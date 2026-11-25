import React, { useEffect, useState } from 'react'
import { Scissors } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { formatTime } from '../../utils/time'

export function ClipModal({
  isOpen,
  onClose,
  currentTime = 0,
  duration = 42,
  onSaveClip,
}) {
  const [title, setTitle] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(10)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      const start = Math.max(0, Math.floor(currentTime))
      const end = Math.min(Math.floor(duration || 42), start + 10)
      setStartTime(start)
      setEndTime(end > start ? end : start + 5)
      setError('')
    }
  }, [isOpen, currentTime, duration])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Please enter a clip title.')
      return
    }
    if (Number(endTime) <= Number(startTime)) {
      setError('End time must be greater than start time.')
      return
    }
    onSaveClip?.({
      title: title.trim(),
      startTime: Number(startTime),
      endTime: Number(endTime),
      notes: notes.trim(),
    })
    setTitle('')
    setNotes('')
    onClose()
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
              max={Math.floor(duration || 42)}
              value={startTime}
              onChange={(e) => setStartTime(Number(e.target.value))}
            />
          </div>
          <div>
            <Input
              label={`End (${formatTime(endTime)})`}
              type="number"
              min={1}
              max={Math.floor(duration || 42)}
              value={endTime}
              onChange={(e) => setEndTime(Number(e.target.value))}
            />
          </div>
        </div>

        <Textarea
          label="Context Notes (optional)"
          placeholder="Why is this moment worth sharing?"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            <Scissors className="w-3.5 h-3.5" />
            Save Highlight Clip
          </Button>
        </div>
      </form>
    </Modal>
  )
}
