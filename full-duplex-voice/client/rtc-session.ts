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

  // S2S sends both ConversationState (magic: "conv") and Subtitle (magic: "subv")
  // as room binary messages. We need the subtitle ones for transcripts.
  engine.on(sdk.events.onRoomBinaryMessageReceived, (e: any) => {
    const msg = e?.message
    if (!(msg instanceof ArrayBuffer)) return
    const bytes = new Uint8Array(msg)
    if (bytes.length < 8) return

    // 4-byte magic + 4-byte big-endian length + JSON payload
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])
    const len = (bytes[4] << 24) | (bytes[5] << 16) | (bytes[6] << 8) | bytes[7]
    if (len <= 0 || len > bytes.length - 8) return

    const jsonStr = new TextDecoder('utf-8').decode(bytes.slice(8, 8 + len))
    console.log('[rtc-session] ROOM BINARY magic:', magic, 'len:', len, 'json:', jsonStr.slice(0, 200))

    if (magic === 'subv') {
      try {
        const parsed = JSON.parse(jsonStr)
        // Subtitle payload wraps items in a "data" array
        const items: any[] = parsed?.data ?? (Array.isArray(parsed) ? parsed : [parsed])
        for (const item of items) {
          const text = String(item?.text ?? '').trim()
          if (!text) continue
          const role = (item?.userId ?? parsed?.userId ?? e.userId) === remoteUserId
            || (item?.userId ?? parsed?.userId ?? e.userId) === options.session.agentUserId
            ? 'agent' : 'parent'
          console.log('[rtc-session] SUBTITLE:', role, text.slice(0, 80), 'definite:', item.definite, 'seq:', item.sequence, 'paragraph:', item.paragraph)
          options.onTranscript({
            role, content: text,
            final: Boolean(item.definite),
            sequence: Number(item.sequence ?? 0),
          })
        }
      } catch (err) { console.error('[rtc-session] subv parse error:', err) }
    }
  })
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
  console.log('[rtc-session] sdk.events.onSubtitleMessageReceived =', sdk.events.onSubtitleMessageReceived)
  engine.on(sdk.events.onSubtitleStateChanged ?? 'onSubtitleStateChanged', (e: any) => {
    console.log('[rtc-session] subtitle STATE changed:', JSON.stringify(e))
  })
  engine.on(sdk.events.onSubtitleMessageReceived ?? 'onSubtitleMessageReceived', (items: any[]) => {
    console.log('[rtc-session] subtitle event, items:', items?.length, items?.[0])
    for (const item of items || []) {
      const content = String(item?.text || '').trim()
      if (!content) continue
      options.onTranscript({
        role: item.userId === remoteUserId || item.userId === options.session.agentUserId ? 'agent' : 'parent',
        content, final: Boolean(item.definite), sequence: Number(item.sequence || 0),
      })
    }
  })
  engine.on(sdk.events.onAutoplayFailed, () => { if (remoteUserId) attachRemoteTrack(remoteUserId) })
  engine.on(sdk.events.onError, (event: any) => options.onStatus(`RTC 异常：${message(event)}`))

  return {
    async start() {
      try { sdk.setParameter?.('rtc.fg_config', 'aigc_media_360=true') } catch { /* optional vendor flag */ }
      await engine.joinRoom(options.session.token, options.session.roomId, { userId: options.session.userId }, {
        isAutoPublish: false, isAutoSubscribeAudio: true, isAutoSubscribeVideo: false, roomProfileType: RoomProfileType.chatRoom,
      })
      // Don't call startSubtitle — S2S model pushes subtitles through RTC message channel
      // when SubtitleConfig.SubtitleEnabled=true. Client-side startSubtitle requires a
      // separate ASR service configured in the RTC console, which is NOT needed for S2S.
      try {
        console.log('[rtc-session] SKIPPING startSubtitle — S2S model will push subtitles via message channel')
      } catch { /* unreachable */ }
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
