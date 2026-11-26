import React, { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { TimelineMarker } from './TimelineMarker'
import { getAuthToken } from '../../services/api'

export function Waveform({
  audioUrl,
  mode = 'study',
  annotations = [],
  clips = [],
  activeAnnotationId = null,
  clipRange = null,
  height = 96,
  onReady,
  onTimeUpdate,
  onPlayStateChange,
  onFinish,
  onSelectAnnotation,
  onSelectClip,
  onRetryAudio,
  waveSurferRef: externalRef,
}) {
  const containerRef = useRef(null)
  const internalWsRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const container = containerRef.current
    if (!container || !audioUrl) return

    let isCleanedUp = false
    setIsLoading(true)
    setLoadError('')

    const accent = mode === 'study' ? '#22D3EE' : '#A78BFA'
    const token = getAuthToken()

    const ws = WaveSurfer.create({
      container,
      waveColor: '#4B4B59',
      progressColor: accent,
      cursorColor: '#F4F4F7',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 2,
      barRadius: 2,
      height,
      normalize: true,
      url: audioUrl,
      ...(token
        ? {
            fetchParams: {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          }
        : {}),
    })

    internalWsRef.current = ws
    if (externalRef) externalRef.current = ws

    ws.on('ready', (dur) => {
      if (isCleanedUp) return
      const resolvedDuration = dur || ws.getDuration() || 0
      setDuration(resolvedDuration)
      setIsLoading(false)
      onReady?.(resolvedDuration, ws)
    })

    ws.on('timeupdate', (currentTime) => {
      if (!isCleanedUp) onTimeUpdate?.(currentTime)
    })

    ws.on('play', () => {
      if (!isCleanedUp) onPlayStateChange?.(true)
    })
    ws.on('pause', () => {
      if (!isCleanedUp) onPlayStateChange?.(false)
    })
    ws.on('finish', () => {
      if (isCleanedUp) return
      onPlayStateChange?.(false)
      onFinish?.()
    })

    ws.on('error', (err) => {
      if (isCleanedUp || err?.name === 'AbortError') return
      setIsLoading(false)
      setLoadError(err?.message || 'Could not load audio stream.')
    })

    return () => {
      isCleanedUp = true
      ws.destroy()
      internalWsRef.current = null
      if (externalRef) externalRef.current = null
    }
  }, [audioUrl, mode, height])

  const clipStartPct =
    clipRange && duration > 0
      ? Math.max(0, Math.min(100, (clipRange.startTime / duration) * 100))
      : 0
  const clipWidthPct =
    clipRange && duration > 0
      ? Math.max(0, Math.min(100 - clipStartPct, ((clipRange.endTime - clipRange.startTime) / duration) * 100))
      : 0

  return (
    <div className="relative w-full select-none">
      {/* Clip highlight overlay if active */}
      {clipRange && duration > 0 && clipWidthPct > 0 && (
        <div
          className="pointer-events-none absolute top-0 bottom-6 bg-[#8B5CF6]/15 border-x border-[#8B5CF6]/60 z-0"
          style={{ left: `${clipStartPct}%`, width: `${clipWidthPct}%` }}
        />
      )}

      {/* WaveSurfer canvas */}
      <div className="relative rounded-xl bg-[#08080B] border border-[#22222B] px-3.5 py-3.5 overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#08080B]/85 z-20">
            <span className="text-xs text-[#A1A1B0] animate-pulse">
              Rendering waveform...
            </span>
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#08080B]/95 z-20 px-4 text-center">
            <span className="text-xs text-rose-400">
              Audio playback error: {loadError}
            </span>
            {onRetryAudio && (
              <button
                type="button"
                onClick={onRetryAudio}
                className="px-2.5 py-1 rounded-md bg-[#16161D] border border-[#22222B] text-[11px] font-medium text-[#F4F4F7] hover:border-[#343442] cursor-pointer"
              >
                Retry Audio
              </button>
            )}
          </div>
        )}
        <div ref={containerRef} className="w-full" />
      </div>

      {/* Annotation & Clip marker track */}
      {(annotations.length > 0 || clips.length > 0) && duration > 0 && (
        <div className="relative h-7 mt-2 rounded-lg bg-[#08080B] border border-[#22222B]">
          <div className="absolute inset-x-2 top-1/2 h-px bg-[#2E2E3A]" />
          {clips.map((clip) => {
            const leftPct = Math.max(0, Math.min(98, (clip.startTime / duration) * 100))
            const widthPct = Math.max(
              1.5,
              Math.min(100 - leftPct, ((clip.endTime - clip.startTime) / duration) * 100)
            )
            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => onSelectClip?.(clip)}
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                title={`Clip: ${clip.title}`}
                className="absolute top-1 bottom-1 rounded-sm bg-emerald-500/35 border border-emerald-400/70 hover:bg-emerald-500/55 transition-colors cursor-pointer z-0"
              />
            )
          })}
          {annotations.map((ann) => (
            <TimelineMarker
              key={ann.id}
              annotation={ann}
              duration={duration}
              mode={mode}
              isActive={ann.id === activeAnnotationId}
              onSelect={onSelectAnnotation}
            />
          ))}
        </div>
      )}
    </div>
  )
}
