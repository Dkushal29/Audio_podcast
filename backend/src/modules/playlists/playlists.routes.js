import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import {
  addEpisodeSchema,
  addEpisodeToPlaylist,
  createPlaylist,
  createPlaylistSchema,
  deletePlaylist,
  listPlaylists,
  removeEpisodeFromPlaylist,
  reorderPlaylist,
  reorderPlaylistSchema,
} from './playlists.controller.js'

const router = Router()

router.get('/workspaces/:id/playlists', requireAuth, listPlaylists)
router.post(
  '/workspaces/:id/playlists',
  requireAuth,
  validate(createPlaylistSchema),
  createPlaylist
)
router.delete('/playlists/:id', requireAuth, deletePlaylist)
router.post(
  '/playlists/:id/episodes',
  requireAuth,
  validate(addEpisodeSchema),
  addEpisodeToPlaylist
)
router.delete(
  '/playlists/:id/episodes/:episodeId',
  requireAuth,
  removeEpisodeFromPlaylist
)
router.patch(
  '/playlists/:id/reorder',
  requireAuth,
  validate(reorderPlaylistSchema),
  reorderPlaylist
)

export default router
