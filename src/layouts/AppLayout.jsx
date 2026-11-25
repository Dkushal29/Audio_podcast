import React, { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Navbar } from '../components/layout/Navbar'
import { UploadRecordingModal } from '../components/dashboard/UploadRecordingModal'
import { useEchoStore } from '../store/useEchoStore'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const token = useEchoStore((s) => s.token)
  const isAuthenticated = useEchoStore((s) => s.isAuthenticated)
  const activeWorkspaceId = useEchoStore((s) => s.activeWorkspaceId)
  const loadWorkspaces = useEchoStore((s) => s.loadWorkspaces)

  useEffect(() => {
    if (token && !activeWorkspaceId) {
      loadWorkspaces().catch(() => {})
    }
  }, [token, activeWorkspaceId, loadWorkspaces])

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen h-screen flex bg-[#09090B] text-[#F4F4F5] overflow-hidden">
      <Sidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Navbar
          onOpenSidebar={() => setSidebarOpen(true)}
          onOpenUpload={() => setUploadOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          <Outlet context={{ openUploadModal: () => setUploadOpen(true) }} />
        </main>
      </div>

      <UploadRecordingModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
      />
    </div>
  )
}
