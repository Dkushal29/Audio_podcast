const MODE_CATEGORIES = {
  STUDY: [
    { id: 'QUESTION', label: 'Question' },
    { id: 'INSIGHT', label: 'Insight' },
    { id: 'REVISION', label: 'Revision' },
  ],
  CREATOR: [
    { id: 'FEEDBACK', label: 'Feedback' },
    { id: 'CORRECTION', label: 'Correction' },
    { id: 'SUGGESTION', label: 'Suggestion' },
  ],
}

let state = {
  apiBaseUrl: 'http://localhost:8080/api',
  webAppUrl: 'http://localhost:5173',
  token: null,
  user: null,
  mode: 'STUDY',
  workspaces: [],
  media: null,
}

const el = (id) => document.getElementById(id)

function formatSec(sec) {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

async function apiFetch(endpoint, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (state.token) headers.Authorization = `Bearer ${state.token}`
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${state.apiBaseUrl}${endpoint}`, {
    ...options,
    headers,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error?.message || `Request failed (${res.status})`)
  }
  return data
}

function renderCategories() {
  const cats = MODE_CATEGORIES[state.mode] || MODE_CATEGORIES.STUDY
  const select = el('category-select')
  select.innerHTML = cats
    .map((c) => `<option value="${c.id}">${c.label}</option>`)
    .join('')
}

function renderWorkspaces() {
  const select = el('workspace-select')
  const filtered = state.workspaces.filter((w) => w.mode === state.mode)
  const list = filtered.length > 0 ? filtered : state.workspaces

  if (list.length === 0) {
    select.innerHTML = '<option value="">No workspaces found</option>'
    return
  }

  select.innerHTML = list
    .map((w) => `<option value="${w.id}">${w.name} (${w.mode})</option>`)
    .join('')
}

function setMode(nextMode) {
  state.mode = nextMode
  el('mode-study').classList.toggle('active', nextMode === 'STUDY')
  el('mode-creator').classList.toggle('active', nextMode === 'CREATOR')
  renderCategories()
  renderWorkspaces()
}

async function detectMediaInActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab?.id || !tab.url?.startsWith('http')) {
      state.media = {
        supported: false,
        reason: 'Open an http/https webpage to capture media.',
        pageTitle: tab?.title || 'Unsupported tab',
        pageUrl: tab?.url || '',
      }
      renderMedia()
      return
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    })

    state.media = results?.[0]?.result || {
      supported: false,
      reason: 'Could not inspect media on this page.',
      pageTitle: tab.title,
      pageUrl: tab.url,
    }
  } catch (err) {
    state.media = {
      supported: false,
      reason: err.message || 'Page blocked script inspection.',
      pageTitle: 'Unavailable',
      pageUrl: '',
    }
  }
  renderMedia()
}

function renderMedia() {
  const m = state.media
  if (!m) return
  el('media-title').textContent = m.pageTitle || 'Untitled Page'
  el('media-url').textContent = m.pageUrl || ''

  const pill = el('media-status')
  if (m.supported) {
    pill.classList.remove('warn')
    const durText = m.hasFiniteDuration
      ? ` / ${formatSec(m.duration)}`
      : ' (duration unavailable)'
    pill.textContent = `HTML5 <${m.tagName}> · ${formatSec(m.currentTime)}${durText}`
    el('timestamp-input').value = String(m.currentTime || 0)
  } else {
    pill.classList.add('warn')
    pill.textContent = m.reason || 'No accessible HTML5 media detected.'
  }
}

async function showAuthenticatedView() {
  el('auth-view').classList.add('hidden')
  el('capture-view').classList.remove('hidden')
  el('logout-btn').classList.remove('hidden')
  el('user-name').textContent = state.user?.name || state.user?.email || ''

  setMode(state.mode)

  try {
    const { workspaces } = await apiFetch('/workspaces')
    state.workspaces = workspaces || []
    renderWorkspaces()
  } catch (err) {
    el('capture-error').textContent = err.message
    el('capture-error').classList.remove('hidden')
  }

  await detectMediaInActiveTab()
}

function showLoginView() {
  el('auth-view').classList.remove('hidden')
  el('capture-view').classList.add('hidden')
  el('logout-btn').classList.add('hidden')
}

async function init() {
  const stored = await chrome.storage.local.get([
    'apiBaseUrl',
    'webAppUrl',
    'token',
    'user',
  ])
  if (stored.apiBaseUrl) state.apiBaseUrl = stored.apiBaseUrl
  if (stored.webAppUrl) state.webAppUrl = stored.webAppUrl

  if (stored.token) {
    state.token = stored.token
    state.user = stored.user
    try {
      const me = await apiFetch('/auth/me')
      state.user = me.user
      await chrome.storage.local.set({ user: me.user })
      await showAuthenticatedView()
      return
    } catch {
      await chrome.storage.local.remove(['token', 'user'])
      state.token = null
      state.user = null
    }
  }
  showLoginView()
}

el('options-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
})

el('logout-btn').addEventListener('click', async () => {
  await chrome.storage.local.remove(['token', 'user'])
  state.token = null
  state.user = null
  showLoginView()
})

el('mode-study').addEventListener('click', () => setMode('STUDY'))
el('mode-creator').addEventListener('click', () => setMode('CREATOR'))
el('refresh-media').addEventListener('click', detectMediaInActiveTab)

el('login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const errEl = el('login-error')
  errEl.classList.add('hidden')
  el('login-submit').disabled = true

  try {
    const email = el('login-email').value.trim()
    const password = el('login-password').value
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    state.token = data.token
    state.user = data.user
    await chrome.storage.local.set({ token: data.token, user: data.user })
    await showAuthenticatedView()
  } catch (err) {
    errEl.textContent = err.message
    errEl.classList.remove('hidden')
  } finally {
    el('login-submit').disabled = false
  }
})

el('annotate-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const errEl = el('capture-error')
  const okEl = el('capture-success')
  errEl.classList.add('hidden')
  okEl.classList.add('hidden')

  const workspaceId = el('workspace-select').value
  const category = el('category-select').value
  const timestamp = Number(el('timestamp-input').value || 0)
  const content = el('note-input').value.trim()

  if (!workspaceId) {
    errEl.textContent = 'Create or select a workspace in EchoSpace first.'
    errEl.classList.remove('hidden')
    return
  }

  if (!state.media?.pageUrl) {
    errEl.textContent = 'No webpage URL available to link.'
    errEl.classList.remove('hidden')
    return
  }

  el('save-btn').disabled = true
  try {
    const epRes = await apiFetch('/episodes/external', {
      method: 'POST',
      body: JSON.stringify({
        workspaceId,
        title: state.media.pageTitle || 'Web Recording',
        description: state.media.supported
          ? `Captured from <${state.media.tagName}> on ${state.media.pageUrl}`
          : `Linked webpage: ${state.media.pageUrl}`,
        sourceUrl: state.media.pageUrl,
        duration: state.media.duration || 0,
      }),
    })

    const episodeId = epRes.episode.id
    await apiFetch(`/episodes/${episodeId}/annotations`, {
      method: 'POST',
      body: JSON.stringify({ timestamp, category, content }),
    })

    el('note-input').value = ''
    el('success-text').textContent = `Saved at ${formatSec(timestamp)}`
    el('open-app-link').href = `${state.webAppUrl}/app/recordings/${episodeId}`
    okEl.classList.remove('hidden')
  } catch (err) {
    errEl.textContent = err.message
    errEl.classList.remove('hidden')
  } finally {
    el('save-btn').disabled = false
  }
})

init()
