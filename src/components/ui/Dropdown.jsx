import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function Dropdown({
  trigger,
  items = [],
  align = 'right',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        {trigger || (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#16161D] border border-[#22222B] text-xs font-medium text-[#F4F4F7]"
          >
            Options <ChevronDown className="w-3.5 h-3.5 text-[#A1A1B0]" />
          </button>
        )}
      </div>

      {open && (
        <div
          className={`absolute z-40 mt-1.5 min-w-48 rounded-xl bg-[#181820] border border-[#22222B] shadow-2xl py-1.5 ${
            align === 'left' ? 'left-0' : 'right-0'
          }`}
        >
          {items.map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              onClick={() => {
                item.onClick?.()
                setOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                item.active
                  ? 'bg-[#8B5CF6]/15 text-[#F4F4F7]'
                  : 'text-[#A1A1B0] hover:bg-[#22222B]/60 hover:text-[#F4F4F7]'
              }`}
            >
              {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
