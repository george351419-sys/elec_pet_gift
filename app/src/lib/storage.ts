export type PetType = 'british_shorthair' | 'american_shorthair' | 'teddy' | 'shiba' | 'golden'

export type PetProfile = {
  nickname: string
  age: number
  personalitySummary: string   // AI generated descriptive text
  personality: string[]        // supplementary tags added by parent
  likes: string
  fears: string
  comfort: string
  memories: string
  encouragement: string
  extras: string               // other important info from interview
  petName: string
  petType: PetType
  createdAt: number
  updatedAt: number
}

export type FactEntry = {
  key: string
  value: string
  updatedAt: number
}

export type ConversationSummary = {
  summary: string
  sessionDate: string
  turnCount: number
}

const KEYS = {
  profile: 'magic_pet_profile',
  rawTranscript: 'magic_pet_raw_transcript',
  facts: 'magic_pet_facts',
  summaries: 'magic_pet_summaries',
} as const

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getProfile(): PetProfile | null {
  return read<PetProfile>(KEYS.profile)
}

export function saveProfile(profile: PetProfile): void {
  write(KEYS.profile, { ...profile, updatedAt: Date.now() })
}

export function getRawTranscript(): unknown[] {
  return read<unknown[]>(KEYS.rawTranscript) ?? []
}

export function saveRawTranscript(turns: unknown[]): void {
  write(KEYS.rawTranscript, turns)
}

export function getFacts(): FactEntry[] {
  return read<FactEntry[]>(KEYS.facts) ?? []
}

export function saveFacts(facts: FactEntry[]): void {
  write(KEYS.facts, facts)
}

export function getSummaries(): ConversationSummary[] {
  return read<ConversationSummary[]>(KEYS.summaries) ?? []
}

export function saveSummaries(summaries: ConversationSummary[]): void {
  // Keep at most 20 entries
  write(KEYS.summaries, summaries.slice(-20))
}

export function mergeFacts(existing: FactEntry[], incoming: FactEntry[]): FactEntry[] {
  const map = new Map(existing.map((f) => [f.key, f]))
  for (const f of incoming) map.set(f.key, f)
  return Array.from(map.values())
}
