import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Mic2 } from 'lucide-react'
import { Logo } from '../components/common/Logo'
import { WorkspaceCard } from '../components/workspace/WorkspaceCard'
import { MODES } from '../config/modeConfig'
import { useEchoStore } from '../store/useEchoStore'

export function WorkspaceSelectionPage() {
  const navigate = useNavigate()
  const activeMode = useEchoStore((s) => s.mode)
  const token = useEchoStore((s) => s.token)
  const workspaces = useEchoStore((s) => s.workspaces)
  const loadWorkspaces = useEchoStore((s) => s.loadWorkspaces)
  const selectWorkspace = useEchoStore((s) => s.selectWorkspace)
  const createAndSelectWorkspace = useEchoStore(
    (s) => s.createAndSelectWorkspace
  )
  const setMode = useEchoStore((s) => s.setMode)
  const [busyMode, setBusyMode] = useState(null)

  useEffect(() => {
    if (token) {
      loadWorkspaces().catch(() => {})
    }
  }, [token, loadWorkspaces])

  const handleEnter = async (modeId) => {
    if (!token) {
      setMode(modeId)
      navigate(modeId === 'study' ? '/app/study' : '/app/creator')
      return
    }

    try {
      setBusyMode(modeId)
      const existing = workspaces.find(
        (w) => w.mode.toLowerCase() === modeId
      )
      if (existing) {
        await selectWorkspace(existing.id)
      } else {
        await createAndSelectWorkspace({
          name:
            modeId === 'study'
              ? 'Study Collective'
              : 'Creator Audio Studio',
          mode: modeId,
        })
      }
      navigate(modeId === 'study' ? '/app/study' : '/app/creator')
    } finally {
      setBusyMode(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#070709] text-[#F4F4F7] flex flex-col">
      <header className="h-16 px-4 sm:px-8 border-b border-[#22222B] bg-[#0A0A0E]/85 backdrop-blur-md flex items-center justify-between">
        <Logo to="/" />
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="text-xs font-medium text-[#A1A1B0] hover:text-[#F4F4F7] cursor-pointer"
        >
          Go to Dashboard
        </button>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#A78BFA]">
              Choose Your Workspace
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#F4F4F7] font-display">
              How are you using EchoSpace today?
            </h1>
            <p className="text-sm text-[#A1A1B0]">
              Both workspaces share the same audio engine — you can switch modes
              anytime.
            </p>
            {busyMode && (
              <p className="text-xs text-[#22D3EE]">
                Preparing {busyMode === 'study' ? 'Study' : 'Creator'}{' '}
                workspace...
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <WorkspaceCard
              modeConfig={MODES.study}
              icon={BookOpen}
              isActive={activeMode === 'study'}
              features={[
                'Timestamped questions & doubt resolution',
                'Important insights & revision highlights',
                'Subject-based playlists & group activity',
              ]}
              onEnter={handleEnter}
            />

            <WorkspaceCard
              modeConfig={MODES.creator}
              icon={Mic2}
              isActive={activeMode === 'creator'}
              features={[
                'Timestamped feedback & correction markers',
                'Collaborative review & approved highlight clips',
                'Shows, episodes & RSS feed management',
              ]}
              onEnter={handleEnter}
            />
          </div>
        </div>
      </main>
    </div>
  )
}
