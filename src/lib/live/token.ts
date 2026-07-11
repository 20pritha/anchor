import { GoogleGenAI, Modality } from "@google/genai";
import { env } from "@/lib/config";

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set — the cloud path is unavailable.");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return client;
}

export interface EphemeralLiveToken {
  token: string;
  model: string;
}

/**
 * Mints a short-lived Gemini Live auth token server-side so the browser can
 * open the Live WebSocket directly without ever seeing GEMINI_API_KEY (doc 10
 * B3 — the browser holds the camera/mic, the server holds the key; an
 * ephemeral token is the bridge between them).
 */
export async function createEphemeralLiveToken(systemInstruction: string): Promise<EphemeralLiveToken> {
  const ai = getClient();
  const authToken = await ai.authTokens.create({
    config: {
      uses: 1,
      newSessionExpireTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      liveConnectConstraints: {
        model: env.GEMINI_LIVE_MODEL,
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction,
        },
      },
    },
  });

  if (!authToken.name) {
    throw new Error("Gemini did not return an auth token name.");
  }

  return { token: authToken.name, model: env.GEMINI_LIVE_MODEL };
}
