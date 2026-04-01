import { fetchGroqJson, toTitleShape, setCorsHeaders } from './utils.js'

const titlePrompt = `You are a code intent classifier.
Return strict JSON only with key:
- title: one short program title in 2 to 6 words.
Rules:
- Do not mention the language name unless absolutely necessary.
- Do not add punctuation at the end.
- Be specific to what the code does.
- No markdown, no extra keys.`

export default async function handler(req, res) {
  console.log('API HIT: /api/program-title')
  
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
      systemContent: titlePrompt,
      userContent: `Create a concise title for this code:\n\n${code}`,
    })
    console.log('Title detection successful')
    return res.status(200).json(toTitleShape(parsed))
  } catch (error) {
    console.error('Error in /api/program-title:', error)
    return res.status(502).json({ error: error.message || 'Unexpected server error.' })
  }
}
