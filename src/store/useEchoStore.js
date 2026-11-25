import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  INITIAL_ACTIVITY,
  INITIAL_ANNOTATIONS,
  INITIAL_CLIPS,
  INITIAL_MEMBERS,
  INITIAL_PLAYLISTS,
  INITIAL_RECORDINGS,
  INITIAL_USER,
  SAMPLE_AUDIO_URL,
} from '../data/mockData'
import { apiClient, setAuthToken } from '../services/api'
import { connectSocket, disconnectSocket } from '../services/socket'

function formatRelativeTime(dateInput) {
  if (!dateInput) return 'Just now'
  const diffSec = Math.floor((Date.now() - new Date(dateInput).getTime()) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  return new Date(dateInput).toLocaleDateString()
}

function normalizeEpisode(ep, mode) {
  return {
    id: ep.id,
    workspaceId: ep.workspaceId,
    mode: (ep.workspace?.mode || mode || 'study').toLowerCase(),
    title: ep.title,
    description: ep.description || '',
    audioUrl: apiClient.getEpisodeAudioUrl(ep.id),
    duration: ep.duration || 0,
    createdAt: formatRelativeTime(ep.createdAt),
    authorId: ep.uploaderId,
    authorName: ep.uploader?.name || 'Member',
    tags: ep.tags || [],
    chapters: ep.chapters || [],
  }
}

function normalizeAnnotation(ann, mode) {
  return {
    id: ann.id,
    recordingId: ann.episodeId,
    mode: (mode || 'study').toLowerCase(),
    timestamp: ann.timestamp,
    category: ann.category,
    status: (ann.status || 'OPEN').toUpperCase(),
    authorId: ann.userId,
    authorName: ann.user?.name || 'Member',
    createdAt: formatRelativeTime(ann.createdAt),
    content: ann.content,
    replies: (ann.replies || []).map((r) => ({
      id: r.id,
      authorName: r.user?.name || 'Member',
      createdAt: formatRelativeTime(r.createdAt),
      content: r.content,
    })),
  }
}

function normalizeClip(clip, mode, recordingTitle = '') {
  return {
    id: clip.id,
    shareToken: clip.shareToken,
    mode: (mode || 'study').toLowerCase(),
    recordingId: clip.episodeId,
    recordingTitle: clip.episode?.title || recordingTitle || 'Recording',
    title: clip.title,
    startTime: clip.startTime,
    endTime: clip.endTime,
    authorName: clip.creator?.name || 'Member',
    createdAt: formatRelativeTime(clip.createdAt),
    views: clip.views ?? 1,
    notes: clip.description || '',
  }
}

export const useEchoStore = create(
  persist(
    (set, get) => ({
      // Auth state
      token: null,
      user: INITIAL_USER,
      isAuthenticated: false,

      // Active workspace & mode
      mode: 'study',
      workspaces: [],
      activeWorkspaceId: null,
      activeWorkspaceRole: 'OWNER',
      shows: [],

      // Domain entities (populated from API when authenticated, or demo fallback)
      recordings: INITIAL_RECORDINGS,
      annotations: INITIAL_ANNOTATIONS,
      clips: INITIAL_CLIPS,
      playlists: INITIAL_PLAYLISTS,
      members: INITIAL_MEMBERS,
      activity: INITIAL_ACTIVITY,

      workspaceSettings: {
        studyName: 'CS & AI Study Collective',
        creatorName: 'EchoSpace Audio Studio',
        defaultPlaybackSpeed: 1,
        autoPauseOnAnnotate: true,
        emailNotifications: true,
        chromeExtensionSync: false,
      },

      // Auth actions
      registerWithBackend: async ({ name, email, password }) => {
        const { user, token } = await apiClient.register({
          name,
          email,
          password,
        })
        setAuthToken(token)
        connectSocket(token)
        set({ token, user, isAuthenticated: true })
        await get().loadWorkspaces()
        return user
      },

      loginWithBackend: async ({ email, password }) => {
        const { user, token } = await apiClient.login({ email, password })
        setAuthToken(token)
        connectSocket(token)
        set({ token, user, isAuthenticated: true })
        await get().loadWorkspaces()
        return user
      },

      loginDemo: (email, name) =>
        set((state) => ({
          isAuthenticated: true,
          token: null,
          user: {
            ...state.user,
            email: email || state.user.email,
            name: name || state.user.name,
          },
        })),

      logoutDemo: () => {
        setAuthToken(null)
        disconnectSocket()
        set({
          token: null,
          isAuthenticated: false,
          workspaces: [],
          activeWorkspaceId: null,
        })
      },

      // Workspaces
      loadWorkspaces: async () => {
        const { token } = get()
        if (!token) return []
        const workspaces = await apiClient.listWorkspaces()
        set({ workspaces })

        const currentId = get().activeWorkspaceId
        const target =
          workspaces.find((w) => w.id === currentId) || workspaces[0]
        if (target) {
          await get().selectWorkspace(target.id)
        }
        return workspaces
      },

      createAndSelectWorkspace: async ({ name, mode }) => {
        const apiMode = mode.toUpperCase()
        const ws = await apiClient.createWorkspace({ name, mode: apiMode })
        await get().loadWorkspaces()
        await get().selectWorkspace(ws.id)
        return ws
      },

      selectWorkspace: async (workspaceId) => {
        const { token } = get()
        if (!token || !workspaceId) return null
        const ws = await apiClient.getWorkspace(workspaceId)
        const modeLower = ws.mode.toLowerCase()

        const mappedRecordings = (ws.episodes || []).map((ep) =>
          normalizeEpisode(ep, modeLower)
        )
        const mappedPlaylists = (ws.playlists || []).map((pl) => ({
          id: pl.id,
          mode: modeLower,
          title: pl.title,
          description: pl.description || '',
          rssUrl: pl.rssUrl || '',
          recordingIds: (pl.episodes || []).map((pe) => pe.episodeId),
          updatedAt: formatRelativeTime(pl.updatedAt),
        }))
        const mappedMembers = (ws.members || []).map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          modes: [modeLower],
          status: 'Active',
          avatarColor: m.user.avatarColor || '#8B5CF6',
        }))

        set((state) => ({
          activeWorkspaceId: ws.id,
          activeWorkspaceRole: ws.myRole || 'MEMBER',
          mode: modeLower,
          shows: ws.shows || [],
          recordings: mappedRecordings,
          playlists: mappedPlaylists,
          members: mappedMembers,
          annotations: [],
          clips: [],
          workspaceSettings: {
            ...state.workspaceSettings,
            ...(modeLower === 'study'
              ? { studyName: ws.name }
              : { creatorName: ws.name }),
          },
        }))
        return ws
      },

      setMode: (mode) => {
        if (mode !== 'study' && mode !== 'creator') return
        const { workspaces, token } = get()
        set({ mode })
        if (token && workspaces.length > 0) {
          const matching = workspaces.find(
            (w) => w.mode.toLowerCase() === mode
          )
          if (matching && matching.id !== get().activeWorkspaceId) {
            get().selectWorkspace(matching.id)
          }
        }
      },

      // Episode detail & upload
      loadEpisodeDetail: async (episodeId) => {
        const { token } = get()
        if (!token || !episodeId) return null
        const { episode, myRole } = await apiClient.getEpisode(episodeId)
        const modeLower = (episode.workspace?.mode || get().mode).toLowerCase()
        const normEp = normalizeEpisode(episode, modeLower)
        const normAnns = (episode.annotations || []).map((a) =>
          normalizeAnnotation(a, modeLower)
        )
        const normClips = (episode.clips || []).map((c) =>
          normalizeClip(c, modeLower, episode.title)
        )

        set((state) => ({
          activeWorkspaceRole: myRole || state.activeWorkspaceRole,
          recordings: state.recordings.some((r) => r.id === normEp.id)
            ? state.recordings.map((r) => (r.id === normEp.id ? normEp : r))
            : [normEp, ...state.recordings],
          annotations: [
            ...normAnns,
            ...state.annotations.filter((a) => a.recordingId !== normEp.id),
          ],
          clips: [
            ...normClips,
            ...state.clips.filter((c) => c.recordingId !== normEp.id),
          ],
        }))
        return normEp
      },

      uploadEpisode: async ({
        file,
        title,
        description,
        tags = '',
        playlistId = '',
        duration = 0,
        onProgress,
      }) => {
        const { token, activeWorkspaceId, mode, shows } = get()
        if (token && activeWorkspaceId && file) {
          const fd = new FormData()
          fd.append('audio', file)
          fd.append('workspaceId', activeWorkspaceId)
          fd.append('title', title)
          fd.append('description', description || '')
          fd.append('tags', Array.isArray(tags) ? tags.join(',') : tags)
          fd.append('duration', String(duration || 0))
          if (playlistId) fd.append('playlistId', playlistId)
          if (mode === 'creator' && shows[0]?.id) {
            fd.append('showId', shows[0].id)
          }

          const ep = await apiClient.uploadEpisode(fd, onProgress)
          const norm = normalizeEpisode(ep, mode)
          set((state) => ({
            recordings: [norm, ...state.recordings],
          }))
          return norm
        }

        // Demo fallback when unauthenticated
        return get().addRecording({
          title,
          description,
          tags: Array.isArray(tags)
            ? tags
            : tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
          playlistId,
        })
      },

      addRecording: ({ title, description, tags = [], playlistId = '' }) => {
        const { mode, user } = get()
        const id = `rec-${mode}-${Date.now()}`
        const newRec = {
          id,
          mode,
          title,
          description:
            description || 'Uploaded via EchoSpace workspace demo uploader.',
          audioUrl: SAMPLE_AUDIO_URL,
          duration: 42,
          createdAt: 'Just now',
          authorId: user.id,
          authorName: user.name,
          playlistId,
          tags,
          chapters: [
            { id: `ch-${Date.now()}-1`, title: 'Introduction', startTime: 0 },
            { id: `ch-${Date.now()}-2`, title: 'Core Discussion', startTime: 18 },
          ],
        }
        set((state) => ({
          recordings: [newRec, ...state.recordings],
        }))
        return newRec
      },

      // Annotations
      addAnnotation: async ({ recordingId, timestamp, category, content }) => {
        const { token, mode, user, recordings } = get()
        const rec = recordings.find((r) => r.id === recordingId)

        if (token) {
          const created = await apiClient.createAnnotation(recordingId, {
            timestamp,
            category,
            content,
          })
          const norm = normalizeAnnotation(created, rec?.mode || mode)
          set((state) => ({
            annotations: state.annotations.some((a) => a.id === norm.id)
              ? state.annotations
              : [norm, ...state.annotations],
          }))
          return norm
        }

        const ann = {
          id: `ann-${Date.now()}`,
          recordingId,
          mode: rec?.mode || mode,
          timestamp,
          category,
          status: 'OPEN',
          authorId: user.id,
          authorName: user.name,
          createdAt: 'Just now',
          content,
          replies: [],
        }
        set((state) => ({
          annotations: [ann, ...state.annotations],
        }))
        return ann
      },

      updateAnnotationStatus: async (annotationId, status) => {
        const { token } = get()
        const upper = String(status).toUpperCase()
        if (token) {
          await apiClient.updateAnnotation(annotationId, { status: upper })
        }
        set((state) => ({
          annotations: state.annotations.map((ann) =>
            ann.id === annotationId ? { ...ann, status: upper } : ann
          ),
        }))
      },

      addReply: async (annotationId, content) => {
        const { token, user } = get()
        if (token) {
          const created = await apiClient.createReply(annotationId, content)
          const normReply = {
            id: created.id,
            authorName: created.user?.name || user.name,
            createdAt: 'Just now',
            content: created.content,
          }
          set((state) => ({
            annotations: state.annotations.map((ann) =>
              ann.id === annotationId &&
              !ann.replies.some((r) => r.id === normReply.id)
                ? { ...ann, replies: [...ann.replies, normReply] }
                : ann
            ),
          }))
          return normReply
        }

        const reply = {
          id: `rep-${Date.now()}`,
          authorName: user.name,
          createdAt: 'Just now',
          content,
        }
        set((state) => ({
          annotations: state.annotations.map((ann) =>
            ann.id === annotationId
              ? { ...ann, replies: [...ann.replies, reply] }
              : ann
          ),
        }))
        return reply
      },

      // Clips
      addClip: async ({ recordingId, title, startTime, endTime, notes }) => {
        const { token, mode, user, recordings } = get()
        const rec = recordings.find((r) => r.id === recordingId)

        if (token) {
          const created = await apiClient.createClip(recordingId, {
            title,
            description: notes || '',
            startTime,
            endTime,
            visibility: 'PUBLIC',
          })
          const norm = normalizeClip(created, rec?.mode || mode, rec?.title)
          set((state) => ({
            clips: state.clips.some((c) => c.id === norm.id)
              ? state.clips
              : [norm, ...state.clips],
          }))
          return norm
        }

        const clip = {
          id: `clip-${Date.now()}`,
          shareToken: `clip-${Date.now()}`,
          mode: rec?.mode || mode,
          recordingId,
          recordingTitle: rec?.title || 'Untitled Recording',
          title,
          startTime,
          endTime,
          authorName: user.name,
          createdAt: 'Just now',
          views: 1,
          notes: notes || '',
        }
        set((state) => ({
          clips: [clip, ...state.clips],
        }))
        return clip
      },

      // Chapters
      addChapter: async ({ episodeId, title, startTime }) => {
        const { token } = get()
        if (token) {
          const chapter = await apiClient.createChapter(episodeId, {
            title,
            startTime,
          })
          set((state) => ({
            recordings: state.recordings.map((r) =>
              r.id === episodeId
                ? {
                    ...r,
                    chapters: [...(r.chapters || []), chapter].sort(
                      (a, b) => a.startTime - b.startTime
                    ),
                  }
                : r
            ),
          }))
          return chapter
        }
        return null
      },

      deleteChapter: async (episodeId, chapterId) => {
        const { token } = get()
        if (token) {
          await apiClient.deleteChapter(chapterId)
        }
        set((state) => ({
          recordings: state.recordings.map((r) =>
            r.id === episodeId
              ? {
                  ...r,
                  chapters: (r.chapters || []).filter((c) => c.id !== chapterId),
                }
              : r
          ),
        }))
      },

      // Playlists
      addPlaylist: async ({
        title,
        description,
        rssUrl = '',
        recordingIds = [],
      }) => {
        const { token, activeWorkspaceId, mode } = get()
        if (token && activeWorkspaceId) {
          const pl = await apiClient.createPlaylist(activeWorkspaceId, {
            title,
            description,
            rssUrl: rssUrl || null,
            episodeIds: recordingIds,
          })
          const norm = {
            id: pl.id,
            mode,
            title: pl.title,
            description: pl.description || '',
            rssUrl: pl.rssUrl || '',
            recordingIds: (pl.episodes || []).map((pe) => pe.episodeId),
            updatedAt: 'Just now',
          }
          set((state) => ({
            playlists: [norm, ...state.playlists],
          }))
          return norm
        }

        const playlist = {
          id: `pl-${mode}-${Date.now()}`,
          mode,
          title,
          description,
          rssUrl,
          recordingIds,
          updatedAt: 'Just now',
        }
        set((state) => ({
          playlists: [playlist, ...state.playlists],
        }))
        return playlist
      },

      reorderPlaylistRecordings: async (playlistId, recordingIds) => {
        const { token } = get()
        if (token) {
          await apiClient.reorderPlaylist(playlistId, recordingIds)
        }
        set((state) => ({
          playlists: state.playlists.map((pl) =>
            pl.id === playlistId
              ? { ...pl, recordingIds, updatedAt: 'Just now' }
              : pl
          ),
        }))
      },

      // Members
      inviteMember: async ({ name, email, role }) => {
        const { token, activeWorkspaceId, mode } = get()
        if (token && activeWorkspaceId) {
          const member = await apiClient.addWorkspaceMember(activeWorkspaceId, {
            email,
            role: role.toUpperCase(),
          })
          const norm = {
            id: member.user.id,
            name: member.user.name,
            email: member.user.email,
            role: member.role,
            modes: [mode],
            status: 'Active',
            avatarColor: member.user.avatarColor || '#22D3EE',
          }
          set((state) => ({
            members: state.members.some((m) => m.id === norm.id)
              ? state.members.map((m) => (m.id === norm.id ? norm : m))
              : [...state.members, norm],
          }))
          return norm
        }

        const member = {
          id: `u-${Date.now()}`,
          name,
          email,
          role,
          modes: [mode],
          status: 'Invited',
          avatarColor: '#22D3EE',
        }
        set((state) => ({
          members: [...state.members, member],
        }))
        return member
      },

      updateProfile: async (updates) => {
        const { token } = get()
        if (token) {
          const { user } = await apiClient.updateProfile(updates)
          set({ user })
          return
        }
        set((state) => ({
          user: { ...state.user, ...updates },
        }))
      },

      updateWorkspaceSettings: async (updates) => {
        const { token, activeWorkspaceId, mode } = get()
        if (token && activeWorkspaceId) {
          const nextName =
            mode === 'study' ? updates.studyName : updates.creatorName
          if (nextName) {
            await apiClient.updateWorkspace(activeWorkspaceId, { name: nextName })
          }
        }
        set((state) => ({
          workspaceSettings: { ...state.workspaceSettings, ...updates },
        }))
      },

      // Socket.IO real-time mutators
      applySocketAnnotationCreated: (ann) => {
        const mode = get().mode
        const norm = normalizeAnnotation(ann, mode)
        set((state) => ({
          annotations: state.annotations.some((a) => a.id === norm.id)
            ? state.annotations
            : [norm, ...state.annotations],
        }))
      },

      applySocketAnnotationUpdated: (ann) => {
        const mode = get().mode
        const norm = normalizeAnnotation(ann, mode)
        set((state) => ({
          annotations: state.annotations.map((a) =>
            a.id === norm.id ? norm : a
          ),
        }))
      },

      applySocketAnnotationDeleted: (annotationId) => {
        set((state) => ({
          annotations: state.annotations.filter((a) => a.id !== annotationId),
        }))
      },

      applySocketReplyCreated: ({ annotationId, reply }) => {
        const normReply = {
          id: reply.id,
          authorName: reply.user?.name || 'Member',
          createdAt: formatRelativeTime(reply.createdAt),
          content: reply.content,
        }
        set((state) => ({
          annotations: state.annotations.map((ann) =>
            ann.id === annotationId &&
            !ann.replies.some((r) => r.id === normReply.id)
              ? { ...ann, replies: [...ann.replies, normReply] }
              : ann
          ),
        }))
      },

      applySocketClipCreated: (clip) => {
        const mode = get().mode
        const norm = normalizeClip(clip, mode)
        set((state) => ({
          clips: state.clips.some((c) => c.id === norm.id)
            ? state.clips
            : [norm, ...state.clips],
        }))
      },

      resetDemoData: () =>
        set({
          recordings: INITIAL_RECORDINGS,
          annotations: INITIAL_ANNOTATIONS,
          clips: INITIAL_CLIPS,
          playlists: INITIAL_PLAYLISTS,
          members: INITIAL_MEMBERS,
          activity: INITIAL_ACTIVITY,
        }),
    }),
    {
      name: 'echospace-demo-store-v1',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setAuthToken(state.token)
          connectSocket(state.token)
        }
      },
    }
  )
)
