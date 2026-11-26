import React from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Play,
  Plus,
  MessageSquareText,
  Scissors,
  ListMusic,
  Clock,
  ArrowRight,
  Sparkles,
  AudioLines,
  ExternalLink,
  Upload,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { ClipCard } from '../clips/ClipCard'
import { PlaylistCard } from '../workspace/PlaylistCard'
import { useEchoStore } from '../../store/useEchoStore'
import {
  getCategoryMeta,
  getModeConfig,
  getStatusMeta,
} from '../../config/modeConfig'
import { formatTime } from '../../utils/time'

export function ModeWorkspaceOverview({ targetMode, titleOverride, subtitleOverride }) {
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const storeMode = useEchoStore((s) => s.mode)
  const user = useEchoStore((s) => s.user)
  const recordings = useEchoStore((s) => s.recordings)
  const annotations = useEchoStore((s) => s.annotations)
  const clips = useEchoStore((s) => s.clips)
  const playlists = useEchoStore((s) => s.playlists)
  const activity = useEchoStore((s) => s.activity)
  const workspaceSettings = useEchoStore((s) => s.workspaceSettings)

  const activeMode = targetMode || storeMode
  const cfg = getModeConfig(activeMode)
  const isStudy = activeMode === 'study'
  const workspaceName = isStudy
    ? workspaceSettings.studyName
    : workspaceSettings.creatorName

  const modeRecordings = recordings.filter((r) => r.mode === activeMode)
  const modeAnnotations = annotations.filter((a) => a.mode === activeMode)
  const openAnnotations = modeAnnotations.filter((a) => a.status !== 'RESOLVED')
  const modeClips = clips.filter((c) => c.mode === activeMode)
  const modePlaylists = playlists.filter((p) => p.mode === activeMode)
  const modeActivity = activity.filter((act) => act.mode === activeMode).slice(0, 6)

  const sectionTitle = (id) =>
    cfg.dashboardSections.find((s) => s.id === id)?.title || id

  const statItems = [
    {
      label: cfg.recordingPlural,
      value: modeRecordings.length,
      icon: AudioLines,
      to: '/app/recordings',
    },
    {
      label: sectionTitle('openItems'),
      value: openAnnotations.length,
      icon: MessageSquareText,
      to: '/app/discussions',
    },
    {
      label: sectionTitle('highlights'),
      value: modeClips.length,
      icon: Scissors,
      to: '/app/highlights',
    },
    {
      label: cfg.collectionPlural,
      value: modePlaylists.length,
      icon: ListMusic,
      to: '/app/playlists',
    },
  ]

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Editorial Workspace Header */}
      <Card className="p-5 sm:p-6 relative overflow-hidden">
        <div
          className={`pointer-events-none absolute inset-0 opacity-60 ${
            isStudy
              ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.09),transparent_55%)]'
              : 'bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.11),transparent_55%)]'
          }`}
        />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={cfg.badgeTone}>{cfg.name}</Badge>
              <span className="text-xs text-[#A1A1B0] font-medium">
                {workspaceName}
              </span>
              <span className="text-[#343442]">·</span>
              <span className="text-xs text-[#6E6E7E]">{cfg.tagline}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F4F7] tracking-tight font-display">
              {titleOverride ||
                `Welcome back, ${(user?.name || 'Creator').split(' ')[0]}`}
            </h1>
            <p className="text-sm text-[#A1A1B0] leading-relaxed">
              {subtitleOverride || cfg.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/app/playlists')}
            >
              <ListMusic className="w-3.5 h-3.5" />
              {cfg.secondaryAction.label}
            </Button>
          </div>
        </div>
      </Card>

      {/* Real-Data Overview Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {statItems.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.label}
              interactive
              onClick={() => navigate(item.to)}
              className="p-4 cursor-pointer flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-xs text-[#A1A1B0] font-medium">{item.label}</p>
                <p className="text-2xl font-bold text-[#F4F4F7] font-display mt-1">
                  {item.value}
                </p>
              </div>
              <div
                className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${cfg.accentBg} ${cfg.accentBorder} ${cfg.accentText}`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Recordings / Continue Listening */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
                {sectionTitle('recentRecordings')}
              </h2>
              <Link
                to="/app/recordings"
                className="text-xs text-[#A1A1B0] hover:text-[#F4F4F7] inline-flex items-center gap-1 transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {modeRecordings.length === 0 ? (
              <Card className="p-8 text-center space-y-3">
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center mx-auto ${cfg.accentBg} ${cfg.accentBorder} ${cfg.accentText}`}
                >
                  <Upload className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-[#F4F4F7]">
                    No {cfg.recordingPlural.toLowerCase()} yet
                  </p>
                  <p className="text-xs text-[#A1A1B0] max-w-sm mx-auto">
                    Upload an audio file or import a podcast RSS / direct media link to start collaborating on waveforms.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isStudy ? 'cyan' : 'primary'}
                  onClick={() => outletContext.openUploadModal?.()}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {cfg.primaryAction.label}
                </Button>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {modeRecordings.slice(0, 5).map((rec) => {
                  const recAnnCount = modeAnnotations.filter(
                    (a) => a.recordingId === rec.id
                  ).length
                  const isExternal = rec.sourceType === 'EXTERNAL_LINK'
                  return (
                    <Card
                      key={rec.id}
                      interactive
                      onClick={() => navigate(`/app/recordings/${rec.id}`)}
                      className="p-4 cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${cfg.accentBg} ${cfg.accentBorder} ${cfg.accentText}`}
                        >
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[#F4F4F7] truncate">
                              {rec.title}
                            </h3>
                            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#08080B] border border-[#22222B] text-[10px] text-[#6E6E7E] shrink-0">
                              {isExternal ? (
                                <>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  Link
                                </>
                              ) : (
                                'Audio'
                              )}
                            </span>
                          </div>
                          <p className="text-xs text-[#A1A1B0] truncate">
                            {rec.authorName} · {rec.createdAt} ·{' '}
                            <span className="font-mono-time text-[#F4F4F7]">
                              {formatTime(rec.duration)}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#A1A1B0] bg-[#08080B] border border-[#22222B] px-2.5 py-1 rounded-md">
                          <MessageSquareText className="w-3.5 h-3.5 text-[#6E6E7E]" />
                          {recAnnCount}
                        </span>
                        <ArrowRight className="w-4 h-4 text-[#6E6E7E]" />
                      </div>
                    </Card>
                  )
                })}
              </div>
            )}
          </section>

          {/* Open Annotations / Discussions */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
                {sectionTitle('openItems')}
              </h2>
              <Link
                to="/app/discussions"
                className="text-xs text-[#A1A1B0] hover:text-[#F4F4F7] inline-flex items-center gap-1 transition-colors"
              >
                All discussions <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-2.5">
              {openAnnotations.slice(0, 3).map((ann) => {
                const cat = getCategoryMeta(activeMode, ann.category)
                const statusMeta = getStatusMeta(activeMode, ann.status)
                const rec = recordings.find((r) => r.id === ann.recordingId)
                return (
                  <Card
                    key={ann.id}
                    interactive
                    onClick={() =>
                      navigate(
                        `/app/recordings/${ann.recordingId}?t=${Math.floor(
                          ann.timestamp || 0
                        )}&ann=${ann.id}`
                      )
                    }
                    className="p-4 cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`px-2 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${cat.badgeClass}`}
                        >
                          {cat.label}
                        </span>
                        <span className="font-mono-time text-[11px] text-[#A1A1B0] bg-[#08080B] border border-[#22222B] px-1.5 py-0.5 rounded shrink-0">
                          {formatTime(ann.timestamp)}
                        </span>
                        {rec && (
                          <span className="text-xs text-[#6E6E7E] truncate">
                            {rec.title}
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-medium shrink-0 ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#E4E4E7] line-clamp-2 leading-relaxed">
                      {ann.content}
                    </p>
                  </Card>
                )
              })}
              {openAnnotations.length === 0 && (
                <Card className="p-5 text-xs text-[#A1A1B0]">
                  All caught up — no open items right now.
                </Card>
              )}
            </div>
          </section>

          {/* Highlight Clips */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
                {sectionTitle('highlights')}
              </h2>
              <Link
                to="/app/highlights"
                className="text-xs text-[#A1A1B0] hover:text-[#F4F4F7] inline-flex items-center gap-1 transition-colors"
              >
                All clips <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {modeClips.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {modeClips.slice(0, 2).map((clip) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    onPlayClip={(c) => navigate(`/app/recordings/${c.recordingId}`)}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-5 text-xs text-[#A1A1B0]">
                No highlight clips created yet. Open any recording to capture an interval clip.
              </Card>
            )}
          </section>
        </div>

        {/* Right Column: Collections + Activity */}
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
                {sectionTitle('collections')}
              </h2>
              <Link
                to="/app/playlists"
                className="text-xs text-[#A1A1B0] hover:text-[#F4F4F7] inline-flex items-center gap-1 transition-colors"
              >
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {modePlaylists.length > 0 ? (
              <div className="space-y-3">
                {modePlaylists.slice(0, 3).map((pl) => (
                  <PlaylistCard
                    key={pl.id}
                    playlist={pl}
                    onSelect={() => navigate('/app/playlists')}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-5 text-xs text-[#A1A1B0]">
                No {cfg.collectionPlural.toLowerCase()} yet.
              </Card>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-[#F4F4F7] font-display">
              {sectionTitle('activity')}
            </h2>
            <Card className="p-4 divide-y divide-[#22222B]">
              {modeActivity.length > 0 ? (
                modeActivity.map((act) => (
                  <div key={act.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="text-xs text-[#E4E4E7] leading-snug">
                      <span className="font-medium text-[#F4F4F7]">
                        {act.actor}
                      </span>{' '}
                      <span className="text-[#A1A1B0]">{act.action}</span>{' '}
                      <span className="font-medium text-[#F4F4F7]">
                        {act.target}
                      </span>
                    </p>
                    <p className="text-[11px] text-[#6E6E7E] mt-1 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {act.time}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#6E6E7E]">
                  Collaboration activity will appear here as your team uploads and annotates.
                </p>
              )}
            </Card>
          </section>

          <Card elevated className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#F4F4F7]">
              <Sparkles className={`w-4 h-4 ${cfg.accentText}`} />
              Studio Workflow
            </div>
            <p className="text-xs text-[#A1A1B0] leading-relaxed">
              Open any {cfg.recordingNoun.toLowerCase()} to drop timestamped{' '}
              {cfg.annotationCategories.map((c) => c.label.toLowerCase()).join(', ')}{' '}
              markers directly on the interactive waveform.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
