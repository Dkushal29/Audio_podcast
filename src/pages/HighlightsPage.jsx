import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Scissors, ArrowRight } from 'lucide-react'
import { ClipCard } from '../components/clips/ClipCard'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useEchoStore } from '../store/useEchoStore'
import { getModeConfig } from '../config/modeConfig'

export function HighlightsPage() {
  const navigate = useNavigate()
  const mode = useEchoStore((s) => s.mode)
  const clips = useEchoStore((s) => s.clips)
  const cfg = getModeConfig(mode)

  const modeClips = clips.filter((c) => c.mode === mode)

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Badge tone={cfg.badgeTone}>{cfg.name}</Badge>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#F4F4F7] font-display mt-2">
            {mode === 'study' ? 'Revision Highlights' : 'Approved Highlights'}
          </h1>
          <p className="text-sm text-[#A1A1B0] mt-0.5">
            Shareable audio moments extracted from your{' '}
            {cfg.recordingPlural.toLowerCase()}.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => navigate('/app/recordings')}
        >
          Open {cfg.recordingPlural}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {modeClips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modeClips.map((clip) => (
            <ClipCard
              key={clip.id}
              clip={clip}
              onPlayClip={(c) => navigate(`/app/recordings/${c.recordingId}`)}
            />
          ))}
        </div>
      ) : (
        <Card className="p-10 text-center space-y-3">
          <Scissors className="w-7 h-7 text-[#6E6E7E] mx-auto" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-[#F4F4F7]">
              No highlight clips yet
            </p>
            <p className="text-xs text-[#A1A1B0]">
              No highlight clips created in {cfg.name} yet. Open any{' '}
              {cfg.recordingNoun.toLowerCase()} to capture an interval clip.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
