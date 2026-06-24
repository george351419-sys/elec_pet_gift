import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react'
import { createVoiceSession, getVoiceStatus, interruptVoiceSession, startVoiceSession, stopVoiceSession } from './api'
import { createRtcSession, type RtcSessionController } from './rtc-session'
import type { TranscriptTurn, VoiceCompletion, VoiceContext, VoiceMode, VoiceProfile, VoiceState } from './types'
import './styles.css'

export interface FullDuplexVoiceHandle {
  start: () => void
  end: () => void
  mute: () => void
  interrupt: () => void
}

export type FullDuplexVoiceProps = {
  mode: VoiceMode
  context?: VoiceContext
  apiBaseUrl?: string
  voiceProfile?: VoiceProfile
  title?: string
  className?: string
  showTranscript?: boolean  // show running transcript below the controls (default: true)
  renderAvatar?: (state: VoiceState) => ReactNode
  onTranscript?: (turn: TranscriptTurn) => void
  onStateChange?: (state: VoiceState) => void
  onComplete?: (result: VoiceCompletion) => void | Promise<void>
}

const initialState: VoiceState = { phase: 'idle', status: '准备连接豆包实时语音', muted: false, inputLevel: 0, remoteLevel: 0, elapsedSeconds: 0, diagnostics: [] }

