import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), '.env') })

import express from 'express'
import { createDoubaoRealtimeRouter } from '../../full-duplex-voice/server/router.ts'
import { memoryRouter } from './memory.ts'

const app = express()
app.use(express.json())

app.use('/api/full-duplex-voice', createDoubaoRealtimeRouter())
app.use('/api/memory', memoryRouter)

app.get('/api/health', (_req, res) => res.json({ ok: true }))

// Only listen when running locally (not on Vercel serverless)
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV
if (!isVercel) {
  const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
  app.listen(PORT, () => console.log(`server listening on http://localhost:${PORT}`))
}

export default app
