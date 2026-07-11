"use client";

import { useState } from "react";
import { MicButton } from "@/components/MicButton";
import { CameraButton } from "@/components/CameraButton";
import { pushDelta, flush, cancelSpeech } from "@/components/speaker";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

let nextId = 0;
function newId(): string {
  nextId += 1;
  return `msg-${nextId}`;
}

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

  function appendMessage(role: Message["role"], text: string): string {
    const id = newId();
    setMessages((prev) => [...prev, { id, role, text }]);
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

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
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
      const message = err instanceof Error ? err.message : "Something went wrong.";
      appendMessage("assistant", message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex h-screen max-w-2xl flex-col p-4">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Anchor</h1>
        <p className="text-sm text-neutral-500">Your memory companion</p>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {messages.length === 0 && (
          <p className="text-sm text-neutral-400">
            Ask me things like &ldquo;Did I take my morning pills?&rdquo; or &ldquo;Where are my keys?&rdquo;
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
            }`}
          >
            {m.text || "…"}
          </div>
        ))}
      </div>

      <div className="mb-3">
        <CameraButton
          onAssistantMessage={(text) => {
            appendMessage("assistant", text);
            speakFullText(text);
          }}
          disabled={busy}
        />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSend(input);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a question…"
          disabled={busy}
          className="flex-1 rounded-full border border-neutral-300 px-4 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <MicButton onTranscript={(text) => void handleSend(text)} disabled={busy} />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          Send
        </button>
      </form>
    </div>
  );
}
