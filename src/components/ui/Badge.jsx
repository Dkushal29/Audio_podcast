import React from 'react'

const TONES = {
  neutral: 'bg-[#16161D] text-[#A1A1B0] border-[#22222B]',
  primary: 'bg-[#8B5CF6]/12 text-[#A78BFA] border-[#8B5CF6]/30',
  cyan: 'bg-[#22D3EE]/12 text-[#22D3EE] border-[#22D3EE]/30',
  teal: 'bg-[#14B8A6]/12 text-[#2DD4BF] border-[#14B8A6]/30',
  amber: 'bg-amber-500/12 text-amber-300 border-amber-500/30',
  emerald: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30',
  rose: 'bg-rose-500/12 text-rose-400 border-rose-500/30',
}

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-[11px] font-medium tracking-wide ${
        TONES[tone] || TONES.neutral
      } ${className}`}
    >
      {children}
    </span>
  )
}
