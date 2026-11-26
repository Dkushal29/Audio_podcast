const MODE_CATEGORIES = {
  STUDY: [
    { value: 'QUESTION', label: 'Question' },
    { value: 'NOTE', label: 'Note' },
    { value: 'INSIGHT', label: 'Insight' },
    { value: 'REVISION', label: 'Revision' },
  ],
  CREATOR: [
    { value: 'FEEDBACK', label: 'Feedback' },
    { value: 'CORRECTION', label: 'Correction' },
    { value: 'SUGGESTION', label: 'Suggestion' },
  ],
}

const state = {
  apiBaseUrl: 'http://localhost:8080/api',
  webAppUrl: 'http://localhost:5173',
  token: null,
  user: null,
  mode: 'STUDY',
  action: 'ANNOTATE',
  workspaces: [],
  detectedMedia: null,
  lastEpisodeId: null,
  timestampManuallyEdited: false,
}

const el = {
  authView: document.getElementById('auth-view'),
  captureView: document.getElementById('capture-view'),
  loginForm: document.getElementById('login-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  authError: document.getElementById('auth-error'),
  userName: document.getElementById('user-name'),
  logoutBtn: document.getElementById('logout-btn'),
  optionsBtn: document.getElementById('options-btn'),
  workspaceSelect: document.getElementById('workspace-select'),
  categoryLabel: document.getElementById('category-label'),
  categorySelect: document.getElementById('category-select'),
  timestampInput: document.getElementById('timestamp-input'),
  noteLabel: document.getElementById('note-label'),
  noteInput: document.getElementById('note-input'),
  annotateForm: document.getElementById('annotate-form'),
  saveBtn: document.getElementById('save-btn'),
  openAppBtn: document.getElementById('open-app-btn'),
  openWsBtn: document.getElementById('open-ws-btn'),
  mediaThumb: document.getElementById('media-thumb'),
  providerBadge: document.getElementById('provider-badge'),
  playbackBadge: document.getElementById('playback-badge'),
  mediaTitle: document.getElementById('media-title'),
  mediaMeta: document.getElementById('media-meta'),
  refreshMediaBtn: document.getElementById('refresh-media-btn'),
  captureError: document.getElementById('capture-error'),
  captureSuccess: document.getElementById('capture-success'),
}

function formatTimestamp(totalSeconds) {
  const sec = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const hours = Math.floor(sec / 3600)
  const mins = Math.floor((sec % 3600) / 60)
  const rem = sec % 60
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
  }
  return `${mins}:${String(rem).padStart(2, '0')}`
}

function parseTimestampInput(value) {
  const raw = String(value || '').trim()
  if (!raw) return 0
  if (/^\d+(\.\d+)?$/.test(raw)) {
    return Math.max(0, Number(raw))
  }
  const parts = raw.split(':').map((p) => Number(p.trim()))
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return NaN
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return NaN
}

async function loadSettings() {
  const stored = await chrome.storage.local.get([
    'apiBaseUrl',
    'webAppUrl',
    'echospaceToken',
    'echospaceMode',
  ])
  if (stored.apiBaseUrl) state.apiBaseUrl = stored.apiBaseUrl
  if (stored.webAppUrl) state.webAppUrl = stored.webAppUrl
  if (stored.echospaceToken) state.token = stored.echospaceToken
  if (stored.echospaceMode) state.mode = stored.echospaceMode
}

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  }
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`
  }
  const res = await fetch(`${state.apiBaseUrl}${path}`, {
    ...options,
    headers,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && state.token) {
    state.token = null
    state.user = null
    await chrome.storage.local.remove('echospaceToken')
    showAuthView('Session expired. Please sign in again.')
  }
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`)
  }
  return data
}

function showAuthView(message = '') {
  el.authView.classList.remove('hidden')
  el.captureView.classList.add('hidden')
  if (message) {
    el.authError.textContent = message
    el.authError.classList.remove('hidden')
  }
}

function showCaptureView() {
  el.authView.classList.add('hidden')
  el.captureView.classList.remove('hidden')
}

function renderModeButtons() {
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === state.mode)
  })
  const cats = MODE_CATEGORIES[state.mode] || MODE_CATEGORIES.STUDY
  el.categorySelect.textContent = ''
  cats.forEach((c) => {
    const opt = document.createElement('option')
    opt.value = c.value
    opt.textContent = c.label
    el.categorySelect.appendChild(opt)
  })
}

