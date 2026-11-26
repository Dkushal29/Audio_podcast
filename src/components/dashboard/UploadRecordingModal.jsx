import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, Music2, Link2, Rss, RefreshCw, XCircle, CheckCircle2, Info } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input, Textarea } from '../ui/Input'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useEchoStore } from '../../store/useEchoStore'
import { getModeConfig } from '../../config/modeConfig'
import { apiClient } from '../../services/api'
import { getSocket } from '../../services/socket'
import { formatTime } from '../../utils/time'

const IMPORT_STAGE_LABELS = {
  QUEUED: 'Queued for processing',
  VALIDATING: 'Validating URL & security checks',
  FETCHING: 'Connecting to remote media',
  DOWNLOADING: 'Downloading media stream',
  EXTRACTING: 'Extracting audio track (FFmpeg)',
  PROCESSING: 'Validating & preparing audio',
  UPLOADING: 'Saving to Tigris storage',
  COMPLETED: 'Import complete',
  FAILED: 'Import failed',
  CANCELLED: 'Import cancelled',
}

export function UploadRecordingModal({ isOpen, onClose }) {
  const navigate = useNavigate()
  const mode = useEchoStore((s) => s.mode)
  const activeWorkspaceId = useEchoStore((s) => s.activeWorkspaceId)
  const playlists = useEchoStore((s) => s.playlists)
  const uploadEpisode = useEchoStore((s) => s.uploadEpisode)
  const createExternalEpisode = useEchoStore((s) => s.createExternalEpisode)
  const loadWorkspaces = useEchoStore((s) => s.loadWorkspaces)
  const cfg = getModeConfig(mode)

  const modePlaylists = playlists.filter((p) => p.mode === mode)

  const [sourceTab, setSourceTab] = useState('upload') // 'upload' | 'import' | 'external'
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

  // Import & RSS state
  const [importUrl, setImportUrl] = useState('')
  const [inspectingUrl, setInspectingUrl] = useState(false)
  const [sourceInfo, setSourceInfo] = useState(null)
  const [rssFeed, setRssFeed] = useState(null)
  const [previewingRss, setPreviewingRss] = useState(false)
  const [importJob, setImportJob] = useState(null)
  const [deduplicatedNotice, setDeduplicatedNotice] = useState(false)
  const [duplicateEpisode, setDuplicateEpisode] = useState(null)

  // Live Socket.IO import status updates + polling fallback
  useEffect(() => {
    if (!importJob) return
    const socket = getSocket()
    const onImportUpdated = ({ job }) => {
      if (!job || job.id !== importJob.id) return
      setImportJob(job)
      if (job.status === 'COMPLETED' && job.episodeId) {
        loadWorkspaces().catch(() => {})
      }
    }
    socket?.on('import:updated', onImportUpdated)

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(importJob.status)) {
      return () => {
        socket?.off('import:updated', onImportUpdated)
      }
    }

    const timer = setInterval(async () => {
      try {
        const latest = await apiClient.getImportJob(importJob.id)
        setImportJob(latest)
        if (latest.status === 'COMPLETED' && latest.episodeId) {
          clearInterval(timer)
          await loadWorkspaces().catch(() => {})
        }
      } catch {
        // Keep polling on transient error
      }
    }, 1500)
    return () => {
      clearInterval(timer)
      socket?.off('import:updated', onImportUpdated)
    }
  }, [importJob, loadWorkspaces])

  // Debounced source URL inspection
  useEffect(() => {
    if (sourceTab !== 'import' || !importUrl.trim()) {
      setSourceInfo(null)
      setInspectingUrl(false)
      return
    }
    try {
      new URL(importUrl.trim())
    } catch {
      setInspectingUrl(false)
      setSourceInfo({
        valid: false,
        statusLabel: 'Invalid Source',
        message: 'Enter a valid http or https URL.',
      })
      return
    }
    setInspectingUrl(true)
    const handle = setTimeout(async () => {
      try {
        const res = await apiClient.inspectImportSource(importUrl.trim())
        setSourceInfo(res.source)
      } catch (err) {
        setSourceInfo({
          valid: false,
          statusLabel: 'Invalid Source',
          message: err.response?.data?.error?.message || 'URL cannot be imported.',
        })
      } finally {
        setInspectingUrl(false)
      }
    }, 350)
    return () => clearTimeout(handle)
  }, [importUrl, sourceTab])

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

  const handlePreviewRss = async (overrideUrl) => {
    const targetUrl = (typeof overrideUrl === 'string' ? overrideUrl : '') || sourceInfo?.feedUrl || importUrl.trim()
    if (!targetUrl) {
      setError('Enter a podcast show or RSS feed URL first.')
      return
    }
    try {
      setError('')
      setPreviewingRss(true)
      const feed = await apiClient.previewRss(targetUrl)
      setRssFeed(feed)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Could not parse RSS feed.'
      )
    } finally {
      setPreviewingRss(false)
    }
  }

  const handleImportRssEpisode = async (ep) => {
    if (!activeWorkspaceId) {
      setError('No active workspace selected.')
      return
    }
    try {
      setError('')
      const res = await apiClient.importRssEpisode({
        workspaceId: activeWorkspaceId,
        enclosureUrl: ep.enclosureUrl,
        title: ep.title,
        description: ep.description || '',
        duration: ep.duration || 0,
      })
      setImportJob(res.job)
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to queue RSS episode import.'
      )
    }
  }

  const startImportRequest = async (force = false) => {
    if (!activeWorkspaceId) {
      setError('No active workspace selected.')
      return
    }
    if (!importUrl.trim()) {
      setError('Please enter a direct audio, video, cloud, or podcast URL.')
      return
    }
    if (sourceInfo?.suggestedAction === 'BROWSE_EPISODES') {
      await handlePreviewRss(sourceInfo.feedUrl || importUrl.trim())
      return
    }
    try {
      setSubmitting(true)
      setError('')
      setDuplicateEpisode(null)
      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const res = await apiClient.createImport({
        workspaceId: activeWorkspaceId,
        url: importUrl.trim(),
        title: title.trim() || undefined,
        description: description.trim(),
        tags: parsedTags,
        force,
      })
      if (res.duplicate && res.existingEpisode) {
        setDuplicateEpisode(res.existingEpisode)
        return
      }
      if (res.mode === 'EXTERNAL_LINK' && res.episode?.id) {
        await loadWorkspaces().catch(() => {})
        onClose()
        navigate(`/app/recordings/${res.episode.id}`)
        return
      }
      if (res.job) {
        setImportJob(res.job)
        setDeduplicatedNotice(Boolean(res.deduplicated))
      }
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to start import.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (sourceTab === 'import') {
      await startImportRequest(false)
      return
    }

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
        <div className="grid grid-cols-3 gap-1 bg-[#09090B] p-1 rounded-lg border border-[#27272F]">
          {[
            { id: 'upload', label: 'Upload File' },
            { id: 'import', label: 'Import URL / RSS' },
            { id: 'external', label: 'External Link' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSourceTab(tab.id)
                setError('')
                setRssFeed(null)
              }}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                sourceTab === tab.id
                  ? 'bg-[#18181D] text-[#F4F4F5]'
                  : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {sourceTab === 'upload' && (
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
        )}

        {sourceTab === 'import' && (
          <div className="space-y-3">
            <p className="text-[11px] text-[#A1A1B0]">
              Supported: Direct audio URLs (with or without extensions), Podcast RSS/Atom feeds, and public Google Drive, Dropbox, or OneDrive audio links.
            </p>
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <Input
                  label="Direct Audio URL or Podcast RSS Feed"
                  placeholder="https://example.com/episode.mp3 or /feed.xml"
                  value={importUrl}
                  onChange={(e) => {
                    setImportUrl(e.target.value)
                    setError('')
                  }}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handlePreviewRss}
                disabled={previewingRss}
              >
                <Rss className="w-3.5 h-3.5" />
                {previewingRss ? 'Loading...' : 'Preview RSS'}
              </Button>
            </div>

            {rssFeed && (
              <div className="p-3 rounded-lg bg-[#09090B] border border-[#27272F] space-y-2 max-h-48 overflow-y-auto">
                <p className="text-xs font-semibold text-[#F4F4F5]">
                  {rssFeed.title} ({rssFeed.episodes.length} episodes)
                </p>
                {rssFeed.episodes.map((ep, idx) => (
                  <div
                    key={`${ep.enclosureUrl}-${idx}`}
                    className="flex items-center justify-between gap-2 py-1.5 border-t border-[#27272F]"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-[#E4E4E7] truncate">
                        {ep.title}
                      </p>
                      <p className="text-[10px] text-[#71717A] font-mono">
                        {ep.duration > 0 ? formatTime(ep.duration) : 'Audio'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="cyan"
                      onClick={() => handleImportRssEpisode(ep)}
                    >
                      Import
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {inspectingUrl && (
              <div className="p-2.5 rounded-lg border border-[#22222B] bg-[#08080B] text-xs text-[#A1A1B0]">
                Inspecting link...
              </div>
            )}

            {!inspectingUrl && sourceInfo && (
              <div
                className={`p-3 rounded-lg border text-xs space-y-2 ${
                  sourceInfo.valid
                    ? 'bg-[#08080B] border-[#22222B] text-[#A1A1B0]'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#22D3EE]" />
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {sourceInfo.statusLabel && (
                        <Badge
                          tone={
                            !sourceInfo.valid
                              ? 'rose'
                              : sourceInfo.supportedForDownload
                                ? 'cyan'
                                : 'primary'
                          }
                        >
                          {sourceInfo.statusLabel}
                        </Badge>
                      )}
                      {sourceInfo.provider && sourceInfo.provider !== sourceInfo.statusLabel && (
                        <span className="text-[11px] text-[#8A8A9A]">
                          {sourceInfo.provider}
                        </span>
                      )}
                      {sourceInfo.fileSize > 0 && (
                        <span className="text-[11px] font-mono-time text-[#8A8A9A]">
                          · {(sourceInfo.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </span>
                      )}
                    </div>
                    <p className="leading-relaxed">{sourceInfo.message}</p>
                  </div>
                </div>

                {!sourceInfo.valid && (
                  <div className="pt-1 border-t border-rose-500/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#A1A1B0]">
                      Try uploading an audio file, sharing a public cloud/RSS link, or saving as external link.
                    </span>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSourceUrl(importUrl.trim())
                          setSourceTab('external')
                          setError('')
                        }}
                        className="text-[11px] font-medium text-[#A78BFA] hover:underline cursor-pointer"
                      >
                        Save as External Link
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSourceTab('upload')
                          setError('')
                        }}
                        className="text-[11px] font-medium text-[#22D3EE] hover:underline cursor-pointer"
                      >
                        Upload File Instead
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {duplicateEpisode && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                <p className="font-medium text-amber-300">
                  This episode already exists in your workspace: {duplicateEpisode.title}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      onClose()
                      navigate(`/app/recordings/${duplicateEpisode.id}`)
                    }}
                  >
                    Open Existing Episode
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => startImportRequest(true)}
                  >
                    Import Anyway
                  </Button>
                </div>
              </div>
            )}

            {importJob && (
              <div className="p-3.5 rounded-lg bg-[#08080B] border border-[#22222B] space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge
                      tone={
                        importJob.status === 'COMPLETED'
                          ? 'emerald'
                          : importJob.status === 'FAILED'
                            ? 'rose'
                            : importJob.status === 'CANCELLED'
                              ? 'neutral'
                              : 'cyan'
                      }
                    >
                      {importJob.status}
                    </Badge>
                    <span className="font-medium text-[#F4F4F7] truncate">
                      {IMPORT_STAGE_LABELS[importJob.status] || importJob.status}
                    </span>
                  </div>
                  {deduplicatedNotice && (
                    <span className="text-[10px] text-[#A1A1B0] shrink-0">
                      Existing job resumed
                    </span>
                  )}
                </div>

                {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(importJob.status) && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <div className="flex-1 h-1.5 bg-[#16161D] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#22D3EE] transition-all duration-300"
                        style={{ width: `${Math.max(8, importJob.progress || 0)}%` }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        const cancelled = await apiClient.cancelImportJob(importJob.id)
                        setImportJob(cancelled)
                      }}
                      className="inline-flex items-center gap-1 text-[11px] text-[#A1A1B0] hover:text-rose-400 cursor-pointer shrink-0"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancel
                    </button>
                  </div>
                )}

                {importJob.status === 'COMPLETED' && importJob.episodeId && (
                  <div className="flex items-center justify-between gap-2 pt-1 text-emerald-400">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Ready in your workspace
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant={mode === 'study' ? 'cyan' : 'primary'}
                      onClick={() => {
                        onClose()
                        navigate(`/app/recordings/${importJob.episodeId}`)
                      }}
                    >
                      Open in Studio
                    </Button>
                  </div>
                )}

                {importJob.error && (
                  <div className="flex items-center justify-between gap-2 text-rose-400 pt-1">
                    <span className="leading-snug">{importJob.error}</span>
                    {importJob.metadata?.retryable !== false && (
                      <button
                        type="button"
                        onClick={async () => {
                          const retried = await apiClient.retryImportJob(importJob.id)
                          setImportJob(retried)
                          setDeduplicatedNotice(false)
                        }}
                        className="inline-flex items-center gap-1 text-[#22D3EE] hover:underline cursor-pointer shrink-0"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {sourceTab === 'external' && (
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
          label={
            sourceTab === 'import'
              ? `${cfg.recordingNoun} Title (optional for direct URL)`
              : `${cfg.recordingNoun} Title`
          }
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

        {sourceTab !== 'import' && (
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
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {!(sourceTab === 'import' && rssFeed) && (
            <Button
              type="submit"
              variant={mode === 'study' ? 'cyan' : 'primary'}
              disabled={
                submitting ||
                (sourceTab === 'import' && sourceInfo && sourceInfo.valid === false)
              }
            >
              <Upload className="w-3.5 h-3.5" />
              {submitting
                ? 'Processing...'
                : sourceTab === 'import'
                  ? sourceInfo?.suggestedAction === 'EXTRACT_AND_IMPORT'
                    ? 'Extract Audio & Import'
                    : sourceInfo?.suggestedAction === 'BROWSE_EPISODES'
                      ? 'Browse Episodes'
                      : sourceInfo?.suggestedAction === 'SAVE_EXTERNAL_LINK'
                        ? 'Save as External Link'
                        : 'Import Audio'
                  : 'Create & Open'}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  )
}
