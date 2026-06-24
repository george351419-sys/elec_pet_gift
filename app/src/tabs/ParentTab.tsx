import { useState, useEffect, useRef } from 'react'
import { FullDuplexVoice } from '@fdv/client'
import type { FullDuplexVoiceHandle, VoiceCompletion, VoiceState, TranscriptTurn } from '@fdv/client'
import { ProfileForm } from '../components/ProfileForm'
import { PetSelector, PET_META } from '../components/PetSelector'
import {
  getProfile, saveProfile, saveRawTranscript, getRawTranscript,
  type PetProfile, type PetType,
} from '../lib/storage'
import { extractProfile } from '../lib/memoryApi'
import './ParentTab.css'

const EMPTY_PROFILE: Partial<PetProfile> = {
  nickname: '', age: 0, personalitySummary: '', personality: [], likes: '', fears: '',
  comfort: '', memories: '', encouragement: '', extras: '', petName: '',
}

export function ParentTab() {
  const fdvRef = useRef<FullDuplexVoiceHandle>(null)
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  // Holds the in-flight extraction promise started when AI says its closing phrase
  const pendingExtractRef = useRef<Promise<Partial<PetProfile>> | null>(null)
  // Mirror of liveTranscript in a ref so effects can read it without stale closure
  const liveTranscriptRef = useRef<TranscriptTurn[]>([])
  // Mirror of draft so the early extraction effect can read it without stale closure
  const draftRef = useRef<Partial<PetProfile>>(EMPTY_PROFILE)

  const saved = getProfile()
  const [interviewOpen, setInterviewOpen] = useState(!saved)
  const [interviewDone, setInterviewDone] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<PetProfile>>(saved ?? EMPTY_PROFILE)
  const [petType, setPetType] = useState<PetType | undefined>(saved?.petType)
  const [saveMsg, setSaveMsg] = useState('')

  const [voiceState, setVoiceState] = useState<VoiceState | null>(null)
  const [liveTranscript, setLiveTranscript] = useState<TranscriptTurn[]>([])
  const [aiReadyToEnd, setAiReadyToEnd] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  // Keep draftRef in sync so effects can access latest value
  useEffect(() => { draftRef.current = draft }, [draft])

  // Detect closing phrase in AI's transcript — check all agent turns, not just final
  // (Doubao subtitle `definite` field may not always be set, so final:true is unreliable)
  useEffect(() => {
    if (aiReadyToEnd) return
    const lastAgent = [...liveTranscript].reverse().find((t) => t.role === 'agent')
    if (lastAgent?.content?.includes('挂断') || lastAgent?.content?.includes('整理档案')) {
      setAiReadyToEnd(true)
    }
  }, [liveTranscript, aiReadyToEnd])

  // As soon as AI signals end, kick off background extraction — so it's ready when user hangs up
  useEffect(() => {
    if (!aiReadyToEnd || pendingExtractRef.current) return
    // Use all content turns — don't filter by final, since definite flag may be missing
    const turns = liveTranscriptRef.current.filter((t) => t.content?.trim())
    if (!turns.length) return
    pendingExtractRef.current = extractProfile({ transcript: turns, existing: draftRef.current })
  }, [aiReadyToEnd])

  // Start / cancel 3-second auto-end countdown
  useEffect(() => {
    if (!aiReadyToEnd || voiceState?.phase !== 'connected') return

    const aiSpeaking = (voiceState.remoteLevel ?? 0) > 0.05
    const userSpeaking = (voiceState.inputLevel ?? 0) > 0.05

    if (aiSpeaking || userSpeaking) {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current)
        countdownInterval.current = null
        setCountdown(null)
      }
      return
    }

    if (!countdownInterval.current) {
      let secs = 3
      setCountdown(secs)
      countdownInterval.current = setInterval(() => {
        secs -= 1
        if (secs <= 0) {
          clearInterval(countdownInterval.current!)
          countdownInterval.current = null
          setCountdown(null)
          fdvRef.current?.end()
        } else {
          setCountdown(secs)
        }
      }, 1000)
    }
  }, [aiReadyToEnd, voiceState?.phase, voiceState?.remoteLevel, voiceState?.inputLevel])

  function stopCountdown() {
    if (countdownInterval.current) { clearInterval(countdownInterval.current); countdownInterval.current = null }
    setCountdown(null)
  }

  function handleTranscript(turn: TranscriptTurn) {
    console.log('[ParentTab] transcript turn:', turn.role, turn.final, turn.content?.slice(0, 30))
    setLiveTranscript((prev) => {
      const copy = [...prev]
      const idx = copy.findIndex((t) => t.role === turn.role && t.sequence === turn.sequence && !t.final)
      if (idx >= 0) copy[idx] = turn
      else copy.push(turn)
      liveTranscriptRef.current = copy
      return copy
    })
  }

  async function handleComplete(result: VoiceCompletion) {
    stopCountdown()
    setAiReadyToEnd(false)

    // Don't rely on final flag — use all content turns as fallback
    const resultFinal: TranscriptTurn[] = result.transcript.filter((t: TranscriptTurn) => t.content?.trim())
    const finalTurns = resultFinal.length > 0
      ? resultFinal
      : liveTranscriptRef.current.filter((t) => t.content?.trim())

    console.log('[ParentTab] handleComplete — result.transcript:', result.transcript.length,
      'liveRef:', liveTranscriptRef.current.length, 'finalTurns:', finalTurns.length)

    saveRawTranscript(finalTurns)
    setInterviewDone(true)
    setInterviewOpen(false)
    setLiveTranscript([])
    liveTranscriptRef.current = []

    if (!finalTurns.length) {
      pendingExtractRef.current = null
      return
    }

    // Use the already-running background extraction if available, otherwise start fresh
    const extractionPromise = pendingExtractRef.current
      ?? extractProfile({ transcript: finalTurns, existing: draftRef.current })

    setExtracting(true)
    setExtractError(null)
    try {
      const extracted = await extractionPromise
      console.log('[ParentTab] extracted profile:', extracted)
      setDraft((prev) => ({ ...prev, ...extracted }))
    } catch (e) {
      console.error('[ParentTab] extractProfile failed:', e)
      setExtractError('AI 整理档案时出了问题，请手动填写。')
    } finally {
      setExtracting(false)
      pendingExtractRef.current = null
    }
  }

  function handleSave() {
    if (!petType) { setSaveMsg('请先选择一只宠物'); return }
    const profile: PetProfile = {
      nickname:           draft.nickname           ?? '',
      age:                draft.age                ?? 0,
      personalitySummary: draft.personalitySummary ?? '',
      personality:        draft.personality        ?? [],
      likes:              draft.likes              ?? '',
      fears:              draft.fears              ?? '',
      comfort:            draft.comfort            ?? '',
      memories:           draft.memories           ?? '',
      encouragement:      draft.encouragement      ?? '',
      extras:             draft.extras             ?? '',
      petName:            draft.petName            ?? PET_META[petType].label,
      petType,
      createdAt:          getProfile()?.createdAt  ?? Date.now(),
      updatedAt:          Date.now(),
    }
    saveProfile(profile)
    setSaveMsg('✓ 已保存')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const rawCount = getRawTranscript().length
  const profileSaved = Boolean(getProfile())

  return (
    <div className="parent-tab">
      {/* 状态摘要行 */}
      <div className="status-bar card">
        <span className="status-icon">{profileSaved ? '✅' : '⏳'}</span>
        <div className="status-text">
          <strong>
            {profileSaved
              ? `${getProfile()!.nickname || '宝贝'} · ${PET_META[getProfile()!.petType]?.label}`
              : '尚未配置'}
          </strong>
          <small>
            {profileSaved
              ? `档案已保存${rawCount ? `，共 ${rawCount} 条访谈记录` : ''}`
              : '请完成语音访谈后保存档案'}
          </small>
        </div>
      </div>

      {/* 访谈区 */}
      {interviewOpen ? (
        <div className="card interview-card">
          {countdown !== null && (
            <div className="auto-end-banner">
              👆 请点击下方红色「结束」按钮挂断&emsp;
              <span className="auto-end-count">{countdown}</span> 秒后自动挂断
            </div>
          )}
          <FullDuplexVoice
            ref={fdvRef}
            mode="parent_onboarding"
            apiBaseUrl="/api/full-duplex-voice"
            className="fdv-light"
            showTranscript={false}
            renderAvatar={() => (
              <div className="interview-avatar"><span>小颖</span></div>
            )}
            onStateChange={setVoiceState}
            onTranscript={handleTranscript}
            onComplete={handleComplete}
          />
        </div>
      ) : (
        <button
          className="btn-secondary full-width"
          onClick={() => {
            setInterviewOpen(true)
            setInterviewDone(false)
            setLiveTranscript([])
            liveTranscriptRef.current = []
            setAiReadyToEnd(false)
            pendingExtractRef.current = null
            stopCountdown()
          }}
        >
          {interviewDone ? '✓ 访谈已结束 — 点击继续补充' : profileSaved ? '继续补充记忆' : '开始语音访谈'}
        </button>
      )}

      {/* 提取中：挂断后等待 AI 整理（通常已提前完成，几乎不显示） */}
      {extracting && (
        <div className="card extract-loading">
          <span className="spinner" />
          <span>AI 正在整理孩子档案…</span>
        </div>
      )}

      {extractError && (
        <p className="extract-error">{extractError}</p>
      )}

      {/* 档案表单 + 宠物选择：对话进行中隐藏 */}
      {(interviewDone || profileSaved) && !extracting && !interviewOpen && (
        <>
          <div className="card">
            <ProfileForm values={draft} onChange={setDraft} />
          </div>

          <div className="card">
            <PetSelector selected={petType} onSelect={setPetType} />
          </div>

          <div className="save-row">
            {saveMsg && <span className="save-msg">{saveMsg}</span>}
            <button
              className="btn-primary full-width"
              disabled={!petType}
              onClick={handleSave}
            >
              保存档案
            </button>
          </div>
        </>
      )}
    </div>
  )
}
