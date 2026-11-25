import React from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'

export function WorkspaceCard({
  modeConfig,
  icon: Icon,
  features = [],
  isActive = false,
  onEnter,
}) {
  const isStudy = modeConfig.id === 'study'

  return (
    <Card
      interactive
      className={`p-6 flex flex-col justify-between gap-6 transition-all ${
        isActive ? 'border-[#8B5CF6]/60 bg-[#141418]' : ''
      }`}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div
            className={`w-11 h-11 rounded-lg border flex items-center justify-center ${
              isStudy
                ? 'bg-[#22D3EE]/10 border-[#22D3EE]/30 text-[#22D3EE]'
                : 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30 text-[#A78BFA]'
            }`}
          >
            <Icon className="w-5 h-5" />
          </div>
          {isActive && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#18181D] border border-[#27272F] text-[#F4F4F5]">
              Current Workspace
            </span>
          )}
        </div>

        <div>
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${modeConfig.accentText}`}
          >
            {modeConfig.name}
          </span>
          <h2 className="text-2xl font-semibold text-[#F4F4F5] mt-1">
            {modeConfig.tagline}
          </h2>
          <p className="text-sm text-[#A1A1AA] mt-2 leading-relaxed">
            {modeConfig.description}
          </p>
        </div>

        <ul className="space-y-2 pt-2 border-t border-[#27272F]">
          {features.map((feat) => (
            <li
              key={feat}
              className="flex items-center gap-2 text-xs text-[#D4D4D8]"
            >
              <Check
                className={`w-3.5 h-3.5 shrink-0 ${
                  isStudy ? 'text-[#22D3EE]' : 'text-[#A78BFA]'
                }`}
              />
              <span>{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <Button
        size="lg"
        variant={isStudy ? 'cyan' : 'primary'}
        onClick={() => onEnter(modeConfig.id)}
        className="w-full justify-between"
      >
        <span>Enter {modeConfig.name}</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </Card>
  )
}
