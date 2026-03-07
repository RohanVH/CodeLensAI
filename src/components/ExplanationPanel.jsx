import { useEffect, useMemo, useRef, useState } from 'react'

const WORD_REGEX = /\S+/g

const tokenize = (text) => {
  if (!text) return []

  const tokens = []
  let match = WORD_REGEX.exec(text)

  while (match) {
    tokens.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    })
    match = WORD_REGEX.exec(text)
  }

  return tokens
}

const buildSpeechSections = (data) => {
  const sections = [
    { key: 'summary', title: 'Summary', content: data?.summary ?? '' },
    { key: 'lineExplanation', title: 'Line by Line Explanation', content: data?.lineExplanation ?? '' },
    { key: 'commentsVersion', title: 'Generated Comments', content: data?.commentsVersion ?? '' },
    { key: 'timeComplexity', title: 'Time Complexity', content: data?.timeComplexity ?? '' },
    { key: 'spaceComplexity', title: 'Space Complexity', content: data?.spaceComplexity ?? '' },
    { key: 'complexityExplanation', title: 'Complexity Explanation', content: data?.complexityExplanation ?? '' },
  ].filter((section) => section.content)

  let runningOffset = 0

  return sections.map((section, index) => {
    const heading = `${section.title}. `
    const spokenText = `${heading}${section.content}`
    const start = runningOffset
    const end = start + spokenText.length
    runningOffset = end + (index < sections.length - 1 ? 2 : 0)

    return {
      ...section,
      spokenText,
      start,
      end,
      headingLength: heading.length,
      tokens: tokenize(section.content),
    }
  })
}

const ExplanationSection = ({ section, activeCharIndex, isSpeaking, registerWordRef }) => {
  const text = section.content ?? ''
  const tokens = section.tokens

  const activeLocalChar = activeCharIndex >= 0 ? activeCharIndex - section.start - section.headingLength : -1

  let cursor = 0
  const fragments = []

  tokens.forEach((token, index) => {
    const isActive =
      isSpeaking &&
      activeLocalChar >= token.start &&
      activeLocalChar < token.end

    if (token.start > cursor) {
      fragments.push(
        <span key={`${section.key}-text-${index}`}>{text.slice(cursor, token.start)}</span>
      )
    }

    fragments.push(
      <span
        key={`${section.key}-word-${index}`}
        className={isActive ? 'active-word' : undefined}
        ref={(node) => registerWordRef(section.key, index, node)}
      >
        {token.value}
      </span>
    )

    cursor = token.end
  })

  if (cursor < text.length) {
    fragments.push(<span key={`${section.key}-tail`}>{text.slice(cursor)}</span>)
  }

  return (
    <section className="explanation-section" id={`section-${section.key}`}>
      <h3>{section.title}</h3>
      <pre>{fragments.length ? fragments : text}</pre>
    </section>
  )
}

