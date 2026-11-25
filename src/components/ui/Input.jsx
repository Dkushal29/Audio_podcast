import React from 'react'

export function Input({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[#A1A1B0]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full h-9.5 px-3 rounded-lg bg-[#08080B] border text-sm text-[#F4F4F7] placeholder-[#6E6E7E] transition-colors focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 ${
          error
            ? 'border-rose-500/60 focus:border-rose-500'
            : 'border-[#22222B] hover:border-[#343442] focus:border-[#8B5CF6]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {!error && hint && <p className="text-xs text-[#6E6E7E]">{hint}</p>}
    </div>
  )
}

export function Textarea({
  label,
  error,
  className = '',
  id,
  rows = 3,
  ...props
}) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-')

  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[#A1A1B0]"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`w-full px-3 py-2 rounded-lg bg-[#08080B] border text-sm text-[#F4F4F7] placeholder-[#6E6E7E] transition-colors focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/30 ${
          error
            ? 'border-rose-500/60 focus:border-rose-500'
            : 'border-[#22222B] hover:border-[#343442] focus:border-[#8B5CF6]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
