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
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#A1A1AA]">
          Chapters
        </span>
        <span className="text-[11px] text-[#71717A]">
          {chapters.length} sections
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {chapters.map((ch, idx) => {
          const next = chapters[idx + 1]
          const isCurrent =
            currentTime >= ch.startTime &&
            (!next || currentTime < next.startTime)

          return (
            <div
              key={ch.id}
              className={`group relative rounded-lg border transition-colors ${
                isCurrent
                  ? 'bg-[#18181D] border-[#8B5CF6]/50 text-[#F4F4F5]'
                  : 'bg-[#09090B] border-[#27272F] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#F4F4F5]'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectChapter?.(ch.startTime)}
                className="w-full text-left px-3 py-2 pr-7 cursor-pointer"
              >
                <span className="block font-mono text-[10px] text-[#22D3EE]">
                  {formatTime(ch.startTime)}
                </span>
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
                  className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 text-[#71717A] hover:text-rose-400 transition-opacity cursor-pointer"
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
