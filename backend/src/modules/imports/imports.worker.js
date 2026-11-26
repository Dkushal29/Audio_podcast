import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { safeDownloadToFile, assertSafePublicUrl } from '../../utils/ssrf.js'
import { storage } from '../../utils/storage.js'
import { emitUserEvent } from '../../sockets/index.js'

const execFileAsync = promisify(execFile)
const MAX_CONCURRENT = 2
const MAX_IMPORT_DURATION_SEC = 4 * 3600 // 4 hours
const ACTIVE_STATUSES = [
  'QUEUED',
  'VALIDATING',
  'FETCHING',
  'DOWNLOADING',
  'EXTRACTING',
  'PROCESSING',
  'UPLOADING',
]
let activeWorkers = 0
const tempDir = path.join(os.tmpdir(), 'echospace-imports')

function ensureTempDir() {
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
}

export async function detectAudioFromBytes(filePath) {
  const fd = await fs.promises.open(filePath, 'r')
  try {
    const buf = Buffer.alloc(16)
    const { bytesRead } = await fd.read(buf, 0, 16, 0)
    if (bytesRead < 4) return null

    const a0 = buf.toString('ascii', 0, 4)
    const a4 = buf.toString('ascii', 4, 8)
    const a8 = buf.toString('ascii', 8, 12)

    if (
      buf.toString('ascii', 0, 3) === 'ID3' ||
      (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)
    ) {
      return { ext: '.mp3', mime: 'audio/mpeg' }
    }
    if (a0 === 'RIFF' && a8 === 'WAVE') {
      return { ext: '.wav', mime: 'audio/wav' }
    }
    if (a0 === 'OggS') return { ext: '.ogg', mime: 'audio/ogg' }
    if (a0 === 'fLaC') return { ext: '.flac', mime: 'audio/flac' }
    if (a4 === 'ftyp') return { ext: '.m4a', mime: 'audio/mp4' }
    if (buf[0] === 0xff && (buf[1] & 0xf0) === 0xf0) {
      return { ext: '.aac', mime: 'audio/aac' }
    }
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return { ext: '.webm', mime: 'audio/webm' }
    }
    return null
  } finally {
    await fd.close()
  }
}

async function probeMediaWithFfprobe(filePath) {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration,format_name:format_tags=title,artist:stream=codec_type,codec_name',
        '-of',
        'json',
        filePath,
      ],
      { timeout: 15000 }
    )
    const parsed = JSON.parse(stdout || '{}')
    const streams = Array.isArray(parsed.streams) ? parsed.streams : []
    const audioStream = streams.find((s) => s.codec_type === 'audio')
    const videoStream = streams.find((s) => s.codec_type === 'video')
    const rawDur = parseFloat(parsed.format?.duration || '0')
    return {
      available: true,
      hasAudio: Boolean(audioStream),
      hasVideo: Boolean(videoStream),
      audioCodec: audioStream?.codec_name || null,
      duration: Number.isFinite(rawDur) && rawDur > 0 ? Math.round(rawDur) : 0,
      title: parsed.format?.tags?.title || null,
      artist: parsed.format?.tags?.artist || null,
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { available: false }
    }
    return { available: true, hasAudio: false, error: err.message }
  }
}

async function extractAudioWithFfmpeg(inputPath, outputPath) {
  try {
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-i',
        inputPath,
        '-vn',
        '-map',
        '0:a:0',
        '-acodec',
        'libmp3lame',
        '-b:a',
        '192k',
        outputPath,
      ],
      { timeout: 180000 }
    )
  } catch (err) {
    if (err.code === 'ENOENT') {
      const e = new Error(
        'Video-to-audio extraction requires FFmpeg on the server.'
      )
      e.code = 'FFMPEG_UNAVAILABLE'
      throw e
    }
    throw err
  }
}

async function isJobCancelled(jobId) {
  const row = await prisma.importJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  })
  return !row || row.status === 'CANCELLED'
}

async function updateJobStage(jobId, userId, data) {
  const updated = await prisma.importJob
    .update({ where: { id: jobId }, data })
    .catch(() => null)
  if (updated && userId) {
    emitUserEvent(userId, 'import:updated', { job: updated })
  }
  return updated
}

