import { fetchGroqJson, toResultShape, setCorsHeaders } from '../lib/utils.js'

const systemPrompt = `You are a senior software engineer assistant. Analyze the user's code and respond with strict JSON only.
Required keys: summary, lineExplanation, commentsVersion, timeComplexity, spaceComplexity, complexityExplanation.
Rules:
- summary: concise high-level explanation.
- lineExplanation: step-by-step or block-by-block explanation.
- commentsVersion: return the original code with clear inline comments added.
- timeComplexity: Big-O notation.
- spaceComplexity: Big-O notation.
- complexityExplanation: short reasoning for complexity.`

export default async function handler(req, res) {
  console.log('API HIT /api/explain')

  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
  }

  let body

  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'Request body must be valid JSON.' })
  }

  const { code } = body || {}

  if (typeof code !== 'string' || !code.trim()) {
    return res.status(400).json({ error: 'Request must include a non-empty "code" string.' })
  }

  const groqApiKey = process.env.GROQ_API_KEY

  if (!groqApiKey) {
    console.error('GROQ_API_KEY is not set for /api/explain')
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured. Add it to your Vercel environment variables.',
    })
  }

  try {
    console.log('Calling Groq for /api/explain')
    const parsed = await fetchGroqJson({
      groqApiKey,
      systemContent: systemPrompt,
      userContent: `Analyze this code:\n\n${code}`,
    })
    console.log('Groq response parsed for /api/explain')
    return res.status(200).json(toResultShape(parsed))
  } catch (error) {
    console.error('Error in /api/explain:', error)
    return res.status(502).json({ error: error.message || 'Unexpected server error.' })
  }
}
