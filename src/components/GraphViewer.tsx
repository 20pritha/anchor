"use client";

import { useMemo, useRef, useState } from "react";
import type { GraphNode, GraphEdge } from "@/lib/types";

const NODE_COLORS: Record<string, string> = {
  User: "var(--node-user)",
  Person: "var(--node-person)",
  Medication: "var(--node-medication)",
  Routine: "var(--node-routine)",
  Place: "var(--node-place)",
  Object: "var(--node-object)",
  Episode: "var(--node-episode)",
};

const W = 900;
const H = 620;

interface Positioned {
  id: string;
  x: number;
  y: number;
  node: GraphNode;
}

/**
 * A tiny deterministic force-directed layout — repulsion between all nodes,
 * spring attraction along edges, centering gravity — run to convergence once,
 * then rendered as static SVG. Dependency-free (no d3 / cytoscape) so it can't
 * pull a CDN or bloat the bundle. Node counts here are small (tens), so the
 * O(n²·iterations) cost is trivial.
 */
function layout(nodes: GraphNode[], edges: GraphEdge[]): Positioned[] {
  const n = nodes.length;
  if (n === 0) return [];

  const pos = nodes.map((node, i) => {
    const a = (i / n) * Math.PI * 2;
    return {
      id: node.id,
      x: W / 2 + Math.cos(a) * W * 0.32,
      y: H / 2 + Math.sin(a) * H * 0.32,
      vx: 0,
      vy: 0,
      node,
    };
  });
  const index = new Map(pos.map((p, i) => [p.id, i]));

  const k = Math.sqrt((W * H) / n) * 0.55; // ideal edge length
  const iterations = 320;

  for (let it = 0; it < iterations; it++) {
    const temp = 1 - it / iterations; // cooling

    // Repulsion (all pairs)
    for (let i = 0; i < n; i++) {
      const pi = pos[i]!;
      for (let j = i + 1; j < n; j++) {
        const pj = pos[j]!;
        let dx = pi.x - pj.x;
        let dy = pi.y - pj.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        if (dist < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          dist = 0.01;
        }
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        pi.vx += fx;
        pi.vy += fy;
        pj.vx -= fx;
        pj.vy -= fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const ai = index.get(edge.source);
      const bi = index.get(edge.target);
      if (ai === undefined || bi === undefined) continue;
      const a = pos[ai]!;
      const b = pos[bi]!;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const dist = Math.hypot(dx, dy) || 0.01;
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }

    // Integrate with centering gravity + cooling
    for (let i = 0; i < n; i++) {
      const p = pos[i]!;
      p.vx += (W / 2 - p.x) * 0.012;
      p.vy += (H / 2 - p.y) * 0.012;
      const speed = Math.hypot(p.vx, p.vy) || 0.01;
      const step = Math.min(speed, 30 * temp);
      p.x += (p.vx / speed) * step;
      p.y += (p.vy / speed) * step;
      p.vx *= 0.85;
      p.vy *= 0.85;
      p.x = Math.max(30, Math.min(W - 30, p.x));
      p.y = Math.max(30, Math.min(H - 30, p.y));
    }
  }

  return pos.map((p) => ({ id: p.id, x: p.x, y: p.y, node: p.node }));
}

export function GraphViewer({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const positioned = useMemo(() => layout(nodes, edges), [nodes, edges]);
  const posById = useMemo(() => new Map(positioned.map((p) => [p.id, p])), [positioned]);
  const [hovered, setHovered] = useState<string | null>(null);

  // Pan / zoom
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const types = useMemo(() => {
    const set = new Set(nodes.map((n) => n.type));
    return [...set];
  }, [nodes]);

  const connected = useMemo(() => {
    if (!hovered) return null;
    const ids = new Set<string>([hovered]);
    for (const e of edges) {
      if (e.source === hovered) ids.add(e.target);
      if (e.target === hovered) ids.add(e.source);
    }
    return ids;
  }, [hovered, edges]);

  if (nodes.length === 0) {
    return (
      <p className="py-10 text-center text-lg" style={{ color: "var(--md-on-surface-variant)" }}>
        The graph is empty. Seed data or add memories to see it here.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-2">
        {types.map((t) => (
          <span key={t} className="m3-chip">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: NODE_COLORS[t] ?? "var(--node-episode)" }}
            />
            {t}
          </span>
        ))}
      </div>

      <div
        className="m3-card overflow-hidden"
        style={{ background: "var(--md-surface-container)" }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full cursor-grab touch-none select-none active:cursor-grabbing"
          style={{ height: "min(70vh, 620px)" }}
          onWheel={(e) => {
            const factor = e.deltaY < 0 ? 1.12 : 0.89;
            setView((v) => ({ ...v, scale: Math.max(0.4, Math.min(3, v.scale * factor)) }));
          }}
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, y: e.clientY };
            (e.target as Element).setPointerCapture?.(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const dx = e.clientX - drag.current.x;
            const dy = e.clientY - drag.current.y;
            drag.current = { x: e.clientX, y: e.clientY };
            setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
        >
          <g transform={`translate(${view.x},${view.y}) scale(${view.scale})`}>
            {edges.map((e, i) => {
              const a = posById.get(e.source);
              const b = posById.get(e.target);
              if (!a || !b) return null;
              const dim = connected && !(connected.has(e.source) && connected.has(e.target));
              return (
                <line
                  key={`${e.source}-${e.type}-${e.target}-${i}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--md-outline)"
                  strokeWidth={connected && !dim ? 2.2 : 1.2}
                  strokeOpacity={dim ? 0.12 : 0.5}
                />
              );
            })}

            {positioned.map((p) => {
              const color = NODE_COLORS[p.node.type] ?? "var(--node-episode)";
              const isEpisode = p.node.type === "Episode";
              const r = isEpisode ? 7 : 11;
              const dim = connected && !connected.has(p.id);
              return (
                <g
                  key={p.id}
                  transform={`translate(${p.x},${p.y})`}
                  opacity={dim ? 0.25 : 1}
                  onPointerEnter={() => setHovered(p.id)}
                  onPointerLeave={() => setHovered((h) => (h === p.id ? null : h))}
                  style={{ cursor: "pointer" }}
                >
                  <circle r={r} fill={color} stroke="var(--md-surface)" strokeWidth={2} />
                  {(!isEpisode || hovered === p.id) && (
                    <text
                      x={0}
                      y={r + 14}
                      textAnchor="middle"
                      fontSize={13}
                      fontWeight={600}
                      fill="var(--md-on-surface)"
                      style={{ pointerEvents: "none" }}
                    >
                      {p.node.label.length > 22 ? `${p.node.label.slice(0, 21)}…` : p.node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="mt-2 flex items-center justify-between text-[0.85rem]" style={{ color: "var(--md-on-surface-variant)" }}>
        <span>
          {nodes.length} nodes · {edges.length} links
        </span>
        <span className="flex items-center gap-3">
          <span>Scroll to zoom · drag to pan</span>
          <button
            type="button"
            onClick={() => setView({ x: 0, y: 0, scale: 1 })}
            className="underline"
          >
            Reset view
          </button>
        </span>
      </div>
    </div>
  );
}
