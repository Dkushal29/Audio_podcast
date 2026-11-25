import { z } from 'zod'
import { prisma } from '../../config/prisma.js'
import { AppError, asyncHandler } from '../../utils/errors.js'
import {
  ALL_ROLES,
  assertWorkspaceMember,
  WRITE_ROLES,
} from '../../middleware/workspaceAuth.js'

export const createPlaylistSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(1000).optional().default(''),
  rssUrl: z.string().max(500).optional().nullable(),
  episodeIds: z.array(z.string().uuid()).optional().default([]),
})

export const addEpisodeSchema = z.object({
  episodeId: z.string().uuid(),
})

export const reorderPlaylistSchema = z.object({
  episodeIds: z.array(z.string().uuid()).min(1),
})

export const listPlaylists = asyncHandler(async (req, res) => {
  await assertWorkspaceMember(req.params.id, req.user.id, ALL_ROLES)

  const playlists = await prisma.playlist.findMany({
    where: { workspaceId: req.params.id },
    include: {
      episodes: {
        orderBy: { position: 'asc' },
        include: {
          episode: {
            select: {
              id: true,
              title: true,
              duration: true,
              createdAt: true,
              uploader: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  res.json({ playlists })
})

export const createPlaylist = asyncHandler(async (req, res) => {
  await assertWorkspaceMember(req.params.id, req.user.id, WRITE_ROLES)

  const playlist = await prisma.playlist.create({
    data: {
      workspaceId: req.params.id,
      creatorId: req.user.id,
      title: req.body.title.trim(),
      description: req.body.description.trim(),
      rssUrl: req.body.rssUrl || null,
      episodes: {
        create: req.body.episodeIds.map((episodeId, idx) => ({
          episodeId,
          position: idx,
        })),
      },
    },
    include: {
      episodes: {
        orderBy: { position: 'asc' },
        include: {
          episode: { select: { id: true, title: true, duration: true } },
        },
      },
    },
  })

  res.status(201).json({ playlist })
})

export const addEpisodeToPlaylist = asyncHandler(async (req, res) => {
  const playlist = await prisma.playlist.findUnique({
    where: { id: req.params.id },
  })
  if (!playlist) {
    throw new AppError(404, 'Playlist not found.', 'NOT_FOUND')
  }

  await assertWorkspaceMember(playlist.workspaceId, req.user.id, WRITE_ROLES)

  const count = await prisma.playlistEpisode.count({
    where: { playlistId: playlist.id },
  })

  const entry = await prisma.playlistEpisode.upsert({
    where: {
      playlistId_episodeId: {
        playlistId: playlist.id,
        episodeId: req.body.episodeId,
      },
    },
    update: {},
    create: {
      playlistId: playlist.id,
      episodeId: req.body.episodeId,
      position: count,
    },
  })

  res.status(201).json({ entry })
})

export const removeEpisodeFromPlaylist = asyncHandler(async (req, res) => {
  const playlist = await prisma.playlist.findUnique({
    where: { id: req.params.id },
  })
  if (!playlist) {
    throw new AppError(404, 'Playlist not found.', 'NOT_FOUND')
  }

  await assertWorkspaceMember(playlist.workspaceId, req.user.id, WRITE_ROLES)

  await prisma.playlistEpisode.deleteMany({
    where: {
      playlistId: playlist.id,
      episodeId: req.params.episodeId,
    },
  })

  res.status(204).end()
})

export const reorderPlaylist = asyncHandler(async (req, res) => {
  const playlist = await prisma.playlist.findUnique({
    where: { id: req.params.id },
  })
  if (!playlist) {
    throw new AppError(404, 'Playlist not found.', 'NOT_FOUND')
  }

  await assertWorkspaceMember(playlist.workspaceId, req.user.id, WRITE_ROLES)

  await prisma.$transaction(
    req.body.episodeIds.map((episodeId, index) =>
      prisma.playlistEpisode.updateMany({
        where: { playlistId: playlist.id, episodeId },
        data: { position: index },
      })
    )
  )

  const updated = await prisma.playlist.findUnique({
    where: { id: playlist.id },
    include: {
      episodes: {
        orderBy: { position: 'asc' },
        include: {
          episode: { select: { id: true, title: true, duration: true } },
        },
      },
    },
  })

  res.json({ playlist: updated })
})