function renderActionPills() {
  document.querySelectorAll('.action-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.action === state.action)
  })

  if (state.action === 'BOOKMARK') {
    el.categoryLabel.classList.add('hidden')
    el.noteLabel.textContent = 'Bookmark Label (optional)'
    el.noteInput.placeholder = 'e.g. Key architecture diagram, Important formula...'
    el.saveBtn.textContent = 'Save Bookmark'
  } else if (state.action === 'QUESTION') {
    el.categoryLabel.classList.remove('hidden')
    el.categorySelect.value = state.mode === 'STUDY' ? 'QUESTION' : 'FEEDBACK'
    el.noteLabel.textContent = 'Question for Workspace'
    el.noteInput.placeholder = 'Ask a timestamped question for your teammates...'
    el.saveBtn.textContent = 'Post Question'
  } else if (state.action === 'DISCUSS') {
    el.categoryLabel.classList.remove('hidden')
    el.noteLabel.textContent = 'Share Moment with Workspace'
    el.noteInput.placeholder = 'Share this video moment & notify your workspace (@team)...'
    el.saveBtn.textContent = 'Share with Workspace'
  } else {
    el.categoryLabel.classList.remove('hidden')
    el.noteLabel.textContent = 'Annotation'
    el.noteInput.placeholder = 'Write a timestamped note, question, or @teammate mention...'
    el.saveBtn.textContent = 'Save Annotation'
  }
}

function renderWorkspaces() {
  const filtered = state.workspaces.filter((ws) => ws.mode === state.mode)
  const list = filtered.length > 0 ? filtered : state.workspaces
  el.workspaceSelect.textContent = ''
  list.forEach((ws) => {
    const opt = document.createElement('option')
    opt.value = ws.id
    opt.textContent = `${ws.name} (${ws.mode})`
    el.workspaceSelect.appendChild(opt)
  })
}

async function queryActiveTabMedia() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return null
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  })
  return results?.[0]?.result || null
}

async function detectMediaInActiveTab() {
  el.captureError.classList.add('hidden')
  el.mediaTitle.textContent = 'Scanning active tab...'
  el.mediaMeta.textContent = ''
  el.mediaThumb.classList.add('hidden')
  el.providerBadge.classList.add('hidden')
  el.playbackBadge.classList.add('hidden')

  try {
    const info = await queryActiveTabMedia()
    state.detectedMedia = info

    if (!info || !info.supported) {
      el.mediaTitle.textContent = 'No supported media detected'
      el.mediaMeta.textContent = info?.reason || 'Open a YouTube video or HTML5 media page.'
      el.saveBtn.disabled = true
      return
    }

    el.mediaTitle.textContent = info.pageTitle || 'External Media'
    const currentFormatted = formatTimestamp(info.currentTime)
    const durationFormatted = info.hasFiniteDuration
      ? formatTimestamp(info.duration)
      : 'Live / Unknown'
    el.mediaMeta.textContent = info.channelName
      ? `At ${currentFormatted} / ${durationFormatted} · ${info.channelName}`
      : `At ${currentFormatted} / ${durationFormatted}`

    if (info.provider === 'YOUTUBE' && info.thumbnailUrl) {
      el.mediaThumb.src = info.thumbnailUrl
      el.mediaThumb.classList.remove('hidden')
      el.providerBadge.textContent = 'YouTube'
      el.providerBadge.className = 'badge badge-yt'
    } else {
      el.providerBadge.textContent = info.tagName || 'Media'
      el.providerBadge.className = 'badge'
    }

    el.playbackBadge.textContent = info.paused ? 'Paused' : 'Playing'
    el.playbackBadge.classList.remove('hidden')

    if (!state.timestampManuallyEdited) {
      el.timestampInput.value = currentFormatted
    }
    el.saveBtn.disabled = false
  } catch (err) {
    el.mediaTitle.textContent = 'Cannot inspect this page'
    el.mediaMeta.textContent = err.message || 'Tab permissions unavailable.'
    el.saveBtn.disabled = true
  }
}

async function bootstrapAuthenticatedSession() {
  try {
    const me = await apiFetch('/auth/me')
    state.user = me.user
    el.userName.textContent = me.user.name
    const wsRes = await apiFetch('/workspaces')
    state.workspaces = wsRes.workspaces || []
    showCaptureView()
    renderModeButtons()
    renderActionPills()
    renderWorkspaces()
    await detectMediaInActiveTab()
  } catch {
    state.token = null
    await chrome.storage.local.remove('echospaceToken')
    showAuthView()
  }
}

el.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  el.authError.classList.add('hidden')
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: el.loginEmail.value.trim(),
        password: el.loginPassword.value,
      }),
    })
    state.token = data.token
    await chrome.storage.local.set({ echospaceToken: data.token })
    await bootstrapAuthenticatedSession()
  } catch (err) {
    el.authError.textContent = err.message
    el.authError.classList.remove('hidden')
  }
})

el.logoutBtn.addEventListener('click', async () => {
  state.token = null
  state.user = null
  await chrome.storage.local.remove('echospaceToken')
  showAuthView()
})

