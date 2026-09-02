import { useEffect, useRef, useState } from 'react';

// Minimal shape of the Web Speech API this hook actually uses — the DOM lib
// doesn't ship types for it, and pulling in a whole ambient-types package
// for four fields isn't worth it.
interface SpeechRecognitionResultLike {
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export interface SpeechToText {
  /** False on browsers with no Web Speech API (e.g. Firefox) — callers
   * should hide voice input entirely rather than show a button that can't
   * work. Also false in an insecure (non-HTTPS, non-localhost) context,
   * since most browsers refuse microphone access there. */
  supported: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
}

/**
 * Wraps the browser's SpeechRecognition API. Each call to `start()` begins a
 * fresh listening session; `onTranscriptChange` is called with the FULL
 * transcript recognized so far *in this session* every time it updates
 * (interim results included), not an incremental delta — callers that want
 * to preserve text typed before recording started should combine it with
 * whatever was there before `start()` was called.
 */
export function useSpeechToText(onTranscriptChange: (transcript: string) => void): SpeechToText {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptChangeRef = useRef(onTranscriptChange);
  onTranscriptChangeRef.current = onTranscriptChange;

  const Ctor = getSpeechRecognitionConstructor();
  const supported = Ctor !== null;

  useEffect(() => {
    return () => recognitionRef.current?.stop();
  }, []);

  const start = () => {
    if (!Ctor || listening) return;

    const recognition = new Ctor();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      onTranscriptChangeRef.current(transcript);
    };
    // A permission denial, an insecure context, or the browser giving up
    // after silence all surface here or via onend — either way, the UI
    // should fall back to the always-available text box, not get stuck
    // showing a "listening" state that never resolves.
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  return { supported, listening, start, stop };
}
