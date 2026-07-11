import { seedDemoData } from "@/lib/seed";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const summary = await seedDemoData();
    return Response.json({ ok: true, summary });
  } catch (err) {
    console.error("[api/seed] failed:", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Seeding failed" },
      { status: 500 },
    );
  }
}
