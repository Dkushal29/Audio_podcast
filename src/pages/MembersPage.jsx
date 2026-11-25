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
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('MEMBER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleInvite = async (e) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('A valid registered user email is required.')
      return
    }
    try {
      setSubmitting(true)
      setError('')
      await inviteMember({ email: email.trim(), role })
      setEmail('')
      setRole('MEMBER')
      setInviteOpen(false)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Could not add member.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge tone={cfg.badgeTone}>{cfg.name}</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F4F7] font-display mt-2">
            Workspace Members
          </h1>
          <p className="text-sm text-[#A1A1B0] mt-0.5">
            Collaborators with access to recordings, annotations, and clips.
          </p>
        </div>

        <Button
          variant={mode === 'study' ? 'cyan' : 'primary'}
          onClick={() => setInviteOpen(true)}
        >
          <UserPlus className="w-4 h-4" />
          Add Member
        </Button>
      </div>

      <Card className="divide-y divide-[#22222B]">
        {members.map((m) => (
          <div
            key={m.id}
            className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <Avatar name={m.name} color={m.avatarColor} size="md" />
              <div>
                <p className="text-sm font-medium text-[#F4F4F7]">{m.name}</p>
                <p className="text-xs text-[#A1A1B0]">{m.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge tone="neutral">{m.role}</Badge>
              <Badge tone="emerald">{m.status}</Badge>
            </div>
          </div>
        ))}
        {members.length === 0 && (
          <div className="p-8 text-center text-xs text-[#A1A1B0]">
            No members found in this workspace yet.
          </div>
        )}
      </Card>

      <Modal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Add Collaborator"
        subtitle="Add a registered EchoSpace user to this workspace by email."
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <Input
            label="User Email Address"
            type="email"
            placeholder="teammate@echospace.app"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#A1A1AA]">
              Workspace Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#09090B] border border-[#27272F] text-sm text-[#F4F4F5]"
            >
              <option value="MEMBER">MEMBER (Annotate, reply &amp; upload)</option>
              <option value="EDITOR">EDITOR (Manage workspace &amp; content)</option>
              <option value="VIEWER">VIEWER (Read &amp; listen only)</option>
              <option value="OWNER">OWNER (Full control)</option>
            </select>
          </div>
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
