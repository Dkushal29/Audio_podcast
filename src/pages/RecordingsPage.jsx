import React, { useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  Play,
  Plus,
  Search,
  MessageSquareText,
  Clock,
  Trash2,
  LayoutGrid,
  List,
  ExternalLink,
  AudioLines,
} from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useEchoStore } from '../store/useEchoStore'
import { getModeConfig } from '../config/modeConfig'
import { formatTime } from '../utils/time'
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../utils/youtube'

export function RecordingsPage() {
  const navigate = useNavigate()
  const outletContext = useOutletContext() || {}
  const mode = useEchoStore((s) => s.mode)
  const user = useEchoStore((s) => s.user)
  const activeWorkspaceRole = useEchoStore((s) => s.activeWorkspaceRole)
  const recordings = useEchoStore((s) => s.recordings)
  const annotations = useEchoStore((s) => s.annotations)
  const deleteRecording = useEchoStore((s) => s.deleteRecording)
  const cfg = getModeConfig(mode)
  const isStudy = mode === 'study'

  const [query, setQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('newest')
  const [viewMode, setViewMode] = useState('grid')
  const [deleteError, setDeleteError] = useState('')
  const isManager = ['OWNER', 'EDITOR'].includes(activeWorkspaceRole)

  const modeRecordings = useMemo(() => {
    const filtered = recordings.filter((r) => {
      if (r.mode !== mode) return false
      if (sourceFilter === 'YOUTUBE') {
        if (!extractYouTubeVideoId(r.sourceUrl)) return false
      } else if (sourceFilter !== 'ALL' && r.sourceType !== sourceFilter) {
        return false
      }
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags?.some((t) => t.toLowerCase().includes(q))
      )
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'longest') return (b.duration || 0) - (a.duration || 0)
      if (sortBy === 'discussed') {
        const countA = annotations.filter((ann) => ann.recordingId === a.id).length
        const countB = annotations.filter((ann) => ann.recordingId === b.id).length
        return countB - countA
      }
      return (
        new Date(b.createdAtRaw || 0).getTime() -
        new Date(a.createdAtRaw || 0).getTime()
      )
    })
  }, [recordings, annotations, mode, sourceFilter, query, sortBy])

  const handleDelete = async (e, rec) => {
    e.stopPropagation()
    if (
      !window.confirm(
        `Delete "${rec.title}"? This removes the recording and its annotations/clips.`
      )
    ) {
      return
    }
    try {
      setDeleteError('')
      await deleteRecording(rec.id)
    } catch (err) {
      setDeleteError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to delete recording.'
      )
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge tone={cfg.badgeTone}>{cfg.name}</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F4F7] font-display mt-2">
            {cfg.recordingPlural}
          </h1>
          <p className="text-sm text-[#A1A1B0] mt-0.5">
            Select any {cfg.recordingNoun.toLowerCase()} to open the interactive
            waveform and discussion studio.
          </p>
        </div>

        <Button
          variant={isStudy ? 'cyan' : 'primary'}
          onClick={() => outletContext.openUploadModal?.()}
        >
          <Plus className="w-4 h-4" />
          {cfg.primaryAction.label}
        </Button>
      </div>

      {/* Search, Filters, Sort & View Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-[#6E6E7E] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${cfg.recordingPlural.toLowerCase()} or tags...`}
            className="w-full h-9.5 pl-9 pr-3 rounded-lg bg-[#101015] border border-[#22222B] text-sm text-[#F4F4F7] placeholder-[#6E6E7E] focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-[#101015] border border-[#22222B] rounded-lg p-0.5">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'UPLOAD', label: 'Audio' },
              { id: 'YOUTUBE', label: 'YouTube' },
              { id: 'EXTERNAL_LINK', label: 'External' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSourceFilter(item.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  sourceFilter === item.id
                    ? 'bg-[#16161D] text-[#F4F4F7]'
                    : 'text-[#A1A1B0] hover:text-[#F4F4F7]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-9 px-3 rounded-lg bg-[#101015] border border-[#22222B] text-xs text-[#F4F4F7] focus:outline-none"
            aria-label="Sort recordings"
          >
            <option value="newest">Newest first</option>
            <option value="longest">Longest duration</option>
            <option value="discussed">Most discussed</option>
          </select>

          <div className="inline-flex bg-[#101015] border border-[#22222B] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-[#16161D] text-[#F4F4F7]'
                  : 'text-[#6E6E7E] hover:text-[#F4F4F7]'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-[#16161D] text-[#F4F4F7]'
                  : 'text-[#6E6E7E] hover:text-[#F4F4F7]'
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {deleteError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {deleteError}
        </div>
      )}

      {/* Grid or List View */}
      {modeRecordings.length > 0 ? (
        viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modeRecordings.map((rec) => {
              const annCount = annotations.filter(
                (a) => a.recordingId === rec.id
              ).length
              const isExternal = rec.sourceType === 'EXTERNAL_LINK'
              const ytId = extractYouTubeVideoId(rec.sourceUrl)
              const ytThumb = getYouTubeThumbnailUrl(ytId)
              return (
                <Card
                  key={rec.id}
                  interactive
                  onClick={() => navigate(`/app/recordings/${rec.id}`)}
                  className="p-5 cursor-pointer flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {ytThumb && (
                      <img
                        src={ytThumb}
                        alt={rec.title}
                        className="w-full h-32 object-cover rounded-lg border border-[#27272F]"
                      />
                    )}
                    <div className="flex items-start justify-between gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${cfg.accentBg} ${cfg.accentBorder} ${cfg.accentText}`}
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#08080B] border border-[#22222B] text-[10px] text-[#A1A1B0]">
                          {isExternal ? (
                            <>
                              <ExternalLink className="w-2.5 h-2.5" />
                              External Link
                            </>
                          ) : rec.sourceUrl ? (
                            'Imported Audio'
                          ) : (
                            'Uploaded Audio'
                          )}
                        </span>
                        <span className="inline-flex items-center gap-1 font-mono-time text-xs text-[#F4F4F7] bg-[#08080B] border border-[#22222B] px-2 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-[#6E6E7E]" />
                          {formatTime(rec.duration)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-[#F4F4F7] font-display line-clamp-1">
                        {rec.title}
                      </h3>
                      <p className="text-xs text-[#A1A1B0] mt-1 line-clamp-2 leading-relaxed">
                        {rec.description || 'No description provided.'}
                      </p>
                    </div>

                    {rec.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {rec.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-[#08080B] border border-[#22222B] text-[11px] text-[#A1A1B0]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#22222B] flex items-center justify-between text-xs text-[#6E6E7E]">
                    <span className="truncate">
                      {rec.authorName} · {rec.createdAt}
                    </span>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="inline-flex items-center gap-1 text-[#A1A1B0]">
                        <MessageSquareText className="w-3.5 h-3.5" />
                        {annCount}
                      </span>
                      {(isManager || (user && rec.authorId === user.id)) && (
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, rec)}
                          className="p-1 rounded text-[#6E6E7E] hover:text-rose-400 hover:bg-[#16161D] cursor-pointer"
                          title="Delete recording"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <Card className="divide-y divide-[#22222B]">
            {modeRecordings.map((rec) => {
              const annCount = annotations.filter(
                (a) => a.recordingId === rec.id
              ).length
              return (
                <div
                  key={rec.id}
                  onClick={() => navigate(`/app/recordings/${rec.id}`)}
                  className="p-4 flex items-center justify-between gap-4 hover:bg-[#14141B] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${cfg.accentBg} ${cfg.accentBorder} ${cfg.accentText}`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-[#F4F4F7] truncate">
                        {rec.title}
                      </h3>
                      <p className="text-xs text-[#A1A1B0] truncate">
                        {rec.authorName} · {rec.createdAt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono-time text-xs text-[#A1A1B0]">
                      {formatTime(rec.duration)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-[#A1A1B0] bg-[#08080B] border border-[#22222B] px-2 py-0.5 rounded">
                      <MessageSquareText className="w-3 h-3" />
                      {annCount}
                    </span>
                    {(isManager || (user && rec.authorId === user.id)) && (
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, rec)}
                        className="p-1.5 rounded text-[#6E6E7E] hover:text-rose-400 hover:bg-[#16161D] cursor-pointer"
                        title="Delete recording"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>
        )
      ) : (
        <Card className="p-10 text-center space-y-3">
          <AudioLines className="w-7 h-7 text-[#6E6E7E] mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#F4F4F7]">
              No {cfg.recordingPlural.toLowerCase()} found
            </p>
            <p className="text-xs text-[#A1A1B0]">
              {query.trim()
                ? 'Try adjusting your search or source filter.'
                : `Upload your first ${cfg.recordingNoun.toLowerCase()} to get started.`}
            </p>
          </div>
          {!query.trim() && (
            <Button
              size="sm"
              variant={isStudy ? 'cyan' : 'primary'}
              onClick={() => outletContext.openUploadModal?.()}
            >
              <Plus className="w-3.5 h-3.5" />
              {cfg.primaryAction.label}
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
