import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import {
  S3Client,
  HeadObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '../config/env.js'

export function assertSafeKey(key) {
  if (!key || typeof key !== 'string') {
    throw new Error('Invalid storage object key.')
  }
  if (
    key.includes('..') ||
    key.includes('/') ||
    key.includes('\\') ||
    key.includes('\0')
  ) {
    throw new Error('Unsafe storage object key: path traversal is not permitted.')
  }
  return path.basename(key)
}

function ensureUploadDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function buildS3Client(s3Config = env.s3) {
  if (!s3Config.bucket || !s3Config.accessKeyId || !s3Config.secretAccessKey) {
    throw new Error(
      'S3/Tigris storage driver selected, but S3_BUCKET, S3_ACCESS_KEY_ID, or S3_SECRET_ACCESS_KEY is missing.'
    )
  }
  return new S3Client({
    region: s3Config.region || 'auto',
    ...(s3Config.endpoint ? { endpoint: s3Config.endpoint } : {}),
    forcePathStyle: Boolean(s3Config.forcePathStyle),
    maxAttempts: 3,
    requestHandler: {
      requestTimeout: s3Config.timeoutMs || 30000,
    },
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
  })
}

export function createStorageService(config = env, customS3Client = null) {
  let s3Client = customS3Client

  function getClient() {
    if (s3Client) return s3Client
    s3Client = buildS3Client(config.s3)
    return s3Client
  }

  function resolveKeyPath(key) {
    const safeKey = assertSafeKey(key)
    return path.join(config.uploadDir, safeKey)
  }

  return {
    async saveLocalFile(
      tempPath,
      targetKey,
      contentType = 'application/octet-stream'
    ) {
      const safeKey = assertSafeKey(targetKey)

      if (config.storageDriver === 's3') {
        const client = getClient()
        const bodyStream = fs.createReadStream(tempPath)
        const uploader = new Upload({
          client,
          params: {
            Bucket: config.s3.bucket,
            Key: safeKey,
            Body: bodyStream,
            ContentType: contentType,
          },
          partSize: 5 * 1024 * 1024,
          leavePartsOnError: false,
        })
        await uploader.done()
        await fs.promises.unlink(tempPath).catch(() => {})
        return { key: safeKey, driver: 's3' }
      }

      ensureUploadDir(config.uploadDir)
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

    async exists(key) {
      const safeKey = assertSafeKey(key)
      if (config.storageDriver === 's3') {
        try {
          await this.stat(safeKey)
          return true
        } catch (err) {
          if (err?.$metadata?.httpStatusCode === 404 || err?.name === 'NotFound') {
            return false
          }
          throw err
        }
      }
      try {
        await fs.promises.access(resolveKeyPath(safeKey))
        return true
      } catch {
        return false
      }
    },

    async stat(key) {
      const safeKey = assertSafeKey(key)
      if (config.storageDriver === 's3') {
        const client = getClient()
        const head = await client.send(
          new HeadObjectCommand({
            Bucket: config.s3.bucket,
            Key: safeKey,
          })
        )
        return {
          size: Number(head.ContentLength || 0),
          contentType: head.ContentType || 'application/octet-stream',
          etag: head.ETag || null,
        }
      }

      const filePath = resolveKeyPath(safeKey)
      const st = await fs.promises.stat(filePath)
      return { size: st.size }
    },

    async createReadStream(key, options = {}) {
      const safeKey = assertSafeKey(key)
      if (config.storageDriver === 's3') {
        const client = getClient()
        const rangeHeader =
          options.start !== undefined && options.end !== undefined
            ? `bytes=${options.start}-${options.end}`
            : undefined
        const res = await client.send(
          new GetObjectCommand({
            Bucket: config.s3.bucket,
            Key: safeKey,
            ...(rangeHeader ? { Range: rangeHeader } : {}),
          })
        )
        return res.Body
      }

      const filePath = resolveKeyPath(safeKey)
      return fs.createReadStream(filePath, options)
    },

    async downloadToFile(key, destPath) {
      const safeKey = assertSafeKey(key)
      if (config.storageDriver === 's3') {
        const body = await this.createReadStream(safeKey)
        await pipeline(body, fs.createWriteStream(destPath))
        return destPath
      }
      const srcPath = resolveKeyPath(safeKey)
      await fs.promises.copyFile(srcPath, destPath)
      return destPath
    },

    async getSignedDownloadUrl(key, { expiresIn } = {}) {
      const safeKey = assertSafeKey(key)
      if (config.storageDriver !== 's3') {
        return null
      }
      const client = getClient()
      const command = new GetObjectCommand({
        Bucket: config.s3.bucket,
        Key: safeKey,
      })
      return getSignedUrl(client, command, {
        expiresIn: expiresIn || config.s3.signedUrlExpiresIn || 3600,
      })
    },

    async remove(key) {
      const safeKey = assertSafeKey(key)
      if (config.storageDriver === 's3') {
        const client = getClient()
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.s3.bucket,
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
}

export const storage = createStorageService(env)
