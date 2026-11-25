import React from 'react'

export function Card({
  children,
  className = '',
  elevated = false,
  interactive = false,
  ...props
}) {
  return (
    <div
      className={`rounded-xl border border-[#22222B] ${
        elevated ? 'bg-[#16161D]' : 'bg-[#101015]'
      } ${
        interactive
          ? 'transition-all duration-150 hover:border-[#343442] hover:bg-[#14141B]'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
