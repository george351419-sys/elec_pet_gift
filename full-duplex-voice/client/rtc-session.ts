import VERTCDefault from '@volcengine/rtc'
import { MediaType, RoomProfileType, StreamIndex, SUBTITLE_MODE } from '@volcengine/rtc'
import type { TranscriptTurn, VoiceSession } from './types'

// Default export is the SDK object (createEngine / events / setParameter).
// Enum types are named ESM exports — import them separately above.
const VERTCSdk = VERTCDefault as unknown as RtcSdk

export type RtcEngine = {
  joinRoom: (...args: any[]) => Promise<void>
  leaveRoom: () => Promise<void>
  startAudioCapture: () => Promise<void>
  stopAudioCapture: () => Promise<void>
  publishStream: (mediaType: any) => Promise<void>
  unpublishStream: (mediaType: any) => Promise<void>
  subscribeStream: (userId: string, mediaType: any) => Promise<void>
  play: (userId: string, mediaType: any) => Promise<void>
  setPlaybackVolume: (userId: string, streamIndex: any, volume: number) => void
  getRemoteStreamTrack?: (userId: string, streamIndex: any, kind: string) => MediaStreamTrack | null
  enableAudioPropertiesReport: (options: { interval: number }) => void
  startSubtitle?: (options: object) => Promise<void>
  stopSubtitle?: () => void
  on: (event: any, callback: (event: any) => void) => void
  destroy: () => void
}

export type RtcSdk = {
  createEngine: (appId: string) => RtcEngine
  setParameter?: (key: string, value: string) => void
  events: Record<string, any>
}

type Options = {
  session: VoiceSession
  audioElement: HTMLAudioElement
  onStatus: (status: string) => void
  onDiagnostic: (message: string) => void
  onRemoteLevel: (level: number) => void
  onTranscript: (turn: TranscriptTurn) => void
  onRemoteReady: () => void
  sdk?: RtcSdk
}

export type RtcSessionController = {
  start: () => Promise<void>
  setMuted: (muted: boolean) => Promise<void>
  stop: () => Promise<void>
}

