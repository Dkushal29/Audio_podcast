import React from 'react'
import { formatTime } from '../../utils/time'

export function ChapterTimeline({ chapters = [], currentTime = 0, onSelectChapter }) {
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
            <button
              key={ch.id}
              type="button"
              onClick={() => onSelectChapter?.(ch.startTime)}
              className={`text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                isCurrent
                  ? 'bg-[#18181D] border-[#8B5CF6]/50 text-[#F4F4F5]'
                  : 'bg-[#09090B] border-[#27272F] text-[#A1A1AA] hover:border-[#3F3F46] hover:text-[#F4F4F5]'
              }`}
            >
              <span className="block font-mono text-[10px] text-[#22D3EE]">
                {formatTime(ch.startTime)}
              </span>
              <span className="block text-xs font-medium truncate mt-0.5">
                {ch.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
