"use client";

import { useNow, formatDuration } from "@/components/ui/Countdown";

/** Ring that fills across the draw period; pulses when the draw is ready. */
export function RadialCountdown({ start, end, drawing, size = 132 }: { start: number; end: number; drawing?: boolean; size?: number }) {
  const now = useNow();
  const total = Math.max(1, end - start);
  const p = Math.max(0, Math.min(1, (now - start) / total));
  const due = now >= end;
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={drawing ? "#5EEAD4" : due ? "#FFD600" : "url(#rc-grad)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={`${c * (1 - (drawing ? 1 : p))}`}
          className={due && !drawing ? "animate-pulse" : ""}
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
        <defs>
          <linearGradient id="rc-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B9CFF" />
            <stop offset="100%" stopColor="#FFD600" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className={`font-mono text-lg font-semibold tabular ${due ? "text-accent" : ""}`}>
          {drawing ? "LIVE" : due ? "READY" : formatDuration(end - now)}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-ink-faint">{drawing ? "drawing" : due ? "run draw" : "next draw"}</div>
      </div>
    </div>
  );
}
