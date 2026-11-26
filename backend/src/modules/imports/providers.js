import {
  classifyUrlWithRegistry,
  resolveAndInspectSource,
} from './resolvers/index.js'

export function classifySourceUrl(rawUrl) {
  const res = classifyUrlWithRegistry(rawUrl)
  const item = res.classification || res
  return {
    ...item,
    kind: item.sourceType,
  }
}

export { resolveAndInspectSource, classifyUrlWithRegistry }

export const SUPPORTED_AUDIO_FORMATS = [
  'MP3',
  'WAV',
  'M4A',
  'OGG',
  'FLAC',
  'AAC',
  'WebM',
]
