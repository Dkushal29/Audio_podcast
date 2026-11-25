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
      className={`rounded-lg border border-[#27272F] ${
        elevated ? 'bg-[#18181D]' : 'bg-[#111114]'
      } ${
        interactive
          ? 'transition-colors duration-150 hover:border-[#3F3F46] hover:bg-[#16161B]'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
