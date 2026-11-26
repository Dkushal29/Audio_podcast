import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquarePlus,
  Scissors,
  Clock,
  Tag,
  Plus,
  ExternalLink,
  Trash2,
  Bookmark,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AudioPlayer } from '../components/audio/AudioPlayer'
import { ChapterTimeline } from '../components/audio/ChapterTimeline'
import { TranscriptPanel } from '../components/audio/TranscriptPanel'
import { AnnotationCard } from '../components/annotations/AnnotationCard'
import { AnnotationForm } from '../components/annotations/AnnotationForm'
import { ClipCard } from '../components/clips/ClipCard'
import { ClipModal } from '../components/clips/ClipModal'
import { useEchoStore } from '../store/useEchoStore'
import { getModeConfig } from '../config/modeConfig'
import { formatTime } from '../utils/time'
import {
  extractYouTubeVideoId,
  getYouTubeThumbnailUrl,
  getYouTubeTimestampUrl,
} from '../utils/youtube'
import {
  getSocket,
  joinEpisodeRoom,
  leaveEpisodeRoom,
} from '../services/socket'
import { apiClient } from '../services/api'

const DIRECT_AUDIO_EXT_RE = /\.(mp3|wav|ogg|m4a|aac|flac|webm)(\?.*)?$/i

