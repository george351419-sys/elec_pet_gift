import { useState, useEffect, useRef } from 'react'
import { FullDuplexVoice } from '@fdv/client'
import type { FullDuplexVoiceHandle, VoiceCompletion, VoiceState, VoiceContext } from '@fdv/client'
import { PetAvatar } from '../components/PetAvatar'
import { getProfile, getFacts, getSummaries, saveFacts, saveSummaries, mergeFacts } from '../lib/storage'
import { updateMemory } from '../lib/memoryApi'
import './PetTab.css'

const SILENCE_TIMEOUT_MS = 5000

function buildContext(): VoiceContext {
  const profile = getProfile()
  const facts = getFacts()
  const summaries = getSummaries().slice(-3)
  return {
    persona: profile ? { ...profile } : null,
    memory: { facts, summaries },
  }
}

export function PetTab() {
  const fdvRef = useRef<FullDuplexVoiceHandle>(null)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [voiceState, setVoiceState] = useState<VoiceState | null>(null)

  // Auto-advance: when check() finishes (phase → 'ready'), immediately call start()
  useEffect(() => {
    if (voiceState?.phase === 'ready') {
      fdvRef.current?.start()
    }
  }, [voiceState?.phase])

  // Auto-hangup: 5 seconds of no user voice input while connected
  useEffect(() => {
    if (voiceState?.phase !== 'connected') {
      clearSilenceTimers()
      return
    }

    const userSpeaking = (voiceState.inputLevel ?? 0) > 0.05
    const petSpeaking = (voiceState.remoteLevel ?? 0) > 0.05

    if (userSpeaking || petSpeaking) {
      clearSilenceTimers()
      return
    }

    // Both silent — start countdown if not already running
    if (!silenceTimer.current) {
      silenceTimer.current = setTimeout(() => {
        clearSilenceTimers()
        fdvRef.current?.end()
      }, SILENCE_TIMEOUT_MS)
    }
  }, [voiceState?.phase, voiceState?.inputLevel, voiceState?.remoteLevel])

  function clearSilenceTimers() {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null }
  }

  const profile = getProfile()
  const isConnected = voiceState?.phase === 'connected'
  const isBusy = voiceState?.phase === 'connecting' || voiceState?.phase === 'checking'
  const remoteLevel = voiceState?.remoteLevel ?? 0

  async function handleComplete(result: VoiceCompletion) {
    clearSilenceTimers()
    const turns = result.transcript.filter((t) => t.content?.trim())
    if (!turns.length) return
    try {
      const { updatedFacts, newSummary } = await updateMemory({
        transcript: turns,
        existingFacts: getFacts(),
        sessionDate: new Date().toLocaleDateString('zh-CN'),
      })
      saveFacts(mergeFacts(getFacts(), updatedFacts))
      if (newSummary) saveSummaries([...getSummaries(), newSummary])
    } catch {
      // memory update is best-effort
    }
  }

  if (!profile) {
    return (
      <div className="pet-tab">
        <div className="pet-empty card">
          <div className="pet-empty-icon">🐾</div>
          <p>等家长来设置～</p>
          <small>请切换到「家长设置」完成访谈和宠物选择</small>
        </div>
      </div>
    )
  }

  return (
    <div className="pet-tab">
      <div className="pet-voice-offscreen" aria-hidden="true">
        <FullDuplexVoice
          ref={fdvRef}
          mode="child_pet"
          apiBaseUrl="/api/full-duplex-voice"
          context={buildContext()}
          showTranscript={false}
          renderAvatar={() => null}
          onStateChange={setVoiceState}
          onComplete={handleComplete}
        />
      </div>

      <div className="pet-stage">
        <PetAvatar
          petType={profile.petType}
          petName={profile.petName || ''}
          remoteLevel={remoteLevel}
          speaking={isConnected && remoteLevel > 0.05}
        />
      </div>

      <div className="pet-controls">
        {isConnected ? (
          <>
            <button className="ctrl-btn secondary" onClick={() => fdvRef.current?.mute()}>
              {voiceState?.muted ? '🎤 开麦' : '🔇 静音'}
            </button>
            <button className="ctrl-btn secondary" onClick={() => fdvRef.current?.interrupt()}>
              ✋ 打断
            </button>
            <button className="ctrl-btn danger" onClick={() => fdvRef.current?.end()}>
              结束
            </button>
          </>
        ) : (
          <button
            className="ctrl-btn primary full-width"
            disabled={isBusy}
            onClick={() => fdvRef.current?.start()}
          >
            {isBusy
              ? `正在唤醒 ${profile.petName || '宠物'}…`
              : voiceState?.phase === 'ended' ? '再次对话' : '开始对话'}
          </button>
        )}
      </div>

      {voiceState?.phase === 'error' && (
        <p className="pet-status pet-status-error">⚠️ {voiceState.status}</p>
      )}
    </div>
  )
}
