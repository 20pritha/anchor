"use client";

import { useEffect, useRef, useState } from "react";

export interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

function getSpeechRecognitionCtor(): typeof SpeechRecognition | undefined {
  if (typeof window === "undefined") return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

/**
 * Push-to-talk voice input via the browser's SpeechRecognition API.
 *
 * Chrome's SpeechRecognition sends audio to a cloud service by default; true
 * offline operation requires explicitly requesting on-device processing plus
 * a one-time language-pack download (Chrome 139+, desktop-only) — that mode
 * switch isn't yet part of the standard `SpeechRecognition` type, so it's a
 * Mac-side configuration step (doc 10 corrections to fold back into 02/03/06)
 * rather than something coded here. Falls back to a disabled state with a
 * text-input hint when the API isn't available at all (doc 10 G9).
 */
export function MicButton({ onTranscript, disabled }: MicButtonProps) {
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      // Feature detection needs `window`, so it can only run after mount —
      // starting from `supported: true` keeps the initial client render
      // consistent with SSR and corrects itself right after.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupported(false);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1]?.[0]?.transcript;
      if (transcript) onTranscript(transcript.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [onTranscript]);

  if (!supported) {
    return (
      <span className="text-xs text-neutral-500" title="Voice input isn't available in this browser">
        Voice unavailable — use text input
      </span>
    );
  }

  const toggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-pressed={listening}
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        listening ? "bg-red-600 text-white" : "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-50"
      }`}
    >
      {listening ? "Listening…" : "🎙 Speak"}
    </button>
  );
}
