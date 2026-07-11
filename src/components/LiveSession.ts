import { GoogleGenAI, Modality, type Session, type LiveServerMessage, type FunctionCall } from "@google/genai";
import { liveFunctionDeclarations } from "@/lib/live/declarations";

export interface LiveSessionCallbacks {
  onTextDelta: (text: string) => void;
  onTurnComplete?: () => void;
  onError: (message: string) => void;
  onClose?: (reason?: string) => void;
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

  // Web Audio playback state for the model's streamed PCM audio.
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;

  async start(): Promise<void> {
    const { token, model } = await fetchLiveToken();
    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion: "v1alpha" } });

    this.session = await ai.live.connect({
      model,
      callbacks: {
        onmessage: (message: LiveServerMessage) => this.handleMessage(message),
        onerror: (event) => this.callbacks.onError(event.message || "Live session error"),
        onclose: (event) => this.callbacks.onClose?.(event?.reason),
      },
      config: {
        // AUDIO out (the only modality these models support) + transcription so
        // the UI still gets the words. Tools keep the cloud path grounded in
        // local memory.
        responseModalities: [Modality.AUDIO],
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: liveFunctionDeclarations }],
      },
    });
  }

  private handleMessage(message: LiveServerMessage): void {
    // Spoken words, as text, for the transcript bubble.
    const transcript = message.serverContent?.outputTranscription?.text;
    if (transcript) {
      this.callbacks.onTextDelta(transcript);
    }

    // Streamed PCM audio chunks — play them back in order.
    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) this.playPcmChunk(data);
    }

    if (message.serverContent?.turnComplete) {
      this.callbacks.onTurnComplete?.();
    }

    const calls = message.toolCall?.functionCalls;
    if (calls && calls.length > 0) {
      void this.handleToolCalls(calls);
    }
  }

  /**
   * Decodes a base64 PCM16 mono chunk (24 kHz, as produced by the native-audio
   * Live models) and schedules it to play immediately after whatever is already
   * queued, so consecutive chunks form gapless speech.
   */
  private playPcmChunk(base64: string): void {
    if (typeof window === "undefined") return;
    if (!this.audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new Ctor();
      this.nextStartTime = this.audioCtx.currentTime;
    }
    const ctx = this.audioCtx;
    void ctx.resume();

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i]! / 32768;

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.getChannelData(0).set(float32);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const start = Math.max(ctx.currentTime, this.nextStartTime);
    source.start(start);
    this.nextStartTime = start + buffer.duration;
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
    void this.audioCtx?.close();
    this.audioCtx = null;
    this.nextStartTime = 0;
  }
}
