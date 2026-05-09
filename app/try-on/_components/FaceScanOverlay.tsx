"use client";
// FaceScanOverlay — intro scan animation shown the first time MediaPipe
// locks on a face. Progresses through three narrative stages so the user
// reads a clear "we're analyzing you" moment before layers come online.
//
// Stage timing (total ~2.6s):
//   detect   0.0s .. 0.8s   "Detecting face"
//   analyze  0.8s .. 1.8s   "Analyzing skin & structure"
//   match    1.8s .. 2.6s   "Matching your products"
//
// Parent is expected to call `onComplete(profile)` at the end. The overlay
// itself does not compute the profile; it just calls back with whatever the
// parent passes in via `profile`. This keeps the overlay presentational.

import { useEffect, useRef, useState } from "react";

type Stage = "detect" | "analyze" | "match" | "done";

const STAGE_ORDER: Stage[] = ["detect", "analyze", "match"];
const STAGE_MS: Record<Stage, number> = {
  detect: 800,
  analyze: 1000,
  match: 800,
  done: 0,
};
const STAGE_LABEL: Record<Exclude<Stage, "done">, string> = {
  detect: "Detecting face",
  analyze: "Analyzing skin & structure",
  match: "Matching your NURA products",
};

export default function FaceScanOverlay({
  visible,
  onComplete,
}: {
  visible: boolean;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<Stage>("detect");
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStage("detect");
    let cancelled = false;

    const tick = (idx: number) => {
      if (cancelled) return;
      if (idx >= STAGE_ORDER.length) {
        setStage("done");
        onComplete();
        return;
      }
      const s = STAGE_ORDER[idx];
      setStage(s);
      timerRef.current = window.setTimeout(
        () => tick(idx + 1),
        STAGE_MS[s]
      );
    };
    tick(0);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [visible, onComplete]);

  if (!visible || stage === "done") return null;

  const stageIdx = STAGE_ORDER.indexOf(stage);
  const pct = ((stageIdx + 1) / STAGE_ORDER.length) * 100;

  return (
    <div className="tryon-scan-overlay" role="status" aria-live="polite">
      {/* Animated radial mesh */}
      <svg
        className="tryon-scan-mesh"
        viewBox="0 0 200 240"
        aria-hidden
      >
        <defs>
          <linearGradient id="scanPulse" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(232, 195, 200, 0.85)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        {/* Outer oval */}
        <ellipse
          cx="100" cy="120" rx="72" ry="92"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.2"
          strokeDasharray="4 6"
        />
        {/* Inner oval */}
        <ellipse
          cx="100" cy="120" rx="60" ry="80"
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth="1"
        />
        {/* Corner brackets */}
        {[
          [28, 42, 1, 1], [172, 42, -1, 1],
          [28, 198, 1, -1], [172, 198, -1, -1],
        ].map(([x, y, sx, sy], i) => (
          <g key={i} transform={`translate(${x} ${y}) scale(${sx} ${sy})`}>
            <path
              d="M0 20 L0 0 L20 0"
              stroke="#fff"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* Horizontal pulse bar — runs top → bottom each cycle */}
        <rect
          className="tryon-scan-pulse"
          x="28" y="0" width="144" height="8"
          fill="url(#scanPulse)"
        />

        {/* Stage markers (three dots that fill as stages complete) */}
        {STAGE_ORDER.map((s, i) => (
          <circle
            key={s}
            cx={80 + i * 20}
            cy={228}
            r={i <= stageIdx ? 4 : 2.5}
            fill={i <= stageIdx ? "#f8eadf" : "rgba(255,255,255,0.35)"}
          />
        ))}
      </svg>

      <div className="tryon-scan-label">{STAGE_LABEL[stage]}</div>

      <div className="tryon-scan-progress" aria-hidden>
        <div
          className="tryon-scan-progress-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
