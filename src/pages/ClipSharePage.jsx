import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, Clock, Share2, Check, Eye } from 'lucide-react'
import { Logo } from '../components/common/Logo'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { AudioPlayer } from '../components/audio/AudioPlayer'
import { AnnotationCard } from '../components/annotations/AnnotationCard'
import { useEchoStore } from '../store/useEchoStore'
import { formatTime } from '../utils/time'
import { apiClient } from '../services/api'

export function ClipSharePage() {
  const { clipId, id } = useParams()
  const lookupId = clipId || id
  const clips = useEchoStore((s) => s.clips)
  const recordings = useEchoStore((s) => s.recordings)
  const annotations = useEchoStore((s) => s.annotations)
  const [remoteClip, setRemoteClip] = useState(null)
  const [loading, setLoading] = useState(false)

  const localClip = clips.find(
    (c) => c.id === lookupId || c.shareToken === lookupId
  )

  useEffect(() => {
    if (!localClip && lookupId) {
      setLoading(true)
      apiClient
        .getClipByToken(lookupId)
        .then((c) => setRemoteClip(c))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [lookupId, localClip])

  const clip = remoteClip
    ? {
        ...remoteClip,
        recordingId: remoteClip.episodeId,
        recordingTitle: remoteClip.episode?.title || 'Recording',
        mode: (remoteClip.episode?.workspace?.mode || 'study').toLowerCase(),
        authorName: remoteClip.creator?.name || 'Member',
        notes: remoteClip.description || '',
      }
    : localClip || clips[0]

  const recording = remoteClip
    ? {
        ...remoteClip.episode,
        audioUrl:
          remoteClip.episode?.sourceType === 'UPLOAD'
            ? apiClient.getClipAudioUrl(remoteClip.shareToken)
            : null,
      }
    : recordings.find((r) => r.id === clip?.recordingId)

  const [copied, setCopied] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-sm text-[#A1A1AA]">
        Loading clip...
      </div>
    )
  }

  if (!clip) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-sm text-[#A1A1AA]">
        Clip not found.
      </div>
    )
  }

  const associatedAnnotations = annotations.filter(
    (a) =>
      a.recordingId === clip.recordingId &&
      a.timestamp >= Math.max(0, clip.startTime - 5) &&
      a.timestamp <= clip.endTime + 5
  )

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="min-h-screen bg-[#070709] text-[#F4F4F7]">
      <header className="border-b border-[#22222B] bg-[#0A0A0E]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-15 flex items-center justify-between">
          <Logo to="/" size="sm" />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={handleCopyLink}>
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  Link Copied
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  Copy Share Link
                </>
              )}
            </Button>
            <Link to={`/app/recordings/${clip.recordingId}`}>
              <Button size="sm" variant="primary">
                Open Original Recording
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <Card className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={clip.mode === 'study' ? 'cyan' : 'primary'}>
                {clip.mode === 'study' ? 'Study Highlight' : 'Podcast Clip'}
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs font-mono text-[#22D3EE]">
                <Clock className="w-3.5 h-3.5" />
                {formatTime(clip.startTime)} – {formatTime(clip.endTime)}
              </span>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-[#A1A1AA]">
              <Eye className="w-3.5 h-3.5" />
              {clip.views} views
            </span>
          </div>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F4F4F5]">
              {clip.title}
            </h1>
            <p className="text-sm text-[#A1A1AA] mt-1">
              From{' '}
              <span className="text-[#F4F4F5] font-medium">
                {clip.recordingTitle}
              </span>{' '}
              · Clipped by {clip.authorName}
            </p>
            {clip.notes && (
              <p className="text-sm text-[#D4D4D8] mt-3 p-3 rounded-lg bg-[#09090B] border border-[#27272F]">
                {clip.notes}
              </p>
            )}
          </div>

          {recording?.audioUrl ? (
            <AudioPlayer
              recording={recording}
              mode={clip.mode}
              annotations={associatedAnnotations}
              clipRange={{ startTime: clip.startTime, endTime: clip.endTime }}
              seekToTime={{ time: clip.startTime }}
            />
          ) : (
            <div className="p-4 rounded-lg bg-[#09090B] border border-[#27272F] text-xs text-[#A1A1AA]">
              This clip belongs to an external media link without locally hosted audio.
            </div>
          )}
        </Card>

        {/* Associated Discussion */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[#F4F4F5]">
              Associated Discussion
            </h2>
            <Link
              to={`/app/recordings/${clip.recordingId}`}
              className="text-xs text-[#22D3EE] hover:underline"
            >
              Join full discussion →
            </Link>
          </div>

          {associatedAnnotations.length === 0 ? (
            <Card className="p-5 text-xs text-[#A1A1AA]">
              No annotations within this clip window yet. Open the full
              recording to start a thread.
            </Card>
          ) : (
            <div className="space-y-3">
              {associatedAnnotations.map((ann) => (
                <AnnotationCard
                  key={ann.id}
                  annotation={ann}
                  mode={clip.mode}
                  onSeek={(t) => waveSurferRef.current?.setTime(t)}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
