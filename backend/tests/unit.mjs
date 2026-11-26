import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { assertSafePublicUrl } from '../src/utils/ssrf.js'
import { classifySourceUrl } from '../src/modules/imports/providers.js'
import { detectAudioFromBytes } from '../src/modules/imports/imports.worker.js'

async function run() {
  console.log('1. Testing SSRF URL validation...')
  const blockedUrls = [
    'http://localhost:8080/audio.mp3',
    'http://127.0.0.1/secret.mp3',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.1/internal.mp3',
    'http://192.168.1.10/audio.mp3',
    'file:///etc/passwd',
    'ftp://example.com/audio.mp3',
  ]

  for (const url of blockedUrls) {
    let failed = false
    try {
      await assertSafePublicUrl(url)
    } catch {
      failed = true
    }
    assert.equal(failed, true, `Expected SSRF/protocol block for ${url}`)
  }

  console.log('2. Testing source URL classification...')
  const direct = classifySourceUrl('https://cdn.example.com/lectures/week1.mp3')
  assert.equal(direct.valid, true)
  assert.equal(direct.kind, 'DIRECT_AUDIO')
  assert.equal(direct.supportedForDownload, true)

  const rss = classifySourceUrl('https://example.com/podcast/feed.xml')
  assert.equal(rss.valid, true)
  assert.equal(rss.kind, 'PODCAST_RSS')

  const yt = classifySourceUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  assert.equal(yt.valid, true)
  assert.equal(yt.kind, 'EXTERNAL_LINK_ONLY')
  assert.equal(yt.provider, 'YouTube')
  assert.equal(yt.supportedForDownload, false)

  const invalid = classifySourceUrl('not-a-url')
  assert.equal(invalid.valid, false)

  console.log('3. Testing magic-byte audio format detection...')
  const tmpFile = path.join(os.tmpdir(), `echospace-unit-${Date.now()}.bin`)
  try {
    // MP3 ID3
    await fs.promises.writeFile(
      tmpFile,
      Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb])
    )
    const mp3 = await detectAudioFromBytes(tmpFile)
    assert.equal(mp3?.ext, '.mp3')
    assert.equal(mp3?.mime, 'audio/mpeg')

    // OGG
    await fs.promises.writeFile(tmpFile, Buffer.from('OggS\x00\x02\x00\x00\x00\x00\x00\x00'))
    const ogg = await detectAudioFromBytes(tmpFile)
    assert.equal(ogg?.ext, '.ogg')

    // Invalid HTML masquerading as audio
    await fs.promises.writeFile(tmpFile, Buffer.from('<html><body>Not audio</body></html>'))
    const bad = await detectAudioFromBytes(tmpFile)
    assert.equal(bad, null)
  } finally {
    await fs.promises.unlink(tmpFile).catch(() => {})
  }

  console.log('ALL UNIT TESTS PASSED')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
