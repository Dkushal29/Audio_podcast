import React, { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Navbar } from '../components/layout/Navbar'
import { UploadRecordingModal } from '../components/dashboard/UploadRecordingModal'
import { useEchoStore } from '../store/useEchoStore'
import { getSocket } from '../services/socket'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [workspaceError, setWorkspaceError] = useState('')

  const token = useEchoStore((s) => s.token)
  const isAuthenticated = useEchoStore((s) => s.isAuthenticated)
  const activeWorkspaceId = useEchoStore((s) => s.activeWorkspaceId)
  const loadWorkspaces = useEchoStore((s) => s.loadWorkspaces)
  const loadNotifications = useEchoStore((s) => s.loadNotifications)
  const addSocketNotification = useEchoStore((s) => s.addSocketNotification)

  const retryLoadWorkspaces = () => {
    setWorkspaceError('')
    loadWorkspaces().catch((err) => {
      setWorkspaceError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to load workspace data.'
      )
    })
  }

  useEffect(() => {
    if (token && !activeWorkspaceId) {
      retryLoadWorkspaces()
    }
  }, [token, activeWorkspaceId])

  useEffect(() => {
    if (!token) return
    loadNotifications().catch(() => {})
    const socket = getSocket()
    if (!socket) return
    const onNotif = ({ notification }) => {
      if (notification) addSocketNotification(notification)
    }
    socket.on('notification:created', onNotif)
    return () => socket.off('notification:created', onNotif)
  }, [token, loadNotifications, addSocketNotification])

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen h-screen flex bg-[#070709] text-[#F4F4F7] overflow-hidden">
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
          {workspaceError && (
            <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-300">
              <span>{workspaceError}</span>
              <button
                type="button"
                onClick={retryLoadWorkspaces}
                className="px-2.5 py-1 rounded bg-[#16161D] border border-[#22222B] text-[#F4F4F7] hover:border-[#343442] cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}
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
