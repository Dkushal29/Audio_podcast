import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  ALL_ROLES,
  assertEpisodeMember,
  MANAGE_ROLES,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import { drainTranscriptionQueue } from './transcriptions.worker.js'
import { emitEpisodeEvent } from '../../sockets/index.js'

const MAX_RETRIES = 3

export const requestTranscriptionSchema = z.object({
  language: z.string().max(20).optional().default('auto'),
  diarize: z.boolean().optional().default(true),
  smartFormat: z.boolean().optional().default(true),
  punctuate: z.boolean().optional().default(true),
  paragraphs: z.boolean().optional().default(true),
  force: z.boolean().optional().default(false),
})

export const updateSpeakersSchema = z.object({
  speakers: z.record(z.string(), z.string().min(1).max(80)),
})

export const requestTranscription = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  const { episode } = await assertEpisodeMember(
    episodeId,
    req.user.id,
    WRITE_ROLES
  )

  if (!episode.audioKey) {
    throw new AppError(
      400,
      'External media links without stored audio cannot be transcribed directly.',
      'NO_STORED_AUDIO'
    )
  }

  const body = req.body || {}
  const existing = await prisma.transcript.findUnique({
    where: { episodeId: episode.id },
  })

  if (existing) {
    if (['QUEUED', 'PROCESSING'].includes(existing.status)) {
      return res.status(200).json({ transcript: existing, deduplicated: true })
    }
    if (existing.status === 'COMPLETED' && !body.force) {
      return res.status(200).json({ transcript: existing, deduplicated: true })
    }
  }

  const settings = {
    model: env.deepgramModel || 'nova-2',
    language: body.language || 'auto',
    diarize: body.diarize !== false,
    smartFormat: body.smartFormat !== false,
    punctuate: body.punctuate !== false,
    paragraphs: body.paragraphs !== false,
  }

  const transcript = existing
    ? await prisma.transcript.update({
        where: { id: existing.id },
        data: {
          status: 'QUEUED',
          error: null,
          language: settings.language,
          model: settings.model,
          settings,
          requestedById: req.user.id,
        },
      })
    : await prisma.transcript.create({
        data: {
          episodeId: episode.id,
          workspaceId: episode.workspaceId,
          requestedById: req.user.id,
          provider: 'deepgram',
          model: settings.model,
          language: settings.language,
          status: 'QUEUED',
          settings,
        },
      })

  emitEpisodeEvent(episode.id, 'transcription:updated', { transcript })
  drainTranscriptionQueue().catch(() => {})
  res.status(202).json({ transcript })
})

export const getTranscription = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  await assertEpisodeMember(episodeId, req.user.id, ALL_ROLES)

  const transcript = await prisma.transcript.findUnique({
    where: { episodeId },
  })
  res.json({ transcript: transcript || null })
})

export const getTranscriptionStatus = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  await assertEpisodeMember(episodeId, req.user.id, ALL_ROLES)

  const transcript = await prisma.transcript.findUnique({
    where: { episodeId },
    select: {
      id: true,
      episodeId: true,
      status: true,
      provider: true,
      model: true,
      language: true,
      detectedLanguage: true,
      confidence: true,
      error: true,
      retryCount: true,
      createdAt: true,
      completedAt: true,
    },
  })
  res.json({ status: transcript || null })
})

export const searchTranscription = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  await assertEpisodeMember(episodeId, req.user.id, ALL_ROLES)

  const q = String(req.query.q || '').trim().toLowerCase()
  const transcript = await prisma.transcript.findUnique({
    where: { episodeId },
    select: { status: true, segments: true, speakers: true },
  })

  if (!transcript || transcript.status !== 'COMPLETED') {
    return res.json({ matches: [] })
  }

  const segments = Array.isArray(transcript.segments) ? transcript.segments : []
  if (!q) return res.json({ matches: segments })

  const matches = segments.filter((seg) =>
    String(seg.text || '').toLowerCase().includes(q)
  )
  res.json({ matches })
})

export const retryTranscription = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  await assertEpisodeMember(episodeId, req.user.id, WRITE_ROLES)

  const existing = await prisma.transcript.findUnique({
    where: { episodeId },
  })
  if (!existing) {
    throw new AppError(404, 'Transcript not found.', 'NOT_FOUND')
  }
  if (existing.retryCount >= MAX_RETRIES) {
    throw new AppError(
      400,
      `Maximum transcription retries (${MAX_RETRIES}) reached.`,
      'MAX_RETRIES_EXCEEDED'
    )
  }

  const transcript = await prisma.transcript.update({
    where: { id: existing.id },
    data: {
      status: 'QUEUED',
      error: null,
      retryCount: { increment: 1 },
    },
  })

  emitEpisodeEvent(episodeId, 'transcription:updated', { transcript })
  drainTranscriptionQueue().catch(() => {})
  res.json({ transcript })
})

export const cancelTranscription = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  await assertEpisodeMember(episodeId, req.user.id, WRITE_ROLES)

  const existing = await prisma.transcript.findUnique({
    where: { episodeId },
  })
  if (!existing) {
    throw new AppError(404, 'Transcript not found.', 'NOT_FOUND')
  }

  const transcript = await prisma.transcript.update({
    where: { id: existing.id },
    data: { status: 'CANCELLED' },
  })

  emitEpisodeEvent(episodeId, 'transcription:updated', { transcript })
  res.json({ transcript })
})

export const updateSpeakerLabels = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  await assertEpisodeMember(episodeId, req.user.id, WRITE_ROLES)

  const existing = await prisma.transcript.findUnique({
    where: { episodeId },
  })
  if (!existing) {
    throw new AppError(404, 'Transcript not found.', 'NOT_FOUND')
  }

  const transcript = await prisma.transcript.update({
    where: { id: existing.id },
    data: { speakers: req.body.speakers },
  })
  emitEpisodeEvent(episodeId, 'transcription:updated', { transcript })
  res.json({ transcript })
})

export const deleteTranscription = asyncHandler(async (req, res) => {
  const episodeId = req.params.episodeId || req.params.audioId
  const { membership } = await assertEpisodeMember(
    episodeId,
    req.user.id,
    ALL_ROLES
  )

  const existing = await prisma.transcript.findUnique({
    where: { episodeId },
  })
  if (!existing) {
    throw new AppError(404, 'Transcript not found.', 'NOT_FOUND')
  }

  const isManager = MANAGE_ROLES.includes(membership.role)
  if (!isManager && existing.requestedById !== req.user.id) {
    throw new AppError(
      403,
      'You do not have permission to delete this transcript.',
      'FORBIDDEN'
    )
  }

  await prisma.transcript.delete({ where: { id: existing.id } })
  emitEpisodeEvent(episodeId, 'transcription:deleted', { episodeId })
  res.status(204).end()
})
