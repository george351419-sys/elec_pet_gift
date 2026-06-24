import 'dotenv/config'
import express from 'express'
import { createDoubaoRealtimeRouter } from '../../full-duplex-voice/server/router.ts'
import { memoryRouter } from './memory.ts'

const app = express()
app.use(express.json())

app.use('/api/full-duplex-voice', createDoubaoRealtimeRouter())
app.use('/api/memory', memoryRouter)

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
app.listen(PORT, () => console.log(`server listening on http://localhost:${PORT}`))
