import { useEffect, useMemo, useRef, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from 'firebase/auth'
import CodeEditor from './components/CodeEditor'
import ExplanationPanel from './components/ExplanationPanel'
import AuthModal from './components/AuthModal'
import TourGuide from './components/TourGuide'
import GraphView from './components/GraphView'
import { detectProgramTitleApi, explainCode, improveCode } from './services/apiClient'
import { auth, googleProvider, githubProvider, hasFirebaseConfig } from './auth/firebase'
import { analyzeCodeStructure } from './analysis/codeAnalysis'
import { detectGithubUrl, fetchGithubFile, getGithubSourceMeta } from '../lib/githubFetcher.js'
import './App.css'

const btnStyles = {
  border: 'none',
  outline: 'none',
  background: 'none',
}

const starterCode = `indices = [i for i in range(len(lst)) if lst[i] == 'Alice']\nprint(indices)`

const tourSteps = [
  {
    id: 'program-title',
    title: 'Program Header',
    description: 'This one-line header summarizes what your pasted code appears to do.',
  },
  {
    id: 'editor-pane',
    title: 'Code Editor',
    description: 'Paste or write code here. The app detects language automatically as you type.',
  },
  {
    id: 'improve-btn',
    title: 'Improve Code',
    description: 'Generate an optimized version of your code with cleaner structure and better performance.',
  },
  {
    id: 'explain-btn',
    title: 'Explain Code',
    description: 'Generate summary, line-by-line explanation, comments, and complexity details.',
  },
  {
    id: 'detected-language',
    title: 'Language Detector',
    description: 'This updates live to show detected language from your current code.',
  },
]

const getInitialTheme = () => {
  const storedTheme = localStorage.getItem('codelens-theme')
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme
  return 'light'
}

const detectLanguage = (code) => {
  const text = code || ''
  const lower = text.toLowerCase()

  if (/^\s*#include\s*<|\bstd::|\busing\s+namespace\s+std\b|\bcout\s*<</m.test(text)) {
    return { label: 'C++', monaco: 'cpp' }
  }
  if (/^\s*package\s+main\b|\bfunc\s+main\s*\(|\bfmt\.print(ln|f)?\(/m.test(text)) {
    return { label: 'Go', monaco: 'go' }
  }
  if (/\bfn\s+main\s*\(|\bprintln!\s*\(|\blet\s+mut\b|\buse\s+std::/m.test(text)) {
    return { label: 'Rust', monaco: 'rust' }
  }
  if (/\bpublic\s+class\b|\bstatic\s+void\s+main\b|\bSystem\.out\.print(ln)?\(/m.test(text)) {
    return { label: 'Java', monaco: 'java' }
  }
  if (/\binterface\s+\w+\b|\btype\s+\w+\s*=|:\s*(string|number|boolean|any|unknown)\b|\bimplements\b/m.test(text)) {
    return { label: 'TypeScript', monaco: 'typescript' }
  }
  if (
    /\bdef\s+\w+\s*\(|\bprint\s*\(|\bimport\s+\w+|\bfrom\s+\w+\s+import\b|f"|f'|\[[^\]]+\bfor\b[^\]]+\bin\b[^\]]+\]/m.test(text) ||
    /\brange\s*\(len\(/m.test(text)
  ) {
    return { label: 'Python', monaco: 'python' }
  }
  if (/\bfunction\s+\w+\s*\(|=>|\bconsole\.log\s*\(|\bconst\s+|\blet\s+|\bvar\s+|\brequire\s*\(/m.test(text)) {
    return { label: 'JavaScript', monaco: 'javascript' }
  }
  if (/\bselect\b|\binsert\b|\bupdate\b|\bdelete\b/i.test(lower)) {
    return { label: 'SQL', monaco: 'sql' }
  }
  return { label: 'Plain Text', monaco: 'plaintext' }
}

const detectProgramTitleFallback = (code, languageLabel) => {
  const text = code || ''
  const lower = text.toLowerCase()

  if (/\bindices?\b/.test(lower) && /\brange\s*\(len\(/.test(lower) && /alice/.test(lower)) return "Find 'Alice' Indices"
  if (/\[[^\]]+\bfor\b[^\]]+\bif\b[^\]]+\]/.test(text)) return 'Filtered List Comprehension'
  if (/\bindices?\b/.test(lower) && /\bif\b/.test(lower)) return 'Conditional Index Finder'
  if (/two\s*sum/.test(lower)) return 'Two Sum Solver'
  if (/fibonacci/.test(lower)) return 'Fibonacci Generator'
  if (/binary\s*search/.test(lower)) return 'Binary Search Utility'
  if (/sort|quicksort|mergesort|bubble\s*sort/.test(lower)) return 'Sorting Routine'
  if (/\bhttp\b|fetch\(|axios|request/.test(lower)) return 'API Request Handler'
  if (/\blogin\b|\bauth\b|token/.test(lower)) return 'Authentication Flow'
  if (/\bprint\(|console\.log\(|System\.out\.print/.test(text)) return 'Console Output Flow'
  if (/(\badd\b|\baddition\b|\+)/.test(lower) && /(num|number|a\b|b\b|x\b|y\b)/.test(lower)) return 'Addition Program'

  return `${languageLabel} Code Snippet`
}

const buildGreeting = (name) => {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name}. Welcome to CodeLensAI.`
}

const getTourDoneKey = (uid) => `codelens_tour_done_${uid}`
const getTourPendingKey = (uid) => `codelens_tour_pending_${uid}`

function App() {
  const [code, setCode] = useState(starterCode)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [theme, setTheme] = useState(getInitialTheme)
  const [user, setUser] = useState(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [brandAnimKey, setBrandAnimKey] = useState(0)
  const [showTour, setShowTour] = useState(false)
  const [tourIndex, setTourIndex] = useState(0)
  const [tourRect, setTourRect] = useState(null)
  const [aiProgramTitle, setAiProgramTitle] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [githubSource, setGithubSource] = useState(null)
  const [currentPage, setCurrentPage] = useState('home')
  const [githubLinkInput, setGithubLinkInput] = useState('')
  const [githubLinkLoading, setGithubLinkLoading] = useState(false)
  const [githubLinkError, setGithubLinkError] = useState('')
  const [githubLinkStatus, setGithubLinkStatus] = useState('')
  const [githubLinkSource, setGithubLinkSource] = useState(null)
  const [githubLinkInsights, setGithubLinkInsights] = useState(null)
  const [githubLinkGraphs, setGithubLinkGraphs] = useState({
    error: '',
    callGraph: { nodes: [], edges: [] },
    dataFlow: { nodes: [], edges: [] },
  })
  const [githubLinkTab, setGithubLinkTab] = useState('insights')

  const titleRequestIdRef = useRef(0)

  const detected = useMemo(() => detectLanguage(code), [code])
  const fallbackProgramTitle = useMemo(() => detectProgramTitleFallback(code, detected.label), [code, detected.label])
  const programTitle = aiProgramTitle || fallbackProgramTitle
  const editorTheme = theme === 'dark' ? 'vs-dark' : 'vs'

  const speakGreeting = (name) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const utterance = new SpeechSynthesisUtterance(buildGreeting(name))
    utterance.rate = 0.94
    utterance.pitch = 0.88
    utterance.lang = navigator.language || 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  const triggerBrandIntro = (name) => {
    setBrandAnimKey((prev) => prev + 1)
    setTimeout(() => speakGreeting(name), 260)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('codelens-theme', theme)
  }, [theme])

  useEffect(() => {
    triggerBrandIntro('Developer')

    if (!hasFirebaseConfig || !auth) return undefined

    const unsub = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser)

      if (authUser) {
        triggerBrandIntro(authUser.displayName || 'Developer')

        const doneKey = getTourDoneKey(authUser.uid)
        const pendingKey = getTourPendingKey(authUser.uid)
        const pending = localStorage.getItem(pendingKey) === '1'
        const done = localStorage.getItem(doneKey) === '1'

        if (pending && !done) {
          setTourIndex(0)
          setShowTour(true)
        }
      }
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    if (!showTour) return undefined

    const updateRect = () => {
      const step = tourSteps[tourIndex]
      if (!step) return
      const el = document.querySelector(`[data-tour="${step.id}"]`)
      if (!el) {
        setTourRect(null)
        return
      }
      const rect = el.getBoundingClientRect()
      setTourRect(rect)
    }

    updateRect()
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [showTour, tourIndex, loading])

  useEffect(() => {
    const trimmed = code.trim()
    if (!trimmed) {
      setAiProgramTitle('')
      return undefined
    }

    if (/^https?:\/\/(www\.)?github\.com\//i.test(trimmed) || /^<!doctype html>|^<html/i.test(trimmed)) {
      setAiProgramTitle('')
      return undefined
    }

    const requestId = ++titleRequestIdRef.current
    const timeoutId = setTimeout(async () => {
      try {
        const payload = await detectProgramTitleApi(trimmed)
        if (titleRequestIdRef.current !== requestId) return
        setAiProgramTitle(payload?.title || '')
      } catch {
        if (titleRequestIdRef.current !== requestId) return
        setAiProgramTitle('')
      }
    }, 700)

    return () => clearTimeout(timeoutId)
  }, [code])

  const resolveInputCode = async (input, options = { injectIntoEditor: false }) => {
    const trimmed = (input || '').trim()

    if (!detectGithubUrl(trimmed)) {
      if (options.injectIntoEditor) {
        setGithubSource(null)
      }
      return input
    }

    setStatusMessage('GitHub file detected — fetching source code...')
    const sourceMeta = getGithubSourceMeta(trimmed)
    const fetchedCode = await fetchGithubFile(trimmed)

    if (options.injectIntoEditor) {
      setCode(fetchedCode)
      setGithubSource(sourceMeta)
    }

    return fetchedCode
  }

  const requestExplanation = async () => {
    if (!code.trim()) {
      setError('Please paste some code before running analysis.')
      return
    }

    setLoading(true)
    setError('')
    setStatusMessage('')

    try {
      const codeToAnalyze = await resolveInputCode(code, { injectIntoEditor: true })

      const data = await explainCode(codeToAnalyze)
      setResult(data)
      if (data.commentsVersion) setCode(data.commentsVersion)
    } catch (err) {
      setError(err.message || 'Something went wrong while analyzing code.')
    } finally {
      setStatusMessage('')
      setLoading(false)
    }
  }

  const requestImprovedCode = async () => {
    if (!code.trim()) {
      setError('Please paste some code before improving it.')
      return
    }

    setLoading(true)
    setError('')
    setStatusMessage('')

    try {
      const sourceCode = await resolveInputCode(code, { injectIntoEditor: true })
      const data = await improveCode(sourceCode)
      const updatedCode = data.improvedCode || sourceCode
      if (data.improvedCode) setCode(data.improvedCode)

      setResult((prev) => ({
        summary: data.summary || prev?.summary || '',
        lineExplanation: data.lineExplanation || prev?.lineExplanation || '',
        commentsVersion: data.improvedCode || prev?.commentsVersion || '',
        timeComplexity: data.timeComplexity || prev?.timeComplexity || '',
        spaceComplexity: data.spaceComplexity || prev?.spaceComplexity || '',
        complexityExplanation: data.complexityExplanation || prev?.complexityExplanation || '',
      }))
    } catch (err) {
      setError(err.message || 'Improve request failed. Please try again.')
    } finally {
      setStatusMessage('')
      setLoading(false)
    }
  }

  const runGithubLinkInsights = async () => {
    const link = githubLinkInput.trim()
    if (!link) {
      setGithubLinkError('Paste a GitHub file URL first.')
      return
    }

    if (!detectGithubUrl(link)) {
      setGithubLinkError('Invalid GitHub file link. Use a github.com/.../blob/... URL.')
      return
    }

    setGithubLinkLoading(true)
    setGithubLinkError('')
    setGithubLinkStatus('GitHub file detected — fetching source code...')
    setGithubLinkTab('insights')

    try {
      const sourceMeta = getGithubSourceMeta(link)
      const fetchedCode = await fetchGithubFile(link)
      const analysis = analyzeCodeStructure(fetchedCode)
      const [explainPayload, titlePayload] = await Promise.all([
        explainCode(fetchedCode),
        detectProgramTitleApi(fetchedCode).catch(() => ({ title: '' })),
      ])

      setGithubLinkSource(sourceMeta)
      setGithubLinkInsights({
        title: titlePayload?.title || detectProgramTitleFallback(fetchedCode, detectLanguage(fetchedCode).label),
        summary: explainPayload?.summary || '',
        lineExplanation: explainPayload?.lineExplanation || '',
        commentsVersion: explainPayload?.commentsVersion || '',
        timeComplexity: explainPayload?.timeComplexity || '',
        spaceComplexity: explainPayload?.spaceComplexity || '',
        complexityExplanation: explainPayload?.complexityExplanation || '',
      })
      setGithubLinkGraphs({
        error: analysis.error || '',
        callGraph: analysis.callGraph || { nodes: [], edges: [] },
        dataFlow: analysis.dataFlow || { nodes: [], edges: [] },
      })
      setGithubLinkStatus('')
    } catch (err) {
      setGithubLinkError(err.message || 'Unable to analyze GitHub link right now.')
      setGithubLinkStatus('')
    } finally {
      setGithubLinkLoading(false)
    }
  }

  const handleOAuthLogin = async (providerName) => {
    if (!hasFirebaseConfig || !auth) {
      setAuthError('OAuth is not configured. Add Firebase VITE_FIREBASE_* env values.')
      return
    }

    setAuthError('')
    setAuthLoading(true)

    try {
      const provider = providerName === 'github' ? githubProvider : googleProvider
      const credential = await signInWithPopup(auth, provider)
      const uid = credential?.user?.uid
      const isNewUser = credential?.additionalUserInfo?.isNewUser

      if (uid && isNewUser) {
        localStorage.setItem(getTourPendingKey(uid), '1')
      }

      setAuthModalOpen(false)
    } catch (err) {
      if (err?.code === 'auth/configuration-not-found') {
        setAuthError('OAuth provider is not enabled in Firebase Console. Enable Google/GitHub sign-in providers and try again.')
      } else if (err?.code === 'auth/unauthorized-domain') {
        setAuthError('This domain is not authorized in Firebase. Add localhost (or your domain) to Firebase Auth authorized domains.')
      } else if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        try {
          const provider = providerName === 'github' ? githubProvider : googleProvider
          await signInWithRedirect(auth, provider)
          return
        } catch (redirectErr) {
          setAuthError(redirectErr?.message || 'OAuth redirect sign-in failed.')
        }
      } else {
        setAuthError(err?.message || 'OAuth sign-in failed.')
      }
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    if (!auth) return
    await signOut(auth)
    setMenuOpen(false)
  }

  const endTour = () => {
    if (user?.uid) {
      localStorage.setItem(getTourDoneKey(user.uid), '1')
      localStorage.removeItem(getTourPendingKey(user.uid))
    }
    setShowTour(false)
  }

  const nextTourStep = () => {
    if (tourIndex >= tourSteps.length - 1) {
      endTour()
      return
    }
    setTourIndex((prev) => prev + 1)
  }

  const openAuth = () => {
    setAuthError('')
    setAuthModalOpen(true)
  }

  const initials = (user?.displayName || user?.email || 'U').slice(0, 1).toUpperCase()

  return (
    <main className="app-shell">
      <div className="bg-orb bg-orb-left" aria-hidden="true" />
      <div className="bg-orb bg-orb-right" aria-hidden="true" />

      <header className="app-header">
        <button type="button" className={`brand-lockup brand-home-btn brand-cinematic-${brandAnimKey % 2}`} onClick={() => setCurrentPage('home')}>
          <svg className="brand-logo" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="brandBg" x1="16" y1="12" x2="116" y2="112" gradientUnits="userSpaceOnUse">
                <stop stopColor="#0B1220" />
                <stop offset="1" stopColor="#1E293B" />
              </linearGradient>
              <linearGradient id="brandEdge" x1="24" y1="24" x2="104" y2="104" gradientUnits="userSpaceOnUse">
                <stop stopColor="#36E6A5" />
                <stop offset="1" stopColor="#1FA2FF" />
              </linearGradient>
            </defs>
            <rect x="10" y="10" width="108" height="108" rx="24" fill="url(#brandBg)" />
            <rect x="10" y="10" width="108" height="108" rx="24" stroke="url(#brandEdge)" strokeWidth="4" />
            <path d="M40 45L24 64L40 83" stroke="#7DD3FC" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M88 45L104 64L88 83" stroke="#7DD3FC" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M73 35L55 93" stroke="#36E6A5" strokeWidth="8" strokeLinecap="round" />
          </svg>
          <div>
            <h1>CodeLensAI</h1>
            <p>Read code faster with high-signal AI explanations and complexity insights.</p>
          </div>
        </button>

        <nav className="top-nav">
          <button type="button" onClick={() => setCurrentPage('home')}>Home</button>
          <button type="button" onClick={() => setCurrentPage('about')}>About</button>
          <button type="button" onClick={() => setCurrentPage('contact')}>Contact Us</button>
          <button type="button" onClick={() => setCurrentPage('profile')}>Profile</button>
        </nav>

        <div className="top-right-controls">
          <button type="button" className="theme-toggle" data-tour="theme-toggle" onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}>
            {theme === 'dark' ? '☀' : '🌙'}
          </button>

          {!user ? (
            <button type="button" className="auth-top-btn primary" onClick={openAuth}>Login</button>
          ) : (
            <div className="profile-menu-wrap">
              <button type="button" className="avatar-btn" onClick={() => setMenuOpen((prev) => !prev)}>
                {user.photoURL ? <img src={user.photoURL} alt="Profile" /> : <span>{initials}</span>}
              </button>
              {menuOpen ? (
                <div className="profile-menu">
                  <button type="button" onClick={() => setCurrentPage('profile')}>Profile</button>
                  <button type="button" onClick={handleLogout}>Logout</button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </header>

      {currentPage === 'home' ? (
        <>
          <section className="workspace-grid">
            <div className="pane editor-pane" data-tour="editor-pane">
              <div className="pane-topbar pane-topbar-centered">
                <h2 data-tour="program-title">{programTitle}</h2>
                <button type="button" data-tour="improve-btn" className="improve-btn" onClick={requestImprovedCode} disabled={loading}>
                  {loading ? 'Improving...' : 'Improve Code'}
                </button>
              </div>

              <CodeEditor code={code} onChange={setCode} language={detected.monaco} theme={editorTheme} />

              <div className="detected-language" data-tour="detected-language">Detected Language: {detected.label}</div>
              {githubSource ? (
                <div className="github-source-badge" title={githubSource.rawUrl}>
                  Fetched from GitHub: {githubSource.label}
                </div>
              ) : null}
            </div>

            <div className="pane result-pane">
              <div className="pane-topbar">
                <h2>Explanation Panel</h2>
                <button data-tour="explain-btn" onClick={requestExplanation} disabled={loading} className="primary-btn">
                  {loading ? 'Analyzing...' : 'Explain Code'}
                </button>
              </div>
              {statusMessage ? <p className="status-inline">{statusMessage}</p> : null}
              <ExplanationPanel data={result} loading={loading} error={error} />
            </div>
          </section>

          <section className="github-link-section">
            <div className="github-link-head">
              <h3>GitHub Link Insights</h3>
              <p>Paste a public GitHub file link and generate complete insights instantly.</p>
            </div>
            <div className="github-link-controls">
              <input
                type="text"
                className="github-link-input"
                placeholder="https://github.com/user/repo/blob/main/src/app.js"
                value={githubLinkInput}
                onChange={(event) => setGithubLinkInput(event.target.value)}
              />
              <button
                type="button"
                className="primary-btn"
                onClick={runGithubLinkInsights}
                disabled={githubLinkLoading}
              >
                {githubLinkLoading ? 'Fetching Insights...' : 'Get Insights'}
              </button>
            </div>

            {githubLinkStatus ? <p className="status-inline">{githubLinkStatus}</p> : null}
            {githubLinkError ? <p className="auth-inline-error">{githubLinkError}</p> : null}
            {githubLinkSource ? (
              <div className="github-source-badge" title={githubLinkSource?.rawUrl}>
                Fetched from GitHub: {githubLinkSource?.label}
              </div>
            ) : null}

            {githubLinkInsights ? (
              <div className="github-insights-panel">
                <h4>{githubLinkInsights.title || 'GitHub File Analysis'}</h4>
                <div className="result-tabs">
                  <button
                    type="button"
                    className={githubLinkTab === 'insights' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setGithubLinkTab('insights')}
                  >
                    Insights
                  </button>
                  <button
                    type="button"
                    className={githubLinkTab === 'call-graph' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setGithubLinkTab('call-graph')}
                  >
                    Call Graph
                  </button>
                  <button
                    type="button"
                    className={githubLinkTab === 'data-flow' ? 'tab-btn active' : 'tab-btn'}
                    onClick={() => setGithubLinkTab('data-flow')}
                  >
                    Data Flow
                  </button>
                </div>

                {githubLinkTab === 'insights' ? (
                  <div className="github-insights-grid">
                    <article className="insight-card"><h5>Summary</h5><pre>{githubLinkInsights.summary}</pre></article>
                    <article className="insight-card"><h5>Line by Line Explanation</h5><pre>{githubLinkInsights.lineExplanation}</pre></article>
                    <article className="insight-card"><h5>Generated Comments</h5><pre>{githubLinkInsights.commentsVersion}</pre></article>
                    <article className="insight-card"><h5>Time Complexity</h5><pre>{githubLinkInsights.timeComplexity}</pre></article>
                    <article className="insight-card"><h5>Space Complexity</h5><pre>{githubLinkInsights.spaceComplexity}</pre></article>
                    <article className="insight-card"><h5>Complexity Explanation</h5><pre>{githubLinkInsights.complexityExplanation}</pre></article>
                  </div>
                ) : null}

                {githubLinkTab === 'call-graph' ? (
                  <GraphView
                    title="Function Call Graph"
                    graph={githubLinkGraphs.callGraph}
                    emptyMessage={githubLinkGraphs.error || 'No function call relationships found in this file.'}
                  />
                ) : null}
                {githubLinkTab === 'data-flow' ? (
                  <GraphView
                    title="Variable Data Flow"
                    graph={githubLinkGraphs.dataFlow}
                    emptyMessage={githubLinkGraphs.error || 'No variable flow relationships found in this file.'}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      ) : null}

      {currentPage === 'about' ? (
        <section className="page-section">
          <h2>About CodeLensAI</h2>
          <p>CodeLensAI helps developers understand code faster with AI-generated explanations, commented versions, complexity analysis, and code structure graphs.</p>
          <div className="about-features">
            <article className="about-card"><h4>Code Understanding</h4><p>Get concise summaries and line-by-line explanations to reduce onboarding and review time.</p></article>
            <article className="about-card"><h4>Engineering Insights</h4><p>Analyze time and space complexity plus generated commented code for easier maintenance.</p></article>
            <article className="about-card"><h4>Structural Analysis</h4><p>Visualize function call graph and variable data flow for JavaScript/TypeScript codebases.</p></article>
          </div>
          <div className="faq-block">
            <details><summary>What problems does CodeLensAI solve?</summary><p>It helps developers quickly understand unfamiliar code and identify optimization opportunities.</p></details>
            <details><summary>Can I analyze GitHub files directly?</summary><p>Yes. Paste a public GitHub file link in the GitHub Insights section on Home.</p></details>
            <details><summary>Does it support multiple languages?</summary><p>Yes for explanation workflow. Call graph/data flow are currently optimized for JavaScript/TypeScript syntax.</p></details>
            <details><summary>Is login required?</summary><p>No for core usage, but login unlocks personalized profile-driven experience.</p></details>
          </div>
        </section>
      ) : null}

      {currentPage === 'contact' ? (
        <section className="page-section">
          <h2>Contact Us</h2>
          <p>Need support, enterprise plans, or integration help? Reach our team and we will get back quickly.</p>
          <div className="contact-grid">
            <article className="about-card"><h4>Email</h4><p>support@codelensai.dev</p></article>
            <article className="about-card"><h4>Response Time</h4><p>Usually within 24 hours on business days.</p></article>
            <article className="about-card"><h4>Use Cases</h4><p>Developer tools teams, code review automation, onboarding acceleration.</p></article>
          </div>
        </section>
      ) : null}

      {currentPage === 'profile' ? (
        <section className="page-section">
          <h2>Profile</h2>
          {user ? (
            <div className="profile-card">
              <p><strong>Name:</strong> {user.displayName || 'N/A'}</p>
              <p><strong>Email:</strong> {user.email || 'N/A'}</p>
              <button type="button" className="auth-top-btn" onClick={handleLogout}>Logout</button>
            </div>
          ) : (
            <p>Log in to view your profile details.</p>
          )}
        </section>
      ) : null}
      
      <footer className="site-footer">
        <button type="button" onClick={() => setCurrentPage('about')} style={btnStyles} ><span>About</span></button>
        <button type="button" onClick={() => setCurrentPage('contact')} style={btnStyles}><span>Contact Us</span></button>
        <span>CodeLensAI</span>
      </footer>

      
      {authError ? <p className="auth-inline-error">{authError}</p> : null}

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLogin={handleOAuthLogin}
        loading={authLoading}
      />

      <TourGuide
        show={showTour}
        step={showTour ? { ...tourSteps[tourIndex], index: tourIndex } : null}
        totalSteps={tourSteps.length}
        rect={tourRect}
        onNext={nextTourStep}
        onSkip={endTour}
      />
    </main>
  )
}

export default App
