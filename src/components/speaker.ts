let buffer = "";

function speakSentence(sentence: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  // A NEW utterance per sentence, not a shared one — reusing one utterance
  // across speak() calls on raw stream chunks splits mid-word and overlaps
  // (doc 10 B6).
  const utterance = new SpeechSynthesisUtterance(sentence);
  window.speechSynthesis.speak(utterance);
}

/**
 * Buffers streamed text deltas and speaks each complete sentence as soon as
 * it arrives, instead of waiting for the full response (doc 06's
 * "stream incrementally" recommendation, done correctly per doc 10 B6).
 */
export function pushDelta(delta: string): void {
  buffer += delta;
  const parts = buffer.split(/(?<=[.!?])\s+/);
  buffer = parts.pop() ?? "";
  for (const sentence of parts) {
    const trimmed = sentence.trim();
    if (trimmed) speakSentence(trimmed);
  }
}

/** Speak any trailing partial sentence once the stream has ended. */
export function flush(): void {
  const trailing = buffer.trim();
  buffer = "";
  if (trailing) speakSentence(trailing);
}

/** Stop any in-flight speech and drop buffered text (e.g. on new user input). */
export function cancelSpeech(): void {
  buffer = "";
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
