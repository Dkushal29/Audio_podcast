import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import { storage } from '../../utils/storage.js'
import {
  ALL_ROLES,
  assertEpisodeMember,
  assertWorkspaceMember,
  MANAGE_ROLES,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'
import { emitEpisodeEvent } from '../../sockets/index.js'

export const createClipSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().default(''),
  startTime: z.number().min(0),
  endTime: z.number().positive(),
  visibility: z.enum(['PUBLIC', 'WORKSPACE']).optional().default('PUBLIC'),
})

export const createClip = asyncHandler(async (req, res) => {
  const { episode } = await assertEpisodeMember(
    req.params.id,
    req.user.id,
    WRITE_ROLES
  )

  const { title, description, startTime, endTime, visibility } = req.body
  if (startTime >= endTime) {
    throw new AppError(
      400,
      'Clip endTime must be greater than startTime.',
      'INVALID_CLIP_RANGE'
    )
  }

  if (episode.duration > 0 && endTime > episode.duration) {
    throw new AppError(
      400,
      `Clip endTime (${endTime}s) exceeds episode duration (${episode.duration}s).`,
      'INVALID_CLIP_RANGE'
    )
  }

  const shareToken = uuidv4().replace(/-/g, '').slice(0, 12)

  const clip = await prisma.clip.create({
    data: {
      episodeId: episode.id,
      creatorId: req.user.id,
      title: title.trim(),
      description: description.trim(),
      startTime,
      endTime,
      shareToken,
      visibility,
    },
    include: {
      creator: { select: { id: true, name: true, avatarColor: true } },
      episode: { select: { id: true, title: true, duration: true } },
    },
  })

  emitEpisodeEvent(episode.id, 'clip:created', { clip })

  res.status(201).json({ clip })
})

export const listEpisodeClips = asyncHandler(async (req, res) => {
  const { episode } = await assertEpisodeMember(
    req.params.id,
    req.user.id,
    ALL_ROLES
  )

  const clips = await prisma.clip.findMany({
    where: { episodeId: episode.id },
    include: {
      creator: { select: { id: true, name: true, avatarColor: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json({ clips })
})

export const getClipByToken = asyncHandler(async (req, res) => {
  const clip = await prisma.clip.findUnique({
    where: { shareToken: req.params.token },
    include: {
      creator: { select: { id: true, name: true, avatarColor: true } },
      episode: {
        include: {
          workspace: { select: { id: true, name: true, mode: true } },
          annotations: {
            include: {
              user: { select: { id: true, name: true, avatarColor: true } },
              replies: {
                include: {
                  user: { select: { id: true, name: true, avatarColor: true } },
                },
                orderBy: { createdAt: 'asc' },
              },
            },
            orderBy: { timestamp: 'asc' },
          },
        },
      },
    },
  })

  if (!clip || clip.episode?.deletedAt) {
    throw new AppError(404, 'Clip not found.', 'NOT_FOUND')
  }

  if (clip.visibility === 'WORKSPACE') {
    if (!req.user) {
      throw new AppError(401, 'Authentication required for workspace clip.', 'UNAUTHORIZED')
    }
    await assertWorkspaceMember(clip.episode.workspaceId, req.user.id, ALL_ROLES)
  }

  await prisma.clip.update({
    where: { id: clip.id },
    data: { views: { increment: 1 } },
  })

  const relatedAnnotations = clip.episode.annotations.filter(
    (a) => a.timestamp >= clip.startTime - 5 && a.timestamp <= clip.endTime + 5
  )

  res.json({
    clip: {
      ...clip,
      views: clip.views + 1,
      episode: {
        id: clip.episode.id,
        title: clip.episode.title,
        description: clip.episode.description,
        duration: clip.episode.duration,
        workspace: clip.episode.workspace,
      },
      annotations: relatedAnnotations,
    },
  })
})

export const streamClipAudio = asyncHandler(async (req, res) => {
  const clip = await prisma.clip.findUnique({
    where: { shareToken: req.params.token },
    include: { episode: true },
  })

  if (!clip || clip.episode?.deletedAt) {
    throw new AppError(404, 'Clip not found.', 'NOT_FOUND')
  }

  if (clip.visibility === 'WORKSPACE') {
    if (!req.user) {
      throw new AppError(401, 'Authentication required.', 'UNAUTHORIZED')
    }
    await assertWorkspaceMember(clip.episode.workspaceId, req.user.id, ALL_ROLES)
  }

  if (clip.episode.sourceType === 'EXTERNAL_LINK' || !clip.episode.audioKey) {
    throw new AppError(
      400,
      'This clip belongs to an external media link without a locally hosted audio file.',
      'EXTERNAL_LINK_NO_LOCAL_AUDIO'
    )
  }

  const stat = await storage.stat(clip.episode.audioKey)
  const fileSize = stat.size
  const range = req.headers.range

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-')
    const start = parseInt(parts[0], 10)
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start >= fileSize ||
      end >= fileSize ||
      start > end
    ) {
      res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).end()
      return
    }
    const stream = await storage.createReadStream(clip.episode.audioKey, { start, end })
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': clip.episode.mimeType,
    })
    stream.pipe(res)
  } else {
    const stream = await storage.createReadStream(clip.episode.audioKey)
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Accept-Ranges': 'bytes',
      'Content-Type': clip.episode.mimeType,
    })
    stream.pipe(res)
  }
})

export const deleteClip = asyncHandler(async (req, res) => {
  const clip = await prisma.clip.findUnique({
    where: { id: req.params.id },
  })
  if (!clip || clip.episode?.deletedAt) {
    throw new AppError(404, 'Clip not found.', 'NOT_FOUND')
  }

  const { membership } = await assertEpisodeMember(
    clip.episodeId,
    req.user.id,
    ALL_ROLES
  )

  const canDelete =
    MANAGE_ROLES.includes(membership.role) || clip.creatorId === req.user.id
  if (!canDelete) {
    throw new AppError(403, 'You can only delete your own clips.', 'FORBIDDEN')
  }

  await prisma.clip.delete({ where: { id: clip.id } })

  emitEpisodeEvent(clip.episodeId, 'clip:deleted', {
    clipId: clip.id,
    episodeId: clip.episodeId,
  })

  res.status(204).end()
})
