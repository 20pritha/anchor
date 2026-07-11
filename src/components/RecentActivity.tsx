"use client";

import { useCallback, useEffect, useState } from "react";
import type { RecentEpisode } from "@/lib/types";

const SOURCE_LABELS: Record<string, string> = {
  caregiver_seed: "Seeded",
  note: "Note",
  upload: "Uploaded",
  voice_note: "Voice note",
  local_perception: "Camera",
  cloud_perception: "Live camera",
};

const SOURCE_TONE: Record<string, string> = {
  note: "var(--md-primary-container)",
  upload: "var(--md-tertiary-container)",
  voice_note: "var(--md-secondary-container)",
  local_perception: "var(--md-secondary-container)",
  cloud_perception: "var(--md-tertiary-container)",
};

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

export function RecentActivity() {
  const [episodes, setEpisodes] = useState<RecentEpisode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recent?limit=40");
      const body = (await res.json()) as { episodes?: RecentEpisode[]; error?: string };
      if (!res.ok || !body.episodes) throw new Error(body.error ?? "Could not load recent activity");
      setEpisodes(body.episodes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load recent activity");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch on mount; load flips loading state as it runs.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-3">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recent activity</h1>
          <p className="text-[0.95rem]" style={{ color: "var(--md-on-surface-variant)" }}>
            The latest additions and changes to Anchor&apos;s knowledge base.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="m3-btn m3-btn-outlined px-4 py-1.5 text-[0.95rem]">
          Refresh
        </button>
      </header>

      {loading && (
        <p className="py-10 text-center text-lg" style={{ color: "var(--md-on-surface-variant)" }}>
          Loading…
        </p>
      )}
      {error && (
        <p className="py-6 text-center text-[0.95rem]" style={{ color: "var(--md-error)" }}>
          {error}
        </p>
      )}

      {!loading && !error && episodes && episodes.length === 0 && (
        <p className="py-10 text-center text-lg" style={{ color: "var(--md-on-surface-variant)" }}>
          Nothing recorded yet. Add a note on the Memory page.
        </p>
      )}

      {!loading && !error && episodes && episodes.length > 0 && (
        <ol className="flex flex-col gap-2">
          {episodes.map((e) => (
            <li key={e.id} className="m3-card flex items-start gap-3 p-3">
              <span
                className="mt-0.5 shrink-0 rounded-full px-2.5 py-1 text-[0.8rem] font-semibold"
                style={{
                  background: SOURCE_TONE[e.source] ?? "var(--md-surface-container-high)",
                  color: "var(--md-on-surface)",
                }}
              >
                {SOURCE_LABELS[e.source] ?? e.source}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[1.05rem] leading-snug">{e.text}</p>
                <p className="mt-0.5 text-[0.8rem]" style={{ color: "var(--md-on-surface-variant)" }}>
                  {relativeTime(e.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
