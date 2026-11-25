import React from 'react'
import { Link } from 'react-router-dom'
import { ListMusic, Rss, ArrowUpRight } from 'lucide-react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'

export function PlaylistCard({ playlist }) {
  const isCreator = playlist.mode === 'creator'

  return (
    <Card interactive className="p-4 flex flex-col justify-between gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-[#18181D] border border-[#27272F] flex items-center justify-center text-[#A1A1AA]">
              <ListMusic className="w-3.5 h-3.5" />
            </div>
            <Badge tone={isCreator ? 'primary' : 'cyan'}>
              {playlist.recordingIds.length}{' '}
              {isCreator ? 'episodes' : 'lectures'}
            </Badge>
          </div>
          {playlist.rssUrl && (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-emerald-400"
              title={playlist.rssUrl}
            >
              <Rss className="w-3 h-3" />
              RSS
            </span>
          )}
        </div>

        <Link
          to="/app/playlists"
          className="block text-sm font-semibold text-[#F4F4F5] hover:text-[#22D3EE] transition-colors"
        >
          {playlist.title}
        </Link>
        <p className="text-xs text-[#A1A1AA] line-clamp-2">
          {playlist.description}
        </p>
      </div>

      <div className="pt-2 border-t border-[#27272F] flex items-center justify-between text-xs text-[#71717A]">
        <span>Updated {playlist.updatedAt}</span>
        <Link
          to="/app/playlists"
          className="inline-flex items-center gap-1 text-[#A1A1AA] hover:text-[#F4F4F5]"
        >
          Open <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </Card>
  )
}
