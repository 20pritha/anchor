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

function dayLabel(ts: number): string {
  const startOfDay = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c.getTime();
  };
  const diffDays = Math.round((startOfDay(new Date()) - startOfDay(new Date(ts))) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Date(ts).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** Groups already-descending episodes into consecutive same-day pages. */
function groupByDay(episodes: RecentEpisode[]): Array<{ label: string; entries: RecentEpisode[] }> {
  const pages: Array<{ label: string; entries: RecentEpisode[] }> = [];
  for (const e of episodes) {
    const label = dayLabel(e.timestamp);
    const last = pages[pages.length - 1];
    if (last && last.label === label) last.entries.push(e);
    else pages.push({ label, entries: [e] });
  }
  return pages;
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

  const pages = episodes ? groupByDay(episodes) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-3">
      <header className="mb-3 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recent activity</h1>
          <p className="text-[0.95rem]" style={{ color: "var(--md-on-surface-variant)" }}>
            A notebook of the latest additions to Anchor&apos;s memory.
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
          Nothing written yet. Add a note on the Memory page.
        </p>
      )}

      {!loading && !error && pages.length > 0 && (
        <div className="flex flex-col gap-5">
          {pages.map((page) => (
            <section
              key={page.label}
              className="relative overflow-hidden rounded-2xl pl-14 pr-5 py-4"
              style={{
                background: "var(--md-surface-container-low)",
                border: "1px solid var(--md-outline-variant)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              }}
            >
              {/* Spiral-notebook binding, purely decorative */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-3 left-4 flex flex-col justify-evenly"
              >
                {Array.from({ length: 8 }).map((_, i) => (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-full"
                    style={{ border: "2px solid var(--md-outline)", background: "var(--md-surface)" }}
                  />
                ))}
              </div>
              {/* Margin rule, like a legal pad */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-10 w-px"
                style={{ background: "var(--node-medication)", opacity: 0.35 }}
              />

              <h2
                className="mb-2 text-lg font-bold"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {page.label}
              </h2>

              <ul className="flex flex-col">
                {page.entries.map((e, i) => (
                  <li
                    key={e.id}
                    className="py-2.5"
                    style={{
                      borderTop: i === 0 ? "none" : "1px dashed var(--md-outline-variant)",
                    }}
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[0.85rem] font-semibold" style={{ color: "var(--md-on-surface-variant)" }}>
                        {timeLabel(e.timestamp)}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[0.72rem] font-semibold"
                        style={{ background: "var(--md-secondary-container)", color: "var(--md-on-secondary-container)" }}
                      >
                        {SOURCE_LABELS[e.source] ?? e.source}
                      </span>
                    </div>
                    <p
                      className="mt-0.5 text-[1.05rem] leading-snug"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                    >
                      {e.text}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