const ExplanationPanel = ({ data, loading, error }) => {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [activeCharIndex, setActiveCharIndex] = useState(-1)
  const activeWordRef = useRef(null)
  const cancelledRef = useRef(false)
  const boundarySeenRef = useRef(false)
  const fallbackTimerRef = useRef(null)
  const fallbackStartRef = useRef(null)
  const fallbackWordIndexRef = useRef(0)

  const speechSections = useMemo(() => buildSpeechSections(data), [data])

  const speechText = useMemo(
    () => speechSections.map((section) => section.spokenText).join('\n\n'),
    [speechSections]
  )
  const wordCharPositions = useMemo(() => {
    const positions = []
    speechSections.forEach((section) => {
      section.tokens.forEach((token) => {
        positions.push(section.start + section.headingLength + token.start)
      })
    })
    return positions
  }, [speechSections])

  const stopFallbackHighlight = () => {
    if (fallbackStartRef.current) {
      clearTimeout(fallbackStartRef.current)
      fallbackStartRef.current = null
    }
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current)
      fallbackTimerRef.current = null
    }
  }

  const startFallbackHighlight = (rate) => {
    stopFallbackHighlight()
    fallbackWordIndexRef.current = 0
    const words = wordCharPositions.length
    if (!words) return

    // Boundary events are preferred; fallback only starts if boundary doesn't arrive.
    fallbackStartRef.current = setTimeout(() => {
      if (boundarySeenRef.current) {
        stopFallbackHighlight()
        return
      }

      const stepMs = Math.max(260, Math.round((360 / Math.max(0.8, rate)) * 1.05))
      fallbackTimerRef.current = setInterval(() => {
        if (boundarySeenRef.current || cancelledRef.current) {
          stopFallbackHighlight()
          return
        }

        const idx = fallbackWordIndexRef.current
        if (idx >= wordCharPositions.length) {
          stopFallbackHighlight()
          return
        }

        setActiveCharIndex(wordCharPositions[idx])
        fallbackWordIndexRef.current += 1
      }, stepMs)
    }, 1200)
  }

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        cancelledRef.current = true
        window.speechSynthesis.cancel()
      }
      stopFallbackHighlight()
    }
  }, [])

  useEffect(() => {
    if (!data && typeof window !== 'undefined' && window.speechSynthesis) {
      cancelledRef.current = true
      window.speechSynthesis.cancel()
    }
    stopFallbackHighlight()
    setIsSpeaking(false)
    setActiveCharIndex(-1)
  }, [data])

  useEffect(() => {
    if (activeWordRef.current) {
      activeWordRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
  }, [activeCharIndex])

  const registerWordRef = (sectionKey, wordIndex, node) => {
    if (!node || activeCharIndex < 0) return

    const activeSection = speechSections.find((section) => activeCharIndex >= section.start && activeCharIndex < section.end)
    if (!activeSection || activeSection.key !== sectionKey) return

    const localChar = activeCharIndex - activeSection.start - activeSection.headingLength
    const token = activeSection.tokens[wordIndex]
    if (!token) return

    if (localChar >= token.start && localChar < token.end) {
      activeWordRef.current = node
    }
  }

  const speakExplanation = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSpeechError('Text-to-speech is not supported in this browser.')
      return
    }

    if (!speechText.trim()) {
      setSpeechError('No explanation text available to read.')
      return
    }

    setSpeechError('')
    cancelledRef.current = true
    boundarySeenRef.current = false
    stopFallbackHighlight()
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(speechText)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.lang = navigator.language || 'en-US'

    utterance.onstart = () => {
      cancelledRef.current = false
      setIsSpeaking(true)
      setActiveCharIndex(wordCharPositions[0] ?? 0)
      startFallbackHighlight(utterance.rate)
    }

    utterance.onboundary = (event) => {
      if (typeof event.charIndex === 'number') {
        boundarySeenRef.current = true
        setActiveCharIndex(event.charIndex)
      }
    }

    utterance.onend = () => {
      stopFallbackHighlight()
      setIsSpeaking(false)
      setActiveCharIndex(-1)
    }

    utterance.onerror = (event) => {
      stopFallbackHighlight()
      setIsSpeaking(false)
      setActiveCharIndex(-1)

      if (cancelledRef.current || event.error === 'interrupted') {
        return
      }

      if (event.error === 'not-allowed') {
        setSpeechError('Browser blocked audio. Click Listen again and allow speech permissions if prompted.')
        return
      }

      setSpeechError('Unable to play text-to-speech right now. Try Chrome or Edge for best support.')
    }

    setTimeout(() => {
      cancelledRef.current = false
      window.speechSynthesis.speak(utterance)
    }, 80)
  }

  const stopSpeaking = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      cancelledRef.current = true
      window.speechSynthesis.cancel()
    }
    stopFallbackHighlight()
    setIsSpeaking(false)
    setActiveCharIndex(-1)
  }

  if (loading && !data) {
    return (
      <div className="explanation-panel-state">
        <p>Analyzing your code...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="explanation-panel-state">
        <p>{error || 'Paste code and click "Explain Code" to view AI insights.'}</p>
      </div>
    )
  }

  return (
    <div className="explanation-panel-content">
      <div className="speech-actions">
        <button
          type="button"
          className="speaker-btn"
          onClick={isSpeaking ? stopSpeaking : speakExplanation}
          title={isSpeaking ? 'Stop reading explanation' : 'Read explanation aloud'}
        >
          <span aria-hidden="true">{isSpeaking ? '⏹' : '🔊'}</span>
          <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
        </button>
        {speechError ? <p className="speech-error">{speechError}</p> : null}
      </div>

      {error ? <p className="panel-inline-error">{error}</p> : null}

      {speechSections.map((section) => (
        <ExplanationSection
          key={section.key}
          section={section}
          activeCharIndex={activeCharIndex}
          isSpeaking={isSpeaking}
          registerWordRef={registerWordRef}
        />
      ))}
    </div>
  )
}

export default ExplanationPanel