el.optionsBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

el.refreshMediaBtn.addEventListener('click', () => {
  state.timestampManuallyEdited = false
  detectMediaInActiveTab()
})

el.timestampInput.addEventListener('input', () => {
  state.timestampManuallyEdited = true
})

document.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', async () => {
    state.mode = btn.dataset.mode
    await chrome.storage.local.set({ echospaceMode: state.mode })
    renderModeButtons()
    renderActionPills()
    renderWorkspaces()
  })
})

document.querySelectorAll('.action-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.action = btn.dataset.action
    renderActionPills()
  })
})

el.annotateForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  el.captureError.classList.add('hidden')
  el.captureSuccess.classList.add('hidden')

  if (!state.detectedMedia?.supported) {
    el.captureError.textContent = 'No supported media detected on the current tab.'
    el.captureError.classList.remove('hidden')
    return
  }

  const workspaceId = el.workspaceSelect.value
  const note = el.noteInput.value.trim()
  if (state.action !== 'BOOKMARK' && !note) {
    el.captureError.textContent = 'Please enter a message before saving.'
    el.captureError.classList.remove('hidden')
    return
  }

  el.saveBtn.disabled = true
  try {
    // Capture live playback timestamp at action time unless user manually edited it
    let timestamp = parseTimestampInput(el.timestampInput.value)
    if (!state.timestampManuallyEdited) {
      const liveInfo = await queryActiveTabMedia().catch(() => null)
      if (liveInfo?.supported) {
        state.detectedMedia = liveInfo
        timestamp = Math.max(0, Number(liveInfo.currentTime) || 0)
        el.timestampInput.value = formatTimestamp(timestamp)
      }
    }

    if (!Number.isFinite(timestamp) || timestamp < 0) {
      throw new Error('Enter a valid timestamp such as 12:43 or 763.')
    }

    const sourceUrl =
      state.detectedMedia.canonicalUrl ||
      state.detectedMedia.mediaSrc ||
      state.detectedMedia.pageUrl

    const epRes = await apiFetch('/episodes/external', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        title: state.detectedMedia.pageTitle || 'External Media',
        description:
          state.detectedMedia.provider === 'YOUTUBE'
            ? `YouTube video session (${state.detectedMedia.videoId})`
            : `Captured from ${state.detectedMedia.pageUrl}`,
        sourceUrl,
        duration: state.detectedMedia.hasFiniteDuration
          ? Math.ceil(state.detectedMedia.duration)
          : 0,
        reuseExisting: true,
      }),
    })

    const episodeId = epRes.episode.id
    state.lastEpisodeId = episodeId

    if (state.action === 'BOOKMARK') {
      await apiFetch(`/episodes/${episodeId}/bookmarks`, {
        method: 'POST',
        body: JSON.stringify({
          timestamp,
          label: note || `Bookmark at ${formatTimestamp(timestamp)}`,
        }),
      })
      el.captureSuccess.textContent = `Bookmark saved at ${formatTimestamp(timestamp)}!`
    } else {
      const category =
        state.action === 'QUESTION'
          ? state.mode === 'STUDY'
            ? 'QUESTION'
            : 'FEEDBACK'
          : el.categorySelect.value

      await apiFetch(`/episodes/${episodeId}/annotations`, {
        method: 'POST',
        body: JSON.stringify({
          timestamp,
          category,
          content: note,
          shareToWorkspace: state.action === 'DISCUSS',
        }),
      })
      el.captureSuccess.textContent =
        state.action === 'DISCUSS'
          ? `Moment shared with workspace at ${formatTimestamp(timestamp)}!`
          : `Saved to workspace at ${formatTimestamp(timestamp)}!`
    }

    el.noteInput.value = ''
    state.timestampManuallyEdited = false
    el.captureSuccess.classList.remove('hidden')
  } catch (err) {
    el.captureError.textContent = err.message
    el.captureError.classList.remove('hidden')
  } finally {
    el.saveBtn.disabled = false
  }
})

el.openAppBtn.addEventListener('click', () => {
  const targetUrl = state.lastEpisodeId
    ? `${state.webAppUrl}/app/recordings/${state.lastEpisodeId}`
    : `${state.webAppUrl}/app/recordings`
  chrome.tabs.create({ url: targetUrl })
})

el.openWsBtn?.addEventListener('click', () => {
  chrome.tabs.create({ url: `${state.webAppUrl}/app` })
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'ECHOSPACE_MEDIA_CHANGED') {
    state.timestampManuallyEdited = false
    detectMediaInActiveTab()
  }
})

;(async function init() {
  await loadSettings()
  if (state.token) {
    await bootstrapAuthenticatedSession()
  } else {
    showAuthView()
  }
})()
