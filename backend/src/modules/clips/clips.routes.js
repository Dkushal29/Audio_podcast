import { Router } from 'express'
import { optionalAuth, requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import {
  createClip,
  createClipSchema,
  getClipByToken,
  listEpisodeClips,
  streamClipAudio,
} from './clips.controller.js'

const router = Router()

router.post(
  '/episodes/:id/clips',
  requireAuth,
  validate(createClipSchema),
  createClip
)
router.get('/episodes/:id/clips', requireAuth, listEpisodeClips)
router.get('/clips/:token', optionalAuth, getClipByToken)
router.get('/clips/:token/audio', optionalAuth, streamClipAudio)

export default router
