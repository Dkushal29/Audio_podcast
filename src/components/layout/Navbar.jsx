import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, Plus, LogOut, Settings, Layers } from 'lucide-react'
import { Button } from '../ui/Button'
import { Dropdown } from '../ui/Dropdown'
import { Avatar } from '../common/Avatar'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'

export function Navbar({ onOpenSidebar, onOpenUpload }) {
  const navigate = useNavigate()
  const mode = useEchoStore((s) => s.mode)
  const user = useEchoStore((s) => s.user)
  const logoutDemo = useEchoStore((s) => s.logoutDemo)
  const workspaceSettings = useEchoStore((s) => s.workspaceSettings)
  const cfg = getModeConfig(mode)

  const workspaceTitle =
    mode === 'study'
      ? workspaceSettings.studyName
      : workspaceSettings.creatorName

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

        <Dropdown
          trigger={
            <div className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-[#18181D] transition-colors">
              <Avatar name={user.name} color={user.avatarColor} size="sm" />
              <span className="hidden md:inline text-xs font-medium text-[#F4F4F5]">
                {user.name}
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
              label: 'Sign Out (Demo)',
              icon: LogOut,
              onClick: () => {
                logoutDemo()
                navigate('/login')
              },
            },
          ]}
        />
      </div>
    </header>
  )
}
