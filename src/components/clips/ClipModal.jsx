import React, { useEffect, useState } from 'react'
import { Scissors, Play } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { formatTime } from '../../utils/time'

export function ClipModal({
  isOpen,
  onClose,
  currentTime = 0,
  initialStart = null,
  initialEnd = null,
  duration = 0,
  onSaveClip,
  onPreviewInterval,
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(10)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const maxDuration = duration > 0 ? Math.floor(duration) : undefined

  useEffect(() => {
    if (isOpen) {
      const start =
        initialStart !== null && initialStart !== undefined
          ? Math.max(0, Math.floor(initialStart))
          : Math.max(0, Math.floor(currentTime))
      const end =
        initialEnd !== null && initialEnd !== undefined && initialEnd > start
          ? Math.floor(initialEnd)
          : duration > 0
            ? Math.min(Math.floor(duration), start + 10)
            : start + 10
      setStartTime(start)
      setEndTime(end > start ? end : start + 5)
      setError('')
    }
  }, [isOpen, currentTime, initialStart, initialEnd, duration])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please enter a clip title.')
      return
    }
    if (Number(startTime) < 0 || Number(endTime) <= Number(startTime)) {
      setError('End time must be greater than start time.')
      return
    }
    if (duration > 0 && Number(endTime) > duration) {
      setError(`End time cannot exceed recording duration (${Math.floor(duration)}s).`)
      return
    }

    try {
      setSaving(true)
      setError('')
      await onSaveClip?.({
        title: title.trim(),
        startTime: Number(startTime),
        endTime: Number(endTime),
        notes: notes.trim(),
      })
      setTitle('')
      setNotes('')
      onClose()
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to save highlight clip.'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Highlight Clip"
      subtitle="Select a timestamp range to share as a standalone EchoSpace clip."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Clip Title"
          placeholder="e.g. Key insight on leader election"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setError('')
          }}
          error={error}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Input
              label={`Start (${formatTime(startTime)})`}
              type="number"
              min={0}
              max={maxDuration}
              value={startTime}
              onChange={(e) => {
                setStartTime(Number(e.target.value))
                setError('')
              }}
            />
          </div>
          <div>
            <Input
              label={`End (${formatTime(endTime)})`}
              type="number"
              min={1}
              max={maxDuration}
              value={endTime}
              onChange={(e) => {
                setEndTime(Number(e.target.value))
                setError('')
              }}
            />
          </div>
        </div>

        <Textarea
          label="Context Notes (optional)"
          placeholder="Why is this moment worth sharing?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex items-center justify-between gap-2 pt-2">
          <div>
            {onPreviewInterval && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={saving || Number(endTime) <= Number(startTime)}
                onClick={() =>
                  onPreviewInterval(Number(startTime), Number(endTime))
                }
              >
                <Play className="w-3.5 h-3.5" />
                Preview Interval
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={saving}>
              <Scissors className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Highlight Clip'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
