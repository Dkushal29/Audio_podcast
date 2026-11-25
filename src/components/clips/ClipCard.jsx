import React from 'react'
import { Link } from 'react-router-dom'
import { Play, Share2, Clock, Eye } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { formatTime } from '../../utils/time'

export function ClipCard({ clip, onPlayClip }) {
  const clipDuration = Math.max(1, clip.endTime - clip.startTime)

  return (
    <Card interactive className="p-4 flex flex-col justify-between gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={clip.mode === 'study' ? 'cyan' : 'primary'}>
            {formatTime(clip.startTime)} – {formatTime(clip.endTime)}
          </Badge>
          <span className="text-[11px] text-[#71717A] font-mono">
            {clipDuration}s
          </span>
        </div>

        <h4 className="text-sm font-semibold text-[#F4F4F5] line-clamp-1">
          {clip.title}
        </h4>

        <p className="text-xs text-[#A1A1AA] line-clamp-1">
          From: {clip.recordingTitle}
        </p>

        {clip.notes && (
          <p className="text-xs text-[#D4D4D8] line-clamp-2 leading-relaxed">
            {clip.notes}
          </p>
        )}
      </div>

      <div className="pt-2.5 border-t border-[#27272F] flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-[#71717A]">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {clip.createdAt}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {clip.views || 1}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {onPlayClip && (
            <button
              type="button"
              onClick={() => onPlayClip(clip)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#18181D] hover:bg-[#222229] border border-[#27272F] text-xs font-medium text-[#F4F4F5] transition-colors cursor-pointer"
            >
              <Play className="w-3 h-3" />
              Play
            </button>
          )}
          <Link
            to={`/clips/${clip.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#09090B] hover:bg-[#18181D] border border-[#27272F] text-xs font-medium text-[#A1A1AA] hover:text-[#F4F4F5] transition-colors"
          >
            <Share2 className="w-3 h-3" />
            Share
          </Link>
        </div>
      </div>
    </Card>
  )
}
