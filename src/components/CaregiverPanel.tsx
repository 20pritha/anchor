"use client";

import { useState } from "react";

type Kind = "person" | "medication" | "routine" | "place" | "object";

const KIND_LABELS: Record<Kind, string> = {
  person: "Person",
  medication: "Medication",
  routine: "Routine",
  place: "Place",
  object: "Object",
};

interface FormState {
  name: string;
  relationship: string;
  notes: string;
  dose: string;
  schedule: string;
  purpose: string;
  label: string;
  timeOfDay: string;
  recurrence: "daily" | "weekdays" | "weekly" | "once";
  type: string;
  usualLocation: string;
  placeId: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  relationship: "",
  notes: "",
  dose: "",
  schedule: "",
  purpose: "",
  label: "",
  timeOfDay: "",
  recurrence: "daily",
  type: "",
  usualLocation: "",
  placeId: "",
};

/**
 * Caregiver seeding/editing screen (doc 01 — the secondary user seeds
 * routines, medication schedules, and important people). Writes directly to
 * Neo4j via POST /api/caregiver.
 */
export function CaregiverPanel() {
  const [kind, setKind] = useState<Kind>("person");
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload(): Record<string, unknown> | null {
    switch (kind) {
      case "person":
        if (!form.name || !form.relationship) return null;
        return { kind, name: form.name, relationship: form.relationship, notes: form.notes || undefined };
      case "medication":
        if (!form.name || !form.dose || !form.schedule || !form.purpose) return null;
        return {
          kind,
          name: form.name,
          dose: form.dose,
          schedule: form.schedule.split(",").map((s) => s.trim()).filter(Boolean),
          purpose: form.purpose,
        };
      case "routine":
        if (!form.label || !form.timeOfDay) return null;
        return { kind, label: form.label, timeOfDay: form.timeOfDay, recurrence: form.recurrence };
      case "place":
        if (!form.label || !form.type) return null;
        return { kind, label: form.label, type: form.type };
      case "object":
        if (!form.label || !form.usualLocation) return null;
        return { kind, label: form.label, usualLocation: form.usualLocation, placeId: form.placeId || undefined };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      setStatus({ ok: false, message: "Please fill in the required fields." });
      return;
    }

    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/caregiver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? "Save failed");
      setStatus({ ok: true, message: `${KIND_LABELS[kind]} saved.` });
      setForm(INITIAL_FORM);
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-3">
      <header>
        <h1 className="text-2xl font-bold">Caregiver</h1>
        <p className="text-[0.95rem]" style={{ color: "var(--md-on-surface-variant)" }}>
          Seed or edit the people, medications, routines, places, and objects Anchor remembers.
        </p>
      </header>

      <label className="flex flex-col gap-1 text-[0.95rem] font-medium">
        Kind
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          className="m3-field"
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {kind === "person" && (
        <>
          <TextField label="Name" value={form.name} onChange={(v) => update("name", v)} />
          <TextField
            label="Relationship"
            value={form.relationship}
            onChange={(v) => update("relationship", v)}
            placeholder="daughter, doctor, neighbor…"
          />
          <TextField label="Notes (optional)" value={form.notes} onChange={(v) => update("notes", v)} />
        </>
      )}

      {kind === "medication" && (
        <>
          <TextField label="Name" value={form.name} onChange={(v) => update("name", v)} />
          <TextField label="Dose" value={form.dose} onChange={(v) => update("dose", v)} placeholder="5mg" />
          <TextField
            label="Schedule (comma-separated, HH:mm)"
            value={form.schedule}
            onChange={(v) => update("schedule", v)}
            placeholder="08:00, 20:00"
          />
          <TextField label="Purpose" value={form.purpose} onChange={(v) => update("purpose", v)} />
        </>
      )}

      {kind === "routine" && (
        <>
          <TextField label="Label" value={form.label} onChange={(v) => update("label", v)} placeholder="Morning walk" />
          <TextField
            label="Time of day (HH:mm)"
            value={form.timeOfDay}
            onChange={(v) => update("timeOfDay", v)}
            placeholder="07:00"
          />
          <label className="flex flex-col gap-1 text-[0.95rem] font-medium">
            Recurrence
            <select
              value={form.recurrence}
              onChange={(e) => update("recurrence", e.target.value as FormState["recurrence"])}
              className="m3-field"
            >
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
              <option value="once">Once</option>
            </select>
          </label>
        </>
      )}

      {kind === "place" && (
        <>
          <TextField label="Label" value={form.label} onChange={(v) => update("label", v)} placeholder="Home" />
          <TextField label="Type" value={form.type} onChange={(v) => update("type", v)} placeholder="residence" />
        </>
      )}

      {kind === "object" && (
        <>
          <TextField label="Label" value={form.label} onChange={(v) => update("label", v)} placeholder="House keys" />
          <TextField
            label="Usual location"
            value={form.usualLocation}
            onChange={(v) => update("usualLocation", v)}
            placeholder="kitchen drawer"
          />
          <TextField
            label="Place ID (optional)"
            value={form.placeId}
            onChange={(v) => update("placeId", v)}
          />
        </>
      )}

      <button type="submit" disabled={submitting} className="m3-btn m3-btn-filled mt-1 self-start">
        {submitting ? "Saving…" : "Save"}
      </button>

      {status && (
        <p
          className="text-[0.95rem] font-medium"
          style={{ color: status.ok ? "var(--md-success)" : "var(--md-error)" }}
        >
          {status.message}
        </p>
      )}
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[0.95rem] font-medium">
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="m3-field"
      />
    </label>
  );
}
