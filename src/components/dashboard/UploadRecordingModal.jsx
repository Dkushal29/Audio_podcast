import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Music2, Link2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'

export function UploadRecordingModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const mode = useEchoStore((s) => s.mode)
  const playlists = useEchoStore((s) => s.playlists)
  const uploadEpisode = useEchoStore((s) => s.uploadEpisode)
  const createExternalEpisode = useEchoStore((s) => s.createExternalEpisode)
  const cfg = getModeConfig(mode)

  const modePlaylists = playlists.filter((p) => p.mode === mode)

  const [sourceTab, setSourceTab] = useState('upload')
  const [file, setFile] = useState(null)
  const [sourceUrl, setSourceUrl] = useState('')
  const [duration, setDuration] = useState(0)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [playlistId, setPlaylistId] = useState('')
  const [progress, setProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
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

    if (sourceTab === 'upload' && !file) {
      setError('Please select an audio file (.mp3, .wav, .ogg, .m4a, .webm).')
      return
    }

    if (sourceTab === 'external') {
      try {
        const parsed = new URL(sourceUrl.trim())
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setError('Please enter a valid http/https URL.')
          return
        }
      } catch {
        setError('Please enter a valid external media URL.')
        return
      }
    }

    try {
      setSubmitting(true)
      setProgress(0)
      const created =
        sourceTab === 'upload'
          ? await uploadEpisode({
              file,
              title: title.trim(),
              description: description.trim(),
              tags,
              playlistId,
              duration,
              onProgress: setProgress,
            })
          : await createExternalEpisode({
              sourceUrl: sourceUrl.trim(),
              title: title.trim(),
              description: description.trim(),
              tags,
              playlistId,
              duration,
            })

      setFile(null)
      setSourceUrl('')
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
      if (err.code === 'ERR_NETWORK') {
        setError(
          'Backend server is unavailable. Please ensure the API server is running.'
        )
      } else if (err.response?.status === 401) {
        setError('Authentication expired. Please sign in again.')
      } else {
        setError(
          err.response?.data?.error?.message ||
            err.message ||
            'Failed to save recording.'
        )
      }
    } finally {
      setSubmitting(false)
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
        <div className="grid grid-cols-2 gap-1 bg-[#09090B] p-1 rounded-lg border border-[#27272F]">
          <button
            type="button"
            onClick={() => {
              setSourceTab('upload')
              setError('')
            }}
            className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              sourceTab === 'upload'
                ? 'bg-[#18181D] text-[#F4F4F5]'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
            }`}
          >
            Upload Audio File
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceTab('external')
              setError('')
            }}
            className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              sourceTab === 'external'
                ? 'bg-[#18181D] text-[#F4F4F5]'
                : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
            }`}
          >
            External Media Link
          </button>
        </div>

        {sourceTab === 'upload' ? (
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
                    : 'Click to select MP3, WAV, OGG, M4A, or WebM audio'}
                </p>
                <p className="text-[#A1A1AA]">
                  {duration > 0
                    ? `Detected duration: ${duration}s`
                    : 'Max 100 MB · Validated on server'}
                </p>
              </div>
            </div>
          </label>
        ) : (
          <div className="space-y-2">
            <Input
              label="Source Webpage or Media URL"
              placeholder="https://example.com/lecture-or-episode"
              value={sourceUrl}
              onChange={(e) => {
                setSourceUrl(e.target.value)
                setError('')
              }}
            />
            <p className="text-[11px] text-[#71717A] flex items-center gap-1.5">
              <Link2 className="w-3 h-3 shrink-0" />
              Stored as an external media link with timestamped annotations (no
              media downloading).
            </p>
          </div>
        )}

        {submitting && sourceTab === 'upload' && (
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
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={mode === 'study' ? 'cyan' : 'primary'}
            disabled={submitting}
          >
            <Upload className="w-3.5 h-3.5" />
            {submitting ? 'Saving...' : 'Create & Open'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
