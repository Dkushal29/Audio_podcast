import React, { useEffect } from 'react'
import { ModeWorkspaceOverview } from '../components/dashboard/ModeWorkspaceOverview'
import { useEchoStore } from '../store/useEchoStore'

export function StudyWorkspacePage() {
  const mode = useEchoStore((s) => s.mode)
  const setMode = useEchoStore((s) => s.setMode)

  useEffect(() => {
    if (mode !== 'study') setMode('study')
  }, [mode, setMode])

  return (
    <ModeWorkspaceOverview
      targetMode="study"
      titleOverride="Study Workspace"
      subtitleOverride="Track lectures, resolve timestamped doubts, and curate revision highlights."
    />
  )
}
