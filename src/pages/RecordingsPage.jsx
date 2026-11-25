import React, { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { Play, Plus, Search, MessageSquareText, Clock, Trash2 } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { useEchoStore } from '../store/useEchoStore'
import { getModeConfig } from '../config/modeConfig'
import { formatTime } from '../utils/time'

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

  const [query, setQuery] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const isManager = ['OWNER', 'EDITOR'].includes(activeWorkspaceRole)

  const modeRecordings = recordings.filter((r) => {
    if (r.mode !== mode) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q))
    )
  })

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge tone={mode === 'study' ? 'cyan' : 'primary'}>{cfg.name}</Badge>
          <h1 className="text-2xl font-semibold text-[#F4F4F5] mt-2">
            {cfg.recordingPlural}
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-0.5">
            Select any {cfg.recordingNoun.toLowerCase()} to open the interactive
            waveform and discussion workspace.
          </p>
        </div>

        <Button
          variant={mode === 'study' ? 'cyan' : 'primary'}
          onClick={() => outletContext.openUploadModal?.()}
        >
          <Plus className="w-4 h-4" />
          {cfg.primaryAction.label}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${cfg.recordingPlural.toLowerCase()} or tags...`}
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#111114] border border-[#27272F] text-sm text-[#F4F4F5] placeholder-[#71717A] focus:outline-none focus:border-[#8B5CF6]"
        />
      </div>

      {deleteError && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
          {deleteError}
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modeRecordings.map((rec) => {
          const annCount = annotations.filter(
            (a) => a.recordingId === rec.id
          ).length
          return (
            <Card
              key={rec.id}
              interactive
              onClick={() => navigate(`/app/recordings/${rec.id}`)}
              className="p-5 cursor-pointer flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${
                      mode === 'study'
                        ? 'bg-[#22D3EE]/10 border-[#22D3EE]/30 text-[#22D3EE]'
                        : 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#A78BFA]'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-xs text-[#A1A1AA] bg-[#09090B] border border-[#27272F] px-2 py-0.5 rounded">
                    <Clock className="w-3 h-3" />
                    {formatTime(rec.duration)}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-[#F4F4F5]">
                    {rec.title}
                  </h3>
                  <p className="text-xs text-[#A1A1AA] mt-1 line-clamp-2 leading-relaxed">
                    {rec.description}
                  </p>
                </div>

                {rec.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {rec.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-[#09090B] border border-[#27272F] text-[11px] text-[#A1A1AA]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#27272F] flex items-center justify-between text-xs text-[#71717A]">
                <span>
                  {rec.authorName} · {rec.createdAt}
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1 text-[#A1A1AA]">
                    <MessageSquareText className="w-3.5 h-3.5" />
                    {annCount} notes
                  </span>
                  {(isManager || (user && rec.authorId === user.id)) && (
                    <button
                      type="button"
                      onClick={async (e) => {
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
                      }}
                      className="p-1 rounded text-[#71717A] hover:text-rose-400 hover:bg-[#18181D] cursor-pointer"
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

      {modeRecordings.length === 0 && (
        <Card className="p-8 text-center text-sm text-[#A1A1AA]">
          No {cfg.recordingPlural.toLowerCase()} match your search.
        </Card>
      )}
    </div>
  )
}
