import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, ExternalLink, MessageSquareText, Search } from 'lucide-react'
import { AnnotationCard } from '../components/annotations/AnnotationCard'
import { Badge } from '../components/ui/Badge'
import { Card } from '../components/ui/Card'
import { useEchoStore } from '../store/useEchoStore'
import { getModeConfig } from '../config/modeConfig'
import { extractYouTubeVideoId, getYouTubeTimestampUrl } from '../utils/youtube'
import { formatTime } from '../utils/time'

export function DiscussionsPage() {
  const navigate = useNavigate()
  const mode = useEchoStore((s) => s.mode)
  const annotations = useEchoStore((s) => s.annotations)
  const recordings = useEchoStore((s) => s.recordings)
  const updateAnnotationStatus = useEchoStore((s) => s.updateAnnotationStatus)
  const addReply = useEchoStore((s) => s.addReply)
  const cfg = getModeConfig(mode)

  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [query, setQuery] = useState('')

  const modeAnnotations = annotations.filter((a) => {
    if (a.mode !== mode) return false
    if (categoryFilter !== 'ALL' && a.category !== categoryFilter) return false
    if (statusFilter !== 'ALL' && a.status !== statusFilter) return false
    if (query.trim()) {
      const q = query.toLowerCase()
      const rec = recordings.find((r) => r.id === a.recordingId)
      const matchesContent = a.content.toLowerCase().includes(q)
      const matchesRec = rec?.title?.toLowerCase().includes(q)
      if (!matchesContent && !matchesRec) return false
    }
    return true
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <Badge tone={cfg.badgeTone}>{cfg.name}</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F4F7] font-display mt-2">
          Discussions &amp; Annotations
        </h1>
        <p className="text-sm text-[#A1A1B0] mt-0.5">
          All timestamped threads across your {cfg.recordingPlural.toLowerCase()}.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {cfg.filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setCategoryFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                categoryFilter === f
                  ? 'bg-[#16161D] border-[#343442] text-[#F4F4F7]'
                  : 'bg-[#101015] border-[#22222B] text-[#A1A1B0] hover:text-[#F4F4F7]'
              }`}
            >
              {f === 'ALL' ? 'All Categories' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6E6E7E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter threads..."
              className="h-8.5 pl-8 pr-3 rounded-lg bg-[#101015] border border-[#22222B] text-xs text-[#F4F4F7] placeholder-[#6E6E7E] focus:outline-none focus:border-[#8B5CF6]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8.5 px-2.5 rounded-lg bg-[#101015] border border-[#22222B] text-xs text-[#F4F4F7] focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            {Object.entries(cfg.statusLabels).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Threads */}
      <div className="space-y-4">
        {modeAnnotations.map((ann) => {
          const rec = recordings.find((r) => r.id === ann.recordingId)
          const ytId = extractYouTubeVideoId(rec?.sourceUrl)
          const ytJumpUrl = ytId
            ? getYouTubeTimestampUrl(rec.sourceUrl, ann.timestamp)
            : null
          return (
            <div key={ann.id} className="space-y-1.5">
              <div className="flex items-center justify-between px-1 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/app/recordings/${ann.recordingId}?t=${Math.floor(
                          ann.timestamp || 0
                        )}&ann=${ann.id}`
                      )
                    }
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#A1A1B0] hover:text-[#F4F4F7] cursor-pointer truncate"
                  >
                    <span className="truncate">{rec?.title || 'Recording'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                  </button>
                  {ytId && <Badge tone="rose">YouTube</Badge>}
                </div>
                {ytJumpUrl && (
                  <a
                    href={ytJumpUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-[#22D3EE] hover:underline shrink-0"
                  >
                    Watch @ {formatTime(ann.timestamp || 0)}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <AnnotationCard
                annotation={ann}
                mode={mode}
                onSeek={() =>
                  navigate(
                    `/app/recordings/${ann.recordingId}?t=${Math.floor(
                      ann.timestamp || 0
                    )}&ann=${ann.id}`
                  )
                }
                onStatusChange={updateAnnotationStatus}
                onAddReply={addReply}
                defaultExpanded
              />
            </div>
          )
        })}

        {modeAnnotations.length === 0 && (
          <Card className="p-10 text-center space-y-2">
            <MessageSquareText className="w-6 h-6 text-[#6E6E7E] mx-auto" />
            <p className="text-sm font-medium text-[#F4F4F7]">No threads found</p>
            <p className="text-xs text-[#A1A1B0]">{cfg.emptyStateText}</p>
          </Card>
        )}
      </div>
    </div>
  )
}
