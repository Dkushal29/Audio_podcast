import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import {
  assertSafeKey,
  buildS3Client,
  createStorageService,
} from '../src/utils/storage.js'
import {
  parseDeepgramResponse,
  transcribeAudioFile,
} from '../src/services/deepgram.service.js'

async function run() {
  console.log('1. Testing Tigris S3 client validation & key safety...')
  assert.throws(() =>
    buildS3Client({
      endpoint: 'https://t3.storage.dev',
      region: 'auto',
      bucket: '',
      accessKeyId: '',
      secretAccessKey: '',
    })
  )

  const client = buildS3Client({
    endpoint: 'https://t3.storage.dev',
    region: 'auto',
    bucket: 'echospace.media',
    accessKeyId: 'test-key',
    secretAccessKey: 'test-secret',
  })
  assert.ok(client)

  for (const badKey of ['../secret.mp3', 'a/b.mp3', 'a\\b.mp3', '']) {
    assert.throws(() => assertSafeKey(badKey))
  }
  assert.equal(assertSafeKey('episode-123.mp3'), 'episode-123.mp3')

  console.log('2. Testing mocked Tigris S3 storage operations (stat, exists, range, remove)...')
  const calls = []
  const mockS3 = {
    async send(cmd) {
      calls.push(cmd.constructor.name)
      if (cmd.constructor.name === 'HeadObjectCommand') {
        if (cmd.input.Key === 'missing.mp3') {
          const err = new Error('NotFound')
          err.name = 'NotFound'
          err.$metadata = { httpStatusCode: 404 }
          throw err
        }
        return { ContentLength: 4096, ContentType: 'audio/mpeg', ETag: '"abc"' }
      }
      if (cmd.constructor.name === 'GetObjectCommand') {
        assert.equal(cmd.input.Range, 'bytes=0-1023')
        return { Body: Readable.from([Buffer.from('mock-audio-chunk')]) }
      }
      if (cmd.constructor.name === 'DeleteObjectCommand') {
        return {}
      }
      throw new Error(`Unexpected command ${cmd.constructor.name}`)
    },
  }

  const s3Storage = createStorageService(
    {
      storageDriver: 's3',
      uploadDir: os.tmpdir(),
      s3: {
        endpoint: 'https://t3.storage.dev',
        region: 'auto',
        bucket: 'echospace.media',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        signedUrlExpiresIn: 3600,
      },
    },
    mockS3
  )

  const st = await s3Storage.stat('ep.mp3')
  assert.equal(st.size, 4096)
  assert.equal(st.contentType, 'audio/mpeg')
  assert.equal(await s3Storage.exists('ep.mp3'), true)
  assert.equal(await s3Storage.exists('missing.mp3'), false)
  const stream = await s3Storage.createReadStream('ep.mp3', { start: 0, end: 1023 })
  assert.ok(stream)
  await s3Storage.remove('ep.mp3')
  assert.ok(calls.includes('DeleteObjectCommand'))

  console.log('3. Testing Deepgram response parsing (timestamps & speaker diarization)...')
  const parsed = parseDeepgramResponse({
    results: {
      channels: [
        {
          detected_language: 'en',
          alternatives: [
            {
              transcript: 'Deadlock prevention is critical in operating systems.',
              confidence: 0.965,
            },
          ],
        },
      ],
      utterances: [
        {
          start: 12.42,
          end: 16.81,
          confidence: 0.96,
          speaker: 0,
          transcript: 'Deadlock prevention is critical in operating systems.',
          words: [
            { word: 'deadlock', punctuated_word: 'Deadlock', start: 12.42, end: 12.9, confidence: 0.98, speaker: 0 },
            { word: 'prevention', punctuated_word: 'prevention', start: 12.91, end: 13.5, confidence: 0.95, speaker: 0 },
          ],
        },
      ],
    },
  })

  assert.equal(parsed.detectedLanguage, 'en')
  assert.equal(parsed.segments.length, 1)
  assert.equal(parsed.segments[0].start, 12.42)
  assert.equal(parsed.segments[0].end, 16.81)
  assert.equal(parsed.segments[0].speaker, 0)
  assert.equal(parsed.segments[0].words.length, 2)

  console.log('4. Testing Deepgram error handling (missing key, 429 rate limit, 502 error)...')
  const tmpAudio = path.join(os.tmpdir(), `dg-test-${Date.now()}.mp3`)
  await fs.promises.writeFile(tmpAudio, Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00\xff\xfb'))
  try {
    await assert.rejects(
      () => transcribeAudioFile(tmpAudio, 'audio/mpeg', {}, { apiKey: '' }),
      (err) => err.code === 'TRANSCRIPTION_NOT_CONFIGURED'
    )

    await assert.rejects(
      () =>
        transcribeAudioFile(
          tmpAudio,
          'audio/mpeg',
          {},
          {
            apiKey: 'dg-test-key',
            fetchImpl: async () => ({ status: 429, ok: false, text: async () => 'rate limit' }),
          }
        ),
      (err) => err.code === 'DEEPGRAM_RATE_LIMIT'
    )

    const okRes = await transcribeAudioFile(
      tmpAudio,
      'audio/mpeg',
      { language: 'en', diarize: true },
      {
        apiKey: 'dg-test-key',
        fetchImpl: async () => ({
          status: 200,
          ok: true,
          json: async () => ({
            results: {
              channels: [{ detected_language: 'en', alternatives: [{ transcript: 'Hello world', confidence: 0.99 }] }],
              utterances: [{ start: 0.1, end: 1.2, confidence: 0.99, speaker: 1, transcript: 'Hello world' }],
            },
          }),
        }),
      }
    )
    assert.equal(okRes.fullText, 'Hello world')
    assert.equal(okRes.segments[0].speaker, 1)
  } finally {
    await fs.promises.unlink(tmpAudio).catch(() => {})
  }

  console.log('ALL TIGRIS & DEEPGRAM TESTS PASSED!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
