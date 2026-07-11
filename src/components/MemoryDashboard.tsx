"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GraphViewer } from "@/components/GraphViewer";
import { UploadIcon } from "@/components/icons";
import type { GraphNode, GraphEdge } from "@/lib/types";

interface Status {
  ok: boolean;
  message: string;
}

export function MemoryDashboard() {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [graphLoading, setGraphLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    setGraphLoading(true);
    setGraphError(null);
    try {
      const res = await fetch("/api/graph");
      const body = (await res.json()) as { nodes?: GraphNode[]; edges?: GraphEdge[]; error?: string };
      if (!res.ok || !body.nodes) throw new Error(body.error ?? "Could not load the graph");
      setGraph({ nodes: body.nodes, edges: body.edges ?? [] });
    } catch (err) {
      setGraphError(err instanceof Error ? err.message : "Could not load the graph");
    } finally {
      setGraphLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch on mount; loadGraph flips loading state as it runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadGraph();
  }, [loadGraph]);

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
      void loadGraph();
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
    <div className="mx-auto max-w-4xl px-4 py-3">
      <header className="mb-3">
        <h1 className="text-2xl font-bold">Memory</h1>
        <p className="text-[0.95rem]" style={{ color: "var(--md-on-surface-variant)" }}>
          Add unstructured notes or upload a file, and explore the knowledge graph Anchor remembers.
        </p>
      </header>

      {/* Add to memory */}
      <section className="m3-card mb-4 p-4">
        <h2 className="mb-2 text-xl font-bold">Add to memory</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Type anything to remember — e.g. 'Ravi enjoys gardening on Sunday mornings and dislikes loud rooms.' Longer text is split into separate memories automatically."
          rows={4}
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

      {/* Knowledge graph */}
      <section className="m3-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xl font-bold">Knowledge graph</h2>
          <button type="button" onClick={() => void loadGraph()} className="m3-btn m3-btn-outlined px-4 py-1.5 text-[0.95rem]">
            Refresh
          </button>
        </div>
        {graphLoading && (
          <p className="py-10 text-center text-lg" style={{ color: "var(--md-on-surface-variant)" }}>
            Loading graph…
          </p>
        )}
        {graphError && (
          <p className="py-6 text-center text-[0.95rem]" style={{ color: "var(--md-error)" }}>
            {graphError}
          </p>
        )}
        {!graphLoading && !graphError && graph && (
          <GraphViewer nodes={graph.nodes} edges={graph.edges} />
        )}
      </section>
    </div>
  );
}
