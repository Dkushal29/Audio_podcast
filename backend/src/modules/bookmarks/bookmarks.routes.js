import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import {
  createBookmark,
  createBookmarkSchema,
  deleteBookmark,
  listBookmarks,
} from './bookmarks.controller.js'

const router = Router()

router.get('/episodes/:id/bookmarks', requireAuth, listBookmarks)
router.post(
  '/episodes/:id/bookmarks',
  requireAuth,
  validate(createBookmarkSchema),
  createBookmark
)
router.delete('/bookmarks/:id', requireAuth, deleteBookmark)

export default router
