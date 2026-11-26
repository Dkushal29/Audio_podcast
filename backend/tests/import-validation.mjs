import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { classifySourceUrl } from '../src/modules/imports/providers.js'
import { detectAudioFromBytes } from '../src/modules/imports/imports.worker.js'
import {
  assertSafePublicUrl,
  validateAudioContentType,
} from '../src/utils/ssrf.js'

async function run() {
  console.log('1. Testing Direct MP3 & M4A URL classification...')
  const mp3Class = classifySourceUrl('https://cdn.example.com/audio/lecture1.mp3')
  assert.equal(mp3Class.valid, true)
  assert.equal(mp3Class.kind, 'DIRECT_AUDIO')
  assert.equal(mp3Class.supportedForDownload, true)

  const m4aClass = classifySourceUrl('https://cdn.example.com/audio/podcast.m4a?token=abc')
  assert.equal(m4aClass.valid, true)
  assert.equal(m4aClass.kind, 'DIRECT_AUDIO')
  assert.equal(m4aClass.supportedForDownload, true)

  console.log('2. Testing Gaana & unsupported streaming platforms...')
  const gaana = classifySourceUrl('https://gaana.com/song/dilruba-dilnasheen')
  assert.equal(gaana.valid, false)
  assert.equal(gaana.kind, 'UNSUPPORTED_STREAMING')
  assert.equal(gaana.provider, 'Gaana')
  assert.equal(gaana.code, 'UNSUPPORTED_STREAMING_SOURCE')
  assert.equal(gaana.retryable, false)
  assert.ok(gaana.message.includes('protected streaming'))

  for (const url of [
    'https://open.spotify.com/track/123',
    'https://music.apple.com/us/album/test/123',
    'https://www.jiosaavn.com/song/test/123',
  ]) {
    const res = classifySourceUrl(url)
    assert.equal(res.valid, false)
    assert.equal(res.kind, 'UNSUPPORTED_STREAMING')
  }

  console.log('3. Testing RSS feed classification...')
  const rss = classifySourceUrl('https://feeds.example.com/show/feed.xml')
  assert.equal(rss.valid, true)
  assert.equal(rss.kind, 'PODCAST_RSS')

  console.log('4. Testing Content-Type validation (HTML webpage, RSS, mismatch, audio/*)...')
  assert.throws(
    () => validateAudioContentType('text/html; charset=utf-8'),
    (err) => err.code === 'UNSUPPORTED_WEBPAGE'
  )
  assert.throws(
    () => validateAudioContentType('application/json'),
    (err) => err.code === 'INVALID_AUDIO_FORMAT'
  )
  const rssCt = validateAudioContentType('application/rss+xml')
  assert.equal(rssCt.ok, false)
  assert.equal(rssCt.kind, 'RSS_FEED')

  assert.equal(validateAudioContentType('audio/mpeg').ok, true)
  assert.equal(validateAudioContentType('audio/mp4').ok, true)

  console.log('5. Testing magic-byte audio signature detection (MP3, M4A, invalid HTML)...')
  const tmpFile = path.join(os.tmpdir(), `echospace-imp-val-${Date.now()}.bin`)
  try {
    // M4A ftyp
    await fs.promises.writeFile(
      tmpFile,
      Buffer.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20])
    )
    const m4a = await detectAudioFromBytes(tmpFile)
    assert.equal(m4a?.ext, '.m4a')
    assert.equal(m4a?.mime, 'audio/mp4')

    // HTML masquerading as .mp3
    await fs.promises.writeFile(tmpFile, Buffer.from('<!DOCTYPE html><html></html>'))
    const htmlSig = await detectAudioFromBytes(tmpFile)
    assert.equal(htmlSig, null)
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => {})
  }

  console.log('6. Testing SSRF protections...')
  for (const badUrl of [
    'http://localhost:8081/test.mp3',
    'http://127.0.0.1/test.mp3',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/audio.mp3',
  ]) {
    await assert.rejects(() => assertSafePublicUrl(badUrl), (err) => err.code === 'SSRF_BLOCKED')
  }

  console.log('ALL IMPORT VALIDATION TESTS PASSED!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
