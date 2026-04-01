import { fetchGroqJson, setCorsHeaders, toImproveShape } from '../lib/utils.js'

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
  console.log('API HIT /api/improve')

  setCorsHeaders(res)

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { code } = body || {}

    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Request must include a non-empty "code" string.' })
    }

    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      console.error('GROQ_API_KEY is not set for /api/improve')
      return res.status(500).json({
        error: 'GROQ_API_KEY is not configured. Add it to your Vercel environment variables.',
      })
    }

    console.log('Calling Groq for /api/improve')
    const parsed = await fetchGroqJson({
      groqApiKey,
      systemContent: improvePrompt,
      userContent: `Improve and optimize this code:\n\n${code}`,
    })

    console.log('Groq response parsed for /api/improve')
    return res.status(200).json(toImproveShape(parsed))
  } catch (error) {
    console.error('Error in /api/improve:', error)

    if (error instanceof SyntaxError) {
      return res.status(400).json({ error: 'Request body must be valid JSON.' })
    }

    return res.status(502).json({
      error: error.message || 'Unexpected server error.',
    })
  }
}
