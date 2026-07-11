"use client";

import { useEffect, useRef, useState } from "react";
import { LiveSession } from "@/components/LiveSession";
import { pushDelta, flush, cancelSpeech } from "@/components/speaker";

export interface CameraButtonProps {
  onAssistantMessage: (text: string) => void;
  disabled?: boolean;
}

const LIVE_FRAME_INTERVAL_MS = 1500;

/**
 * Camera trigger (doc 13 — trigger-based, never continuous). Two modes:
 * - Still frame: capture one frame, send to local Gemma vision via
 *   /api/perception (doc 02 Pipeline B: single frames stay local).
 * - Live: open a Gemini Live session (doc 10 B3 — ephemeral token minted
 *   server-side, browser holds the camera stream) and stream frames.
 */
export function CameraButton({ onAssistantMessage, disabled }: CameraButtonProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const liveSessionRef = useRef<LiveSession | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveTextRef = useRef("");

  const [cameraOn, setCameraOn] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      stopLive();
      stopCamera();
    };
  }, []);

  async function startCamera(): Promise<void> {
    if (streamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setCameraOn(true);
  }

  function stopCamera(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  }

  function captureFrameBase64(): string | null {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    return dataUrl.split(",")[1] ?? null;
  }

  async function handleStillFrame(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await startCamera();
      // Give the stream a beat to actually paint a frame before capturing.
      await new Promise((resolve) => setTimeout(resolve, 250));
      const base64 = captureFrameBase64();
      if (!base64) throw new Error("Could not capture a frame from the camera.");

      const res = await fetch("/api/perception", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: "image/jpeg" }),
      });
      const body = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok || !body.answer) throw new Error(body.error ?? "Perception request failed");

      onAssistantMessage(body.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Camera capture failed");
    } finally {
      setBusy(false);
    }
  }

  async function startLive(): Promise<void> {
    setError(null);
    setBusy(true);
    try {
      await startCamera();
      liveTextRef.current = "";
      cancelSpeech();

      const session = new LiveSession({
        onTextDelta: (delta) => {
          liveTextRef.current += delta;
          pushDelta(delta);
        },
        onTurnComplete: () => {
          flush();
          if (liveTextRef.current.trim()) onAssistantMessage(liveTextRef.current.trim());
          liveTextRef.current = "";
        },
        onError: (message) => setError(message),
        onClose: () => setLiveActive(false),
      });

      await session.start();
      liveSessionRef.current = session;
      session.sendText("What am I looking at, and is it mine?");

      frameIntervalRef.current = setInterval(() => {
        const base64 = captureFrameBase64();
        if (base64) liveSessionRef.current?.sendVideoFrame(base64);
      }, LIVE_FRAME_INTERVAL_MS);

      setLiveActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the live session");
      stopLive();
    } finally {
      setBusy(false);
    }
  }

  function stopLive(): void {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    liveSessionRef.current?.stop();
    liveSessionRef.current = null;
    setLiveActive(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <video ref={videoRef} muted playsInline className={cameraOn ? "w-40 rounded-lg" : "hidden"} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleStillFrame}
          disabled={disabled || busy || liveActive}
          className="rounded-full bg-neutral-200 px-4 py-2 text-sm font-medium text-neutral-900 transition-colors disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-50"
        >
          📷 What is this?
        </button>
        <button
          type="button"
          onClick={liveActive ? stopLive : startLive}
          disabled={disabled || busy}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            liveActive ? "bg-red-600 text-white" : "bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-neutral-50"
          }`}
        >
          {liveActive ? "⏹ Stop live" : "🔴 Start live"}
        </button>
        {cameraOn && !liveActive && (
          <button
            type="button"
            onClick={stopCamera}
            className="rounded-full px-3 py-2 text-xs text-neutral-500 underline"
          >
            Turn off camera
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
