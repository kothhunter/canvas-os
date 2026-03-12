import { useState, useRef, useEffect, useCallback } from 'react'

export function useLiveTranscription() {
    const [transcript, setTranscript] = useState('')
    const [listening, setListening] = useState(false)
    const [browserSupportsSpeechRecognition, setBrowserSupports] = useState(true)
    const [error, setError] = useState('')
    const recognitionRef = useRef<any>(null)
    const finalTranscriptRef = useRef('') // Keep track of finalized sentences

    useEffect(() => {
        if (typeof window === 'undefined') return
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRec) {
            setBrowserSupports(false)
            return
        }

        const recognition = new SpeechRec()
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'

        recognition.onstart = () => {
            setListening(true)
            setError('')
        }

        recognition.onresult = (event: any) => {
            let interimTranscript = ''
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscriptRef.current += event.results[i][0].transcript + ' '
                } else {
                    interimTranscript += event.results[i][0].transcript
                }
            }
            setTranscript(finalTranscriptRef.current + interimTranscript)
        }

        recognition.onerror = (event: any) => {
            console.error('Speech recognition error', event.error)
            setError(event.error)
            setListening(false)
        }

        recognition.onend = () => {
            setListening(false)
        }

        recognitionRef.current = recognition
    }, []) // Empty dependency array ensures it only binds once, safely handling strict mode if refs are used cleanly

    const startListening = useCallback(() => {
        setError('')
        if (recognitionRef.current) {
            try {
                recognitionRef.current.start()
            } catch (err) {
                // Ignore "already started" errors
                console.error(err)
            }
        }
    }, [])

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
        }
    }, [])

    const resetTranscript = useCallback(() => {
        finalTranscriptRef.current = ''
        setTranscript('')
        setError('')
    }, [])

    return {
        transcript,
        listening,
        browserSupportsSpeechRecognition,
        error,
        startListening,
        stopListening,
        resetTranscript
    }
}
