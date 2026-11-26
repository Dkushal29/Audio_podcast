import axios from 'axios'

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

const http = axios.create({
  baseURL: API_BASE_URL,
})

let authToken = null

export function setAuthToken(token) {
  authToken = token || null
}

export function getAuthToken() {
  if (authToken) return authToken
  try {
    const raw = localStorage.getItem('echospace-store-v2')
    if (raw) {
      const parsed = JSON.parse(raw)
      const persisted = parsed?.state?.token
      if (persisted) {
        authToken = persisted
        return persisted
      }
    }
  } catch {
    // Ignore storage read error
  }
  return null
}

http.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const apiClient = {
  async healthCheck() {
    const { data } = await http.get('/health')
    return data
  },

  // Auth
  async register({ name, email, password }) {
    const { data } = await http.post('/auth/register', { name, email, password })
    return data
  },

  async login({ email, password }) {
    const { data } = await http.post('/auth/login', { email, password })
    return data
  },

  async getMe() {
    const { data } = await http.get('/auth/me')
    return data
  },

  async updateProfile(updates) {
    const { data } = await http.patch('/users/me', updates)
    return data
  },

  // Workspaces
  async listWorkspaces() {
    const { data } = await http.get('/workspaces')
    return data.workspaces
  },

  async createWorkspace({ name, mode }) {
    const { data } = await http.post('/workspaces', { name, mode })
    return data.workspace
  },

  async getWorkspace(id) {
    const { data } = await http.get(`/workspaces/${id}`)
    return data.workspace
  },

  async updateWorkspace(id, updates) {
    const { data } = await http.patch(`/workspaces/${id}`, updates)
    return data.workspace
  },

  async addWorkspaceMember(workspaceId, { email, role }) {
    const { data } = await http.post(`/workspaces/${workspaceId}/members`, {
      email,
      role,
    })
    return data.member
  },

  // Episodes & Audio
  async uploadEpisode(formData, onUploadProgress) {
    const { data } = await http.post('/episodes/upload', formData, {
      onUploadProgress: (evt) => {
        if (evt.total && onUploadProgress) {
          onUploadProgress(Math.round((evt.loaded * 100) / evt.total))
        }
      },
    })
    return data.episode
  },

  async createExternalEpisode(payload) {
    const { data } = await http.post('/episodes/external', payload)
    return data.episode
  },

  async getEpisode(id) {
    const { data } = await http.get(`/episodes/${id}`)
    return data
  },

  async deleteEpisode(id) {
    await http.delete(`/episodes/${id}`)
  },

  getEpisodeAudioUrl(episodeId) {
    const base = `${API_BASE_URL}/episodes/${episodeId}/audio`
    const token = getAuthToken()
    return token ? `${base}?token=${encodeURIComponent(token)}` : base
  },

  async getEpisodeAudioAccess(episodeId) {
    const { data } = await http.get(`/episodes/${episodeId}/audio-url`)
    return data
  },

  // Annotations
  async listAnnotations(episodeId) {
    const { data } = await http.get(`/episodes/${episodeId}/annotations`)
    return data.annotations
  },

  async createAnnotation(episodeId, payload) {
    const { data } = await http.post(
      `/episodes/${episodeId}/annotations`,
      payload
    )
    return data.annotation
  },

  async updateAnnotation(annotationId, payload) {
    const { data } = await http.patch(`/annotations/${annotationId}`, payload)
    return data.annotation
  },

  async deleteAnnotation(annotationId) {
    await http.delete(`/annotations/${annotationId}`)
  },

  // Replies
  async listReplies(annotationId) {
    const { data } = await http.get(`/annotations/${annotationId}/replies`)
    return data.replies
  },

  async createReply(annotationId, content) {
    const { data } = await http.post(`/annotations/${annotationId}/replies`, {
      content,
    })
    return data.reply
  },

  async deleteReply(replyId) {
    await http.delete(`/replies/${replyId}`)
  },

  // Clips
  async createClip(episodeId, payload) {
    const { data } = await http.post(`/episodes/${episodeId}/clips`, payload)
    return data.clip
  },

  async deleteClip(clipId) {
    await http.delete(`/clips/${clipId}`)
  },

  async getClipByToken(token) {
    const { data } = await http.get(`/clips/${token}`)
    return data.clip
  },

  getClipAudioUrl(token) {
    const base = `${API_BASE_URL}/clips/${token}/audio`
    return authToken ? `${base}?token=${encodeURIComponent(authToken)}` : base
  },

  // Chapters
  async createChapter(episodeId, payload) {
    const { data } = await http.post(`/episodes/${episodeId}/chapters`, payload)
    return data.chapter
  },

  // Bookmarks
  async listBookmarks(episodeId) {
    const { data } = await http.get(`/episodes/${episodeId}/bookmarks`)
    return data.bookmarks
  },

  async createBookmark(episodeId, payload) {
    const { data } = await http.post(`/episodes/${episodeId}/bookmarks`, payload)
    return data.bookmark
  },

  async deleteBookmark(bookmarkId) {
    await http.delete(`/bookmarks/${bookmarkId}`)
  },

  async updateChapter(chapterId, payload) {
    const { data } = await http.patch(`/chapters/${chapterId}`, payload)
    return data.chapter
  },

  async deleteChapter(chapterId) {
    await http.delete(`/chapters/${chapterId}`)
  },

  // Playlists
  async listPlaylists(workspaceId) {
    const { data } = await http.get(`/workspaces/${workspaceId}/playlists`)
    return data.playlists
  },

  async createPlaylist(workspaceId, payload) {
    const { data } = await http.post(
      `/workspaces/${workspaceId}/playlists`,
      payload
    )
    return data.playlist
  },

  async reorderPlaylist(playlistId, episodeIds) {
    const { data } = await http.patch(`/playlists/${playlistId}/reorder`, {
      episodeIds,
    })
    return data.playlist
  },

  async deletePlaylist(playlistId) {
    await http.delete(`/playlists/${playlistId}`)
  },

  getShowRssUrl(showId) {
    return `${API_BASE_URL}/shows/${showId}/feed.xml`
  },

  // Notifications
  async listNotifications() {
    const { data } = await http.get('/notifications')
    return data
  },

  async markNotificationRead(id) {
    const { data } = await http.patch(`/notifications/${id}/read`)
    return data.notification
  },

  async markAllNotificationsRead() {
    await http.post('/notifications/read-all')
  },

  // Imports (Direct Audio & Podcast RSS)
  async inspectImportSource(url) {
    const { data } = await http.post('/imports/inspect', { url })
    return data
  },

  async previewRss(url) {
    const { data } = await http.post('/imports/rss/preview', { url })
    return data.feed
  },

  async createImport(payload) {
    const { data } = await http.post('/imports', payload)
    return data
  },

  async importRssEpisode(payload) {
    const { data } = await http.post('/imports/rss/episode', payload)
    return data
  },

  async importRssBatch(payload) {
    const { data } = await http.post('/imports/rss/batch', payload)
    return data
  },

  async getImportJob(id) {
    const { data } = await http.get(`/imports/${id}`)
    return data.job
  },

  async retryImportJob(id) {
    const { data } = await http.post(`/imports/${id}/retry`)
    return data.job
  },

  async cancelImportJob(id) {
    const { data } = await http.post(`/imports/${id}/cancel`)
    return data.job
  },

  // Transcriptions (Deepgram)
  async getTranscription(episodeId) {
    const { data } = await http.get(`/episodes/${episodeId}/transcription`)
    return data.transcript
  },

  async requestTranscription(episodeId, options = {}) {
    const { data } = await http.post(`/episodes/${episodeId}/transcription`, options)
    return data.transcript
  },

  async retryTranscription(episodeId) {
    const { data } = await http.post(`/episodes/${episodeId}/transcription/retry`)
    return data.transcript
  },

  async cancelTranscription(episodeId) {
    const { data } = await http.post(`/episodes/${episodeId}/transcription/cancel`)
    return data.transcript
  },

  async updateSpeakerLabels(episodeId, speakers) {
    const { data } = await http.patch(`/episodes/${episodeId}/transcription/speakers`, {
      speakers,
    })
    return data.transcript
  },

  async deleteTranscription(episodeId) {
    await http.delete(`/episodes/${episodeId}/transcription`)
  },
}
