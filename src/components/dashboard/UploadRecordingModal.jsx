import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Music2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'

export function UploadRecordingModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const mode = useEchoStore((s) => s.mode)
  const token = useEchoStore((s) => s.token)
  const playlists = useEchoStore((s) => s.playlists)
  const uploadEpisode = useEchoStore((s) => s.uploadEpisode)
  const cfg = getModeConfig(mode)

  const modePlaylists = playlists.filter((p) => p.mode === mode)

  const [file, setFile] = useState(null)
  const [duration, setDuration] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setError('')
    if (!title) {
      setTitle(selected.name.replace(/\.[^/.]+$/, ''))
    }
    const objUrl = URL.createObjectURL(selected)
    const audio = new Audio(objUrl)
    audio.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration))
      }
      URL.revokeObjectURL(objUrl)
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title.trim()) {
      setError(`Please enter a ${cfg.recordingNoun.toLowerCase()} title.`)
      return
    }
    if (token && !file) {
      setError('Please select an audio file (.mp3, .wav, .ogg, .m4a, .webm).')
      return
    }

    try {
      setUploading(true)
      setProgress(0)
      const created = await uploadEpisode({
        file,
        title: title.trim(),
        description: description.trim(),
        tags,
        playlistId,
        duration,
        onProgress: setProgress,
      })

      setFile(null)
      setDuration(0)
      setTitle('')
      setDescription('')
      setTags('')
      setPlaylistId('')
      setProgress(0)
      setError('')
      onClose()
      navigate(`/app/recordings/${created.id}`)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Upload failed. Check file format and size.'
      )
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cfg.primaryAction.label}
      subtitle={`Add a new ${cfg.recordingNoun.toLowerCase()} to your ${cfg.name} workspace.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block p-3.5 rounded-lg bg-[#09090B] border border-dashed border-[#27272F] hover:border-[#8B5CF6]/60 transition-colors cursor-pointer">
          <input
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,.aac,.flac,.webm,audio/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#18181D] border border-[#27272F] flex items-center justify-center text-[#8B5CF6] shrink-0">
              <Music2 className="w-4 h-4" />
            </div>
            <div className="text-xs min-w-0">
              <p className="font-medium text-[#F4F4F5] truncate">
                {file
                  ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`
                  : token
                    ? 'Click to select MP3, WAV, OGG, M4A, or WebM audio'
                    : 'Demo Audio Ready (or select a local audio file)'}
              </p>
              <p className="text-[#A1A1AA]">
                {duration > 0
                  ? `Detected duration: ${duration}s`
                  : 'Max 100 MB · Validated on server'}
              </p>
            </div>
          </div>
        </label>

        {uploading && (
          <div className="space-y-1">
            <div className="h-1.5 w-full bg-[#18181D] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8B5CF6] transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[11px] text-[#A1A1AA] text-right">
              Uploading... {progress}%
            </p>
          </div>
        )}

        <Input
          label={`${cfg.recordingNoun} Title`}
          placeholder={
            mode === 'study'
              ? 'e.g. Week 6: Operating Systems Scheduling'
              : 'e.g. Ep. 49 — Building Real-Time Audio Sync'
          }
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            setError('')
          }}
          error={error}
        />

        <Textarea
          label="Description"
          placeholder="Context, agenda, or topics covered in this recording..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Tags (comma-separated)"
            placeholder="e.g. Systems, Review"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#A1A1AA]">
              {cfg.collectionNoun}
            </label>
            <select
              value={playlistId}
              onChange={(e) => setPlaylistId(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[#09090B] border border-[#27272F] text-sm text-[#F4F4F5] focus:outline-none focus:border-[#8B5CF6]"
            >
              <option value="">None</option>
              {modePlaylists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={mode === 'study' ? 'cyan' : 'primary'}
            disabled={uploading}
          >
            <Upload className="w-3.5 h-3.5" />
            {uploading ? 'Uploading...' : 'Create & Open'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
