import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  assertEpisodeMember,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'

export const createChapterSchema = z.object({
  title: z.string().min(1).max(160),
  startTime: z.number().min(0),
})

export const updateChapterSchema = z.object({
  title: z.string().min(1).max(160).optional(),
  startTime: z.number().min(0).optional(),
})

export const createChapter = asyncHandler(async (req, res) => {
  const { episode } = await assertEpisodeMember(
    req.params.id,
    req.user.id,
    WRITE_ROLES
  )

  if (episode.duration > 0 && req.body.startTime > episode.duration) {
    throw new AppError(
      400,
      'Chapter startTime exceeds episode duration.',
      'INVALID_TIMESTAMP'
    )
  }

  const chapter = await prisma.chapter.create({
    data: {
      episodeId: episode.id,
      title: req.body.title.trim(),
      startTime: req.body.startTime,
    },
  })

  res.status(201).json({ chapter })
})

export const updateChapter = asyncHandler(async (req, res) => {
  const existing = await prisma.chapter.findUnique({
    where: { id: req.params.id },
  })
  if (!existing) {
    throw new AppError(404, 'Chapter not found.', 'NOT_FOUND')
  }

  await assertEpisodeMember(existing.episodeId, req.user.id, WRITE_ROLES)

  const chapter = await prisma.chapter.update({
    where: { id: existing.id },
    data: {
      ...(req.body.title ? { title: req.body.title.trim() } : {}),
      ...(req.body.startTime !== undefined
        ? { startTime: req.body.startTime }
        : {}),
    },
  })

  res.json({ chapter })
})

export const deleteChapter = asyncHandler(async (req, res) => {
  const existing = await prisma.chapter.findUnique({
    where: { id: req.params.id },
  })
  if (!existing) {
    throw new AppError(404, 'Chapter not found.', 'NOT_FOUND')
  }

  await assertEpisodeMember(existing.episodeId, req.user.id, WRITE_ROLES)

  await prisma.chapter.delete({ where: { id: existing.id } })
  res.status(204).end()
})
