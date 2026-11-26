import React from 'react'
import { formatTime } from '../../utils/time'
import { getCategoryMeta } from '../../config/modeConfig'

export function TimelineMarker({
  annotation,
  duration,
  mode,
  isActive,
  onSelect,
}) {
  if (!duration || duration <= 0) return null
  const percent = Math.min(98, Math.max(2, (annotation.timestamp / duration) * 100))
  const cat = getCategoryMeta(mode, annotation.category)

  return (
    <button
      type="button"
      onClick={() => onSelect?.(annotation)}
      style={{ left: `${percent}%` }}
      title={`${formatTime(annotation.timestamp)} • ${cat.label}: ${annotation.content}`}
      className="group absolute -translate-x-1/2 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/60"
    >
      <span
        className={`w-3.5 h-3.5 rounded-full border-2 border-[#08080B] transition-transform duration-150 shadow-sm ${
          isActive
            ? 'scale-125 ring-2 ring-white/60'
            : 'group-hover:scale-125 group-hover:ring-2 group-hover:ring-white/30'
        }`}
        style={{ backgroundColor: cat.color }}
      />
      <span className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 px-2 py-1 rounded-md bg-[#181820] border border-[#22222B] text-[10px] font-medium text-[#F4F4F7] whitespace-nowrap shadow-xl">
        {formatTime(annotation.timestamp)} · {cat.label}
      </span>
    </button>
  )
}
