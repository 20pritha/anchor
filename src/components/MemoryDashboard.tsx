"use client";

import { useRef, useState } from "react";
import { UploadIcon } from "@/components/icons";

interface Status {
  ok: boolean;
  message: string;
}

export function MemoryDashboard() {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function ingest(text: string, source: "note" | "upload", title?: string) {
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source, title }),
      });
      const body = (await res.json()) as { ok?: boolean; stored?: number; total?: number; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Could not store the memory");
      setStatus({
        ok: true,
        message: `Stored ${body.stored} ${body.stored === 1 ? "memory" : "memories"}${
          body.total && body.total !== body.stored ? ` of ${body.total}` : ""
        }.`,
      });
      setNote("");
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Could not store the memory" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleFile(file: File) {
    const text = await file.text();
    if (!text.trim()) {
      setStatus({ ok: false, message: "That file looks empty." });
      return;
    }
    await ingest(text, "upload", file.name);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-3">
      <header className="mb-3">
        <h1 className="text-2xl font-bold">Memory</h1>
        <p className="text-[0.95rem]" style={{ color: "var(--md-on-surface-variant)" }}>
          Add unstructured notes or upload a file — Anchor splits it into memories automatically.
        </p>
      </header>

      <section className="m3-card p-4">
        <h2 className="mb-2 text-xl font-bold">Add to memory</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Type anything to remember — e.g. 'Ravi enjoys gardening on Sunday mornings and dislikes loud rooms.' Longer text is split into separate memories automatically."
          rows={5}
          className="m3-field resize-y"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={submitting || !note.trim()}
            onClick={() => void ingest(note, "note")}
            className="m3-btn m3-btn-filled"
          >
            {submitting ? "Saving…" : "Save note"}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={submitting}
            onClick={() => fileInputRef.current?.click()}
            className="m3-btn m3-btn-tonal"
          >
            <UploadIcon className="h-5 w-5" />
            Upload .txt / .md
          </button>

          {status && (
            <span
              className="text-[0.95rem] font-medium"
              style={{ color: status.ok ? "var(--md-success)" : "var(--md-error)" }}
            >
              {status.message}
            </span>
          )}
        </div>
        <p className="mt-2 text-[0.8rem]" style={{ color: "var(--md-on-surface-variant)" }}>
          Notes run through the same on-device PII filter and local embedding as everything else — nothing
          leaves this machine.
        </p>
      </section>

      <p className="mt-3 text-[0.9rem]" style={{ color: "var(--md-on-surface-variant)" }}>
        Want to see what Anchor remembers? Browse the timeline on{" "}
        <a href="/recent" className="font-semibold underline">
          Recent activity
        </a>{" "}
        or explore how it all connects on the{" "}
        <a href="/caregiver" className="font-semibold underline">
          Caregiver
        </a>{" "}
        page.
      </p>
    </div>
  );
}
