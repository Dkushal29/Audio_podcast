import React from 'react'
import { Trash2 } from 'lucide-react'
import { formatTime } from '../../utils/time'

export function ChapterTimeline({
  chapters = [],
  currentTime = 0,
  onSelectChapter,
  onDeleteChapter,
}) {
  if (!chapters.length) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1B0]">
          Chapters
        </span>
        <span className="text-[11px] text-[#8A8A9A]">
          {chapters.length} {chapters.length === 1 ? 'section' : 'sections'}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {chapters.map((ch, idx) => {
          const next = chapters[idx + 1]
          const isCurrent =
            currentTime >= ch.startTime &&
            (!next || currentTime < next.startTime)

          return (
            <div
              key={ch.id}
              className={`group relative min-w-0 rounded-lg border transition-all ${
                isCurrent
                  ? 'bg-[#16161D] border-[#22D3EE]/50 text-[#F4F4F7] shadow-xs'
                  : 'bg-[#08080B] border-[#22222B] text-[#A1A1B0] hover:border-[#343442] hover:text-[#F4F4F7]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectChapter?.(ch.startTime)}
                title={`${formatTime(ch.startTime)} — ${ch.title}`}
                className="w-full min-w-0 text-left px-3 py-2.5 pr-8 cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/50"
              >
                <div className="flex items-center gap-1.5">
                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] shrink-0" />
                  )}
                  <span className="font-mono-time text-[10px] text-[#22D3EE]">
                    {formatTime(ch.startTime)}
                  </span>
                </div>
                <span className="block text-xs font-medium truncate mt-0.5">
                  {ch.title}
                </span>
              </button>
              {onDeleteChapter && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete chapter "${ch.title}"?`)) {
                      onDeleteChapter(ch.id)
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 absolute top-2 right-2 p-1 rounded text-[#8A8A9A] hover:text-rose-400 transition-opacity cursor-pointer"
                  title="Delete chapter"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
