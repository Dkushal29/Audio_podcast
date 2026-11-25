const DEFAULT_CONFIG = {
  apiBaseUrl: 'http://localhost:8080/api',
  webAppUrl: 'http://localhost:5173',
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(['apiBaseUrl', 'webAppUrl'])
  if (!existing.apiBaseUrl || !existing.webAppUrl) {
    await chrome.storage.local.set({
      apiBaseUrl: existing.apiBaseUrl || DEFAULT_CONFIG.apiBaseUrl,
      webAppUrl: existing.webAppUrl || DEFAULT_CONFIG.webAppUrl,
    })
  }
})
