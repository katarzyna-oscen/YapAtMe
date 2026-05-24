import { useState, useRef, useEffect, useCallback } from 'react'

export function useVoiceDictation() {
  const SR = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null

  const [isListening,  setIsListening]  = useState(false)
  const [transcript,   setTranscript]   = useState('')
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
    rec.interimResults = false
    rec.lang           = 'en-US'

    rec.onresult = (event) => {
      const segment = Array.from(event.results)
        .slice(event.resultIndex)
        .filter(r => r.isFinal)
        .map(r => r[0].transcript.trim())
        .join(' ')
      if (segment) {
        setTranscript(prev => prev ? prev + ' ' + segment : segment)
      }
    }

    rec.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    rec.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }, [SR, isListening])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
  }, [])

  return { isListening, isSupported, start, stop, transcript, reset }
}
