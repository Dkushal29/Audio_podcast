import React, { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Avatar } from '../components/common/Avatar'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { useEchoStore } from '../store/useEchoStore'
import { getModeConfig } from '../config/modeConfig'

export function MembersPage() {
  const mode = useEchoStore((s) => s.mode)
  const members = useEchoStore((s) => s.members)
  const inviteMember = useEchoStore((s) => s.inviteMember)
  const cfg = getModeConfig(mode)

  const [inviteOpen, setInviteOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState(mode === 'study' ? 'Student' : 'Editor')
  const [error, setError] = useState('')

  const handleInvite = (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Name and email are required.')
      return
    }
    inviteMember({ name: name.trim(), email: email.trim(), role })
    setName('')
    setEmail('')
    setError('')
    setInviteOpen(false)
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge tone={mode === 'study' ? 'cyan' : 'primary'}>{cfg.name}</Badge>
          <h1 className="text-2xl font-semibold text-[#F4F4F5] mt-2">
            Workspace Members
          </h1>
          <p className="text-sm text-[#A1A1AA] mt-0.5">
            Collaborators with access to recordings, annotations, and clips.
          </p>
        </div>

        <Button
          variant={mode === 'study' ? 'cyan' : 'primary'}
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </Button>
      </div>

      <Card className="divide-y divide-[#27272F]">
        {members.map((m) => (
          <div
            key={m.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <Avatar name={m.name} color={m.avatarColor} size="md" />
              <div>
                <p className="text-sm font-medium text-[#F4F4F5]">{m.name}</p>
                <p className="text-xs text-[#A1A1AA]">{m.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="neutral">{m.role}</Badge>
              <Badge tone={m.status === 'Active' ? 'emerald' : 'amber'}>
                {m.status}
              </Badge>
            </div>
          </div>
        ))}
      </Card>

      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Collaborator"
        subtitle="Add a teammate to your EchoSpace demo workspace."
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Kabir Sharma"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="kabir@echospace.app"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
          />
          <Input
            label="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Send Demo Invite</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
