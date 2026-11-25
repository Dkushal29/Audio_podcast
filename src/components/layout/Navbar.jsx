import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Plus, LogOut, Settings, Layers, Bell, CheckCheck } from 'lucide-react'
import { Button } from '../ui/Button'
import { Dropdown } from '../ui/Dropdown'
import { Avatar } from '../common/Avatar'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'
import { formatTime } from '../../utils/time'

export function Navbar({ onOpenSidebar, onOpenUpload }) {
  const navigate = useNavigate()
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

  const handleNotificationClick = async (n) => {
    setNotifOpen(false)
    if (!n.isRead) {
      await markNotificationRead(n.id).catch(() => {})
    }
    const tParam = Math.floor(n.timestamp || 0)
    navigate(`/app/recordings/${n.episodeId}?t=${tParam}&ann=${n.annotationId}`)
  }

  return (
    <header className="h-14 px-4 lg:px-6 border-b border-[#27272F] bg-[#09090B]/90 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="lg:hidden p-1.5 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181D] cursor-pointer"
          aria-label="Open navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[#F4F4F5] truncate">
            {workspaceTitle}
          </span>
          <span className="hidden sm:inline-block text-[#27272F]">/</span>
          <span className={`hidden sm:inline-block text-xs font-medium ${cfg.accentText}`}>
            {cfg.name}
          </span>
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
            className="relative p-2 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181D] transition-colors cursor-pointer"
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
            <div className="absolute right-0 mt-2 w-80 rounded-lg bg-[#111114] border border-[#27272F] shadow-2xl z-50 overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-[#27272F] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#F4F4F5]">
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

              <div className="max-h-80 overflow-y-auto divide-y divide-[#27272F]">
                {notifications.length === 0 ? (
                  <div className="p-5 text-center text-xs text-[#71717A]">
                    No notifications yet.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left p-3 hover:bg-[#18181D] transition-colors cursor-pointer ${
                        !n.isRead ? 'bg-[#18181D]/60' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs text-[#F4F4F5] leading-snug">
                          {n.message}
                        </p>
                        {!n.isRead && (
                          <span className="w-2 h-2 rounded-full bg-[#22D3EE] shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-[#71717A] mt-1 truncate">
                        {n.episodeTitle} ·{' '}
                        <span className="font-mono text-[#A1A1AA]">
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
            <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[#18181D] transition-colors">
              <Avatar
                name={user?.name || 'User'}
                color={user?.avatarColor || '#8B5CF6'}
                size="sm"
              />
              <span className="hidden md:inline text-xs font-medium text-[#F4F4F5]">
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
