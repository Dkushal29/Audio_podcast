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
  BookOpen,
  Mic2,
} from 'lucide-react'
import { Logo } from '../common/Logo'
import { Avatar } from '../common/Avatar'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'

export function Sidebar({ mobileOpen, onClose }) {
  const mode = useEchoStore((s) => s.mode)
  const setMode = useEchoStore((s) => s.setMode)
  const user = useEchoStore((s) => s.user)
  const activeWorkspaceRole = useEchoStore((s) => s.activeWorkspaceRole)
  const workspaceSettings = useEchoStore((s) => s.workspaceSettings)
  const navigate = useNavigate()
  const cfg = getModeConfig(mode)
  const isStudy = mode === 'study'

  const workspaceTitle = isStudy
    ? workspaceSettings.studyName
    : workspaceSettings.creatorName

  const workspaceNav = [
    { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/app/recordings', label: cfg.recordingPlural, icon: AudioLines },
    { to: '/app/discussions', label: 'Discussions', icon: MessageSquareText },
    { to: '/app/highlights', label: 'Highlights', icon: Scissors },
    { to: '/app/playlists', label: cfg.collectionPlural, icon: ListMusic },
  ]

  const teamNav = [
    { to: '/app/members', label: 'Members', icon: Users },
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ]

  const handleSwitchMode = (nextMode) => {
    setMode(nextMode)
    navigate(nextMode === 'study' ? '/app/study' : '/app/creator')
    onClose?.()
  }

  const renderLink = (item) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onClose}
        className={({ isActive }) =>
          `group relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
            isActive
              ? 'bg-[#16161D] text-[#F4F4F7] border border-[#22222B] shadow-xs'
              : 'text-[#A1A1B0] hover:text-[#F4F4F7] hover:bg-[#101015] border border-transparent'
          }`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && (
              <span
                className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full ${cfg.accentBar}`}
              />
            )}
            <Icon
              className={`w-4 h-4 shrink-0 transition-colors ${
                isActive ? cfg.accentText : 'text-[#6E6E7E] group-hover:text-[#A1A1B0]'
              }`}
            />
            <span className="truncate">{item.label}</span>
          </>
        )}
      </NavLink>
    )
  }

  const content = (
    <div className="flex flex-col h-full w-64 bg-[#0A0A0E] border-r border-[#22222B]">
      {/* Brand */}
      <div className="h-15 px-4 flex items-center justify-between border-b border-[#22222B]">
        <Logo to="/app" size="sm" />
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-[#A1A1B0] hover:text-[#F4F4F7] hover:bg-[#16161D] cursor-pointer"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Workspace & Mode Switcher */}
      <div className="px-3 pt-4 pb-3 border-b border-[#22222B]/60">
        <div className="p-3 rounded-xl bg-[#101015] border border-[#22222B] space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-[#6E6E7E] font-semibold block">
                Active Workspace
              </span>
              <p className="text-xs font-semibold text-[#F4F4F7] truncate mt-0.5">
                {workspaceTitle}
              </p>
            </div>
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#16161D] border border-[#22222B] text-[#A1A1B0] shrink-0">
              {activeWorkspaceRole}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 bg-[#08080B] p-1 rounded-lg border border-[#22222B]">
            <button
              type="button"
              onClick={() => handleSwitchMode('study')}
              className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                isStudy
                  ? 'bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/30 shadow-xs'
                  : 'text-[#A1A1B0] hover:text-[#F4F4F7] border border-transparent'
              }`}
            >
              <BookOpen className="w-3 h-3" />
              Study
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('creator')}
              className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                !isStudy
                  ? 'bg-[#8B5CF6]/18 text-[#A78BFA] border border-[#8B5CF6]/35 shadow-xs'
                  : 'text-[#A1A1B0] hover:text-[#F4F4F7] border border-transparent'
              }`}
            >
              <Mic2 className="w-3 h-3" />
              Creator
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#6E6E7E] mb-1.5">
            Studio
          </p>
          {workspaceNav.map(renderLink)}
        </div>

        <div className="space-y-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#6E6E7E] mb-1.5">
            Workspace
          </p>
          {teamNav.map(renderLink)}
        </div>
      </nav>

      {/* Bottom Workspace Switcher + User */}
      <div className="p-3 border-t border-[#22222B] space-y-2">
        <button
          type="button"
          onClick={() => {
            navigate('/workspaces')
            onClose?.()
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-[#A1A1B0] hover:text-[#F4F4F7] hover:bg-[#101015] border border-transparent hover:border-[#22222B] transition-all cursor-pointer"
        >
          <span>Switch Workspace</span>
          <ArrowLeftRight className="w-3.5 h-3.5 text-[#6E6E7E]" />
        </button>

        {user && (
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-[#101015] border border-[#22222B]/70">
            <Avatar
              name={user.name || 'User'}
              color={user.avatarColor || '#8B5CF6'}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[#F4F4F7] truncate">
                {user.name}
              </p>
              <p className="text-[10px] text-[#6E6E7E] truncate">{user.email}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <>
      <aside className="hidden lg:block shrink-0">{content}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={onClose}
          />
          <div className="relative z-10 h-full">{content}</div>
        </div>
      )}
    </>
  )
}
