import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  AudioLines,
  MessageSquareText,
  Scissors,
  ListMusic,
  Users,
  Settings,
  X,
  ArrowLeftRight,
} from 'lucide-react'
import { Logo } from '../common/Logo'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'

const NAV_ITEMS = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/recordings', label: 'Recordings', icon: AudioLines },
  { to: '/app/discussions', label: 'Discussions', icon: MessageSquareText },
  { to: '/app/highlights', label: 'Highlights', icon: Scissors },
  { to: '/app/playlists', label: 'Playlists', icon: ListMusic },
  { to: '/app/members', label: 'Members', icon: Users },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ mobileOpen, onClose }) {
  const mode = useEchoStore((s) => s.mode)
  const setMode = useEchoStore((s) => s.setMode)
  const navigate = useNavigate()
  const cfg = getModeConfig(mode)

  const handleSwitchMode = (nextMode) => {
    setMode(nextMode)
    navigate(nextMode === 'study' ? '/app/study' : '/app/creator')
    onClose?.()
  }

  const content = (
    <div className="flex flex-col h-full w-60 bg-[#09090B] border-r border-[#27272F]">
      <div className="h-14 px-4 flex items-center justify-between border-b border-[#27272F]">
        <Logo to="/app" size="sm" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-md text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181D] cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Mode indicator pill */}
      <div className="px-3 pt-4 pb-2">
        <div className="p-2.5 rounded-lg bg-[#111114] border border-[#27272F]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase tracking-wider text-[#A1A1AA] font-medium">
              Workspace
            </span>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.accentBg} ${cfg.accentText} ${cfg.accentBorder}`}
            >
              {cfg.shortName}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1 bg-[#09090B] p-0.5 rounded-md border border-[#27272F]">
            <button
              type="button"
              onClick={() => handleSwitchMode('study')}
              className={`py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                mode === 'study'
                  ? 'bg-[#22D3EE]/15 text-[#22D3EE]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              Study
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('creator')}
              className={`py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                mode === 'creator'
                  ? 'bg-[#8B5CF6]/15 text-[#A78BFA]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              Creator
            </button>
          </div>
        </div>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#18181D] text-[#F4F4F5] border border-[#27272F]'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#111114] border border-transparent'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom workspace link */}
      <div className="p-3 border-t border-[#27272F]">
        <button
          type="button"
          onClick={() => {
            navigate('/workspaces')
            onClose?.()
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#111114] transition-colors cursor-pointer"
        >
          <span>All Workspaces</span>
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs"
            onClick={onClose}
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  )
}
