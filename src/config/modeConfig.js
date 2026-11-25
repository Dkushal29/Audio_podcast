export const MODES = {
  study: {
    id: 'study',
    name: 'Study Mode',
    shortName: 'Study',
    tagline: 'Learn together.',
    description:
      'For students, teachers, and study groups. Capture timestamped doubts, key insights, and revision highlights across lectures.',
    accentColor: '#22D3EE',
    accentBg: 'bg-[#22D3EE]/10',
    accentText: 'text-[#22D3EE]',
    accentBorder: 'border-[#22D3EE]/30',
    recordingNoun: 'Lecture',
    recordingPlural: 'Lectures',
    collectionNoun: 'Subject Playlist',
    collectionPlural: 'Subject Playlists',
    primaryAction: {
      label: 'Upload Lecture',
      shortLabel: 'Upload',
    },
    secondaryAction: {
      label: 'New Subject Playlist',
    },
    dashboardSections: [
      { id: 'recentRecordings', title: 'Recent Lectures' },
      { id: 'openItems', title: 'Unresolved Doubts' },
      { id: 'highlights', title: 'Revision Highlights' },
      { id: 'collections', title: 'Subject Playlists' },
      { id: 'activity', title: 'Group Activity' },
    ],
    annotationCategories: [
      {
        id: 'QUESTION',
        label: 'Question',
        color: '#22D3EE',
        badgeClass: 'bg-[#22D3EE]/12 text-[#22D3EE] border-[#22D3EE]/30',
        dotClass: 'bg-[#22D3EE]',
      },
      {
        id: 'INSIGHT',
        label: 'Insight',
        color: '#8B5CF6',
        badgeClass: 'bg-[#8B5CF6]/12 text-[#A78BFA] border-[#8B5CF6]/30',
        dotClass: 'bg-[#8B5CF6]',
      },
      {
        id: 'REVISION',
        label: 'Revision',
        color: '#F59E0B',
        badgeClass: 'bg-amber-500/12 text-amber-400 border-amber-500/30',
        dotClass: 'bg-amber-400',
      },
    ],
    statusLabels: {
      OPEN: {
        label: 'Unresolved',
        badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/25',
      },
      RESOLVED: {
        label: 'Resolved',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      },
    },
    filters: ['ALL', 'QUESTION', 'INSIGHT', 'REVISION'],
    emptyStateText: 'No study annotations match this filter yet.',
  },
  creator: {
    id: 'creator',
    name: 'Creator Mode',
    shortName: 'Creator',
    tagline: 'Create together.',
    description:
      'For podcasters, interviewers, and audio teams. Leave timestamped feedback, correction markers, and approve highlight clips.',
    accentColor: '#8B5CF6',
    accentBg: 'bg-[#8B5CF6]/10',
    accentText: 'text-[#A78BFA]',
    accentBorder: 'border-[#8B5CF6]/30',
    recordingNoun: 'Episode',
    recordingPlural: 'Episodes',
    collectionNoun: 'Show',
    collectionPlural: 'Shows',
    primaryAction: {
      label: 'Upload Episode',
      shortLabel: 'Upload',
    },
    secondaryAction: {
      label: 'New Show',
    },
    dashboardSections: [
      { id: 'recentRecordings', title: 'Recent Episodes' },
      { id: 'openItems', title: 'Pending Feedback' },
      { id: 'highlights', title: 'Approved Highlights' },
      { id: 'collections', title: 'Shows & Feeds' },
      { id: 'activity', title: 'Production Activity' },
    ],
    annotationCategories: [
      {
        id: 'FEEDBACK',
        label: 'Feedback',
        color: '#8B5CF6',
        badgeClass: 'bg-[#8B5CF6]/12 text-[#A78BFA] border-[#8B5CF6]/30',
        dotClass: 'bg-[#8B5CF6]',
      },
      {
        id: 'CORRECTION',
        label: 'Correction',
        color: '#F43F5E',
        badgeClass: 'bg-rose-500/12 text-rose-400 border-rose-500/30',
        dotClass: 'bg-rose-400',
      },
      {
        id: 'SUGGESTION',
        label: 'Suggestion',
        color: '#22D3EE',
        badgeClass: 'bg-[#22D3EE]/12 text-[#22D3EE] border-[#22D3EE]/30',
        dotClass: 'bg-[#22D3EE]',
      },
    ],
    statusLabels: {
      OPEN: {
        label: 'Pending',
        badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/25',
      },
      RESOLVED: {
        label: 'Approved',
        badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
      },
    },
    filters: ['ALL', 'FEEDBACK', 'CORRECTION', 'SUGGESTION'],
    emptyStateText: 'No production notes match this filter yet.',
  },
}

export function getModeConfig(mode) {
  return MODES[mode] || MODES.study
}

export function getCategoryMeta(mode, categoryId) {
  const cfg = getModeConfig(mode)
  return (
    cfg.annotationCategories.find((c) => c.id === categoryId) ||
    cfg.annotationCategories[0]
  )
}

export function getStatusMeta(mode, statusId) {
  const cfg = getModeConfig(mode)
  const normalized = String(statusId || 'OPEN').toUpperCase()
  return cfg.statusLabels[normalized] || cfg.statusLabels.OPEN
}