export const FullDuplexVoice = forwardRef<FullDuplexVoiceHandle, FullDuplexVoiceProps>(function FullDuplexVoice({
  mode, context = {}, apiBaseUrl = '/api/full-duplex-voice', voiceProfile = 'official_o', title,
  showTranscript = true,
  className = '', renderAvatar, onTranscript, onStateChange, onComplete,
}: FullDuplexVoiceProps, ref) {
  const [state, setState] = useState<VoiceState>(initialState)
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const sessionRef = useRef<Awaited<ReturnType<typeof createVoiceSession>> | null>(null)
  const rtcRef = useRef<RtcSessionController | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserCleanupRef = useRef<(() => void) | null>(null)
  const turnsRef = useRef<TranscriptTurn[]>([])

  const label = title || (mode === 'parent_onboarding' ? '实时语音访谈' : '实时语音陪伴')
  const update = (next: Partial<VoiceState>) => setState((previous) => ({ ...previous, ...next }))
  const addDiagnostic = (line: string) => setState((previous) => ({ ...previous, diagnostics: [...previous.diagnostics.slice(-7), line] }))

  useEffect(() => { onStateChange?.(state) }, [onStateChange, state])
  useEffect(() => () => { void teardown(false) }, [])
  useEffect(() => {
    if (state.phase !== 'connected') return
    const timer = window.setInterval(() => update({ elapsedSeconds: state.elapsedSeconds + 1 }), 1000)
    return () => window.clearInterval(timer)
  }, [state.elapsedSeconds, state.phase])

  async function check() {
    if (state.phase === 'checking' || state.phase === 'connecting') return
    update({ phase: 'checking', status: '正在检查实时语音通路…' })
    try {
      if (!window.isSecureContext) throw new Error('请使用 HTTPS 或 localhost 打开页面，浏览器才允许麦克风。')
      const status = await getVoiceStatus(apiBaseUrl)
      if (!status.realtimeReady) throw new Error(`豆包配置不完整：${status.missing.join('、')}`)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      streamRef.current = stream
      startInputMeter(stream)
      update({ phase: 'ready', status: '语音通路已通过，可以开始对话。' })
    } catch (error: any) {
      update({ phase: 'error', status: readableError(error) })
    }
  }

  async function start() {
    if (state.phase === 'connecting' || state.phase === 'connected') return
    update({ phase: 'connecting', status: '正在加入实时语音房间…', elapsedSeconds: 0 })
    setTurns([]); turnsRef.current = []
    try {
      if (!streamRef.current) await check()
      if (!streamRef.current || !audioRef.current) throw new Error('麦克风或音频播放器未准备好。')
      const session = await createVoiceSession({ baseUrl: apiBaseUrl, mode, voiceProfile })
      sessionRef.current = session
      rtcRef.current = createRtcSession({
        session, audioElement: audioRef.current,
        onStatus: (status) => update({ status }), onDiagnostic: addDiagnostic,
        onRemoteLevel: (remoteLevel) => update({ remoteLevel }), onRemoteReady: () => addDiagnostic('已订阅远端音频。'),
        onTranscript: receiveTurn,
      })
      await rtcRef.current.start()
      await startVoiceSession({ baseUrl: apiBaseUrl, session, mode, context })
      update({ phase: 'connected', status: '已连接，直接说话即可。' })
    } catch (error: any) {
      // Clean up partial resources but stay in 'error' phase so the message is visible
      await rtcRef.current?.stop().catch(() => {})
      rtcRef.current = null
      if (sessionRef.current) stopVoiceSession(apiBaseUrl, sessionRef.current).catch(() => {})
      sessionRef.current = null
      update({ phase: 'error', status: readableError(error), inputLevel: 0, remoteLevel: 0, muted: false })
    }
  }

  function receiveTurn(turn: TranscriptTurn) {
    const adjusted: TranscriptTurn = { ...turn, role: turn.role === 'parent' && mode === 'child_pet' ? 'child' : turn.role }
    turnsRef.current = mergeTurn(turnsRef.current, adjusted)
    setTurns(turnsRef.current.slice(-12))
    onTranscript?.(adjusted)
  }

  async function toggleMute() {
    const muted = !state.muted
    await rtcRef.current?.setMuted(muted)
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !muted })
    update({ muted, status: muted ? '麦克风已静音。' : '麦克风已打开。' })
  }

  async function interrupt() {
    if (sessionRef.current) await interruptVoiceSession(apiBaseUrl, sessionRef.current).catch((error) => addDiagnostic(`打断请求失败：${readableError(error)}`))
    update({ status: '已打断，继续说就好。' })
  }

  async function end() {
    const session = sessionRef.current
    // Deduplicate by (role, sequence), preferring final versions.
    // Don't filter-out non-final turns — Doubao's `definite` flag is unreliable.
    const turnMap = new Map<string, TranscriptTurn>()
    for (const t of turnsRef.current) {
      const key = `${t.role}-${t.sequence}`
      if (!turnMap.has(key) || t.final) turnMap.set(key, t)
    }
    const transcript = Array.from(turnMap.values()).filter((t) => t.content?.trim())
    const result = session ? { session, mode, transcript, durationSeconds: state.elapsedSeconds } : null
    try {
      await teardown(true)
    } catch {
      // teardown threw (e.g. SDK disconnect error) — still mark as ended and fire onComplete
      update({ phase: 'ended', muted: false, inputLevel: 0, remoteLevel: 0, status: '实时语音已结束。' })
    }
    if (result) await onComplete?.(result)
  }

  async function teardown(remote: boolean) {
    const session = sessionRef.current
    if (remote && session) await stopVoiceSession(apiBaseUrl, session).catch(() => {})
    await rtcRef.current?.stop().catch(() => {})
    rtcRef.current = null
    analyserCleanupRef.current?.(); analyserCleanupRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null
    sessionRef.current = null
    update({ phase: 'ended', muted: false, inputLevel: 0, remoteLevel: 0, status: '实时语音已结束。' })
  }

  function startInputMeter(stream: MediaStream) {
    analyserCleanupRef.current?.()
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser(); analyser.fftSize = 256
    audioContext.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.frequencyBinCount)
    let frame = 0
    const tick = () => { analyser.getByteFrequencyData(samples); update({ inputLevel: Math.min(1, samples.reduce((sum, value) => sum + value, 0) / samples.length / 96) }); frame = requestAnimationFrame(tick) }
    tick()
    analyserCleanupRef.current = () => { cancelAnimationFrame(frame); void audioContext.close() }
  }

  useImperativeHandle(ref, () => ({
    start: () => { void (state.phase === 'ready' ? start() : check()) },
    end: () => { void end() },
    mute: () => { void toggleMute() },
    interrupt: () => { void interrupt() },
  }))

  const avatar = useMemo(() => renderAvatar?.(state) || <div className="fdv-orb" style={{ transform: `scale(${1 + Math.max(state.inputLevel, state.remoteLevel) * .15})` }}>声</div>, [renderAvatar, state])
  const canStart = state.phase === 'ready' || state.phase === 'idle' || state.phase === 'error' || state.phase === 'ended'

  return <section className={`fdv ${className}`} aria-label={label}>
    <audio ref={audioRef} autoPlay playsInline />
    <header className="fdv-header"><div><small>{mode === 'parent_onboarding' ? '家长访谈' : '儿童陪伴'}</small><h2>{label}</h2></div><time>{formatDuration(state.elapsedSeconds)}</time></header>
    <div className="fdv-stage">
      <div className="fdv-meter"><span style={{ width: `${Math.max(5, state.inputLevel * 100)}%` }} /></div>
      <div className="fdv-avatar">{avatar}</div>
      <p>{state.status}</p>
    </div>
    <div className="fdv-actions">
      {canStart && <button onClick={() => void (state.phase === 'ready' ? start() : check())}>{state.phase === 'ready' ? '开始实时对话' : '检查语音通路'}</button>}
      {state.phase === 'connected' && <><button onClick={() => void toggleMute()}>{state.muted ? '打开麦克风' : '静音'}</button><button onClick={() => void interrupt()}>打断</button><button className="fdv-danger" onClick={() => void end()}>结束</button></>}
    </div>
    {showTranscript && <ol className="fdv-transcript" aria-live="polite">{turns.map((turn, index) => <li key={`${turn.role}-${turn.sequence}-${index}`} className={turn.role}><b>{turn.role === 'agent' ? '助手' : turn.role === 'child' ? '孩子' : '家长'}</b>{turn.content}</li>)}</ol>}
  </section>
})

function mergeTurn(turns: TranscriptTurn[], next: TranscriptTurn) {
  const copy = [...turns]
  const index = copy.findIndex((turn) => turn.role === next.role && turn.sequence === next.sequence && !turn.final)
  if (index >= 0) copy[index] = next
  else copy.push(next)
  return copy.slice(-80)
}
function formatDuration(total: number) { return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` }
function readableError(error: any) {
  if (error?.name === 'NotAllowedError') return '麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。'
  if (error?.name === 'NotFoundError') return '没有找到可用麦克风。'
  return String(error?.message || error || '实时语音连接失败。')
}
