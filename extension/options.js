const apiInput = document.getElementById('api-url')
const webInput = document.getElementById('web-url')
const savedMsg = document.getElementById('saved-msg')

chrome.storage.local.get(['apiBaseUrl', 'webAppUrl']).then((res) => {
  apiInput.value = res.apiBaseUrl || 'http://localhost:8080/api'
  webInput.value = res.webAppUrl || 'http://localhost:5173'
})

document.getElementById('options-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  await chrome.storage.local.set({
    apiBaseUrl: apiInput.value.replace(/\/$/, ''),
    webAppUrl: webInput.value.replace(/\/$/, ''),
  })
  savedMsg.classList.remove('hidden')
  setTimeout(() => savedMsg.classList.add('hidden'), 2000)
})
