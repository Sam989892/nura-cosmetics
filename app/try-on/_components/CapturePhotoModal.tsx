"use client";
// NURA — On-spot photo capture modal
// ───────────────────────────────────
// Opens the user's webcam in a self-contained overlay, lets them line up a
// shot (with mirror toggle + optional 3-2-1 countdown), then captures a
// single still that we hand back to the parent as a Blob.
//
// Privacy:
//   • The video stream lives only inside this component and is `.stop()`-ed
//     the moment the modal closes or the user accepts the capture.
//   • The captured frame becomes a blob URL on the client; no upload to
//     our servers ever happens. Identical guarantee to the file-upload
//     path (see /privacy §3).

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Receives the captured frame as a Blob (image/jpeg). */
  onCapture: (blob: Blob) => void;
};

type Stage = "idle" | "starting" | "live" | "countdown" | "preview" | "denied" | "error";

export default function CapturePhotoModal({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  // Front cameras feel right when mirrored ("selfie" preview); rear cameras
  // should not be mirrored. Auto-detect by facingMode.
  const [mirrored, setMirrored] = useState(true);
  const [countdownValue, setCountdownValue] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);
  // Multiple cameras (e.g. laptop has built-in + plugged-in webcam, phone
  // has front + rear) — let the user toggle.
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [hasMultiple, setHasMultiple] = useState(false);

  // ── Stream lifecycle ────────────────────────────────────────────────────
  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setErrorMsg("");
    setStage("starting");
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // play() can reject on iOS Safari if not user-gesture-triggered, but
        // the modal only opens via a tap so we should be inside that gesture.
        await videoRef.current.play().catch(() => {});
      }
      setStage("live");

      // Probe device count so we can show the flip-camera button only when
      // it's useful.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput");
        setHasMultiple(cams.length > 1);
      } catch {
        setHasMultiple(false);
      }
    } catch (err: unknown) {
      // NotAllowedError = permission denied; everything else = generic error.
      const name = (err as { name?: string })?.name ?? "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setStage("denied");
      } else {
        setErrorMsg(
          (err as { message?: string })?.message ?? "Could not start the camera."
        );
        setStage("error");
      }
    }
  }, [facingMode, stopStream]);

  // Open / close lifecycle.
  useEffect(() => {
    if (open) {
      void startStream();
    } else {
      stopStream();
      setStage("idle");
      setCountdownValue(0);
      previewBlobRef.current = null;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Re-start when the user flips camera.
  useEffect(() => {
    if (open && (stage === "live" || stage === "preview")) {
      void startStream();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  // Reflect facingMode in mirror default — front cameras mirror, rear don't.
  useEffect(() => {
    setMirrored(facingMode === "user");
  }, [facingMode]);

  // ── Capture a single frame ─────────────────────────────────────────────
  const grabFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    if (!video.videoWidth || !video.videoHeight) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // If the user is in mirrored preview (front camera), bake the flip into
    // the saved image so the photo matches what they saw. Otherwise the
    // saved photo would feel wrong-handed.
    if (mirrored) {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92)
    );
    if (!blob) return;

    previewBlobRef.current = blob;
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    setStage("preview");
    // Free the camera as soon as the user has their shot.  They can
    // re-start it by pressing "retake".
    stopStream();
  }, [mirrored, stopStream]);

  // ── Capture with optional countdown ─────────────────────────────────────
  const startCountdown = useCallback(() => {
    setStage("countdown");
    setCountdownValue(3);
  }, []);

  useEffect(() => {
    if (stage !== "countdown") return;
    if (countdownValue <= 0) {
      void grabFrame();
      return;
    }
    const t = window.setTimeout(() => setCountdownValue((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [stage, countdownValue, grabFrame]);

  // ── Action handlers ────────────────────────────────────────────────────
  const handleUse = () => {
    const blob = previewBlobRef.current;
    if (!blob) return;
    onCapture(blob);
    onClose();
  };

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    previewBlobRef.current = null;
    void startStream();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo for virtual try-on"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8, 6, 10, 0.78)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        zIndex: 9500,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          width: "min(720px, 100%)",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: "1px solid var(--nura-line, #eee)",
          }}
        >
          <div>
            <strong style={{ fontSize: "1.05rem" }}>Take a photo</strong>
            <div style={{ fontSize: "0.78rem", color: "var(--nura-mute, #777)" }}>
              Stays on your device · Never uploaded
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            style={{
              border: "none",
              background: "transparent",
              fontSize: "1.4rem",
              cursor: "pointer",
              padding: 6,
              lineHeight: 1,
              color: "#555",
            }}
          >
            ×
          </button>
        </header>

        {/* Stage */}
        <div
          style={{
            position: "relative",
            background: "#0a0810",
            aspectRatio: "4 / 5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {(stage === "live" || stage === "countdown" || stage === "starting") && (
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: mirrored ? "scaleX(-1)" : "none",
              }}
            />
          )}

          {stage === "preview" && previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Captured preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          )}

          {/* Camera-guide oval — helps the user position their face. */}
          {(stage === "live" || stage === "countdown") && (
            <svg
              viewBox="0 0 200 250"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                opacity: 0.55,
              }}
              aria-hidden
            >
              <ellipse
                cx="100"
                cy="115"
                rx="62"
                ry="86"
                fill="none"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="1.4"
                strokeDasharray="4 5"
              />
            </svg>
          )}

          {stage === "starting" && (
            <Overlay>
              <Spinner /> Starting camera…
            </Overlay>
          )}
          {stage === "denied" && (
            <Overlay>
              <strong>Camera access denied</strong>
              <p
                style={{
                  margin: "8px 0 14px 0",
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.78)",
                  maxWidth: 320,
                  textAlign: "center",
                }}
              >
                Allow camera access in your browser settings, then retry. If
                you&apos;d rather not, you can upload a saved photo instead.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => startStream()}>
                  Retry
                </button>
                <button className="btn btn-primary" onClick={onClose}>
                  Upload instead
                </button>
              </div>
            </Overlay>
          )}
          {stage === "error" && (
            <Overlay>
              <strong>Camera error</strong>
              <p
                style={{
                  margin: "8px 0 14px 0",
                  fontSize: "0.85rem",
                  color: "rgba(255,255,255,0.78)",
                  maxWidth: 320,
                  textAlign: "center",
                }}
              >
                {errorMsg}
              </p>
              <button className="btn btn-primary" onClick={() => startStream()}>
                Retry
              </button>
            </Overlay>
          )}

          {stage === "countdown" && countdownValue > 0 && (
            <div
              aria-live="polite"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: "8rem",
                fontWeight: 200,
                textShadow: "0 4px 24px rgba(0,0,0,0.5)",
                pointerEvents: "none",
              }}
            >
              {countdownValue}
            </div>
          )}

          {/* Hidden capture canvas — never displayed. */}
          <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden />
        </div>

        {/* Controls */}
        <div
          style={{
            padding: 16,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderTop: "1px solid var(--nura-line, #eee)",
            background: "#fff",
          }}
        >
          {stage === "live" && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setMirrored((m) => !m)}
                aria-pressed={mirrored}
                title="Mirror preview"
              >
                {mirrored ? "Mirrored" : "Not mirrored"}
              </button>
              {hasMultiple && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setFacingMode((m) => (m === "user" ? "environment" : "user"))
                  }
                  aria-label="Flip camera"
                >
                  Flip camera
                </button>
              )}
              <button
                type="button"
                onClick={() => void grabFrame()}
                aria-label="Capture photo now"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  border: "4px solid var(--nura-plum-deep, #4a1e3a)",
                  background: "#fff",
                  cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "var(--nura-plum-deep, #4a1e3a)",
                  }}
                />
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={startCountdown}
                title="Capture with a 3-second timer"
              >
                3s timer
              </button>
            </>
          )}

          {stage === "preview" && (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleRetake}
              >
                Retake
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUse}
              >
                Use this photo
              </button>
            </>
          )}
        </div>

        {/* Privacy note */}
        <p
          style={{
            margin: 0,
            padding: "10px 18px 14px 18px",
            fontSize: "0.75rem",
            color: "var(--nura-mute, #777)",
            textAlign: "center",
            background: "var(--nura-cream, #fbf7f3)",
          }}
        >
          Detection runs in your browser only. We do not send the image to
          our servers. See <a href="/privacy">privacy notice</a>.
        </p>
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#fff",
        background: "rgba(0,0,0,0.55)",
        padding: 16,
      }}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <>
      <style>{`@keyframes nura-cap-spin { to { transform: rotate(360deg) } }`}</style>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 18,
          height: 18,
          borderRadius: "50%",
          border: "2px solid rgba(255,255,255,0.3)",
          borderTopColor: "#fff",
          animation: "nura-cap-spin 0.8s linear infinite",
          marginRight: 8,
          verticalAlign: "middle",
        }}
      />
    </>
  );
}
