import { useState, useRef, useEffect, useCallback } from 'react'

// A genuine pause (in ms) between finalized speech results that we treat as a
// sentence boundary. Chrome finalizes results often, even mid-sentence on tiny
// hesitations, so only longer gaps start a new sentence.
const SENTENCE_PAUSE_MS = 1200

// Capitalize the first alphabetic character of a string.
function upperFirst(text) {
  return String(text || '').replace(/[a-z]/, (letter) => letter.toUpperCase())
}

// Capitalize letters that follow sentence-ending punctuation that already
// exists inside the segment (does NOT touch the start of the segment).
function capitalizeAfterPunctuation(text) {
  return String(text || '').replace(
    /([.!?…]\s+)([a-z])/g,
    (_, lead, letter) => lead + letter.toUpperCase(),
  )
}

// Append a finalized segment to the running transcript with correct spacing,
// capitalization and sentence punctuation. Handles the case where the speech
// engine emits standalone punctuation chunks (auto-punctuation), which must
// attach to the previous word with no separating space (avoids "word .").
function appendSegment(prev, rawSegment, isNewSentence) {
  const seg = capitalizeAfterPunctuation(rawSegment)
  if (!prev) return upperFirst(seg)

  // Segment that begins with punctuation attaches directly, no leading space.
  if (/^[.,!?;:…]/.test(seg)) return `${prev}${seg}`

  const prevEndsSentence = /[.!?…]$/.test(prev)
  if (isNewSentence) {
    return `${prev}${prevEndsSentence ? '' : '.'} ${upperFirst(seg)}`
  }
  // If the engine already closed the previous sentence (auto-punctuation),
  // treat this segment as a fresh sentence start and capitalize it.
  return `${prev} ${prevEndsSentence ? upperFirst(seg) : seg}`
}

export function useVoiceDictation() {
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

  const [isListening,  setIsListening]  = useState(false)
  const [transcript,   setTranscript]   = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef(null)
  // Timestamp of the previous finalized segment, used to detect sentence pauses.
  const lastFinalTimeRef = useRef(0)

  const isSupported = Boolean(SR)

  // Clean up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      recognitionRef.current = null
    }
  }, [])

  const start = useCallback(() => {
    if (!SR || isListening) return

    const rec = new SR()
    rec.continuous     = true
    rec.interimResults = true
    rec.lang           = 'en-US'
    lastFinalTimeRef.current = 0

    rec.onresult = (event) => {
      let finalSegment = ''
      let interimSegment = ''

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i]
        const chunk = res?.[0]?.transcript?.trim() || ''
        if (!chunk) continue
        if (res.isFinal) {
          finalSegment = finalSegment ? `${finalSegment} ${chunk}` : chunk
        } else {
          interimSegment = interimSegment ? `${interimSegment} ${chunk}` : chunk
        }
      }

      if (finalSegment) {
        const now = Date.now()
        const gap = lastFinalTimeRef.current ? now - lastFinalTimeRef.current : Infinity
        const isNewSentence = gap >= SENTENCE_PAUSE_MS
        lastFinalTimeRef.current = now

        // The transcript only ever grows; each chunk carries its own leading
        // separator so consumers can append it verbatim with no extra spacing.
        setTranscript((prev) => appendSegment(prev, finalSegment, isNewSentence))
      }

      setInterimTranscript(interimSegment)
    }

    rec.onerror = () => {
      setIsListening(false)
      setInterimTranscript('')
      recognitionRef.current = null
    }

    rec.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
      recognitionRef.current = null
    }

    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }, [SR, isListening])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setInterimTranscript('')
    setIsListening(false)
    // Close the final sentence with a period if it lacks terminal punctuation.
    setTranscript((prev) => (prev && !/[.!?…]$/.test(prev) ? `${prev}.` : prev))
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
    lastFinalTimeRef.current = 0
  }, [])

  return { isListening, isSupported, start, stop, transcript, interimTranscript, reset }
}
