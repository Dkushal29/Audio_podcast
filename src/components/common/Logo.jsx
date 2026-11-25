import React from 'react'
import { Link } from 'react-router-dom'

export function Logo({ to = '/', size = 'md', showTagline = false }) {
  const iconSize = size === 'sm' ? 'w-7 h-7' : 'w-8 h-8'
  const textSize = size === 'sm' ? 'text-sm' : 'text-base'

  return (
    <Link to={to} className="inline-flex items-center gap-2.5 group">
      <div
        className={`${iconSize} rounded-lg bg-[#18181D] border border-[#27272F] group-hover:border-[#8B5CF6]/50 flex items-center justify-center transition-colors`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-4 h-4 text-[#8B5CF6]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M4 12v0" />
          <path d="M8 8v8" />
          <path d="M12 5v14" className="text-[#22D3EE]" stroke="currentColor" />
          <path d="M16 9v6" />
          <path d="M20 12v0" />
        </svg>
      </div>
      <div className="leading-none">
        <span className={`${textSize} font-semibold tracking-tight text-[#F4F4F5]`}>
          EchoSpace
        </span>
        {showTagline && (
          <p className="text-[11px] text-[#A1A1AA] mt-0.5">
            Listen. Understand. Discuss. Create.
          </p>
        )}
      </div>
    </Link>
  )
}
