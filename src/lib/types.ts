// Shared domain types for the memory store (Neo4j graph + ChromaDB vectors).
// See docs/05-koredb-schema.md for the original schema and docs/10 (B7) for
// the Routine time-representation fix applied here.

export interface Person {
  id: string;
  name: string;
  relationship: string; // e.g. "daughter", "doctor", "neighbor"
  notes?: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  schedule: string[]; // ["08:00", "20:00"] — 24h "HH:mm" times of day
  purpose: string;
}

export type Recurrence = "daily" | "weekdays" | "weekly" | "once";

export interface Routine {
  id: string;
  label: string;
  /** 24h "HH:mm" time of day — NOT a datetime. Combine with `recurrence` to find the next occurrence. */
  timeOfDay: string;
  recurrence: Recurrence;
  /** ISO weekday (1=Mon..7=Sun) list, only meaningful when recurrence === "weekly". */
  daysOfWeek?: number[];
}

export interface Place {
  id: string;
  label: string;
  type: string;
}

export interface ObjectEntity {
  id: string;
  label: string;
  usualLocation: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  preferences: Record<string, unknown>;
}

export type EpisodeSource =
  | "local_perception"
  | "cloud_perception"
  | "voice_note"
  | "caregiver_seed";

export type EpisodeNamespace =
  | "episodic/daily"
  | "episodic/people"
  | "episodic/objects"
  | "episodic/medical";

export interface Episode {
  id: string;
  text: string;
  timestamp: number; // epoch ms
  importance: number; // 0..1
  source: EpisodeSource;
  piiFiltered: boolean;
  namespace: EpisodeNamespace;
  entityRefs?: string[];
}

export interface GraphQueryResult {
  summary: string;
  raw?: Record<string, unknown>;
}

export interface EpisodicMatch {
  id: string;
  text: string;
  timestamp: number;
  distance: number | null;
  namespace: EpisodeNamespace;
}

export interface BlendedMemoryResult {
  graph?: GraphQueryResult;
  episodes: EpisodicMatch[];
  blendedContext: string;
}

export type MedicationPeriod = "morning" | "afternoon" | "evening" | "today";

export interface MedicationStatus {
  medications: Array<{ name: string; dose: string; schedule: string[] }>;
  recentEpisodes: EpisodicMatch[];
}

/** Channel-based routing decision (doc 10 B9/B15 — no LLM hop by default). */
export type RouteDecision = "memory" | "perception" | "cloud";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}
