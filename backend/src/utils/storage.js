import fs from 'fs'
import path from 'path'
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { env } from '../config/env.js'

function ensureUploadDir() {
  if (!fs.existsSync(env.uploadDir)) {
    fs.mkdirSync(env.uploadDir, { recursive: true })
  }
}

function resolveKeyPath(key) {
  const safeKey = path.basename(key)
  return path.join(env.uploadDir, safeKey)
}

let s3Client = null
function getS3Client() {
  if (s3Client) return s3Client
  if (!env.s3.bucket || !env.s3.accessKeyId || !env.s3.secretAccessKey) {
    throw new Error(
      'S3 storage driver selected, but S3_BUCKET, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY is missing.'
    )
  }
  s3Client = new S3Client({
    region: env.s3.region,
    ...(env.s3.endpoint ? { endpoint: env.s3.endpoint } : {}),
    forcePathStyle: env.s3.forcePathStyle,
    credentials: {
      accessKeyId: env.s3.accessKeyId,
      secretAccessKey: env.s3.secretAccessKey,
    },
  })
  return s3Client
}

/**
 * Storage abstraction supporting local filesystem (development/persistent disk)
 * and S3-compatible object storage (production).
 */
export const storage = {
  async saveLocalFile(tempPath, targetKey, contentType = 'application/octet-stream') {
    const safeKey = path.basename(targetKey)

    if (env.storageDriver === 's3') {
      const client = getS3Client()
      const bodyStream = fs.createReadStream(tempPath)
      await client.send(
        new PutObjectCommand({
          Bucket: env.s3.bucket,
          Key: safeKey,
          Body: bodyStream,
          ContentType: contentType,
        })
      )
      await fs.promises.unlink(tempPath).catch(() => {})
      return { key: safeKey, driver: 's3' }
    }

    ensureUploadDir()
    const destPath = resolveKeyPath(safeKey)
    try {
      await fs.promises.rename(tempPath, destPath)
    } catch (err) {
      if (err.code === 'EXDEV') {
        await fs.promises.copyFile(tempPath, destPath)
        await fs.promises.unlink(tempPath).catch(() => {})
      } else {
        throw err
      }
    }
    return { key: safeKey, path: destPath, driver: 'local' }
  },

  async stat(key) {
    const safeKey = path.basename(key)
    if (env.storageDriver === 's3') {
      const client = getS3Client()
      const head = await client.send(
        new HeadObjectCommand({
          Bucket: env.s3.bucket,
          Key: safeKey,
        })
      )
      return { size: Number(head.ContentLength || 0) }
    }

    const filePath = resolveKeyPath(safeKey)
    return fs.promises.stat(filePath)
  },

  async createReadStream(key, options = {}) {
    const safeKey = path.basename(key)
    if (env.storageDriver === 's3') {
      const client = getS3Client()
      const rangeHeader =
        options.start !== undefined && options.end !== undefined
          ? `bytes=${options.start}-${options.end}`
          : undefined
      const res = await client.send(
        new GetObjectCommand({
          Bucket: env.s3.bucket,
          Key: safeKey,
          ...(rangeHeader ? { Range: rangeHeader } : {}),
        })
      )
      return res.Body
    }

    const filePath = resolveKeyPath(safeKey)
    return fs.createReadStream(filePath, options)
  },

  async remove(key) {
    const safeKey = path.basename(key)
    if (env.storageDriver === 's3') {
      const client = getS3Client()
      await client.send(
        new DeleteObjectCommand({
          Bucket: env.s3.bucket,
          Key: safeKey,
        })
      )
      return
    }

    const filePath = resolveKeyPath(safeKey)
    try {
      await fs.promises.unlink(filePath)
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  },
}