async function processJob(job) {
  ensureTempDir()
  const rawTempPath = path.join(tempDir, `${uuidv4()}.tmp`)
  const transcodeTempPath = path.join(tempDir, `${uuidv4()}.mp3`)

  try {
    if (await isJobCancelled(job.id)) return

    // Stage 1: VALIDATING
    await updateJobStage(job.id, job.userId, {
      status: 'VALIDATING',
      progress: 5,
      error: null,
    })
    await assertSafePublicUrl(job.sourceUrl)

    if (await isJobCancelled(job.id)) return

    // Stage 2: FETCHING -> DOWNLOADING
    await updateJobStage(job.id, job.userId, {
      status: 'FETCHING',
      progress: 10,
    })

    let lastPct = 12
    await updateJobStage(job.id, job.userId, {
      status: 'DOWNLOADING',
      progress: 12,
    })
    const { cancelled, downloaded } = await safeDownloadToFile(
      job.sourceUrl,
      rawTempPath,
      {
        maxBytes: env.maxFileSizeBytes,
        timeoutMs: 45000,
        validateAudio: true,
        shouldCancel: () => isJobCancelled(job.id),
        onProgress: async (bytes, total) => {
          const pct = Math.min(68, 12 + Math.round((bytes / total) * 56))
          if (pct - lastPct >= 10) {
            lastPct = pct
            await updateJobStage(job.id, job.userId, { progress: pct })
          }
        },
      }
    )

    if (cancelled || (await isJobCancelled(job.id))) return

    // Stage 3: PROCESSING / EXTRACTING
    let detected = await detectAudioFromBytes(rawTempPath)
    const probe = await probeMediaWithFfprobe(rawTempPath)

    if (probe.available && !probe.hasAudio && !detected) {
      throw new Error(
        'The remote file does not contain a valid playable audio stream.'
      )
    }

    let finalPath = rawTempPath
    let finalSize = downloaded

    const needsVideoExtraction =
      job.sourceKind === 'DIRECT_VIDEO' ||
      (probe.available && probe.hasAudio && (probe.hasVideo || !detected))

    if (needsVideoExtraction) {
      await updateJobStage(job.id, job.userId, {
        status: 'EXTRACTING',
        progress: 72,
      })
      await extractAudioWithFfmpeg(rawTempPath, transcodeTempPath)
      const stat = await fs.promises.stat(transcodeTempPath)
      finalPath = transcodeTempPath
      finalSize = stat.size
      detected = { ext: '.mp3', mime: 'audio/mpeg' }
    } else {
      await updateJobStage(job.id, job.userId, {
        status: 'PROCESSING',
        progress: 76,
      })
    }

    if (!detected) {
      const err = new Error(
        'The retrieved file is not a supported audio format. Supported formats: MP3, WAV, M4A, OGG, FLAC, AAC and WebM.'
      )
      err.code = 'INVALID_AUDIO_FORMAT'
      throw err
    }

    const metaDuration = Number(job.metadata?.duration || 0)
    const duration = probe.duration > 0 ? probe.duration : metaDuration

    if (duration > MAX_IMPORT_DURATION_SEC) {
      throw new Error('Audio duration exceeds the 4-hour import limit.')
    }

    if (await isJobCancelled(job.id)) return

    // Stage 4: UPLOADING to persistent storage
    await updateJobStage(job.id, job.userId, {
      status: 'UPLOADING',
      progress: 88,
    })

    const targetKey = `${uuidv4()}${detected.ext}`
    await storage.saveLocalFile(finalPath, targetKey, detected.mime)

    if (await isJobCancelled(job.id)) {
      await storage.remove(targetKey).catch(() => {})
      return
    }

    const resolvedTitle =
      job.title && job.title !== 'Imported Audio'
        ? job.title
        : probe.title || job.title || 'Imported Audio'

    const episode = await prisma.episode.create({
      data: {
        workspaceId: job.workspaceId,
        uploaderId: job.userId,
        title: resolvedTitle.slice(0, 200),
        description:
          job.metadata?.description ||
          `Imported from ${new URL(job.sourceUrl).hostname}`,
        sourceType: 'UPLOAD',
        sourceUrl: job.sourceUrl,
        audioKey: targetKey,
        mimeType: detected.mime,
        fileSize: finalSize,
        duration,
        tags: Array.isArray(job.metadata?.tags) ? job.metadata.tags : [],
      },
    })

    // Stage 5: COMPLETED
    await updateJobStage(job.id, job.userId, {
      status: 'COMPLETED',
      progress: 100,
      episodeId: episode.id,
    })
  } catch (err) {
    const cancelledNow = await isJobCancelled(job.id).catch(() => false)
    if (!cancelledNow) {
      const nonRetryableCodes = new Set([
        'UNSUPPORTED_WEBPAGE',
        'UNSUPPORTED_STREAMING_SOURCE',
        'INVALID_AUDIO_FORMAT',
        'RSS_FEED_DETECTED',
        'FILE_TOO_LARGE',
        'SSRF_BLOCKED',
      ])
      const retryable = !nonRetryableCodes.has(err.code)
      const nextMeta = {
        ...(job.metadata && typeof job.metadata === 'object' ? job.metadata : {}),
        errorCode: err.code || 'IMPORT_FAILED',
        retryable,
      }
      await updateJobStage(job.id, job.userId, {
        status: 'FAILED',
        error: err.message || 'Import failed.',
        metadata: nextMeta,
      })
    }
  } finally {
    await fs.promises.unlink(rawTempPath).catch(() => {})
    await fs.promises.unlink(transcodeTempPath).catch(() => {})
  }
}

export async function drainImportQueue() {
  if (activeWorkers >= MAX_CONCURRENT) return

  while (activeWorkers < MAX_CONCURRENT) {
    const candidate = await prisma.importJob.findFirst({
      where: { status: 'QUEUED' },
      orderBy: { createdAt: 'asc' },
    })
    if (!candidate) break

    // Atomic claim prevents duplicate execution across concurrent drain calls
    const claimed = await prisma.importJob.updateMany({
      where: { id: candidate.id, status: 'QUEUED' },
      data: { status: 'VALIDATING', progress: 5, error: null },
    })
    if (claimed.count === 0) continue

    activeWorkers += 1
    processJob(candidate).finally(() => {
      activeWorkers -= 1
      drainImportQueue().catch(() => {})
    })
  }
}

export async function recoverImportJobs() {
  await prisma.importJob.updateMany({
    where: {
      status: { in: ACTIVE_STATUSES.filter((s) => s !== 'QUEUED') },
    },
    data: { status: 'QUEUED', progress: 0 },
  })
  await drainImportQueue()
}
