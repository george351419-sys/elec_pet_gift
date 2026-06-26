import { Router } from 'express'

export const memoryRouter = Router()

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

type Turn = { role: string; content: string; final?: boolean }
type FactEntry = { key: string; value: string; updatedAt: number }

async function callDeepSeek(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? ''
  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${text.slice(0, 200)}`)
  const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[] }
  return data.choices?.[0]?.message?.content ?? '{}'
}

// POST /api/memory/extract
// Extracts structured child profile from parent interview transcript
memoryRouter.post('/extract', async (req, res) => {
  const { transcript, existing } = req.body as { transcript: Turn[]; existing?: object }
  console.log('[memory/extract] turns received:', transcript?.length ?? 0)
  if (!transcript?.length) return res.json({ profile: existing ?? {} })

  const dialogue = transcript
    .filter((t) => t.content?.trim())   // keep all turns with content; definite/final flag is unreliable
    .map((t) => `${t.role === 'agent' ? '访谈师' : '家长'}：${t.content}`)
    .join('\n')

  const systemPrompt = `你是信息提取助手。从家长访谈对话中提取孩子的信息，输出严格的 JSON 对象。
字段说明：
- nickname: 孩子昵称（string，无则空字符串）
- age: 年龄（number，不确定则 0）
- personalitySummary: 用1到2句话描述孩子的性格（string，要生动具体，如"活泼开朗、好奇心旺盛，但遇到陌生人会有些害羞"）
- personality: 性格补充标签（string[]，从 [活泼,安静,好奇,敏感,爱笑,粘人,独立,胆大,害羞,温柔,倔强] 中选最符合的，可多选）
- likes: 喜欢的事（string，尽量具体）
- fears: 害怕的事（string）
- comfort: 安抚方式（string）
- memories: 亲子回忆（string，记录家长提到的具体故事或回忆，可较长）
- encouragement: 鼓励方式（string）
- extras: 其他重要信息（string，记录对话中提到的、不属于以上字段但值得记住的细节，如家庭成员、生活习惯、特殊经历等，若无则空字符串）
只输出 JSON，不要解释。已有信息供参考：${JSON.stringify(existing ?? {})}`

  try {
    const raw = await callDeepSeek(systemPrompt, `对话记录：\n${dialogue}`)
    console.log('[memory/extract] DeepSeek raw:', raw.slice(0, 400))
    const profile = JSON.parse(raw) as object
    console.log('[memory/extract] profile keys:', Object.keys(profile))
    res.json({ profile })
  } catch (err) {
    console.error('[memory/extract] error:', err)
    res.json({ profile: existing ?? {} })
  }
})

// POST /api/memory/update
// Extracts facts + compresses conversation after child pet session
memoryRouter.post('/update', async (req, res) => {
  const { transcript, existingFacts, sessionDate } = req.body as {
    transcript: Turn[]
    existingFacts: FactEntry[]
    sessionDate: string
  }
  if (!transcript?.length) return res.json({ updatedFacts: existingFacts ?? [], newSummary: null })

  const dialogue = transcript
    .filter((t) => t.content?.trim())
    .map((t) => `${t.role === 'agent' ? '宠物' : '孩子'}：${t.content}`)
    .join('\n')

  const turnCount = transcript.filter((t) => t.final !== false).length

  const factsPrompt = `从孩子与宠物的对话中提取孩子说出的重要信息（喜好、心愿、害怕的事、开心的事等）。
已有记忆：${JSON.stringify(existingFacts ?? [])}
输出 JSON 对象格式：{"facts": [{"key": "string", "value": "string", "updatedAt": ${Date.now()}}]}
相同 key 做 UPDATE，新内容做 ADD。只输出 JSON。`

  try {
    const factsRaw = await callDeepSeek(factsPrompt, `对话：\n${dialogue}`)
    const factsData = JSON.parse(factsRaw) as { facts?: FactEntry[] }
    const incomingFacts = factsData.facts ?? []

    const map = new Map((existingFacts ?? []).map((f) => [f.key, f]))
    for (const f of incomingFacts) map.set(f.key, f)
    const updatedFacts = Array.from(map.values())

    let newSummary = null
    if (turnCount > 5) {
      const summaryPrompt = `用不超过100字总结以下孩子与宠物的对话，重点记录孩子说了什么重要的事。只输出 JSON：{"summary": "..."}`
      const summaryRaw = await callDeepSeek(summaryPrompt, `对话：\n${dialogue}`)
      const summaryData = JSON.parse(summaryRaw) as { summary?: string }
      if (summaryData.summary) {
        newSummary = { summary: summaryData.summary, sessionDate, turnCount }
      }
    }

    res.json({ updatedFacts, newSummary })
  } catch {
    res.json({ updatedFacts: existingFacts ?? [], newSummary: null })
  }
})
