import assert from 'node:assert/strict'
import {
  resolveAndInspectSource,
  extractGoogleDriveFileId,
  resolveDropboxUrl,
  resolveOneDriveUrl,
  discoverRssFromHtml,
  canonicalizeSourceUrl,
} from '../src/modules/imports/resolvers/index.js'
import { AppError } from '../src/utils/errors.js'

const noopSafe = async () => ({ pinnedIp: '93.184.216.34', pinnedFamily: 4 })

async function run() {
  console.log('1. Testing extensionless direct audio & CDN URLs...')
  const noExt = await resolveAndInspectSource('https://cdn.example.com/stream?id=123', {
    assertSafePublicUrl: noopSafe,
    inspectHeaders: async () => ({ contentType: 'audio/mpeg', contentLength: 2048576 }),
  })
  assert.equal(noExt.valid, true)
  assert.equal(noExt.importability, 'IMPORTABLE')
  assert.equal(noExt.statusLabel, 'Public Media Source')
  assert.equal(noExt.fileSize, 2048576)
  assert.equal(noExt.capabilities.audioPlayback, true)

  console.log('1b. Testing Direct Video (.mp4) & Podcast Show RSS discovery...')
  const mp4 = await resolveAndInspectSource('https://cdn.example.com/talk.mp4', {
    assertSafePublicUrl: noopSafe,
    inspectHeaders: async () => ({ contentType: 'video/mp4', contentLength: 5000000 }),
  })
  assert.equal(mp4.sourceType, 'DIRECT_VIDEO')
  assert.equal(mp4.suggestedAction, 'EXTRACT_AND_IMPORT')
  assert.equal(mp4.capabilities.waveform, true)

  const showFeed = discoverRssFromHtml(
    '<html><head><title>Tech Pod</title><link rel="alternate" type="application/rss+xml" href="/feed.xml" /></head></html>',
    'https://techpod.example.com/show'
  )
  assert.equal(showFeed, 'https://techpod.example.com/feed.xml')

  const showRes = await resolveAndInspectSource('https://techpod.example.com/show', {
    assertSafePublicUrl: noopSafe,
    inspectHeaders: async () => {
      throw new AppError(400, 'Webpage', 'UNSUPPORTED_WEBPAGE')
    },
    fetchHtmlSnippet: async () => ({
      finalUrl: 'https://techpod.example.com/show',
      html: '<html><head><title>Tech Pod</title><link rel="alternate" type="application/rss+xml" href="/feed.xml" /></head></html>',
    }),
  })
  assert.equal(showRes.sourceType, 'PODCAST_SHOW_PAGE')
  assert.equal(showRes.feedUrl, 'https://techpod.example.com/feed.xml')
  assert.equal(showRes.suggestedAction, 'BROWSE_EPISODES')

  const appleShow = await resolveAndInspectSource(
    'https://podcasts.apple.com/us/podcast/test-show/id123456',
    {
      assertSafePublicUrl: noopSafe,
      fetchText: async () =>
        JSON.stringify({
          results: [{ collectionName: 'Test Show', feedUrl: 'https://feeds.example.com/test.xml' }],
        }),
    }
  )
  assert.equal(appleShow.sourceType, 'PODCAST_SHOW_PAGE')
  assert.equal(appleShow.feedUrl, 'https://feeds.example.com/test.xml')

  const yt = await resolveAndInspectSource('https://www.youtube.com/watch?v=abc123', {
    assertSafePublicUrl: noopSafe,
  })
  assert.equal(yt.sourceType, 'EXTERNAL_LINK_ONLY')
  assert.equal(yt.capabilities.audioPlayback, false)
  assert.equal(yt.capabilities.waveform, false)

  assert.equal(
    canonicalizeSourceUrl('https://example.com/ep.mp3/?utm_source=x#t=10'),
    'https://example.com/ep.mp3'
  )

  console.log('2. Testing extensionless URL returning RSS/Atom feed...')
  const atomDetected = await resolveAndInspectSource('https://podcast.example.com/feed', {
    assertSafePublicUrl: noopSafe,
    inspectHeaders: async () => ({ contentType: 'application/atom+xml' }),
  })
  assert.equal(atomDetected.valid, true)
  assert.equal(atomDetected.sourceType, 'PODCAST_RSS')
  assert.equal(atomDetected.importability, 'RSS_PREVIEW')

  console.log('3. Testing Google Drive public file & auth-required file...')
  const driveId = extractGoogleDriveFileId(
    new URL('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing')
  )
  assert.equal(driveId, '1AbCdEfGhIjKlMnOp')

  const driveOk = await resolveAndInspectSource(
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing',
    {
      assertSafePublicUrl: noopSafe,
      inspectHeaders: async (u) => {
        assert.ok(u.includes('uc?export=download&id=1AbCdEfGhIjKlMnOp'))
        return { contentType: 'audio/mp4', contentLength: 1024000 }
      },
    }
  )
  assert.equal(driveOk.valid, true)
  assert.equal(driveOk.provider, 'Google Drive')
  assert.equal(driveOk.statusLabel, 'Google Drive File')
  assert.equal(driveOk.importability, 'IMPORTABLE')

  const driveAuth = await resolveAndInspectSource(
    'https://drive.google.com/file/d/1PrivateFileId/view',
    {
      assertSafePublicUrl: noopSafe,
      inspectHeaders: async () => ({ contentType: 'text/html; charset=utf-8' }),
    }
  )
  assert.equal(driveAuth.valid, false)
  assert.equal(driveAuth.importability, 'REQUIRES_AUTH')
  assert.equal(driveAuth.statusLabel, 'Authentication Required')
  assert.equal(driveAuth.requiresAuthentication, true)

  console.log('4. Testing Dropbox shared file & access denied...')
  const dbxResolved = resolveDropboxUrl(
    new URL('https://www.dropbox.com/scl/fi/abc123/lecture.mp3?rlkey=xyz&dl=0')
  )
  assert.ok(dbxResolved.includes('dl=1'))
  assert.ok(dbxResolved.includes('rlkey=xyz'))

  const dbxOk = await resolveAndInspectSource(
    'https://www.dropbox.com/scl/fi/abc123/lecture.mp3?rlkey=xyz&dl=0',
    {
      assertSafePublicUrl: noopSafe,
      inspectHeaders: async () => ({ contentType: 'audio/mpeg', contentLength: 500000 }),
    }
  )
  assert.equal(dbxOk.valid, true)
  assert.equal(dbxOk.provider, 'Dropbox')
  assert.equal(dbxOk.importability, 'IMPORTABLE')

  const dbxDenied = await resolveAndInspectSource(
    'https://www.dropbox.com/s/badlink/file.mp3?dl=0',
    {
      assertSafePublicUrl: noopSafe,
      inspectHeaders: async () => {
        throw new AppError(403, 'The audio source denied access.', 'ACCESS_DENIED')
      },
    }
  )
  assert.equal(dbxDenied.valid, false)
  assert.equal(dbxDenied.importability, 'REQUIRES_AUTH')

  console.log('5. Testing OneDrive shared file & access denied...')
  const odResolved = resolveOneDriveUrl(
    new URL('https://onedrive.live.com/redir?resid=123&authkey=abc')
  )
  assert.ok(odResolved.includes('download=1'))

  const odOk = await resolveAndInspectSource(
    'https://onedrive.live.com/redir?resid=123&authkey=abc',
    {
      assertSafePublicUrl: noopSafe,
      inspectHeaders: async () => ({ contentType: 'audio/wav', contentLength: 900000 }),
    }
  )
  assert.equal(odOk.valid, true)
  assert.equal(odOk.provider, 'OneDrive')
  assert.equal(odOk.importability, 'IMPORTABLE')

  const odAuth = await resolveAndInspectSource(
    'https://myorg.sharepoint.com/:u:/s/team/secret.mp3',
    {
      assertSafePublicUrl: noopSafe,
      inspectHeaders: async () => {
        throw new AppError(403, 'Access denied', 'ACCESS_DENIED')
      },
    }
  )
  assert.equal(odAuth.valid, false)
  assert.equal(odAuth.importability, 'REQUIRES_AUTH')
  assert.equal(odAuth.statusLabel, 'Authentication Required')

  console.log('6. Testing HTML webpage & unsupported streaming platforms...')
  const webpage = await resolveAndInspectSource('https://example.com/blog/post', {
    assertSafePublicUrl: noopSafe,
    inspectHeaders: async () => ({ contentType: 'text/html' }),
  })
  assert.equal(webpage.valid, false)
  assert.equal(webpage.sourceType, 'UNKNOWN_SOURCE')
  assert.equal(webpage.statusLabel, 'Unsupported Webpage')

  const gaana = await resolveAndInspectSource('https://gaana.com/song/dilruba-dilnasheen')
  assert.equal(gaana.valid, false)
  assert.equal(gaana.sourceType, 'UNSUPPORTED_STREAMING')
  assert.equal(gaana.statusLabel, 'Unsupported Streaming Platform')

  console.log('7. Testing SSRF blocking in resolver...')
  await assert.rejects(
    () => resolveAndInspectSource('http://127.0.0.1:8081/internal.mp3'),
    (err) => err.code === 'SSRF_BLOCKED'
  )

  console.log('ALL SMART SOURCE RESOLVER TESTS PASSED!')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
