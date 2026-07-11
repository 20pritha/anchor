import { createEphemeralLiveToken } from "@/lib/live/token";

export const runtime = "nodejs";

const CLOUD_PATH_SYSTEM = `You are Anchor, a calm memory companion looking through the user's camera. Ground your answers in the user's local memory using the available tools when relevant. Keep answers short, warm, and never clinical.`;

// Mints a short-lived Gemini Live token so the browser can connect directly
// to the Live API without ever receiving GEMINI_API_KEY (doc 10 B3).
export async function POST(): Promise<Response> {
  try {
    const { token, model } = await createEphemeralLiveToken(CLOUD_PATH_SYSTEM);
    return Response.json({ token, model });
  } catch (err) {
    console.error("[api/live-token] failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Could not mint a Live token" },
      { status: 503 },
    );
  }
}
