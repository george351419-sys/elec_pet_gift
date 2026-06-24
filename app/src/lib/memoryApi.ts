import type { FactEntry, ConversationSummary, PetProfile } from './storage'

type TranscriptTurn = { role: string; content: string; final: boolean }

export async function extractProfile(input: {
  transcript: TranscriptTurn[]
  existing?: Partial<PetProfile>
}): Promise<Partial<PetProfile>> {
  const res = await fetch('/api/memory/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) return {}
  const data = await res.json() as { profile?: Partial<PetProfile> }
  return data.profile ?? {}
}

export async function updateMemory(input: {
  transcript: TranscriptTurn[]
  existingFacts: FactEntry[]
  sessionDate: string
}): Promise<{ updatedFacts: FactEntry[]; newSummary: ConversationSummary | null }> {
  try {
    const res = await fetch('/api/memory/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) return { updatedFacts: input.existingFacts, newSummary: null }
    return res.json() as Promise<{ updatedFacts: FactEntry[]; newSummary: ConversationSummary | null }>
  } catch {
    return { updatedFacts: input.existingFacts, newSummary: null }
  }
}