export function createRtcSession(options: Options): RtcSessionController {
  const sdk = options.sdk || VERTCSdk
  const engine = sdk.createEngine(options.session.appId)
  let remoteUserId = options.session.agentUserId
  let stopped = false

  const attachRemoteTrack = (userId: string) => {
    const track = engine.getRemoteStreamTrack?.(userId, StreamIndex.STREAM_INDEX_MAIN, 'audio')
    if (track && (!options.audioElement.srcObject || (options.audioElement.srcObject as MediaStream).getAudioTracks()[0]?.id !== track.id)) {
      options.audioElement.srcObject = new MediaStream([track])
    }
    options.audioElement.autoplay = true
    options.audioElement.muted = false
    options.audioElement.volume = 1
    options.audioElement.play().catch(() => options.onStatus('浏览器拦截了自动播放，请点击页面任意按钮后重试。'))
  }

  const playRemote = async (userId: string) => {
    remoteUserId = userId
    await engine.subscribeStream(userId, MediaType.AUDIO)
    await engine.play(userId, MediaType.AUDIO)
    engine.setPlaybackVolume(userId, StreamIndex.STREAM_INDEX_MAIN, 100)
    attachRemoteTrack(userId)
    options.onRemoteReady()
    options.onStatus('已接入远端声音，可以自然说话。')
  }

  engine.enableAudioPropertiesReport({ interval: 500 })

  // Spy ALL RTC events to find where S2S transcript data arrives
  const origOn = engine.on.bind(engine)
  const spied = new Set<string>()
  const spyEvent = (eventName: string) => {
    if (typeof eventName !== 'string' || spied.has(eventName) || eventName.includes('AudioProperties')) return
    spied.add(eventName)
    origOn(eventName, (...args: any[]) => {
      if (args.length === 0) return
      const payload = args.length === 1 ? args[0] : args
      if (payload === undefined || payload === null) return
      try {
        const str = typeof payload === 'string' ? payload : JSON.stringify(payload)
        if (str.length < 600) console.log('[rtc-spy]', eventName, '→', str.slice(0, 300))
      } catch { /* ignore unserializable events */ }
    })
  }
  for (const key of Object.keys(sdk.events)) spyEvent(sdk.events[key])

  // Helper: parse a TranscriptTurn from any subtitle-like JSON object and deliver it
  const deliverSubtitleItem = (item: any, senderUserId?: string) => {
    const text = String(item?.text ?? item?.content ?? '').trim()
    if (!text) return
    const uid = item?.userId ?? item?.user_id ?? senderUserId ?? ''
    const isAgent = uid === remoteUserId || uid === options.session.agentUserId || uid === ''
    options.onTranscript({
      role: isAgent ? 'agent' : 'parent',
      content: text,
      final: Boolean(item.definite ?? item.isFinal ?? item.is_final ?? false),
      sequence: Number(item.sequence ?? item.seq ?? 0),
    })
  }

  // Path A: RTS subtitle channel (DisableRTSSubtitle: false)
  // S2S agent pushes subtitles via the RTS channel; client receives without calling startSubtitle().
  engine.on(sdk.events.onSubtitleMessageReceived ?? 'onSubtitleMessageReceived', (items: any) => {
    const arr: any[] = Array.isArray(items) ? items : (items ? [items] : [])
    console.log('[rtc-session] onSubtitleMessageReceived fired, count:', arr.length, arr[0])
    for (const item of arr) deliverSubtitleItem(item)
  })

  // Path B: binary message channel (DisableRTSSubtitle: true) - kept as fallback
  const parseBinary = (e: any) => {
    const raw = e?.message ?? e?.data ?? e
    let bytes: Uint8Array
    if (raw instanceof Uint8Array) bytes = raw
    else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw)
    else if (ArrayBuffer.isView(raw)) bytes = new Uint8Array((raw as any).buffer, (raw as any).byteOffset, (raw as any).byteLength)
    else return

    const hex = Array.from(bytes.slice(0, 24)).map((b) => b.toString(16).padStart(2, '0')).join(' ')
    console.log('[rtc-session] binary msg len:', bytes.length, 'hex[0..24]:', hex, 'from:', e?.userId)

    // Strategy 1: magic(4) + uint32BE-len(4) + JSON
    if (bytes.length >= 8) {
      const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
      const len = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]
      if (len > 0 && len <= bytes.length - 8) {
        try {
          const jsonStr = new TextDecoder().decode(bytes.slice(8, 8 + len))
          console.log('[rtc-session] binary magic:', magic, 'json:', jsonStr.slice(0, 200))
          if (magic === 'subv' || magic === 'SUBV') {
            const parsed = JSON.parse(jsonStr)
            const items: any[] = parsed?.data ?? (Array.isArray(parsed) ? parsed : [parsed])
            for (const item of items) deliverSubtitleItem(item, e?.userId)
            return
          }
        } catch { /* try next strategy */ }
      }
    }

    // Strategy 2: raw JSON (no magic header)
    try {
      const jsonStr = new TextDecoder().decode(bytes)
      const parsed = JSON.parse(jsonStr)
      if (parsed?.text || parsed?.data?.[0]?.text) {
        console.log('[rtc-session] binary raw-JSON parsed:', jsonStr.slice(0, 200))
        const items: any[] = parsed?.data ?? [parsed]
        for (const item of items) deliverSubtitleItem(item, e?.userId)
      }
    } catch { /* not JSON */ }
  }

  engine.on(sdk.events.onUserBinaryMessageReceived ?? 'onUserBinaryMessageReceived', parseBinary)
  // Some SDK versions use onRoomBinaryMessageReceived; cover both
  engine.on('onRoomBinaryMessageReceived', parseBinary)

  // Path C: custom / text messages — some SDK versions deliver S2S data here
  const parseMessage = (e: any) => {
    const raw = typeof e === 'string' ? e : (e?.message ?? e?.data ?? '')
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.text || parsed?.data?.[0]?.text) {
        console.log('[rtc-session] onCustomMessage parsed:', String(raw).slice(0, 200))
        const items: any[] = parsed?.data ?? [parsed]
        for (const item of items) deliverSubtitleItem(item, e?.userId)
      }
    } catch { /* not JSON */ }
  }
  engine.on(sdk.events.onUserMessageReceived ?? 'onUserMessageReceived', parseMessage)
  engine.on(sdk.events.onCustomMessage ?? 'onCustomMessage', parseMessage)
  engine.on(sdk.events.onUserPublishStream, (event: any) => {
    if (!(event?.mediaType & MediaType.AUDIO)) return
    void playRemote(event.userId).catch((error) => options.onStatus(`接入远端声音失败：${message(error)}`))
  })
  engine.on(sdk.events.onRemoteAudioFirstFrame, (event: any) => {
    const userId = event?.userId || remoteUserId
    if (userId) attachRemoteTrack(userId)
    options.onRemoteReady()
    options.onStatus('已收到远端声音，可以继续对话。')
  })
  engine.on(sdk.events.onRemoteAudioPropertiesReport, (items: any[]) => {
    const active = (items || []).find((item) => linearVolume(item) > 0)
    options.onRemoteLevel(active ? Math.min(1, linearVolume(active) / 120) : 0)
  })
  engine.on(sdk.events.onSubtitleStateChanged ?? 'onSubtitleStateChanged', (e: any) => {
    console.log('[rtc-session] subtitle STATE changed:', JSON.stringify(e))
  })
  engine.on(sdk.events.onAutoplayFailed, () => { if (remoteUserId) attachRemoteTrack(remoteUserId) })
  engine.on(sdk.events.onError, (event: any) => options.onStatus(`RTC 异常：${message(event)}`))

  return {
    async start() {
      try { sdk.setParameter?.('rtc.fg_config', 'aigc_media_360=true') } catch { /* optional vendor flag */ }
      await engine.joinRoom(options.session.token, options.session.roomId, { userId: options.session.userId }, {
        isAutoPublish: false, isAutoSubscribeAudio: true, isAutoSubscribeVideo: false, roomProfileType: RoomProfileType.chatRoom,
      })
      // startSubtitle() activates the client's subscription to the RTS subtitle channel.
      // Even for S2S (where subtitles are server-pushed), this call is required before
      // onSubtitleMessageReceived fires. Failure is non-fatal — binary channel is the fallback.
      try {
        if (engine.startSubtitle) {
          await engine.startSubtitle({ mode: 0, targetUserId: [options.session.agentUserId] })
          console.log('[rtc-session] startSubtitle OK')
        }
      } catch (err) { console.warn('[rtc-session] startSubtitle failed (non-fatal):', err) }
      await engine.startAudioCapture()
      await engine.publishStream(MediaType.AUDIO)
      options.onDiagnostic('麦克风已发布到 RTC 房间。')
    },
    async setMuted(muted) {
      if (muted) await engine.stopAudioCapture()
      else await engine.startAudioCapture()
    },
    async stop() {
      if (stopped) return
      stopped = true
      engine.stopSubtitle?.()
      await Promise.allSettled([engine.stopAudioCapture(), engine.unpublishStream(MediaType.AUDIO), engine.leaveRoom()])
      options.audioElement.pause()
      options.audioElement.srcObject = null
      try { engine.destroy() } catch { /* SDK may throw _SDKError: disconnect on already-torn-down engine */ }
    },
  }
}

function linearVolume(item: any) {
  return Number(item?.audioPropertiesInfo?.linearVolume || item?.audioPropertiesInfo?.volume || item?.linearVolume || 0)
}
function message(error: any) { return String(error?.message || error?.reason || error?.code || error || '未知错误') }
