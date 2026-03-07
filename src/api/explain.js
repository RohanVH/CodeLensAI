const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'

const postCode = async (endpoint, code) => {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  })

  if (!response.ok) {
    const raw = await response.text().catch(() => '')
    let message = 'Request failed.'

    if (raw) {
      if (raw.includes('Cannot POST /api/improve')) {
        throw new Error('Improve endpoint is unavailable on backend. Restart backend using: node backend/server.js')
      }

      try {
        const payload = JSON.parse(raw)
        message = payload.error || payload.message || raw
      } catch {
        message = raw
      }
    }

    throw new Error(message)
  }

  return response.json()
}

export const explainCode = async (code) => {
  return postCode('/api/explain', code)
}

export const improveCode = async (code) => postCode('/api/improve', code)
export const detectProgramTitleApi = async (code) => postCode('/api/program-title', code)
