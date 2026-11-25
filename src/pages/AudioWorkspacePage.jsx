import React, { useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  MessageSquarePlus,
  Scissors,
  Clock,
  Tag,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Waveform } from '../components/audio/Waveform'
import { AudioPlayer } from '../components/audio/AudioPlayer'
import { ChapterTimeline } from '../components/audio/ChapterTimeline'
import { AnnotationCard } from '../components/annotations/AnnotationCard'
import { AnnotationForm } from '../components/annotations/AnnotationForm'
import { ClipModal } from '../components/clips/ClipModal'
import { useEchoStore } from '../store/useEchoStore'
import { getModeConfig } from '../config/modeConfig'
import { formatTime } from '../utils/time'
import {
  getSocket,
  joinEpisodeRoom,
  leaveEpisodeRoom,
} from '../services/socket'

export function AudioWorkspacePage() {
  const { id } = useParams()
  const token = useEchoStore((s) => s.token)
  const recordings = useEchoStore((s) => s.recordings)
  const annotations = useEchoStore((s) => s.annotations)
  const workspaceSettings = useEchoStore((s) => s.workspaceSettings)
  const loadEpisodeDetail = useEchoStore((s) => s.loadEpisodeDetail)
  const addAnnotation = useEchoStore((s) => s.addAnnotation)
  const updateAnnotationStatus = useEchoStore((s) => s.updateAnnotationStatus)
  const addReply = useEchoStore((s) => s.addReply)
  const addClip = useEchoStore((s) => s.addClip)
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
  const applySocketClipCreated = useEchoStore(
    (s) => s.applySocketClipCreated
  )

  const recording =
    recordings.find((r) => r.id === id) || recordings[0]

  const mode = recording?.mode || 'study'
  const cfg = getModeConfig(mode)

  const waveSurferRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(recording?.duration || 42)
  const [playbackRate, setPlaybackRate] = useState(
    workspaceSettings.defaultPlaybackSpeed || 1
  )
  const [isLooping, setIsLooping] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null)
  const [showAnnotationForm, setShowAnnotationForm] = useState(false)
  const [clipModalOpen, setClipModalOpen] = useState(false)
  const [clipToast, setClipToast] = useState(null)

  React.useEffect(() => {
    if (!token || !id) return
    loadEpisodeDetail(id).catch(() => {})
    joinEpisodeRoom(id)

    const socket = getSocket()
    if (!socket) {
      return () => leaveEpisodeRoom(id)
    }

    const onAnnCreated = ({ annotation }) =>
      applySocketAnnotationCreated(annotation)
    const onAnnUpdated = ({ annotation }) =>
      applySocketAnnotationUpdated(annotation)
    const onAnnDeleted = ({ annotationId }) =>
      applySocketAnnotationDeleted(annotationId)
    const onReplyCreated = (payload) => applySocketReplyCreated(payload)
    const onClipCreated = ({ clip }) => applySocketClipCreated(clip)

    socket.on('annotation:created', onAnnCreated)
    socket.on('annotation:updated', onAnnUpdated)
    socket.on('annotation:deleted', onAnnDeleted)
    socket.on('reply:created', onReplyCreated)
    socket.on('clip:created', onClipCreated)

    return () => {
      leaveEpisodeRoom(id)
      socket.off('annotation:created', onAnnCreated)
      socket.off('annotation:updated', onAnnUpdated)
      socket.off('annotation:deleted', onAnnDeleted)
      socket.off('reply:created', onReplyCreated)
      socket.off('clip:created', onClipCreated)
    }
  }, [token, id])

  const recordingAnnotations = useMemo(() => {
    const list = annotations.filter((a) => a.recordingId === recording?.id)
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp)
    if (categoryFilter === 'ALL') return sorted
    return sorted.filter((a) => a.category === categoryFilter)
  }, [annotations, recording?.id, categoryFilter])

  if (!recording) {
    return (
      <div className="p-8 text-center text-sm text-[#A1A1AA]">
        Recording not found.
      </div>
    )
  }

  const seekTo = (time) => {
    const ws = waveSurferRef.current
    if (ws) {
      ws.setTime(Math.max(0, Math.min(duration, time)))
    }
    setCurrentTime(time)
  }

  const seekRelative = (delta) => {
    seekTo(currentTime + delta)
  }

  const handleToggleMute = () => {
    const next = !isMuted
    setIsMuted(next)
    waveSurferRef.current?.setMuted(next)
  }

  const handleOpenAnnotate = () => {
    if (workspaceSettings.autoPauseOnAnnotate && isPlaying) {
      setIsPlaying(false)
    }
    setShowAnnotationForm(true)
  }

  const handleCreateAnnotation = async ({ timestamp, category, content }) => {
    const created = await addAnnotation({
      recordingId: recording.id,
      timestamp,
      category,
      content,
    })
    setSelectedAnnotationId(created.id)
    setShowAnnotationForm(false)
  }

  const handleSaveClip = (clipInput) => {
    const created = addClip({
      recordingId: recording.id,
      ...clipInput,
    })
    setClipToast(created)
    setTimeout(() => setClipToast(null), 5000)
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Top breadcrumb & metadata */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            to="/app/recordings"
            className="inline-flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All {cfg.recordingPlural}
          </Link>
          <span className="text-[#27272F]">/</span>
          <Badge tone={mode === 'study' ? 'cyan' : 'primary'}>
            {cfg.name}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-[#A1A1AA]">
          <span>By {recording.authorName}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {clipToast && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-xs">
          <span className="text-emerald-300">
            Highlight clip <strong>{clipToast.title}</strong> saved (
            {formatTime(clipToast.startTime)} – {formatTime(clipToast.endTime)}).
          </span>
          <Link
            to={`/clip/${clipToast.id}`}
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
          <Card className="p-5 space-y-4">
            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#F4F4F5]">
                {recording.title}
              </h1>
              <p className="text-sm text-[#A1A1AA] leading-relaxed">
                {recording.description}
              </p>
              {recording.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <Tag className="w-3.5 h-3.5 text-[#71717A]" />
                  {recording.tags.map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Prominent WaveSurfer Waveform */}
            <Waveform
              audioUrl={recording.audioUrl}
              mode={mode}
              annotations={recordingAnnotations}
              selectedAnnotationId={selectedAnnotationId}
              onSelectAnnotation={(ann) => {
                setSelectedAnnotationId(ann.id)
                setCurrentTime(ann.timestamp)
              }}
              isPlaying={isPlaying}
              playbackRate={playbackRate}
              isLooping={isLooping}
              onReady={(dur) => setDuration(dur)}
              onTimeUpdate={(t) => setCurrentTime(t)}
              onPlayStateChange={(playing) => setIsPlaying(playing)}
              waveSurferRef={waveSurferRef}
              height={116}
            />

            {/* Transport & Actions */}
            <AudioPlayer
              mode={mode}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              currentTime={currentTime}
              duration={duration}
              onSeekRelative={seekRelative}
              playbackRate={playbackRate}
              onChangePlaybackRate={(spd) => setPlaybackRate(spd)}
              isLooping={isLooping}
              onToggleLoop={() => setIsLooping((l) => !l)}
              isMuted={isMuted}
              onToggleMute={handleToggleMute}
              rightActions={
                <>
                  <Button
                    size="sm"
                    variant={mode === 'study' ? 'cyan' : 'primary'}
                    onClick={handleOpenAnnotate}
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    Annotate
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setClipModalOpen(true)}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                    Create Clip
                  </Button>
                </>
              }
            />
          </Card>

          {/* Chapter Timeline */}
          <Card className="p-5">
            <ChapterTimeline
              chapters={recording.chapters}
              currentTime={currentTime}
              onSelectChapter={(start) => seekTo(start)}
            />
          </Card>
        </div>

        {/* Right Discussion Panel (4 cols) */}
        <div className="xl:col-span-4 space-y-4">
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[#F4F4F5]">
                  {mode === 'study' ? 'Study Notes & Doubts' : 'Review Notes'}
                </h2>
                <p className="text-[11px] text-[#71717A]">
                  Click any timestamp to jump in the waveform
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleOpenAnnotate}
              >
                + Note
              </Button>
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
                      ? 'bg-[#18181D] border-[#8B5CF6]/50 text-[#F4F4F5]'
                      : 'bg-[#09090B] border-[#27272F] text-[#A1A1AA] hover:text-[#F4F4F5]'
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
            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {recordingAnnotations.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71717A]">
                  {cfg.emptyStateText}
                </div>
              ) : (
                recordingAnnotations.map((ann) => (
                  <AnnotationCard
                    key={ann.id}
                    annotation={ann}
                    mode={mode}
                    isSelected={selectedAnnotationId === ann.id}
                    onSeek={(t) => {
                      setSelectedAnnotationId(ann.id)
                      seekTo(t)
                    }}
                    onStatusChange={updateAnnotationStatus}
                    onAddReply={addReply}
                  />
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <ClipModal
        isOpen={clipModalOpen}
        onClose={() => setClipModalOpen(false)}
        currentTime={currentTime}
        duration={duration}
        onSaveClip={handleSaveClip}
      />
    </div>
  )
}
