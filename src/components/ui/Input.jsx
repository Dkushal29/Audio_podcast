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
          className="block text-xs font-medium text-[#A1A1AA]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full h-9 px-3 rounded-lg bg-[#09090B] border text-sm text-[#F4F4F5] placeholder-[#71717A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/35 ${
          error
            ? 'border-rose-500/60 focus:border-rose-500'
            : 'border-[#27272F] focus:border-[#8B5CF6]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {!error && hint && <p className="text-xs text-[#71717A]">{hint}</p>}
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
          className="block text-xs font-medium text-[#A1A1AA]"
        >
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`w-full px-3 py-2 rounded-lg bg-[#09090B] border text-sm text-[#F4F4F5] placeholder-[#71717A] transition-colors focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]/35 ${
          error
            ? 'border-rose-500/60 focus:border-rose-500'
            : 'border-[#27272F] focus:border-[#8B5CF6]'
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  )
}
