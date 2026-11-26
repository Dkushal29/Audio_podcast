import dns from 'dns/promises'
import fs from 'fs'
import http from 'http'
import https from 'https'
import net from 'net'
import { AppError } from './errors.js'

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
])

function isPrivateIpv4(ip) {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = parts
  if (a === 0) return true
  if (a === 10) return true
  if (a === 100 && b >= 64 && b <= 127) return true
  if (a === 127) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 0 && parts[2] === 0) return true
  if (a === 192 && b === 0 && parts[2] === 2) return true
  if (a === 192 && b === 168) return true
  if (a === 198 && (b === 18 || b === 19)) return true
  if (a >= 224) return true
  return false
}

function isPrivateIp(ip) {
  if (!ip) return true
  const normalized = ip.toLowerCase().trim()
  if (net.isIPv4(normalized)) return isPrivateIpv4(normalized)

  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true
    if (normalized.startsWith('fe80:')) return true
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    if (normalized.startsWith('::ffff:')) {
      return isPrivateIpv4(normalized.slice(7))
    }
    return false
  }
  return true
}

/**
 * Validates URL protocol, hostname, and resolved DNS IPs.
 * Returns the parsed URL along with the exact pinned IP & family so callers
 * connect directly to the validated IP (preventing DNS rebinding).
 */
export async function assertSafePublicUrl(rawUrl) {
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new AppError(400, 'Invalid URL format.', 'INVALID_URL')
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new AppError(
      400,
      'Only http and https URLs are permitted.',
      'INVALID_PROTOCOL'
    )
  }

  const hostname = parsed.hostname.toLowerCase()
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new AppError(
      400,
      'Local or internal network addresses are blocked.',
      'SSRF_BLOCKED'
    )
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new AppError(
        400,
        'Private or reserved IP addresses are blocked.',
        'SSRF_BLOCKED'
      )
    }
    return {
      parsed,
      pinnedIp: hostname,
      pinnedFamily: net.isIPv6(hostname) ? 6 : 4,
    }
  }

  let records
  try {
    records = await dns.lookup(hostname, { all: true })
  } catch {
    throw new AppError(400, `Could not resolve host "${hostname}".`, 'DNS_FAILED')
  }

  if (!records || records.length === 0) {
    throw new AppError(400, `Host "${hostname}" resolved to no addresses.`, 'DNS_FAILED')
  }

  for (const rec of records) {
    if (isPrivateIp(rec.address)) {
      throw new AppError(
        400,
        'URL resolves to a private or restricted IP address.',
        'SSRF_BLOCKED'
      )
    }
  }

  return {
    parsed,
    pinnedIp: records[0].address,
    pinnedFamily: records[0].family || (net.isIPv6(records[0].address) ? 6 : 4),
  }
}

function openPinnedRequest(parsed, pinnedIp, pinnedFamily, timeoutMs, method = 'GET') {
  const lib = parsed.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || undefined,
        path: `${parsed.pathname}${parsed.search}`,
        method,
        headers: {
          'User-Agent': 'EchoSpace-Importer/1.0',
          Host: parsed.host,
        },
        lookup: (_host, opts, cb) => {
          if (opts && opts.all) {
            return cb(null, [{ address: pinnedIp, family: pinnedFamily }])
          }
          return cb(null, pinnedIp, pinnedFamily)
        },
        servername: parsed.protocol === 'https:' ? parsed.hostname : undefined,
        timeout: timeoutMs,
      },
      (res) => resolve(res)
    )

    req.on('timeout', () => {
      req.destroy(new AppError(408, 'Remote request timed out.', 'FETCH_TIMEOUT'))
    })
    req.on('error', (err) => {
      if (err instanceof AppError) return reject(err)
      reject(new AppError(502, `Failed to reach remote URL: ${err.message}`, 'FETCH_FAILED'))
    })
    req.end()
  })
}

function mapRemoteHttpError(status) {
  if (status === 401 || status === 403) {
    return new AppError(
      403,
      'The audio source denied access. Check whether the audio is publicly accessible.',
      'ACCESS_DENIED'
    )
  }
  if (status === 404 || status === 410) {
    return new AppError(
      404,
      'The audio URL could not be found. Check that the link is still valid.',
      'REMOTE_NOT_FOUND'
    )
  }
  return new AppError(502, `Remote server returned HTTP ${status}.`, 'REMOTE_HTTP_ERROR')
}

export function validateAudioContentType(contentTypeHeader) {
  const ct = String(contentTypeHeader || '').split(';')[0].trim().toLowerCase()
  if (!ct) return { ok: true, kind: 'UNKNOWN' }

  if (ct === 'text/html' || ct === 'application/xhtml+xml') {
    throw new AppError(
      400,
      'This URL points to a webpage, not a direct audio file. Import a direct audio URL or podcast RSS feed instead.',
      'UNSUPPORTED_WEBPAGE'
    )
  }
  if (
    ct === 'application/rss+xml' ||
    ct === 'application/atom+xml' ||
    ct === 'application/xml' ||
    ct === 'text/xml'
  ) {
    return { ok: false, kind: 'RSS_FEED', contentType: ct }
  }
  if (
    ct.startsWith('audio/') ||
    ct === 'application/ogg' ||
    ct === 'application/octet-stream' ||
    ct === 'binary/octet-stream' ||
    ct === 'video/webm' ||
    ct === 'video/mp4' ||
    ct === 'video/quicktime' ||
    ct === 'video/x-matroska'
  ) {
    return {
      ok: true,
      kind: ct.startsWith('video/') ? 'DIRECT_VIDEO' : 'DIRECT_AUDIO',
      contentType: ct,
    }
  }

  throw new AppError(
    400,
    'The retrieved file is not a supported audio format. Supported formats: MP3, WAV, M4A, OGG, FLAC, AAC and WebM.',
    'INVALID_AUDIO_FORMAT'
  )
}

