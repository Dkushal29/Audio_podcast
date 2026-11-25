import multer from 'multer'
import { ZodError } from 'zod'
import { AppError } from '../utils/errors.js'

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    })
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    })
  }

  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Audio file exceeds maximum allowed size.'
        : err.message
    return res.status(400).json({
      error: { code: 'UPLOAD_ERROR', message },
    })
  }

  if (err?.code === 'P2002') {
    return res.status(409).json({
      error: {
        code: 'CONFLICT',
        message: 'A record with that unique value already exists.',
      },
    })
  }

  if (err?.code === 'P2025') {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Requested record was not found.' },
    })
  }

  console.error('[EchoSpace Error]', err)
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected server error occurred.',
    },
  })
}
