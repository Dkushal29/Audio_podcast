import { prisma } from './config/prisma.js'
import {
  drainImportQueue,
  recoverImportJobs,
} from './modules/imports/imports.worker.js'
import {
  drainTranscriptionQueue,
  recoverTranscriptionJobs,
} from './modules/transcriptions/transcriptions.worker.js'

const POLL_INTERVAL_MS = 4000
let stopping = false

async function tick() {
  if (stopping) return
  await drainImportQueue().catch((err) =>
    console.error('[Worker] Import queue error:', err.message)
  )
  await drainTranscriptionQueue().catch((err) =>
    console.error('[Worker] Transcription queue error:', err.message)
  )
}

async function start() {
  console.log('[EchoSpace Worker] Starting background worker...')
  await recoverImportJobs().catch((err) =>
    console.error('[Worker] Import recovery error:', err.message)
  )
  await recoverTranscriptionJobs().catch((err) =>
    console.error('[Worker] Transcription recovery error:', err.message)
  )

  const timer = setInterval(tick, POLL_INTERVAL_MS)

  const shutdown = async (signal) => {
    if (stopping) return
    stopping = true
    console.log(`[EchoSpace Worker] Received ${signal}. Shutting down...`)
    clearInterval(timer)
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start()
