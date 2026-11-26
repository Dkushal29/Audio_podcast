import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText,
  Search,
  Sparkles,
  RefreshCw,
  MessageSquarePlus,
  XCircle,
  Users,
  Check,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { apiClient } from '../../services/api'
import { getSocket } from '../../services/socket'
import { formatTime } from '../../utils/time'

export function TranscriptPanel({
  episodeId,
  mode = 'study',
  currentTime = 0,
  canWrite = false,
  hasAudio = false,
  onSeekTo,
  onAnnotateAt,
}) {
  const isStudy = mode === 'study'
  const [transcript, setTranscript] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [diarize, setDiarize] = useState(true)
  const [language, setLanguage] = useState('auto')
  const [editingSpeaker, setEditingSpeaker] = useState(null)
  const [speakerNameInput, setSpeakerNameInput] = useState('')
  const activeSegRef = useRef(null)

  useEffect(() => {
    if (!episodeId) return
    let active = true
    setLoading(true)
    setError('')

    apiClient
      .getTranscription(episodeId)
      .then((t) => {
        if (active) setTranscript(t)
      })
      .catch(() => {
        if (active) setTranscript(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    const socket = getSocket()
    const onUpdated = ({ transcript: next }) => {
      if (next && next.episodeId === episodeId) {
        setTranscript(next)
      }
    }
    const onDeleted = ({ episodeId: deletedEpId }) => {
      if (deletedEpId === episodeId) setTranscript(null)
    }

    socket?.on('transcription:updated', onUpdated)
    socket?.on('transcription:deleted', onDeleted)

    return () => {
      active = false
      socket?.off('transcription:updated', onUpdated)
      socket?.off('transcription:deleted', onDeleted)
    }
  }, [episodeId])

  // Polling fallback while QUEUED or PROCESSING
  useEffect(() => {
    if (!transcript || !['QUEUED', 'PROCESSING'].includes(transcript.status)) {
      return
    }
    const timer = setInterval(async () => {
      try {
        const latest = await apiClient.getTranscription(episodeId)
        if (latest) setTranscript(latest)
      } catch {
        // Ignore transient poll error
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [transcript, episodeId])

  const segments = useMemo(() => {
    const raw = Array.isArray(transcript?.segments) ? transcript.segments : []
    if (!query.trim()) return raw
    const q = query.trim().toLowerCase()
    return raw.filter((s) => String(s.text || '').toLowerCase().includes(q))
  }, [transcript, query])

  const activeSegmentId = useMemo(() => {
    if (!transcript || transcript.status !== 'COMPLETED') return null
    const raw = Array.isArray(transcript.segments) ? transcript.segments : []
    const found = raw.find(
      (s) => currentTime >= (s.start || 0) && currentTime <= (s.end || 0)
    )
    return found?.id || null
  }, [transcript, currentTime])

  useEffect(() => {
    if (activeSegRef.current) {
      activeSegRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [activeSegmentId])

  const speakerLabel = (speakerId) => {
    if (speakerId === null || speakerId === undefined) return null
    const custom = transcript?.speakers?.[String(speakerId)]
    return custom || `Speaker ${speakerId + 1}`
  }

  const handleStartTranscription = async () => {
    try {
      setSubmitting(true)
      setError('')
      const created = await apiClient.requestTranscription(episodeId, {
        language,
        diarize,
      })
      setTranscript(created)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Could not start transcription.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = async () => {
    try {
      setSubmitting(true)
      setError('')
      const retried = await apiClient.retryTranscription(episodeId)
      setTranscript(retried)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Could not retry transcription.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveSpeakerName = async (speakerId) => {
    if (!speakerNameInput.trim()) {
      setEditingSpeaker(null)
      return
    }
    try {
      const nextMap = {
        ...(transcript?.speakers || {}),
        [String(speakerId)]: speakerNameInput.trim(),
      }
      const updated = await apiClient.updateSpeakerLabels(episodeId, nextMap)
      setTranscript(updated)
    } catch {
      // Ignore
    } finally {
      setEditingSpeaker(null)
    }
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <FileText
            className={`w-4 h-4 ${isStudy ? 'text-[#22D3EE]' : 'text-[#A78BFA]'}`}
          />
          <div>
            <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
              Transcript &amp; Audio Intelligence
            </h2>
            <p className="text-xs text-[#A1A1B0]">
              Click any segment to jump in the waveform or attach a timestamped note
            </p>
          </div>
        </div>

        {transcript?.status && (
          <Badge
            tone={
              transcript.status === 'COMPLETED'
                ? 'emerald'
                : transcript.status === 'FAILED'
                  ? 'rose'
                  : 'cyan'
            }
          >
            {transcript.status}
          </Badge>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs text-[#A1A1B0]">
          Loading transcript...
        </div>
      ) : !hasAudio ? (
        <div className="p-4 rounded-lg bg-[#08080B] border border-[#22222B] text-xs text-[#A1A1B0]">
          Transcription is available for uploaded or imported audio files.
        </div>
      ) : !transcript || transcript.status === 'CANCELLED' ? (
        <div className="p-4 rounded-xl bg-[#08080B] border border-[#22222B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#F4F4F7]">
              Generate a searchable, speaker-aware transcript with Deepgram
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#A1A1B0]">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={diarize}
                  onChange={(e) => setDiarize(e.target.checked)}
                  className="accent-[#22D3EE]"
                />
                <Users className="w-3.5 h-3.5" />
                Speaker diarization
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-7 px-2 rounded bg-[#101015] border border-[#22222B] text-xs text-[#F4F4F7]"
              >
                <option value="auto">Auto-detect language</option>
                <option value="en">English (en)</option>
                <option value="es">Spanish (es)</option>
                <option value="fr">French (fr)</option>
                <option value="de">German (de)</option>
                <option value="hi">Hindi (hi)</option>
              </select>
            </div>
          </div>

          {canWrite && (
            <Button
              size="sm"
              variant={isStudy ? 'cyan' : 'primary'}
              onClick={handleStartTranscription}
              disabled={submitting}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {submitting ? 'Queuing...' : 'Transcribe Audio'}
            </Button>
          )}
        </div>
      ) : ['QUEUED', 'PROCESSING'].includes(transcript.status) ? (
        <div className="p-4 rounded-xl bg-[#08080B] border border-[#22222B] flex items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[#F4F4F7]">
              {transcript.status === 'QUEUED'
                ? 'Transcription queued for worker...'
                : 'Transcribing audio with Deepgram...'}
            </p>
            <p className="text-[11px] text-[#8A8A9A]">
              This runs asynchronously and will appear automatically when ready.
            </p>
          </div>
          {canWrite && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                apiClient
                  .cancelTranscription(episodeId)
                  .then(setTranscript)
                  .catch(() => {})
              }
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </Button>
          )}
        </div>
      ) : transcript.status === 'FAILED' ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-rose-300">
            {transcript.error || 'Transcription failed.'}
          </p>
          {canWrite && (
            <Button size="sm" variant="secondary" onClick={handleRetry} disabled={submitting}>
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Transcription
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Search & Metadata Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 text-[#8A8A9A] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search transcript..."
                className="w-full h-8.5 pl-8 pr-3 rounded-lg bg-[#08080B] border border-[#22222B] text-xs text-[#F4F4F7] placeholder-[#8A8A9A] focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#8A8A9A]">
              {transcript.detectedLanguage && (
                <span>Lang: {transcript.detectedLanguage.toUpperCase()}</span>
              )}
              {typeof transcript.confidence === 'number' && transcript.confidence > 0 && (
                <span>· {Math.round(transcript.confidence * 100)}% confidence</span>
              )}
            </div>
          </div>

          {/* Scrollable Segments */}
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {segments.length === 0 ? (
              <p className="py-6 text-center text-xs text-[#A1A1B0]">
                {query.trim()
                  ? 'No transcript segments match your search.'
                  : transcript.fullText || 'No speech detected in this recording.'}
              </p>
            ) : (
              segments.map((seg) => {
                const isActive = seg.id === activeSegmentId
                const label = speakerLabel(seg.speaker)
                return (
                  <div
                    key={seg.id}
                    ref={isActive ? activeSegRef : null}
                    onClick={() => onSeekTo?.(seg.start, true)}
                    className={`group p-3 rounded-lg border transition-colors cursor-pointer ${
                      isActive
                        ? isStudy
                          ? 'bg-[#16161D] border-[#22D3EE]/50'
                          : 'bg-[#16161D] border-[#8B5CF6]/55'
                        : 'bg-[#08080B] border-[#22222B] hover:border-[#343442]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono-time text-[11px] ${
                            isStudy ? 'text-[#22D3EE]' : 'text-[#A78BFA]'
                          }`}
                        >
                          {formatTime(seg.start)}
                        </span>
                        {label && editingSpeaker === seg.speaker ? (
                          <span
                            className="inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={speakerNameInput}
                              onChange={(e) => setSpeakerNameInput(e.target.value)}
                              className="h-5 px-1.5 rounded bg-[#101015] border border-[#343442] text-[11px] text-[#F4F4F7] w-28"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSpeakerName(seg.speaker)}
                              className="text-emerald-400 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </span>
                        ) : (
                          label && (
                            <button
                              type="button"
                              onClick={(e) => {
                                if (!canWrite) return
                                e.stopPropagation()
                                setEditingSpeaker(seg.speaker)
                                setSpeakerNameInput(label)
                              }}
                              title={canWrite ? 'Click to rename speaker' : label}
                              className="text-[11px] font-semibold text-[#A1A1B0] hover:text-[#F4F4F7] cursor-pointer"
                            >
                              {label}
                            </button>
                          )
                        )}
                      </div>

                      {canWrite && onAnnotateAt && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onAnnotateAt(Math.floor(seg.start))
                          }}
                          className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 text-[11px] text-[#A1A1B0] hover:text-[#F4F4F7] transition-opacity cursor-pointer"
                          title="Add annotation at this timestamp"
                        >
                          <MessageSquarePlus className="w-3 h-3" />
                          Note
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-[#E4E4E7] leading-relaxed">
                      {seg.text}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
