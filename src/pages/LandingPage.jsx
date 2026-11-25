import React from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  AudioLines,
  BookOpen,
  Globe,
  Clock,
  Headphones,
  MessageSquareText,
  Mic2,
  Scissors,
  Sparkles,
  CheckCircle2,
} from 'lucide-react'
import { Logo } from '../components/common/Logo'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'

const CORE_FEATURES = [
  {
    icon: AudioLines,
    title: 'Interactive Waveforms',
    description:
      'Navigate dense lectures or multi-hour rough cuts with precision scrubbing, chapter markers, and variable speed.',
  },
  {
    icon: MessageSquareText,
    title: 'Timestamped Discussions',
    description:
      'Anchor questions, feedback, and revision notes to exact moments in the audio timeline with threaded replies.',
  },
  {
    icon: Scissors,
    title: 'Instant Highlight Clips',
    description:
      'Extract key moments with start and end markers and publish clean, shareable clip links with full context.',
  },
  {
    icon: Sparkles,
    title: 'Unified Dual-Mode Engine',
    description:
      'Switch seamlessly between Study Mode and Creator Mode while keeping one familiar, high-craft audio workspace.',
  },
]

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#070709] text-[#F4F4F7] flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#22222B] bg-[#0A0A0E]/85 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Logo to="/" />

          <nav className="hidden md:flex items-center gap-7 text-sm text-[#A1A1B0]">
            <a href="#preview" className="hover:text-[#F4F4F7] transition-colors">
              Product
            </a>
            <a href="#modes" className="hover:text-[#F4F4F7] transition-colors">
              Modes
            </a>
            <a href="#features" className="hover:text-[#F4F4F7] transition-colors">
              Features
            </a>
            <a href="#extension" className="hover:text-[#F4F4F7] transition-colors">
              Extension
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link to="/workspaces">
              <Button variant="primary" size="sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-[#22222B]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.14),transparent_55%)]" />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-16 sm:pt-28 sm:pb-24 text-center relative">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#101015] border border-[#22222B] text-xs text-[#A1A1B0] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]" />
              <span>Listen. Understand. Discuss. Create.</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[#F4F4F7] font-display leading-[1.08] max-w-3xl mx-auto">
              Every recording has a story worth exploring.
            </h1>

            <p className="mt-5 text-base sm:text-lg text-[#A1A1B0] max-w-2xl mx-auto leading-relaxed">
              Turn long recordings into collaborative conversations, meaningful
              insights and shareable moments.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/workspaces">
                <Button size="lg" variant="primary" className="w-full sm:w-auto">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#preview">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Explore EchoSpace
                </Button>
              </a>
            </div>
          </div>

          {/* Product Preview */}
          <div id="preview" className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
            <Card className="p-4 sm:p-6 bg-[#111114] border-[#27272F] shadow-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#27272F]">
                <div className="flex items-center gap-3">
                  <Badge tone="cyan">Study Mode</Badge>
                  <span className="text-sm font-medium text-[#F4F4F5]">
                    Distributed Consensus &amp; Raft Walkthrough
                  </span>
                </div>
                <span className="font-mono text-xs text-[#A1A1AA]">
                  00:14 / 00:42
                </span>
              </div>

              {/* Stylized editorial waveform preview */}
              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-lg bg-[#09090B] border border-[#27272F] p-4 flex flex-col justify-between gap-4">
                  <div className="flex items-end gap-1 h-24 px-1">
                    {[
                      28, 45, 62, 38, 78, 92, 54, 41, 68, 84, 96, 72, 46, 58, 88,
                      64, 39, 52, 74, 86, 60, 42, 67, 90, 55, 48, 73, 61, 35, 50,
                      79, 66, 44, 59, 82, 49, 34, 57, 71, 40,
                    ].map((h, idx) => (
                      <div
                        key={idx}
                        className={`flex-1 rounded-full ${
                          idx < 16 ? 'bg-[#22D3EE]' : 'bg-[#27272F]'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#A1A1AA] pt-2 border-t border-[#27272F]">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#22D3EE]" />
                      Marker at 0:14 · Question
                    </span>
                    <span className="font-mono text-[11px] text-[#71717A]">
                      1.25x · Loop Off
                    </span>
                  </div>
                </div>

                <div className="rounded-lg bg-[#09090B] border border-[#27272F] p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Badge tone="cyan">QUESTION</Badge>
                    <span className="font-mono text-[11px] text-[#A1A1AA]">
                      0:14
                    </span>
                  </div>
                  <p className="text-xs text-[#E4E4E7] leading-relaxed">
                    Does Raft increment currentTerm on every split vote before
                    sending RequestVote RPCs?
                  </p>
                  <div className="pt-2 border-t border-[#27272F] text-[11px] text-[#A1A1AA]">
                    <span className="text-[#F4F4F5] font-medium">
                      Elena Rostova:
                    </span>{' '}
                    Yes — currentTerm increments immediately.
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Dual Mode Introduction */}
        <section id="modes" className="py-20 border-b border-[#27272F]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#8B5CF6]">
                Dual-Mode Architecture
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-[#F4F4F5] mt-2">
                One audio workspace. Two dedicated workflows.
              </h2>
              <p className="text-sm text-[#A1A1AA] mt-2 leading-relaxed">
                Whether you are dissecting a university seminar or mastering a
                weekly podcast, EchoSpace adapts terminology, markers, and
                collections to your craft.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-[#22D3EE]/10 border border-[#22D3EE]/30 flex items-center justify-center text-[#22D3EE]">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <Badge tone="cyan">Study Mode</Badge>
                  <h3 className="text-xl font-semibold text-[#F4F4F5] mt-2">
                    Learn together.
                  </h3>
                  <p className="text-sm text-[#A1A1AA] mt-1.5 leading-relaxed">
                    Built for students, teaching fellows, and study cohorts to
                    turn dense lecture recordings into structured knowledge.
                  </p>
                </div>
                <ul className="space-y-2 pt-2 border-t border-[#27272F] text-xs text-[#D4D4D8]">
                  {[
                    'Timestamped questions & doubt resolution',
                    'Important insights & revision highlights',
                    'Subject-based playlists for exam prep',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#22D3EE]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              <Card className="p-6 space-y-4">
                <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 flex items-center justify-center text-[#A78BFA]">
                  <Mic2 className="w-5 h-5" />
                </div>
                <div>
                  <Badge tone="primary">Creator Mode</Badge>
                  <h3 className="text-xl font-semibold text-[#F4F4F5] mt-2">
                    Create together.
                  </h3>
                  <p className="text-sm text-[#A1A1AA] mt-1.5 leading-relaxed">
                    Built for podcasters, interviewers, and producers to review
                    cuts, mark corrections, and ship highlight clips.
                  </p>
                </div>
                <ul className="space-y-2 pt-2 border-t border-[#27272F] text-xs text-[#D4D4D8]">
                  {[
                    'Timestamped feedback & correction markers',
                    'Collaborative episode review & approval',
                    'Shows, episodes & RSS feed management',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#A78BFA]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </section>

        {/* Core Features */}
        <section id="features" className="py-20 border-b border-[#27272F]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="max-w-2xl">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#22D3EE]">
                Core Infrastructure
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-[#F4F4F5] mt-2">
                Engineered for focused listening.
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {CORE_FEATURES.map((feat) => {
                const Icon = feat.icon
                return (
                  <Card key={feat.title} className="p-5 space-y-3">
                    <div className="w-9 h-9 rounded-lg bg-[#18181D] border border-[#27272F] flex items-center justify-center text-[#F4F4F5]">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#F4F4F5]">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-[#A1A1AA] leading-relaxed">
                      {feat.description}
                    </p>
                  </Card>
                )
              })}
            </div>
          </div>
        </section>

        {/* Chrome Extension Promo */}
        <section id="extension" className="py-20 border-b border-[#27272F]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <Card elevated className="p-6 sm:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-xl">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-[#22D3EE]">
                  <Globe className="w-4 h-4" />
                  <span>Chrome Extension · Coming Next</span>
                </div>
                <h3 className="text-2xl font-semibold text-[#F4F4F5]">
                  Capture moments from any browser tab.
                </h3>
                <p className="text-sm text-[#A1A1AA] leading-relaxed">
                  Soon you will be able to clip web lectures, podcasts, and
                  interviews directly into your EchoSpace workspace without
                  breaking flow.
                </p>
              </div>
              <Link to="/app/settings">
                <Button variant="secondary" size="md" className="shrink-0">
                  Preview Sync Settings
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </Card>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center space-y-5">
            <div className="w-11 h-11 rounded-lg bg-[#111114] border border-[#27272F] flex items-center justify-center mx-auto text-[#8B5CF6]">
              <Headphones className="w-5 h-5" />
            </div>
            <h2 className="text-3xl font-semibold tracking-tight text-[#F4F4F5]">
              Ready to explore your recordings?
            </h2>
            <p className="text-sm text-[#A1A1AA]">
              Jump straight into the interactive Study or Creator workspace with
              sample audio and live annotations.
            </p>
            <div className="pt-2 flex items-center justify-center gap-3">
              <Link to="/workspaces">
                <Button size="lg" variant="primary">
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#27272F] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <Logo to="/" size="sm" showTagline />
          <div className="flex items-center gap-5">
            <Link to="/workspaces" className="hover:text-[#F4F4F5]">
              Workspaces
            </Link>
            <Link to="/login" className="hover:text-[#F4F4F5]">
              Sign In
            </Link>
            <Link to="/clips/clip-1" className="hover:text-[#F4F4F5]">
              Sample Clip
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
