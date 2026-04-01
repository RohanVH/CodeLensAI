export const sanitizeContent = (text) => {
  if (typeof text !== 'string') return ''
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

export const extractJsonObject = (text) => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return null
  }
  return text.slice(start, end + 1)
}

export const parseModelJson = (rawText) => {
  const text = sanitizeContent(rawText)

  try {
    return JSON.parse(text)
  } catch {
    const extracted = extractJsonObject(text)
    if (!extracted) {
      return null
    }

    try {
      return JSON.parse(extracted)
    } catch {
      return null
    }
  }
}

export const toResultShape = (parsed) => ({
  summary: String(parsed?.summary ?? ''),
  lineExplanation: String(parsed?.lineExplanation ?? ''),
  commentsVersion: String(parsed?.commentsVersion ?? ''),
  timeComplexity: String(parsed?.timeComplexity ?? ''),
  spaceComplexity: String(parsed?.spaceComplexity ?? ''),
  complexityExplanation: String(parsed?.complexityExplanation ?? ''),
})

export const toImproveShape = (parsed) => ({
  improvedCode: String(parsed?.improvedCode ?? ''),
  summary: String(parsed?.summary ?? ''),
  lineExplanation: String(parsed?.lineExplanation ?? ''),
  timeComplexity: String(parsed?.timeComplexity ?? ''),
  spaceComplexity: String(parsed?.spaceComplexity ?? ''),
  complexityExplanation: String(parsed?.complexityExplanation ?? ''),
})

export const toTitleShape = (parsed) => ({
  title: String(parsed?.title ?? '').trim(),
})

export const fetchGroqJson = async ({ groqApiKey, systemContent, userContent }) => {
  const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
    }),
  })

  if (!groqResponse.ok) {
    const errorPayload = await groqResponse.text()
    throw new Error(`Groq API error: ${errorPayload}`)
  }

  const payload = await groqResponse.json()
  const content = payload?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('Groq API returned an empty response.')
  }

  const parsed = parseModelJson(content)
  if (!parsed) {
    throw new Error(`Unable to parse model response as JSON. Raw preview: ${String(content).slice(0, 500)}`)
  }

  return parsed
}

export const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version')
}

export const handleCors = (res) => {
  setCorsHeaders(res)
}
