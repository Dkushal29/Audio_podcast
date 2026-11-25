import React, { useEffect } from 'react'
import { ModeWorkspaceOverview } from '../components/dashboard/ModeWorkspaceOverview'
import { useEchoStore } from '../store/useEchoStore'

export function CreatorWorkspacePage() {
  const mode = useEchoStore((s) => s.mode)
  const setMode = useEchoStore((s) => s.setMode)

  useEffect(() => {
    if (mode !== 'creator') setMode('creator')
  }, [mode, setMode])

  return (
    <ModeWorkspaceOverview
      targetMode="creator"
      titleOverride="Creator Workspace"
      subtitleOverride="Review episode cuts, resolve correction markers, and approve highlight clips."
    />
  )
}