export function AudioWorkspacePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = useEchoStore((s) => s.token)
  const user = useEchoStore((s) => s.user)
  const activeWorkspaceRole = useEchoStore((s) => s.activeWorkspaceRole)
  const recordings = useEchoStore((s) => s.recordings)
  const annotations = useEchoStore((s) => s.annotations)
  const clips = useEchoStore((s) => s.clips)
  const workspaceSettings = useEchoStore((s) => s.workspaceSettings)

  const loadEpisodeDetail = useEchoStore((s) => s.loadEpisodeDetail)
  const deleteRecording = useEchoStore((s) => s.deleteRecording)
  const addAnnotation = useEchoStore((s) => s.addAnnotation)
  const updateAnnotationStatus = useEchoStore((s) => s.updateAnnotationStatus)
  const editAnnotation = useEchoStore((s) => s.editAnnotation)
  const deleteAnnotation = useEchoStore((s) => s.deleteAnnotation)
  const addReply = useEchoStore((s) => s.addReply)
  const deleteReply = useEchoStore((s) => s.deleteReply)
  const addClip = useEchoStore((s) => s.addClip)
  const deleteClip = useEchoStore((s) => s.deleteClip)
  const addChapter = useEchoStore((s) => s.addChapter)
  const deleteChapter = useEchoStore((s) => s.deleteChapter)
  const createBookmark = useEchoStore((s) => s.createBookmark)
  const deleteBookmark = useEchoStore((s) => s.deleteBookmark)

  const applySocketBookmarkCreated = useEchoStore(
    (s) => s.applySocketBookmarkCreated
  )
  const applySocketBookmarkDeleted = useEchoStore(
    (s) => s.applySocketBookmarkDeleted
  )

  const applySocketAnnotationCreated = useEchoStore(
    (s) => s.applySocketAnnotationCreated
  )
  const applySocketAnnotationUpdated = useEchoStore(
    (s) => s.applySocketAnnotationUpdated
  )
  const applySocketAnnotationDeleted = useEchoStore(
    (s) => s.applySocketAnnotationDeleted
  )
  const applySocketReplyCreated = useEchoStore(
    (s) => s.applySocketReplyCreated
  )
  const applySocketReplyDeleted = useEchoStore(
    (s) => s.applySocketReplyDeleted
  )
  const applySocketClipCreated = useEchoStore(
    (s) => s.applySocketClipCreated
  )
  const applySocketClipDeleted = useEchoStore(
    (s) => s.applySocketClipDeleted
  )

  const recording = recordings.find((r) => r.id === id) || null
  const isManager = ['OWNER', 'EDITOR'].includes(activeWorkspaceRole)
  const canWrite = ['OWNER', 'EDITOR', 'MEMBER'].includes(activeWorkspaceRole)

  const [loadingEpisode, setLoadingEpisode] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [authorizedAudioUrl, setAuthorizedAudioUrl] = useState(null)

  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(recording?.duration || 0)
  const [seekTarget, setSeekTarget] = useState(null)
  const [activeClipRange, setActiveClipRange] = useState(null)

  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null)
  const [showAnnotationForm, setShowAnnotationForm] = useState(false)
  const [clipModalOpen, setClipModalOpen] = useState(false)
  const [highlightStart, setHighlightStart] = useState(null)
  const [clipInitialRange, setClipInitialRange] = useState({ start: null, end: null })
  const [clipToast, setClipToast] = useState(null)

  // Deep-link timestamp & annotation selection from Notifications (?t=...&ann=...)
  useEffect(() => {
    const tParam = searchParams.get('t')
    const annParam = searchParams.get('ann')
    if (annParam) setSelectedAnnotationId(annParam)
    if (tParam !== null && !Number.isNaN(Number(tParam))) {
      setSeekTarget({ time: Math.max(0, Number(tParam)), autoplay: false, ts: Date.now() })
    }
  }, [id, searchParams])

  const [showChapterForm, setShowChapterForm] = useState(false)
  const [chapterTitle, setChapterTitle] = useState('')
  const [chapterError, setChapterError] = useState('')

  useEffect(() => {
    if (!token || !id) return
    let active = true
    setLoadingEpisode(true)
    setLoadError('')
    setActiveClipRange(null)

    loadEpisodeDetail(id)
      .then(async (ep) => {
        if (active && ep) {
          setDuration(ep.duration || 0)
          if (ep.sourceType === 'UPLOAD') {
            try {
              const access = await apiClient.getEpisodeAudioAccess(id)
              if (active && access?.url) setAuthorizedAudioUrl(access.url)
            } catch {
              if (active) setAuthorizedAudioUrl(apiClient.getEpisodeAudioUrl(id))
            }
          }
        }
      })
      .catch((err) => {
        if (active) {
          setLoadError(
            err.response?.data?.error?.message ||
              'Could not load this recording.'
          )
        }
      })
      .finally(() => {
        if (active) setLoadingEpisode(false)
      })

    joinEpisodeRoom(id)

    const socket = getSocket()
    if (!socket) {
      return () => {
        active = false
        leaveEpisodeRoom(id)
      }
    }

    const onAnnCreated = ({ annotation }) =>
      applySocketAnnotationCreated(annotation)
    const onAnnUpdated = ({ annotation }) =>
      applySocketAnnotationUpdated(annotation)
    const onAnnDeleted = ({ annotationId }) =>
      applySocketAnnotationDeleted(annotationId)
    const onReplyCreated = (payload) => applySocketReplyCreated(payload)
    const onReplyDeleted = (payload) => applySocketReplyDeleted(payload)
    const onClipCreated = ({ clip }) => applySocketClipCreated(clip)
    const onClipDeleted = ({ clipId }) => applySocketClipDeleted(clipId)
    const onBookmarkCreated = ({ bookmark }) =>
      applySocketBookmarkCreated(id, bookmark)
    const onBookmarkDeleted = ({ id: bookmarkId }) =>
      applySocketBookmarkDeleted(id, bookmarkId)

    socket.on('annotation:created', onAnnCreated)
    socket.on('annotation:updated', onAnnUpdated)
    socket.on('annotation:deleted', onAnnDeleted)
    socket.on('reply:created', onReplyCreated)
    socket.on('reply:deleted', onReplyDeleted)
    socket.on('clip:created', onClipCreated)
    socket.on('clip:deleted', onClipDeleted)
    socket.on('bookmark:created', onBookmarkCreated)
    socket.on('bookmark:deleted', onBookmarkDeleted)

    return () => {
      active = false
      leaveEpisodeRoom(id)
      socket.off('annotation:created', onAnnCreated)
      socket.off('annotation:updated', onAnnUpdated)
      socket.off('annotation:deleted', onAnnDeleted)
      socket.off('reply:created', onReplyCreated)
      socket.off('reply:deleted', onReplyDeleted)
      socket.off('clip:created', onClipCreated)
      socket.off('clip:deleted', onClipDeleted)
      socket.off('bookmark:created', onBookmarkCreated)
      socket.off('bookmark:deleted', onBookmarkDeleted)
    }
  }, [token, id])

  const mode = recording?.mode || 'study'
  const cfg = getModeConfig(mode)

  const recordingAnnotations = useMemo(() => {
    if (!recording) return []
    const list = annotations.filter((a) => a.recordingId === recording.id)
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)
    if (categoryFilter === 'ALL') return sorted
    return sorted.filter((a) => a.category === categoryFilter)
  }, [annotations, recording, categoryFilter])

  const recordingClips = useMemo(() => {
    if (!recording) return []
    return clips.filter((c) => c.recordingId === recording.id)
  }, [clips, recording])

  if (loadingEpisode && !recording) {
    return (
      <div className="p-8 text-center text-sm text-[#A1A1AA]">
        Loading recording workspace...
      </div>
    )
  }

  if (loadError && !recording) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <p className="text-sm text-rose-400">{loadError}</p>
        <Link to="/app/recordings">
          <Button size="sm" variant="secondary">
            Back to Recordings
          </Button>
        </Link>
      </div>
    )
  }

  if (!recording) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <p className="text-sm text-[#A1A1AA]">Recording not found.</p>
        <Link to="/app/recordings">
          <Button size="sm" variant="secondary">
            Back to Recordings
          </Button>
        </Link>
      </div>
    )
  }

  const isExternalDirectAudio =
    recording.sourceType === 'EXTERNAL_LINK' &&
    Boolean(recording.sourceUrl && DIRECT_AUDIO_EXT_RE.test(recording.sourceUrl))

  const playableRecording =
    recording.sourceType === 'UPLOAD'
      ? {
          ...recording,
          audioUrl: authorizedAudioUrl || apiClient.getEpisodeAudioUrl(recording.id),
        }
      : isExternalDirectAudio
        ? { ...recording, audioUrl: recording.sourceUrl }
        : null

  const handleRetryAudio = async () => {
    if (recording.sourceType !== 'UPLOAD') return
    try {
      const access = await apiClient.getEpisodeAudioAccess(recording.id)
      if (access?.url) setAuthorizedAudioUrl(access.url)
    } catch {
      setAuthorizedAudioUrl(`${apiClient.getEpisodeAudioUrl(recording.id)}&_r=${Date.now()}`)
    }
  }

  const seekTo = (time, autoplay = false) => {
    const safe = Math.max(0, time)
    setSeekTarget({ time: safe, autoplay, ts: Date.now() })
    setCurrentTime(safe)
  }

  const handlePlayClipInterval = (startTime, endTime) => {
    setActiveClipRange({ startTime, endTime })
    seekTo(startTime, true)
  }

  const handleCreateAnnotation = async ({ timestamp, category, content }) => {
    try {
      setActionError('')
      const created = await addAnnotation({
        recordingId: recording.id,
        timestamp,
        category,
        content,
      })
      setSelectedAnnotationId(created.id)
      setShowAnnotationForm(false)
    } catch (err) {
      setActionError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to create annotation.'
      )
    }
  }

  const handleAction = async (fn, fallbackMsg) => {
    try {
      setActionError('')
      await fn()
    } catch (err) {
      setActionError(
        err.response?.data?.error?.message || err.message || fallbackMsg
      )
    }
  }

  const handleSaveClip = async (clipInput) => {
    const created = await addClip({
      recordingId: recording.id,
      ...clipInput,
    })
    setClipToast(created)
    setTimeout(() => setClipToast(null), 6000)
  }

  const handleCreateChapter = async (e) => {
    e.preventDefault()
    if (!chapterTitle.trim()) {
      setChapterError('Chapter title is required.')
      return
    }
    try {
      setChapterError('')
      await addChapter({
        episodeId: recording.id,
        title: chapterTitle.trim(),
        startTime: Math.floor(currentTime),
      })
      setChapterTitle('')
      setShowChapterForm(false)
    } catch (err) {
      setChapterError(
        err.response?.data?.error?.message ||
          err.message ||
          'Could not add chapter.'
      )
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Top breadcrumb & metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/app/recordings"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1B0] hover:text-[#F4F4F7] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All {cfg.recordingPlural}
          </Link>
          <span className="text-[#343442]">/</span>
          <Badge tone={cfg.badgeTone}>
            {cfg.name}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#A1A1B0]">
          <span>By {recording.authorName}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 font-mono-time text-[#F4F4F7] bg-[#101015] border border-[#22222B] px-2 py-0.5 rounded">
            <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
            {formatTime(duration || recording.duration)}
          </span>
          {(isManager || (user && recording.authorId === user.id)) && (
            <button
              type="button"
              onClick={() =>
                handleAction(async () => {
                  if (
                    !window.confirm(
                      `Delete "${recording.title}"? This action cannot be undone.`
                    )
                  ) {
                    return
                  }
                  await deleteRecording(recording.id)
                  navigate('/app/recordings')
                }, 'Failed to delete recording.')
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#27272F] text-[#A1A1AA] hover:text-rose-400 hover:border-rose-500/40 transition-colors cursor-pointer"
              title="Delete recording"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {actionError}
        </div>
      )}

      {clipToast && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
          <span className="text-emerald-300">
            Highlight clip <strong>{clipToast.title}</strong> saved (
            {formatTime(clipToast.startTime)} – {formatTime(clipToast.endTime)}).
          </span>
          <Link
            to={`/clips/${clipToast.shareToken || clipToast.id}`}
            className="font-medium text-[#22D3EE] hover:underline shrink-0"
          >
            Open Share Page →
          </Link>
        </div>
      )}

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left/Main Audio Workspace (8 cols) */}
        <div className="xl:col-span-8 space-y-5">
          <Card className="p-5 space-y-3">
            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F4F4F5]">
                {recording.title}
              </h1>
              {recording.description && (
                <p className="text-sm text-[#A1A1AA] leading-relaxed">
                  {recording.description}
                </p>
              )}
              {recording.tags?.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Tag className="w-3.5 h-3.5 text-[#71717A]" />
                  {recording.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Authoritative AudioPlayer for UPLOAD or direct audio EXTERNAL_LINK */}
          {playableRecording ? (
            <AudioPlayer
              recording={playableRecording}
              mode={mode}
              annotations={recordingAnnotations}
              clips={recordingClips}
              activeAnnotationId={selectedAnnotationId}
              clipRange={activeClipRange}
              seekToTime={seekTarget}
              defaultSpeed={workspaceSettings.defaultPlaybackSpeed || 1}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              onSelectAnnotation={(ann) => {
                setSelectedAnnotationId(ann.id)
                setCurrentTime(ann.timestamp)
              }}
              onSelectClip={(clip) =>
                setActiveClipRange({
                  startTime: clip.startTime,
                  endTime: clip.endTime,
                })
              }
              onClearClipRange={() => setActiveClipRange(null)}
              onCreateAnnotation={
                canWrite
                  ? (t) => {
                      setCurrentTime(t)
                      setShowAnnotationForm(true)
                    }
                  : undefined
              }
              onCreateClip={
                canWrite
                  ? (t) => {
                      setCurrentTime(t)
                      setClipInitialRange({ start: null, end: null })
                      setClipModalOpen(true)
                    }
                  : undefined
              }
              highlightStart={highlightStart}
              onStartHighlight={
                canWrite ? (t) => setHighlightStart(Math.floor(t)) : undefined
              }
              onStopHighlight={
                canWrite
                  ? (t) => {
                      const start = highlightStart ?? Math.floor(t)
                      const end = Math.max(start + 1, Math.floor(t))
                      setHighlightStart(null)
                      setClipInitialRange({ start, end })
                      setClipModalOpen(true)
                    }
                  : undefined
              }
              onCancelHighlight={() => setHighlightStart(null)}
              onRetryAudio={handleRetryAudio}
            />
          ) : (() => {
            const youtubeId = extractYouTubeVideoId(recording.sourceUrl)
            const ytThumb = getYouTubeThumbnailUrl(youtubeId)
            const ytJumpUrl = getYouTubeTimestampUrl(
              recording.sourceUrl,
              currentTime
            )
            const bookmarks = recording.bookmarks || []

            return (
              <>
                <Card className="p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {ytThumb && (
                        <img
                          src={ytThumb}
                          alt={recording.title}
                          className="w-28 h-16 rounded-lg object-cover border border-[#27272F] shrink-0"
                        />
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge tone={youtubeId ? 'rose' : 'cyan'}>
                            {youtubeId ? 'YouTube Collaboration' : 'External Media Link'}
                          </Badge>
                          {youtubeId && currentTime > 0 && (
                            <span className="text-[11px] font-mono text-[#22D3EE]">
                              Selected: {formatTime(currentTime)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#A1A1AA] truncate">
                          {recording.sourceUrl}
                        </p>
                        <p className="text-[11px] text-[#71717A]">
                          {youtubeId
                            ? 'Synced from YouTube without downloading video/audio. Waveform, AI transcription, and audio clips are disabled; annotations, questions, and bookmarks sync live with the Chrome extension.'
                            : 'This link points to an external webpage rather than a direct audio stream. Open the original source to listen, and record timestamped notes below.'}
                        </p>
                      </div>
                    </div>
                    {recording.sourceUrl && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {ytJumpUrl && currentTime > 0 && (
                          <a
                            href={ytJumpUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#164E63]/40 border border-[#22D3EE]/40 text-xs font-medium text-[#67E8F9] hover:border-[#22D3EE]"
                          >
                            Jump to {formatTime(currentTime)}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <a
                          href={recording.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#18181D] border border-[#27272F] text-xs font-medium text-[#22D3EE] hover:border-[#22D3EE]/40"
                        >
                          {youtubeId ? 'Open on YouTube' : 'Open Source Media'}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>

                  {canWrite && (
                    <div className="pt-3 border-t border-[#27272F] flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant={mode === 'study' ? 'cyan' : 'primary'}
                        onClick={() => setShowAnnotationForm(true)}
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                        Create Annotation
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          handleAction(
                            () =>
                              createBookmark(recording.id, {
                                timestamp: currentTime || 0,
                                label: `Bookmark at ${formatTime(currentTime || 0)}`,
                              }),
                            'Failed to save bookmark.'
                          )
                        }
                      >
                        <Bookmark className="w-3.5 h-3.5" />
                        Bookmark ({formatTime(currentTime)})
                      </Button>
                    </div>
                  )}
                </Card>

                {/* Timestamped Bookmarks */}
                <Card className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                      Bookmarks ({bookmarks.length})
                    </span>
                  </div>
                  {bookmarks.length === 0 ? (
                    <p className="text-xs text-[#A1A1B0]">
                      No bookmarks yet. Save a key moment from the YouTube extension or click Bookmark above.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {bookmarks.map((bm) => {
                        const bmYtUrl = getYouTubeTimestampUrl(
                          recording.sourceUrl,
                          bm.timestamp
                        )
                        const canDel =
                          isManager || (user && bm.userId === user.id)
                        return (
                          <div
                            key={bm.id}
                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#09090B] border border-[#27272F]"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                onClick={() => seekTo(bm.timestamp)}
                                className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272F] text-[11px] font-mono text-[#22D3EE] hover:border-[#22D3EE]/50 cursor-pointer shrink-0"
                              >
                                {formatTime(bm.timestamp)}
                              </button>
                              <span className="text-xs text-[#F4F4F5] truncate">
                                {bm.label || `Moment at ${formatTime(bm.timestamp)}`}
                              </span>
                              {bm.user?.name && (
                                <span className="text-[11px] text-[#71717A] shrink-0">
                                  by {bm.user.name}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {bmYtUrl && (
                                <a
                                  href={bmYtUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-[#67E8F9] hover:underline"
                                >
                                  YouTube
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {canDel && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAction(
                                      () => deleteBookmark(recording.id, bm.id),
                                      'Failed to delete bookmark.'
                                    )
                                  }
                                  className="text-[#71717A] hover:text-rose-400 cursor-pointer"
                                  title="Delete bookmark"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </Card>
              </>
            )
          })()}

          {/* Transcript & Audio Intelligence */}
          <TranscriptPanel
            episodeId={recording.id}
            mode={mode}
            currentTime={currentTime}
            canWrite={canWrite}
            hasAudio={Boolean(playableRecording)}
            onSeekTo={(t, autoplay) => seekTo(t, autoplay)}
            onAnnotateAt={(t) => {
              seekTo(t, false)
              setShowAnnotationForm(true)
            }}
          />

          {/* Chapters Card */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#A1A1AA]">
                Chapter Timeline
              </span>
              {canWrite && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowChapterForm((p) => !p)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Chapter ({formatTime(currentTime)})
                </Button>
              )}
            </div>

            {showChapterForm && (
              <form
                onSubmit={handleCreateChapter}
                className="flex flex-col sm:flex-row gap-2 pt-1"
              >
                <input
                  type="text"
                  value={chapterTitle}
                  onChange={(e) => {
                    setChapterTitle(e.target.value)
                    setChapterError('')
                  }}
                  placeholder="Chapter title at current timestamp..."
                  className="flex-1 h-9 px-3 rounded-lg bg-[#09090B] border border-[#27272F] text-sm text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
                />
                <Button type="submit" size="sm">
                  Save Chapter
                </Button>
              </form>
            )}
            {chapterError && (
              <p className="text-xs text-rose-400">{chapterError}</p>
            )}

            {recording.chapters?.length > 0 ? (
              <ChapterTimeline
                chapters={recording.chapters}
                currentTime={currentTime}
                onSelectChapter={(start) => seekTo(start)}
                onDeleteChapter={
                  canWrite
                    ? (chapterId) =>
                        handleAction(
                          () => deleteChapter(recording.id, chapterId),
                          'Failed to delete chapter.'
                        )
                    : undefined
                }
              />
            ) : (
              <p className="text-xs text-[#A1A1B0]">
                No chapters added yet. Seek to a moment and click Add Chapter.
              </p>
            )}
          </Card>

          {/* Highlight Clips Section */}
          <Card className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
                  Highlight Clips ({recordingClips.length})
                </h2>
                <p className="text-xs text-[#A1A1B0]">
                  Play exact intervals or share public clip links
                </p>
              </div>
              {canWrite && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setClipModalOpen(true)}
                >
                  <Scissors className="w-3.5 h-3.5" />
                  Create Clip
                </Button>
              )}
            </div>

            {recordingClips.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recordingClips.map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    onPlayClip={
                      playableRecording
                        ? (c) => handlePlayClipInterval(c.startTime, c.endTime)
                        : undefined
                    }
                    onDeleteClip={
                      isManager || (user && clip.authorId === user.id)
                        ? (clipId) =>
                            handleAction(
                              () => deleteClip(clipId),
                              'Failed to delete clip.'
                            )
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#71717A]">
                No highlight clips saved for this recording yet.
              </p>
            )}
          </Card>
        </div>

        {/* Right Discussion Panel (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
                  {mode === 'study' ? 'Study Notes & Doubts' : 'Review Notes'}
                </h2>
                <p className="text-xs text-[#A1A1B0] mt-0.5">
                  Click any timestamp to jump in the waveform
                </p>
              </div>
              {canWrite && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowAnnotationForm(true)}
                >
                  + Note
                </Button>
              )}
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-1.5">
              {cfg.filters.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setCategoryFilter(f)}
                  className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                    categoryFilter === f
                      ? mode === 'study'
                        ? 'bg-[#16161D] border-[#22D3EE]/50 text-[#F4F4F7]'
                        : 'bg-[#16161D] border-[#8B5CF6]/55 text-[#F4F4F7]'
                      : 'bg-[#08080B] border-[#22222B] text-[#A1A1B0] hover:text-[#F4F4F7]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* New Annotation Form */}
            {showAnnotationForm && (
              <AnnotationForm
                mode={mode}
                currentTime={currentTime}
                onSubmit={handleCreateAnnotation}
                onCancel={() => setShowAnnotationForm(false)}
              />
            )}

            {/* Annotation Thread List */}
            <div className="space-y-3 xl:max-h-[580px] xl:overflow-y-auto xl:pr-1">
              {recordingAnnotations.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#A1A1B0]">
                  {cfg.emptyStateText}
                </div>
              ) : (
                recordingAnnotations.map((ann) => {
                  const canModify =
                    isManager || (user && ann.authorId === user.id)
                  return (
                    <AnnotationCard
                      key={ann.id}
                      annotation={ann}
                      mode={mode}
                      isActive={selectedAnnotationId === ann.id}
                      canModify={canModify}
                      currentUserId={user?.id}
                      isManager={isManager}
                      onSeek={(target) => {
                        setSelectedAnnotationId(target.id)
                        seekTo(target.timestamp)
                      }}
                      onStatusChange={
                        canWrite
                          ? (annId, status) =>
                              handleAction(
                                () => updateAnnotationStatus(annId, status),
                                'Failed to update status.'
                              )
                          : undefined
                      }
                      onEdit={
                        canModify
                          ? (annId, content) =>
                              handleAction(
                                () => editAnnotation(annId, content),
                                'Failed to edit annotation.'
                              )
                          : undefined
                      }
                      onDelete={
                        canModify
                          ? (annId) =>
                              handleAction(
                                () => deleteAnnotation(annId),
                                'Failed to delete annotation.'
                              )
                          : undefined
                      }
                      onAddReply={
                        canWrite
                          ? (annId, text) =>
                              handleAction(
                                () => addReply(annId, text),
                                'Failed to post reply.'
                              )
                          : undefined
                      }
                      onDeleteReply={(annId, replyId) =>
                        handleAction(
                          () => deleteReply(annId, replyId),
                          'Failed to delete reply.'
                        )
                      }
                    />
                  )
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      <ClipModal
        isOpen={clipModalOpen}
        onClose={() => {
          setClipModalOpen(false)
          setClipInitialRange({ start: null, end: null })
        }}
        currentTime={currentTime}
        initialStart={clipInitialRange.start}
        initialEnd={clipInitialRange.end}
        duration={duration || recording.duration || 0}
        onSaveClip={handleSaveClip}
        onPreviewInterval={
          playableRecording
            ? (start, end) => handlePlayClipInterval(start, end)
            : undefined
        }
      />
    </div>
  )
}
