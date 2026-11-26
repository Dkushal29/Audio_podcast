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
          <div
            className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
              isCreator
                ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#A78BFA]'
                : 'bg-[#22D3EE]/10 border-[#22D3EE]/30 text-[#22D3EE]'
            }`}
          >
            <ListMusic className="w-4 h-4" />
          </div>
          <Badge tone={isCreator ? 'primary' : 'cyan'}>
            {(() => {
              const count = recordingCount ?? playlist.recordingIds.length
              const unit = isCreator
                ? count === 1
                  ? 'Episode'
                  : 'Episodes'
                : count === 1
                  ? 'Lecture'
                  : 'Lectures'
              return `${count} ${unit}`
            })()}
          </Badge>
        </div>

        <h4 className="text-sm font-semibold text-[#F4F4F7] font-display line-clamp-1">
          {playlist.title}
        </h4>
        <p className="text-xs text-[#A1A1B0] line-clamp-2 leading-relaxed">
          {playlist.description}
        </p>
      </div>

      <div className="pt-2.5 border-t border-[#22222B] flex items-center justify-between text-[11px] text-[#6E6E7E]">
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
