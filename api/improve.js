import { fetchGroqJson, toImproveShape, setCorsHeaders } from './utils.js'

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

export default async function handler(req, res) {
  console.log('API HIT: /api/improve')
  
  setCorsHeaders(res)

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
  }

  const { code } = req.body || {}

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Request must include a "code" string.' })
  }

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) {
    console.error('GROQ_API_KEY is not set')
    return res.status(500).json({
      error: 'GROQ_API_KEY is not configured. Add it to your Vercel environment variables.',
    })
  }

  try {
    console.log('Calling fetchGroqJson...')
    const parsed = await fetchGroqJson({
      groqApiKey,
      systemContent: improvePrompt,
      userContent: `Improve and optimize this code:\n\n${code}`,
    })
    console.log('Improvement successful')
    return res.status(200).json(toImproveShape(parsed))
  } catch (error) {
    console.error('Error in /api/improve:', error)
    return res.status(502).json({ error: error.message || 'Unexpected server error.' })
  }
}
