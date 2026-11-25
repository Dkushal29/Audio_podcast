import { Router } from 'express'
import { requireAuth } from '../../middleware/auth.js'
import { validate } from '../../middleware/validate.js'
import {
  createAnnotation,
  createAnnotationSchema,
  deleteAnnotation,
  listAnnotations,
  updateAnnotation,
  updateAnnotationSchema,
} from './annotations.controller.js'

const router = Router()

router.get('/episodes/:id/annotations', requireAuth, listAnnotations)
router.post(
  '/episodes/:id/annotations',
  requireAuth,
  validate(createAnnotationSchema),
  createAnnotation
)
router.patch(
  '/annotations/:id',
  requireAuth,
  validate(updateAnnotationSchema),
  updateAnnotation
)
router.delete('/annotations/:id', requireAuth, deleteAnnotation)

export default router
