"use client";

import { useEffect, useRef, useState } from "react";
import { MicButton } from "@/components/MicButton";
import { CameraButton } from "@/components/CameraButton";
import { SendIcon } from "@/components/icons";
import { pushDelta, flush, cancelSpeech } from "@/components/speaker";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

let nextId = 0;
function newId(): string {
  nextId += 1;
  return `msg-${nextId}`;
}

const SUGGESTIONS = [
  "Did I take my morning pills?",
  "Where are my keys?",
  "Who is coming today?",
  "What's on my schedule this week?",
];

/**
 * The main conversation surface: text/voice input, streamed answers spoken
 * incrementally, and the camera trigger. POST /api/agent responds either as
 * a streamed text body (the Gemma tool-calling path) or as JSON (the
 * deterministic fallback or an error) — distinguished by Content-Type since
 * both are valid outcomes of the same endpoint (doc 10 B2).
 */
export function ConversationView() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Cancel any in-flight request if the user navigates away mid-stream —
  // otherwise the reader loop keeps running (and speaking) after unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function appendMessage(role: Message["role"], text: string): string {
    const id = newId();
    setMessages((prev) => [...prev, { id, role, text, timestamp: Date.now() }]);
    return id;
  }

  function updateMessage(id: string, updater: (prev: string) => string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, text: updater(m.text) } : m)));
  }

  function speakFullText(text: string) {
    pushDelta(text);
    flush();
  }

  async function handleSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setBusy(true);
    cancelSpeech();
    appendMessage("user", trimmed);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const body = (await res.json()) as { answer?: string; error?: string };
        const answer = body.answer ?? body.error ?? "Something went wrong.";
        appendMessage("assistant", answer);
        speakFullText(answer);
        return;
      }

      if (!res.body) throw new Error("Empty response body");
      const assistantId = appendMessage("assistant", "");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        updateMessage(assistantId, (prev) => prev + chunk);
        pushDelta(chunk);
      }
      flush();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Something went wrong.";
      appendMessage("assistant", message);
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="mx-auto flex h-[calc(100vh-0px)] max-w-4xl flex-col px-4 pt-3 md:h-screen">
      <header className="mb-2 shrink-0">
        <h1 className="text-2xl font-bold">Chat</h1>
        <p className="text-[0.95rem]" style={{ color: "var(--md-on-surface-variant)" }}>
          Ask about your day, people, medications, or where things are.
        </p>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-2">
        {empty && (
          <div className="pt-4">
            <p className="mb-3 text-lg" style={{ color: "var(--md-on-surface-variant)" }}>
              Try asking:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void handleSend(s)}
                  disabled={busy}
                  className="m3-chip cursor-pointer hover:brightness-95 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex max-w-[75%] flex-col ${isUser ? "ml-auto items-end" : "mr-auto items-start"}`}>
              <span
                className="mb-0.5 px-1 text-[0.78rem] font-semibold"
                style={{ color: "var(--md-on-surface-variant)" }}
              >
                {isUser ? "You" : "Anchor"} ·{" "}
                {new Date(m.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
              </span>
              <div
                className={`rounded-2xl px-4 py-2.5 text-[1.1rem] leading-snug ${
                  isUser ? "rounded-br-md" : "rounded-bl-md"
                }`}
                style={
                  isUser
                    ? { background: "var(--md-primary)", color: "var(--md-on-primary)" }
                    : { background: "var(--md-surface-container-high)", color: "var(--md-on-surface)" }
                }
              >
                {m.text}
              </div>
            </div>
          );
        })}

        {/* Shown for the whole request round-trip, not just after the first
            chunk arrives — the up-to-15s local-model wait (item #5) happens
            entirely inside the pending fetch, before any message changes. */}
        {busy && messages[messages.length - 1]?.role === "user" && (
          <div className="mr-auto flex max-w-[75%] flex-col items-start">
            <span className="mb-0.5 px-1 text-[0.78rem] font-semibold" style={{ color: "var(--md-on-surface-variant)" }}>
              Anchor
            </span>
            <div
              className="rounded-2xl rounded-bl-md px-4 py-2.5"
              style={{ background: "var(--md-surface-container-high)", color: "var(--md-on-surface)" }}
            >
              <span className="inline-flex items-center gap-1 py-1" aria-label="Anchor is thinking">
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: "currentColor", animationDelay: "0ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: "currentColor", animationDelay: "150ms" }} />
                <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: "currentColor", animationDelay: "300ms" }} />
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 pb-2">
        <div className="mb-2">
          <CameraButton
            onAssistantMessage={(text, speak = true) => {
              appendMessage("assistant", text);
              if (speak) speakFullText(text);
            }}
            disabled={busy}
          />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend(input);
          }}
          className="flex items-center gap-2 rounded-full p-1.5"
          style={{ background: "var(--md-surface-container-high)" }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a question…"
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent px-3 text-[1.1rem] outline-none"
            style={{ color: "var(--md-on-surface)" }}
          />
          <MicButton onTranscript={(text) => void handleSend(text)} disabled={busy} />
          <button
            type="submit"
            disabled={busy}
            aria-label="Send"
            className="m3-btn m3-btn-filled px-4 py-2.5"
          >
            <SendIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
