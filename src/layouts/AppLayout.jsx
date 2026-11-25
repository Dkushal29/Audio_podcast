import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'
import { Navbar } from '../components/layout/Navbar'
import { UploadRecordingModal } from '../components/dashboard/UploadRecordingModal'

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

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
