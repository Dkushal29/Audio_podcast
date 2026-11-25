import React from 'react'
import { ListMusic, Rss, ArrowRight } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

export function PlaylistCard({ playlist, recordingCount, onSelect }) {
  const isCreator = playlist.mode === 'creator'

  return (
    <Card
      interactive
      onClick={() => onSelect?.(playlist)}
      className="p-4 cursor-pointer flex flex-col justify-between gap-3"
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#18181D] border border-[#27272F] flex items-center justify-center text-[#A1A1AA]">
            <ListMusic className="w-4 h-4" />
          </div>
          <Badge tone={isCreator ? 'primary' : 'cyan'}>
            {recordingCount ?? playlist.recordingIds.length}{' '}
            {isCreator ? 'Episodes' : 'Lectures'}
          </Badge>
        </div>

        <h4 className="text-sm font-semibold text-[#F4F4F5] line-clamp-1">
          {playlist.title}
        </h4>
        <p className="text-xs text-[#A1A1AA] line-clamp-2 leading-relaxed">
          {playlist.description}
        </p>
      </div>

      <div className="pt-2.5 border-t border-[#27272F] flex items-center justify-between text-[11px] text-[#71717A]">
        <span className="truncate">
          {isCreator && playlist.rssUrl ? (
            <span className="inline-flex items-center gap-1 text-[#A78BFA]">
              <Rss className="w-3 h-3" />
              RSS Active
            </span>
          ) : (
            `Updated ${playlist.updatedAt}`
          )}
        </span>
        <span className="inline-flex items-center gap-1 text-[#A1A1AA] font-medium">
          Open
          <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Card>
  )
}
