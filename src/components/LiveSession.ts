import { GoogleGenAI, Modality, type Session, type LiveServerMessage, type FunctionCall } from "@google/genai";
import { liveFunctionDeclarations } from "@/lib/live/declarations";

export interface LiveSessionCallbacks {
  onTextDelta: (text: string) => void;
  onTurnComplete?: () => void;
  onError: (message: string) => void;
  onClose?: () => void;
}

async function fetchLiveToken(): Promise<{ token: string; model: string }> {
  const res = await fetch("/api/live-token", { method: "POST" });
  const body = await res.json().catch(() => ({}) as { token?: string; model?: string; error?: string });
  if (!res.ok || !body.token || !body.model) {
    throw new Error(body.error ?? `Failed to mint Live token (HTTP ${res.status})`);
  }
  return { token: body.token, model: body.model };
}

async function executeToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  const res = await fetch("/api/live-tool-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, args }),
  });
  const body = await res.json().catch(() => ({}) as { response?: unknown; error?: string });
  if (!res.ok) throw new Error(body.error ?? "Tool call failed");
  return body.response;
}

/**
 * Browser-side Gemini Live client (doc 10 B3): the server only ever mints a
 * short-lived token via POST /api/live-token — the real GEMINI_API_KEY never
 * reaches the browser. Tool calls the model makes are forwarded to
 * POST /api/live-tool-call so the cloud path stays grounded in local memory
 * (doc 02 Pipeline B).
 */
export class LiveSession {
  private session: Session | null = null;

  constructor(private callbacks: LiveSessionCallbacks) {}

  async start(): Promise<void> {
    const { token, model } = await fetchLiveToken();
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });

    this.session = await ai.live.connect({
      model,
      callbacks: {
        onmessage: (message: LiveServerMessage) => this.handleMessage(message),
        onerror: (event) => this.callbacks.onError(event.message || "Live session error"),
        onclose: () => this.callbacks.onClose?.(),
      },
      config: {
        responseModalities: [Modality.TEXT],
        tools: [{ functionDeclarations: liveFunctionDeclarations }],
      },
    });
  }

  private handleMessage(message: LiveServerMessage): void {
    if (message.text) {
      this.callbacks.onTextDelta(message.text);
    }
    if (message.serverContent?.turnComplete) {
      this.callbacks.onTurnComplete?.();
    }
    const calls = message.toolCall?.functionCalls;
    if (calls && calls.length > 0) {
      void this.handleToolCalls(calls);
    }
  }

  private async handleToolCalls(calls: FunctionCall[]): Promise<void> {
    if (!this.session) return;
    const functionResponses = await Promise.all(
      calls.map(async (call) => {
        try {
          const response = await executeToolCall(call.name ?? "", call.args ?? {});
          return { id: call.id, name: call.name, response: { output: response } };
        } catch (err) {
          return {
            id: call.id,
            name: call.name,
            response: { error: err instanceof Error ? err.message : "Tool call failed" },
          };
        }
      }),
    );
    this.session.sendToolResponse({ functionResponses });
  }

  sendText(text: string): void {
    this.session?.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }] });
  }

  sendVideoFrame(base64Jpeg: string): void {
    this.session?.sendRealtimeInput({ video: { data: base64Jpeg, mimeType: "image/jpeg" } });
  }

  stop(): void {
    this.session?.close();
    this.session = null;
  }
}
