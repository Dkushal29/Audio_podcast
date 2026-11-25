import React from 'react'

const VARIANTS = {
  primary:
    'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white border border-[#A78BFA]/30 shadow-[0_1px_2px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.14)]',
  secondary:
    'bg-[#16161D] hover:bg-[#1E1E27] text-[#F4F4F7] border border-[#22222B] hover:border-[#343442]',
  cyan:
    'bg-[#22D3EE]/14 hover:bg-[#22D3EE]/22 text-[#22D3EE] border border-[#22D3EE]/35 shadow-[0_1px_2px_rgba(0,0,0,0.3)]',
  ghost:
    'bg-transparent hover:bg-[#16161D] text-[#A1A1B0] hover:text-[#F4F4F7] border border-transparent',
  danger:
    'bg-rose-500/12 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30',
}

const SIZES = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
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
      className={`inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/40 ${
        VARIANTS[variant] || VARIANTS.primary
      } ${SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
