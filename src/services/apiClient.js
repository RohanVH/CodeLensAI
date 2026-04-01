const postCode = async (endpoint, code) => {
  try {
    const response = await fetch(endpoint, {
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

export const explainCode = async (code) => postCode('/api/explain', code)
export const improveCode = async (code) => postCode('/api/improve', code)
export const detectProgramTitleApi = async (code) => postCode('/api/program-title', code)
