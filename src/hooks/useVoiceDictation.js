import { useState, useRef, useEffect, useCallback } from 'react'

export function useVoiceDictation() {
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

  const [isListening,  setIsListening]  = useState(false)
  const [transcript,   setTranscript]   = useState('')
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef(null)

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
        setTranscript((prev) => (prev ? `${prev} ${finalSegment}` : finalSegment))
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
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setInterimTranscript('')
  }, [])

  return { isListening, isSupported, start, stop, transcript, interimTranscript, reset }
}
