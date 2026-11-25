import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import {
  createChapter,
  createChapterSchema,
  deleteChapter,
  updateChapter,
  updateChapterSchema,
} from './chapters.controller.js'

const router = Router()

router.post(
  '/episodes/:id/chapters',
  requireAuth,
  validate(createChapterSchema),
  createChapter
)
router.patch(
  '/chapters/:id',
  requireAuth,
  validate(updateChapterSchema),
  updateChapter
)
router.delete('/chapters/:id', requireAuth, deleteChapter)

export default router
