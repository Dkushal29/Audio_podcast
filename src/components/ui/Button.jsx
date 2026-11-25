import React from 'react'

const VARIANTS = {
  primary:
    'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border border-[#8B5CF6]/50 shadow-sm',
  secondary:
    'bg-[#18181D] hover:bg-[#222229] text-[#F4F4F5] border border-[#27272F] hover:border-[#3F3F46]',
  cyan: 'bg-[#22D3EE]/12 hover:bg-[#22D3EE]/20 text-[#22D3EE] border border-[#22D3EE]/30',
  ghost:
    'bg-transparent hover:bg-[#18181D] text-[#A1A1AA] hover:text-[#F4F4F5] border border-transparent',
  danger:
    'bg-rose-500/12 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 ${
        VARIANTS[variant] || VARIANTS.primary
      } ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
