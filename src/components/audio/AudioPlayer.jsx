import React, { useEffect, useRef, useState } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  Volume2,
  VolumeX,
  MessageSquarePlus,
  Scissors,
} from 'lucide-react'
import { Waveform } from './Waveform'
import { Button } from '../ui/Button'
import { formatTime } from '../../utils/time'

const SPEEDS = [0.75, 1, 1.25, 1.5, 2]

export function AudioPlayer({
  recording,
  mode,
  annotations = [],
  clips = [],
  activeAnnotationId = null,
  clipRange = null,
  seekToTime = null,
  defaultSpeed = 1,
  onTimeUpdate,
  onDurationChange,
  onSelectAnnotation,
  onSelectClip,
  onClearClipRange,
  onCreateAnnotation,
  onCreateClip,
  highlightStart = null,
  onStartHighlight,
  onStopHighlight,
  onCancelHighlight,
}) {
  const wsRef = useRef(null)
  const pendingSeekRef = useRef(null)
  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(recording?.duration || 0)
  const [speed, setSpeed] = useState(defaultSpeed)
  const [isLooping, setIsLooping] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const initialDur = recording?.duration || 0
    setIsReady(false)
    setDuration(initialDur)
    setCurrentTime(0)
    onDurationChange?.(initialDur)
  }, [recording?.id])

  if (!recording) return null

  // External seek requests (e.g. clicking an annotation card, notification, or chapter)
  useEffect(() => {
    if (seekToTime === null || seekToTime === undefined) return
    const rawTarget = seekToTime.time ?? seekToTime
    const maxDur = duration > 0 ? duration : 999999
    const target = Math.max(0, Math.min(rawTarget, maxDur))

    if (!wsRef.current || !isReady) {
      pendingSeekRef.current = { time: rawTarget, autoplay: Boolean(seekToTime.autoplay) }
      setCurrentTime(target)
      return
    }

    const ws = wsRef.current
    ws.setTime(target)
    setCurrentTime(target)
    if (seekToTime.autoplay) {
      ws.play()
    }
  }, [seekToTime, duration, isReady])

  // Keep playback speed synced
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.setPlaybackRate(speed)
    }
  }, [speed])

  const handleTogglePlay = () => {
    wsRef.current?.playPause()
  }

  const handleSkip = (delta) => {
    if (!wsRef.current) return
    const next = Math.max(0, Math.min(duration, currentTime + delta))
    wsRef.current.setTime(next)
    setCurrentTime(next)
  }

  const handleToggleMute = () => {
    if (!wsRef.current) return
    const nextMuted = !isMuted
    wsRef.current.setVolume(nextMuted ? 0 : 1)
    setIsMuted(nextMuted)
  }

  const handleTimeUpdate = (t) => {
    setCurrentTime(t)
    onTimeUpdate?.(t)
    if (clipRange && t >= clipRange.endTime) {
      if (isLooping) {
        wsRef.current?.setTime(clipRange.startTime)
      } else {
        wsRef.current?.pause()
        wsRef.current?.setTime(clipRange.endTime)
      }
    }
  }

  const handleFinish = () => {
    if (isLooping && wsRef.current) {
      wsRef.current.setTime(clipRange ? clipRange.startTime : 0)
      wsRef.current.play()
    }
  }

  const handleOpenAnnotate = () => {
    if (isPlaying) {
      wsRef.current?.pause()
    }
    onCreateAnnotation?.(Math.floor(currentTime))
  }

  const handleOpenClip = () => {
    onCreateClip?.(Math.floor(currentTime))
  }

  return (
    <div className="rounded-lg bg-[#111114] border border-[#27272F] p-4 sm:p-5 space-y-4">
      {/* Waveform + Markers */}
      <Waveform
        audioUrl={recording.audioUrl}
        mode={mode}
        annotations={annotations}
        clips={clips}
        activeAnnotationId={activeAnnotationId}
        clipRange={clipRange}
        waveSurferRef={wsRef}
        onReady={(dur, ws) => {
          setIsReady(true)
          setDuration(dur)
          onDurationChange?.(dur)
          ws.setPlaybackRate(speed)
          if (pendingSeekRef.current) {
            const { time, autoplay } = pendingSeekRef.current
            pendingSeekRef.current = null
            const clamped = Math.max(0, Math.min(time, dur || time))
            ws.setTime(clamped)
            setCurrentTime(clamped)
            if (autoplay) ws.play()
          }
        }}
        onTimeUpdate={handleTimeUpdate}
        onPlayStateChange={setIsPlaying}
        onFinish={handleFinish}
        onSelectAnnotation={(ann) => {
          wsRef.current?.setTime(ann.timestamp)
          setCurrentTime(ann.timestamp)
          onSelectAnnotation?.(ann)
        }}
        onSelectClip={(clip) => {
          wsRef.current?.setTime(clip.startTime)
          setCurrentTime(clip.startTime)
          wsRef.current?.play()
          onSelectClip?.(clip)
        }}
      />

      {clipRange && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-300">
          <span>
            Playing interval: <strong className="font-mono">{formatTime(clipRange.startTime)} – {formatTime(clipRange.endTime)}</strong>
          </span>
          {onClearClipRange && (
            <button
              type="button"
              onClick={onClearClipRange}
              className="text-[11px] text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer"
            >
              Exit interval
            </button>
          )}
        </div>
      )}

      {/* Transport & Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSkip(-5)}
            className="p-2 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181D] transition-colors cursor-pointer"
            title="Back 5s"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleTogglePlay}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              mode === 'study'
                ? 'bg-[#22D3EE] hover:bg-[#06B6D4] text-[#09090B]'
                : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white'
            }`}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSkip(5)}
            className="p-2 rounded-lg text-[#A1A1AA] hover:text-[#F4F4F5] hover:bg-[#18181D] transition-colors cursor-pointer"
            title="Forward 5s"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="ml-2 font-mono text-xs text-[#F4F4F5] bg-[#09090B] border border-[#27272F] px-2.5 py-1.5 rounded-md">
            <span>{formatTime(currentTime)}</span>
            <span className="text-[#71717A] mx-1">/</span>
            <span className="text-[#A1A1AA]">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Speed, Loop, Volume */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex items-center bg-[#09090B] border border-[#27272F] rounded-lg p-0.5">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSpeed(s)}
                className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
                  speed === s
                    ? 'bg-[#18181D] text-[#F4F4F5]'
                    : 'text-[#A1A1AA] hover:text-[#F4F4F5]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsLooping((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
              isLooping
                ? 'bg-[#8B5CF6]/15 border-[#8B5CF6]/40 text-[#A78BFA]'
                : 'bg-[#09090B] border-[#27272F] text-[#A1A1AA] hover:text-[#F4F4F5]'
            }`}
            title="Toggle loop playback"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Loop</span>
          </button>

          <button
            type="button"
            onClick={handleToggleMute}
            className="p-2 rounded-lg bg-[#09090B] border border-[#27272F] text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Chapter Timeline + Primary Workspace Actions */}
      <div className="pt-3 border-t border-[#27272F] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
          <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium mr-1 shrink-0">
            Chapters
          </span>
          {(recording.chapters || []).map((ch) => {
            const isCurrent =
              currentTime >= ch.startTime &&
              !recording.chapters.some(
                (other) =>
                  other.startTime > ch.startTime && currentTime >= other.startTime
              )
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  wsRef.current?.setTime(ch.startTime)
                  setCurrentTime(ch.startTime)
                }}
                className={`shrink-0 px-2.5 py-1 rounded-md text-xs border transition-colors cursor-pointer ${
                  isCurrent
                    ? 'bg-[#18181D] border-[#3F3F46] text-[#F4F4F5]'
                    : 'bg-[#09090B] border-[#27272F] text-[#A1A1AA] hover:text-[#F4F4F5]'
                }`}
              >
                <span className="font-mono text-[10px] text-[#71717A] mr-1.5">
                  {formatTime(ch.startTime)}
                </span>
                {ch.title}
              </button>
            )
          })}
        </div>

        {(onCreateAnnotation || onCreateClip || onStartHighlight) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onCreateAnnotation && (
              <Button
                size="sm"
                variant={mode === 'study' ? 'cyan' : 'primary'}
                onClick={handleOpenAnnotate}
              >
                <MessageSquarePlus className="w-3.5 h-3.5" />
                Create Annotation
              </Button>
            )}
            {onStartHighlight && highlightStart === null && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onStartHighlight(currentTime)}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Start Highlight
              </Button>
            )}
            {highlightStart !== null && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/12 border border-rose-500/35 text-xs">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-rose-300 font-mono">
                  {formatTime(highlightStart)} → {formatTime(currentTime)}
                </span>
                <button
                  type="button"
                  onClick={() => onStopHighlight?.(currentTime)}
                  className="ml-1 px-2 py-0.5 rounded bg-rose-500 text-white text-[11px] font-medium hover:bg-rose-600 cursor-pointer"
                >
                  Stop
                </button>
                <button
                  type="button"
                  onClick={() => onCancelHighlight?.()}
                  className="px-1.5 py-0.5 text-[11px] text-[#A1A1AA] hover:text-[#F4F4F5] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
            {onCreateClip && highlightStart === null && (
              <Button size="sm" variant="secondary" onClick={handleOpenClip}>
                <Scissors className="w-3.5 h-3.5" />
                Create Clip
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
