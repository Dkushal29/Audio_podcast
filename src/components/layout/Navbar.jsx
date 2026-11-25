import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Menu, Plus, LogOut, Settings, Layers, Bell, CheckCheck } from 'lucide-react'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Dropdown } from '../ui/Dropdown'
import { Avatar } from '../common/Avatar'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'
import { formatTime } from '../../utils/time'

const PAGE_TITLES = {
  '/app': 'Overview',
  '/app/study': 'Study Workspace',
  '/app/creator': 'Creator Workspace',
  '/app/recordings': 'Library',
  '/app/discussions': 'Discussions',
  '/app/highlights': 'Highlights',
  '/app/playlists': 'Collections',
  '/app/members': 'Members',
  '/app/settings': 'Settings',
}

export function Navbar({ onOpenSidebar, onOpenUpload }) {
  const navigate = useNavigate()
  const location = useLocation()
  const mode = useEchoStore((s) => s.mode)
  const user = useEchoStore((s) => s.user)
  const logout = useEchoStore((s) => s.logout)
  const workspaceSettings = useEchoStore((s) => s.workspaceSettings)
  const notifications = useEchoStore((s) => s.notifications)
  const unreadCount = useEchoStore((s) => s.unreadNotifications)
  const markNotificationRead = useEchoStore((s) => s.markNotificationRead)
  const markAllNotificationsRead = useEchoStore((s) => s.markAllNotificationsRead)
  const cfg = getModeConfig(mode)

  const [notifOpen, setNotifOpen] = useState(false)
  const notifRef = useRef(null)

  useEffect(() => {
    const onDocClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const workspaceTitle =
    mode === 'study'
      ? workspaceSettings.studyName
      : workspaceSettings.creatorName

  const pageLabel = location.pathname.startsWith('/app/recordings/')
    ? 'Audio Studio'
    : PAGE_TITLES[location.pathname] || 'Studio'

  const handleNotificationClick = async (n) => {
    setNotifOpen(false)
    if (!n.isRead) {
      await markNotificationRead(n.id).catch(() => {})
    }
    const tParam = Math.floor(n.timestamp || 0)
    navigate(`/app/recordings/${n.episodeId}?t=${tParam}&ann=${n.annotationId}`)
  }

  return (
    <header className="h-15 px-4 lg:px-6 border-b border-[#22222B] bg-[#0A0A0E]/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-1.5 rounded-lg text-[#A1A1B0] hover:text-[#F4F4F7] hover:bg-[#16161D] cursor-pointer"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xs font-medium text-[#A1A1B0] truncate hidden sm:inline">
            {workspaceTitle}
          </span>
          <span className="hidden sm:inline-block text-[#343442]">/</span>
          <span className="text-sm font-semibold text-[#F4F4F7] font-display truncate">
            {pageLabel}
          </span>
          <Badge tone={cfg.badgeTone} className="hidden md:inline-flex">
            {cfg.shortName}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          size="sm"
          variant={mode === 'study' ? 'cyan' : 'primary'}
          onClick={onOpenUpload}
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{cfg.primaryAction.label}</span>
          <span className="sm:hidden">{cfg.primaryAction.shortLabel}</span>
        </Button>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifOpen((p) => !p)}
            className="relative p-2 rounded-lg text-[#A1A1B0] hover:text-[#F4F4F7] hover:bg-[#16161D] border border-transparent hover:border-[#22222B] transition-all cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[15px] h-[15px] px-1 rounded-full bg-[#8B5CF6] text-[10px] font-semibold text-white flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#121218] border border-[#22222B] shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#22222B] bg-[#101015] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F4F4F7] font-display">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllNotificationsRead().catch(() => {})}
                    className="inline-flex items-center gap-1 text-[11px] text-[#22D3EE] hover:underline cursor-pointer"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-[#22222B]">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#6E6E7E]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left p-3.5 hover:bg-[#16161D] transition-colors cursor-pointer ${
                        !n.isRead ? 'bg-[#16161D]/60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-[#F4F4F7] leading-snug">
                          {n.message}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#22D3EE] shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#6E6E7E] mt-1 truncate">
                        {n.episodeTitle} ·{' '}
                        <span className="font-mono-time text-[#A1A1B0]">
                          {formatTime(n.timestamp)}
                        </span>
                      </p>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <Dropdown
          trigger={
            <div className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-[#16161D] border border-transparent hover:border-[#22222B] transition-all">
              <Avatar
                name={user?.name || 'User'}
                color={user?.avatarColor || '#8B5CF6'}
                size="sm"
              />
              <span className="hidden md:inline text-xs font-medium text-[#F4F4F7]">
                {user?.name}
              </span>
            </div>
          }
          items={[
            {
              id: 'workspaces',
              label: 'Switch Workspace',
              icon: Layers,
              onClick: () => navigate('/workspaces'),
            },
            {
              id: 'settings',
              label: 'Settings',
              icon: Settings,
              onClick: () => navigate('/app/settings'),
            },
            {
              id: 'logout',
              label: 'Sign Out',
              icon: LogOut,
              onClick: () => {
                logout()
                navigate('/login')
              },
            },
          ]}
        />
      </div>
    </header>
  )
}
