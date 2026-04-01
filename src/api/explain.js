// Automatically use relative paths in production, localhost in development
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') return ''
  
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001'
  }
  
  return ''
}

const API_BASE_URL = getApiBaseUrl()

const postCode = async (endpoint, code) => {
  const url = `${API_BASE_URL}${endpoint}`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    })

    if (!response.ok) {
      const raw = await response.text().catch(() => '')
      let message = `Request failed with status ${response.status}.`

      if (raw) {
        try {
          const payload = JSON.parse(raw)
          message = payload.error || payload.message || raw
        } catch {
          message = raw || message
        }
      }

      throw new Error(message)
    }

    return response.json()
  } catch (error) {
    console.error(`Error calling ${endpoint}:`, error)
    throw error
  }
}

export const explainCode = async (code) => {
  return postCode('/api/explain', code)
}

export const improveCode = async (code) => postCode('/api/improve', code)
export const detectProgramTitleApi = async (code) => postCode('/api/program-title', code)
