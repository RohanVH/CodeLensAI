import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.resolve(__dirname, '../.env') })

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json({ limit: '1mb' }))

const systemPrompt = `You are a senior software engineer assistant. Analyze the user's code and respond with strict JSON only.
Required keys: summary, lineExplanation, commentsVersion, timeComplexity, spaceComplexity, complexityExplanation.
Rules:
- summary: concise high-level explanation.
- lineExplanation: step-by-step or block-by-block explanation.
- commentsVersion: return the original code with clear inline comments added.
- timeComplexity: Big-O notation.
- spaceComplexity: Big-O notation.
- complexityExplanation: short reasoning for complexity.`

const improvePrompt = `You are a principal engineer focused on performance and code quality.
Return strict JSON only with these keys:
- improvedCode: a better, faster, cleaner implementation that preserves behavior.
- summary: short summary of the improvements.
- lineExplanation: explanation of what changed and why.
- timeComplexity: Big-O notation of the improved code.
- spaceComplexity: Big-O notation of the improved code.
- complexityExplanation: short reasoning for complexity.
Rules:
- Keep the same programming language as input.
- Do not include markdown fences.
- Keep output practical and production friendly.`

const titlePrompt = `You are a code intent classifier.
Return strict JSON only with key:
- title: one short program title in 2 to 6 words.
Rules:
- Do not mention the language name unless absolutely necessary.
- Do not add punctuation at the end.
- Be specific to what the code does.
- No markdown, no extra keys.`

const sanitizeContent = (text) => {
  if (typeof text !== 'string') return ''
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

const extractJsonObject = (text) => {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    return null
  }
  return text.slice(start, end + 1)
}

const parseModelJson = (rawText) => {
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

const toResultShape = (parsed) => ({
  summary: String(parsed?.summary ?? ''),
  lineExplanation: String(parsed?.lineExplanation ?? ''),
  commentsVersion: String(parsed?.commentsVersion ?? ''),
  timeComplexity: String(parsed?.timeComplexity ?? ''),
  spaceComplexity: String(parsed?.spaceComplexity ?? ''),
  complexityExplanation: String(parsed?.complexityExplanation ?? ''),
})

const toImproveShape = (parsed) => ({
  improvedCode: String(parsed?.improvedCode ?? ''),
  summary: String(parsed?.summary ?? ''),
  lineExplanation: String(parsed?.lineExplanation ?? ''),
  timeComplexity: String(parsed?.timeComplexity ?? ''),
  spaceComplexity: String(parsed?.spaceComplexity ?? ''),
  complexityExplanation: String(parsed?.complexityExplanation ?? ''),
})

const toTitleShape = (parsed) => ({
  title: String(parsed?.title ?? '').trim(),
})

const fetchGroqJson = async ({ groqApiKey, systemContent, userContent }) => {
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

app.post('/api/explain', async (req, res) => {
  const { code } = req.body || {}

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Request must include a "code" string.' })
  }

  const groqApiKey = process.env.GROQ_API_KEY

  if (!groqApiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured. Add it to your environment before running the backend.',
    })
  }

  try {
    const parsed = await fetchGroqJson({
      groqApiKey,
      systemContent: systemPrompt,
      userContent: `Analyze this code:\n\n${code}`,
    })

    return res.json(toResultShape(parsed))
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Unexpected server error.' })
  }
})

app.post('/api/improve', async (req, res) => {
  const { code } = req.body || {}

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Request must include a "code" string.' })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured. Add it to your environment before running the backend.',
    })
  }

  try {
    const parsed = await fetchGroqJson({
      groqApiKey,
      systemContent: improvePrompt,
      userContent: `Improve and optimize this code:\n\n${code}`,
    })
    return res.json(toImproveShape(parsed))
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Unexpected server error.' })
  }
})

app.post('/api/program-title', async (req, res) => {
  const { code } = req.body || {}

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Request must include a "code" string.' })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured. Add it to your environment before running the backend.',
    })
  }

  try {
    const parsed = await fetchGroqJson({
      groqApiKey,
      systemContent: titlePrompt,
      userContent: `Create a concise title for this code:\n\n${code}`,
    })
    return res.json(toTitleShape(parsed))
  } catch (error) {
    return res.status(502).json({ error: error.message || 'Unexpected server error.' })
  }
})

app.listen(PORT, () => {
  console.log(`CodeLensAI backend listening on http://localhost:${PORT}`)
})
