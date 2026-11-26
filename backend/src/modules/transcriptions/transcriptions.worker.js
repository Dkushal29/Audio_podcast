import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../../config/prisma.js'
import { storage } from '../../utils/storage.js'
import { transcribeAudioFile } from '../../services/deepgram.service.js'
import { emitEpisodeEvent } from '../../sockets/index.js'

const execFileAsync = promisify(execFile)
const MAX_CONCURRENT = 2
let activeWorkers = 0
const tempDir = path.join(os.tmpdir(), 'echospace-transcriptions')

function ensureTempDir() {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
}

async function isCancelled(transcriptId) {
  const row = await prisma.transcript.findUnique({
    where: { id: transcriptId },
    select: { status: true },
  })
  return !row || row.status === 'CANCELLED'
}

async function emitTranscriptUpdate(transcript) {
  if (!transcript) return
  emitEpisodeEvent(transcript.episodeId, 'transcription:updated', {
    transcript,
  })
}

async function processTranscriptionJob(job) {
  ensureTempDir()
  let episode
  try {
    episode = await prisma.episode.findUnique({
      where: { id: job.episodeId },
    })
  } catch (err) {
    console.error('[TranscriptionWorker] DB lookup error:', err.message)
    return
  }

  if (!episode || episode.deletedAt || !episode.audioKey) {
    const failed = await prisma.transcript
      .update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: 'Audio asset is missing or unavailable for transcription.',
        },
      })
      .catch(() => null)
    await emitTranscriptUpdate(failed)
    return
  }

  const ext = path.extname(episode.audioKey) || '.mp3'
  const tempPath = path.join(tempDir, `${uuidv4()}${ext}`)
  const wavTempPath = path.join(tempDir, `${uuidv4()}.mp3`)

  try {
    if (await isCancelled(job.id)) return

    await storage.downloadToFile(episode.audioKey, tempPath)
    if (await isCancelled(job.id)) return

    let sourcePath = tempPath
    let sourceMime = episode.mimeType || 'audio/mpeg'

    // Validate/convert only if FFmpeg is present and format is uncommon
    if (ext === '.webm') {
      try {
        await execFileAsync(
          'ffmpeg',
          ['-y', '-i', tempPath, '-vn', '-c:a', 'libmp3lame', '-q:a', '2', wavTempPath],
          { timeout: 120000 }
        )
        sourcePath = wavTempPath
        sourceMime = 'audio/mpeg'
      } catch {
        // Fallback to sending original stream if ffmpeg is unavailable
      }
    }

    const result = await transcribeAudioFile(
      sourcePath,
      sourceMime,
      job.settings || {}
    )

    if (await isCancelled(job.id)) return

    const completed = await prisma.transcript.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        fullText: result.fullText,
        segments: result.segments,
        confidence: result.confidence,
        detectedLanguage: result.detectedLanguage,
        error: null,
        completedAt: new Date(),
      },
    })
    await emitTranscriptUpdate(completed)
  } catch (err) {
    const cancelledNow = await isCancelled(job.id).catch(() => false)
    if (!cancelledNow) {
      const failed = await prisma.transcript
        .update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: err.message || 'Transcription failed.',
          },
        })
        .catch(() => null)
      await emitTranscriptUpdate(failed)
    }
  } finally {
    await fs.promises.unlink(tempPath).catch(() => {})
    await fs.promises.unlink(wavTempPath).catch(() => {})
  }
}

export async function drainTranscriptionQueue() {
  if (activeWorkers >= MAX_CONCURRENT) return

  while (activeWorkers < MAX_CONCURRENT) {
    const candidate = await prisma.transcript.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    })
    if (!candidate) break

    const claimed = await prisma.transcript.updateMany({
      where: { id: candidate.id, status: 'QUEUED' },
      data: { status: 'PROCESSING', error: null },
    })
    if (claimed.count === 0) continue

    const processingRow = await prisma.transcript.findUnique({
      where: { id: candidate.id },
    })
    await emitTranscriptUpdate(processingRow)

    activeWorkers += 1
    processTranscriptionJob(candidate).finally(() => {
      activeWorkers -= 1
      drainTranscriptionQueue().catch(() => {})
    })
  }
}

export async function recoverTranscriptionJobs() {
  await prisma.transcript.updateMany({
    where: { status: 'PROCESSING' },
    data: { status: 'QUEUED' },
  })
  await drainTranscriptionQueue()
}
