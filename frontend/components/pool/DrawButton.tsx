"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useNow, formatDuration } from "@/components/ui/Countdown";
import { sfx } from "@/lib/sound";
import { fire } from "@/lib/scene";

export type DrawButtonState = "countdown" | "armed" | "live" | "busy";

/**
 * The big button. A physical arcade cap on a dark bezel with the draw
 * countdown wrapped around it. Hold ~1s to fire; release early to cancel.
 */
export function DrawButton({
  state,
  start,
  end,
  connected,
  progressLabel,
  progress = 0,
  onRun,
  onConnect,
  size = 176,
}: {
  state: DrawButtonState;
  start: number;
  end: number;
  connected: boolean;
  progressLabel?: string;
  progress?: number; // 0..1 while live
  onRun: () => void;
  onConnect: () => void;
  size?: number;
}) {
  const now = useNow();
  const [hold, setHold] = useState(0); // 0..1
  const [pressed, setPressed] = useState(false);
  const raf = useRef(0);
  const t0 = useRef(0);
  const firedRef = useRef(false);
  const HOLD_MS = 1000;

  const canPress = state === "armed" || (!connected && state !== "live");
  const r = size / 2 - 8;
  const c = 2 * Math.PI * r;
  const cdProgress = Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start)));

  const stop = () => {
    cancelAnimationFrame(raf.current);
    setPressed(false);
    setHold(0);
  };
  const begin = () => {
    if (!canPress) return;
    if (!connected) { sfx.click(); onConnect(); return; }
    setPressed(true);
    firedRef.current = false;
    t0.current = performance.now();
    sfx.click();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0.current) / HOLD_MS);
      setHold(p);
      if (p >= 1) {
        if (!firedRef.current) {
          firedRef.current = true;
          sfx.whoosh();
          fire({ type: "interact" });
          onRun();
        }
        setPressed(false);
        setHold(0);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const label =
    state === "live" ? "LIVE" : state === "busy" ? "…" : !connected ? "CONNECT" : state === "armed" ? (pressed ? "HOLD" : "RUN DRAW") : formatDuration(end - now);
  const sub =
    state === "live" ? progressLabel ?? "drawing" : state === "busy" ? "confirm in wallet" : !connected ? "to run the draw" : state === "armed" ? (pressed ? "keep holding" : "hold to start") : "to next draw";

  const capColor = state === "live" ? "var(--mint)" : "var(--accent)";
  const lit = state === "armed" || state === "live";

  return (
    <div className="relative select-none" style={{ width: size, height: size }} aria-live="polite">
      {/* countdown / hold / live ring */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("absolute inset-0 -rotate-90", state === "live" && "animate-[spin_3s_linear_infinite]")} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pressed ? "#fff" : state === "live" ? "#5EEAD4" : state === "armed" ? "#FFD600" : "url(#db-grad)"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${c}`}
          strokeDashoffset={`${c * (1 - (pressed ? hold : state === "live" ? 0.3 : state === "armed" ? 1 : cdProgress))}`}
          style={{ transition: pressed ? "none" : "stroke-dashoffset 700ms ease" }}
        />
        <defs>
          <linearGradient id="db-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8B9CFF" />
            <stop offset="100%" stopColor="#FFD600" />
          </linearGradient>
        </defs>
      </svg>

      {/* bezel */}
      <div className="absolute inset-[14px] rounded-full bg-[#101116] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9),0_18px_40px_-16px_rgba(0,0,0,0.9)] ring-1 ring-white/10" />

      {/* cap */}
      <motion.button
        type="button"
        disabled={state === "live" || state === "busy"}
        aria-label={!connected ? "Connect wallet to run the draw" : state === "armed" ? "Hold to run the draw" : state === "live" ? "Draw in progress" : `Next draw in ${formatDuration(end - now)}`}
        onPointerDown={begin}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") begin(); }}
        onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") stop(); }}
        animate={{ y: pressed ? 7 : 0, scale: pressed ? 0.98 : 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 30 }}
        className={cn(
          "absolute inset-[24px] flex flex-col items-center justify-center rounded-full text-black outline-none focus-visible:ring-4 focus-visible:ring-accent/50",
          !canPress && state !== "live" && "cursor-default",
        )}
        style={{
          background: lit
            ? `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.65), rgba(255,255,255,0) 38%), radial-gradient(circle at 50% 60%, rgb(${capColor}) 0%, rgb(${capColor} / 0.85) 70%, rgb(${capColor} / 0.7) 100%)`
            : `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.18), rgba(255,255,255,0) 38%), radial-gradient(circle at 50% 60%, rgb(var(--accent) / 0.35), rgb(var(--accent) / 0.22) 100%)`,
          boxShadow: pressed
            ? "inset 0 2px 6px rgba(0,0,0,0.35), 0 2px 0 rgba(0,0,0,0.5)"
            : lit
              ? `0 10px 0 rgb(${capColor} / 0.35), 0 14px 30px -6px rgb(${capColor} / 0.55), inset 0 -6px 12px rgba(0,0,0,0.25)`
              : "0 10px 0 rgba(255,214,0,0.12), inset 0 -6px 12px rgba(0,0,0,0.35)",
          color: lit ? "#0b0c0f" : "rgba(255,255,255,0.75)",
        }}
      >
        {state === "armed" && !pressed && <span className="absolute inset-0 animate-pulseRing rounded-full border-2 border-accent/70" aria-hidden="true" />}
        <span className={cn("display tabular", label.length > 6 ? "text-[15px]" : "text-[19px]")}>{label}</span>
        <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.2em] opacity-80">{sub}</span>
      </motion.button>

      {state === "live" && (
        <div className="absolute -bottom-6 left-1/2 w-max -translate-x-1/2 font-mono text-[10px] text-mint">{Math.round(progress * 100)}%</div>
      )}
    </div>
  );
}