async function resolveSafeStream(
  rawUrl,
  { maxBytes, timeoutMs, maxRedirects, method = 'GET' }
) {
  let currentUrl = rawUrl

  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const { parsed, pinnedIp, pinnedFamily } = await assertSafePublicUrl(currentUrl)
    const res = await openPinnedRequest(parsed, pinnedIp, pinnedFamily, timeoutMs, method)
    const status = res.statusCode || 0

    if (status >= 300 && status < 400) {
      const location = res.headers.location
      res.resume()
      if (!location) {
        throw new AppError(502, 'Redirect response missing Location header.', 'INVALID_REDIRECT')
      }
      currentUrl = new URL(location, currentUrl).toString()
      continue
    }

    if (status < 200 || status >= 300) {
      res.resume()
      throw mapRemoteHttpError(status)
    }

    const contentLength = Number(res.headers['content-length'] || 0)
    if (contentLength > maxBytes) {
      res.destroy()
      throw new AppError(
        413,
        'The audio file exceeds the maximum import size.',
        'FILE_TOO_LARGE'
      )
    }

    return {
      res,
      finalUrl: currentUrl,
      contentLength,
      contentType: res.headers['content-type'] || '',
    }
  }

  throw new AppError(502, 'Too many redirects.', 'TOO_MANY_REDIRECTS')
}

export async function safeInspectRemoteHeaders(
  rawUrl,
  { maxBytes = 100 * 1024 * 1024, timeoutMs = 8000, maxRedirects = 5 } = {}
) {
  try {
    const { res, finalUrl, contentLength, contentType } = await resolveSafeStream(
      rawUrl,
      { maxBytes, timeoutMs, maxRedirects, method: 'HEAD' }
    )
    res.resume()
    return { finalUrl, contentLength, contentType }
  } catch (err) {
    if (err?.code === 'REMOTE_HTTP_ERROR' && err.message.includes('405')) {
      const { res, finalUrl, contentLength, contentType } = await resolveSafeStream(
        rawUrl,
        { maxBytes, timeoutMs, maxRedirects, method: 'GET' }
      )
      res.destroy()
      return { finalUrl, contentLength, contentType }
    }
    throw err
  }
}

export async function safeFetchText(
  rawUrl,
  { maxBytes = 2 * 1024 * 1024, timeoutMs = 12000, maxRedirects = 5 } = {}
) {
  const { res } = await resolveSafeStream(rawUrl, { maxBytes, timeoutMs, maxRedirects })
  const chunks = []
  let total = 0

  for await (const chunk of res) {
    total += chunk.length
    if (total > maxBytes) {
      res.destroy()
      throw new AppError(413, 'Remote feed exceeds maximum allowed size.', 'FILE_TOO_LARGE')
    }
    chunks.push(chunk)
  }

  return Buffer.concat(chunks).toString('utf8')
}

export async function safeFetchHtmlSnippet(
  rawUrl,
  { maxBytes = 256 * 1024, timeoutMs = 8000, maxRedirects = 5 } = {}
) {
  const { res, finalUrl, contentType } = await resolveSafeStream(rawUrl, {
    maxBytes: 20 * 1024 * 1024,
    timeoutMs,
    maxRedirects,
  })
  const chunks = []
  let total = 0
  for await (const chunk of res) {
    chunks.push(chunk)
    total += chunk.length
    if (total >= maxBytes) {
      res.destroy()
      break
    }
  }
  return {
    html: Buffer.concat(chunks).toString('utf8'),
    finalUrl,
    contentType,
  }
}

export async function safeDownloadToFile(
  rawUrl,
  destPath,
  {
    maxBytes = 100 * 1024 * 1024,
    timeoutMs = 30000,
    maxRedirects = 5,
    validateAudio = false,
    onProgress,
    shouldCancel,
  } = {}
) {
  const { res, contentLength, contentType } = await resolveSafeStream(rawUrl, {
    maxBytes,
    timeoutMs,
    maxRedirects,
  })

  if (validateAudio) {
    const ctCheck = validateAudioContentType(contentType)
    if (!ctCheck.ok && ctCheck.kind === 'RSS_FEED') {
      res.destroy()
      throw new AppError(
        400,
        'This URL points to an RSS or XML feed, not a direct audio file. Click Preview RSS to import an episode.',
        'RSS_FEED_DETECTED'
      )
    }
  }

  const writeStream = fs.createWriteStream(destPath)
  let downloaded = 0

  try {
    for await (const chunk of res) {
      if (shouldCancel && (await shouldCancel())) {
        res.destroy()
        writeStream.destroy()
        return { cancelled: true, downloaded }
      }
      downloaded += chunk.length
      if (downloaded > maxBytes) {
        res.destroy()
        writeStream.destroy()
        throw new AppError(413, 'The audio file exceeds the maximum import size.', 'FILE_TOO_LARGE')
      }
      writeStream.write(chunk)
      if (onProgress && contentLength > 0) {
        await onProgress(downloaded, contentLength)
      }
    }

    await new Promise((resolve, reject) => {
      writeStream.end(resolve)
      writeStream.on('error', reject)
    })

    return { cancelled: false, downloaded }
  } catch (err) {
    writeStream.destroy()
    throw err
  }
}
