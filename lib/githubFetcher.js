const githubFileCache = new Map()

const parseGithubFileUrl = (url) => {
  const trimmed = url.trim()
  const withoutHash = trimmed.split('#')[0]
  const withoutQuery = withoutHash.split('?')[0]
  const match = withoutQuery.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i)
  if (!match) return null

  const [, owner, repo, branch, filePath] = match
  return { owner, repo, branch, filePath }
}

export const detectGithubUrl = (input) => {
  if (!input || typeof input !== 'string') return false
  return /^https?:\/\/github\.com\/.+\/blob\/.+/i.test(input.trim())
}

export const convertGithubToRaw = (url) => {
  if (!detectGithubUrl(url)) {
    throw new Error('Invalid GitHub file URL format.')
  }

  const meta = parseGithubFileUrl(url)
  if (!meta) {
    throw new Error('Unsupported GitHub URL format. Expected github.com/.../blob/...')
  }

  const { owner, repo, branch, filePath } = meta
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`
}

export const getGithubSourceMeta = (url) => {
  const meta = parseGithubFileUrl(url)
  if (!meta) return null
  return {
    ...meta,
    rawUrl: convertGithubToRaw(url),
    label: `${meta.owner}/${meta.repo}:${meta.filePath}`,
  }
}

export const fetchGithubFile = async (url) => {
  const normalized = url.trim()

  if (githubFileCache.has(normalized)) {
    return githubFileCache.get(normalized)
  }

  const rawUrl = convertGithubToRaw(normalized)
  let response
  try {
    response = await fetch(rawUrl)
  } catch {
    throw new Error('Unable to fetch GitHub file. Make sure the repository is public.')
  }

  if (!response.ok) {
    throw new Error('Unable to fetch GitHub file. Make sure the repository is public.')
  }

  const text = await response.text()

  if (!text || !text.trim()) {
    throw new Error('Fetched GitHub file is empty.')
  }

  githubFileCache.set(normalized, text)
  return text
}
