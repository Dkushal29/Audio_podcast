import fs from 'fs'
import { Readable } from 'stream'
import { env } from '../config/env.js'
import { AppError } from '../utils/errors.js'

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen'

/**
 * Maps Deepgram's JSON response into EchoSpace transcript segments
 * compatible with WaveSurfer playback timestamps and speaker diarization.
 */
export function parseDeepgramResponse(raw) {
  const channel = raw?.results?.channels?.[0]
  const alt = channel?.alternatives?.[0]
  if (!alt) {
    return {
      fullText: '',
      confidence: 0,
      detectedLanguage: channel?.detected_language || null,
      segments: [],
    }
  }

  const utterances = Array.isArray(raw?.results?.utterances)
    ? raw.results.utterances
    : []

  let segments = []
  if (utterances.length > 0) {
    segments = utterances.map((u, idx) => ({
      id: `seg-${idx + 1}`,
      text: (u.transcript || '').trim(),
      start: Number((u.start ?? 0).toFixed(2)),
      end: Number((u.end ?? u.start ?? 0).toFixed(2)),
      confidence: Number((u.confidence ?? alt.confidence ?? 0).toFixed(3)),
      speaker: typeof u.speaker === 'number' ? u.speaker : null,
      words: Array.isArray(u.words)
        ? u.words.map((w) => ({
            word: w.punctuated_word || w.word || '',
            start: Number((w.start ?? 0).toFixed(2)),
            end: Number((w.end ?? w.start ?? 0).toFixed(2)),
            confidence: Number((w.confidence ?? 0).toFixed(3)),
            speaker: typeof w.speaker === 'number' ? w.speaker : null,
          }))
        : [],
    }))
  } else if (Array.isArray(alt.words) && alt.words.length > 0) {
    // Group words into ~12-word segments when utterances are absent
    const chunkSize = 12
    for (let i = 0; i < alt.words.length; i += chunkSize) {
      const slice = alt.words.slice(i, i + chunkSize)
      const first = slice[0]
      const last = slice[slice.length - 1]
      segments.push({
        id: `seg-${segments.length + 1}`,
        text: slice.map((w) => w.punctuated_word || w.word || '').join(' ').trim(),
        start: Number((first.start ?? 0).toFixed(2)),
        end: Number((last.end ?? first.start ?? 0).toFixed(2)),
        confidence: Number(
          (
            slice.reduce((acc, w) => acc + (w.confidence ?? 0), 0) / slice.length
          ).toFixed(3)
        ),
        speaker: typeof first.speaker === 'number' ? first.speaker : null,
        words: slice.map((w) => ({
          word: w.punctuated_word || w.word || '',
          start: Number((w.start ?? 0).toFixed(2)),
          end: Number((w.end ?? w.start ?? 0).toFixed(2)),
          confidence: Number((w.confidence ?? 0).toFixed(3)),
          speaker: typeof w.speaker === 'number' ? w.speaker : null,
        })),
      })
    }
  }

  return {
    fullText: (alt.transcript || '').trim(),
    confidence: Number((alt.confidence ?? 0).toFixed(3)),
    detectedLanguage: channel?.detected_language || null,
    segments: segments.filter((s) => s.text.length > 0),
  }
}

export async function transcribeAudioFile(
  filePath,
  mimeType = 'audio/mpeg',
  options = {},
  { fetchImpl = fetch, apiKey = env.deepgramApiKey } = {}
) {
  if (!apiKey) {
    throw new AppError(
      503,
      'Deepgram transcription is not configured (missing DEEPGRAM_API_KEY).',
      'TRANSCRIPTION_NOT_CONFIGURED'
    )
  }

  const params = new URLSearchParams({
    model: options.model || env.deepgramModel || 'nova-2',
    smart_format: String(options.smartFormat !== false),
    punctuate: String(options.punctuate !== false),
    diarize: String(options.diarize !== false),
    paragraphs: String(options.paragraphs !== false),
    utterances: 'true',
  })

  if (options.language && options.language !== 'auto') {
    params.set('language', options.language)
  } else {
    params.set('detect_language', 'true')
  }

  const controller = new AbortController()
  const timeoutMs = Number(options.timeoutMs || 5 * 60 * 1000)
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const fileStream = fs.createReadStream(filePath)
    const webStream = Readable.toWeb(fileStream)

    const res = await fetchImpl(`${DEEPGRAM_API_URL}?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': mimeType || 'audio/mpeg',
      },
      body: webStream,
      duplex: 'half',
      signal: controller.signal,
    })

    if (res.status === 429) {
      throw new AppError(
        429,
        'Transcription provider rate limit reached. Please retry shortly.',
        'DEEPGRAM_RATE_LIMIT'
      )
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      throw new AppError(
        502,
        `Transcription provider returned HTTP ${res.status}.${bodyText ? ' Check audio format or API settings.' : ''}`,
        'DEEPGRAM_ERROR'
      )
    }

    const json = await res.json()
    return parseDeepgramResponse(json)
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new AppError(
        504,
        'Transcription request timed out.',
        'DEEPGRAM_TIMEOUT'
      )
    }
    if (err instanceof AppError) throw err
    throw new AppError(
      502,
      `Transcription failed: ${err.message}`,
      'DEEPGRAM_FAILED'
    )
  } finally {
    clearTimeout(timer)
  }
}
