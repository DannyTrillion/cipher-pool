"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { usePoolState, useUserState, useDraw, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { formatAmount, truncateAddress } from "@/lib/format";
import { Reading } from "@/components/ui/Reading";
import { DECIMALS, POOL, SYMBOL } from "@/lib/contracts";
import { formatDuration, useNow } from "@/components/ui/Countdown";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";

type Pane = "position" | "draw";
const PANES: { key: Pane; label: string }[] = [
  { key: "position", label: "Your savings" },
  { key: "draw", label: "The prize draw" },
];

/**
 * One fused game card with a sliding segmented control. Manual only: tabs,
 * dots, arrow keys, or a horizontal swipe change the pane. Nothing moves on its own.
 */
export function GameCard() {
  const [pane, setPane] = useState<Pane>("position");
  const [dir, setDir] = useState(1);
  const pick = (p: Pane) => { setDir(p === "draw" ? 1 : -1); setPane(p); sfx.click(); };
  const next = () => pick(pane === "position" ? "draw" : "position");

  return (
    <div
      className="tile flex h-full min-h-[380px] flex-col"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "ArrowRight") pick("draw"); if (e.key === "ArrowLeft") pick("position"); }}
      aria-roledescription="carousel"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5">
        <div className="relative flex rounded-full bg-black/40 p-1" role="tablist">
          {PANES.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={pane === p.key}
              className={cn("relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", pane === p.key ? "text-black" : "text-ink-muted hover:text-ink")}
              onClick={() => pick(p.key)}
            >
              {pane === p.key && <motion.span layoutId="game-tab" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pr-1">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            {PANES.map((p) => (
              <button key={p.key} className={cn("h-1.5 rounded-full transition-all", pane === p.key ? "w-5 bg-accent" : "w-1.5 bg-white/20")} onClick={() => pick(p.key)} tabIndex={-1} />
            ))}
          </div>
          <button className="btn-ghost h-7 w-7 !p-0 text-ink-muted" aria-label={pane === "position" ? "Show the prize draw" : "Show your savings"} onClick={next}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={pane === "position" ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} /></svg>
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pane}
            initial={{ opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 * dir }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.15}
            onDragEnd={(_, info) => { if (info.offset.x < -60) pick("draw"); else if (info.offset.x > 60) pick("position"); }}
            className="absolute inset-0 flex flex-col"
          >
            {pane === "position" ? <PositionPane /> : <DrawPane />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function PositionPane() {
  const { address, isConnected } = useAccount();
  const { state } = usePoolState();
  const { user } = useUserState(state?.epoch);
  const { reveal, get, busy } = useReveal();
  const poolBal = get(user?.poolBalance);
  const claimable = get(user?.claimable);
  return (
    <>
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-accent text-[10px] font-bold text-black">C</span>
          <span className="font-medium">{isConnected ? truncateAddress(address) : "You"}</span>
        </div>
        <span className="pill py-0.5 text-[10px]">{isConnected ? "connected" : "what others see"}</span>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-4 px-5 py-4">
        <div>
          <div className="label">Your savings</div>
          <div className="mt-1"><EncryptedValue value={isConnected ? (user?.poolBalance ? poolBal : null) : undefined} revealed={poolBal !== undefined} size="md" /></div>
          <div className="mt-1 text-[11px] text-ink-faint">Always yours to withdraw</div>
        </div>
        <div>
          <div className="label">Prizes to claim</div>
          <div className="mt-1"><EncryptedValue value={isConnected ? (user?.claimable ? claimable : null) : undefined} revealed={claimable !== undefined} size="md" /></div>
          <div className="mt-1 text-[11px] text-ink-faint">Claim to your wallet any time</div>
        </div>
        <div className="col-span-2 rounded-xl border border-line px-3.5 py-3 text-[13px] leading-relaxed text-ink-muted">
          The more you save, the better your odds. Nobody can see how much you saved, not even the pool.
        </div>
      </div>
      <div className="border-t border-line px-5 py-2.5 text-[12px] text-ink-faint">
        {isConnected && user?.poolBalance ? (
          <button className="text-accent hover:underline" disabled={!!busy} onClick={() => { void reveal(POOL.address, user.poolBalance, "tile-pool"); void reveal(POOL.address, user.claimable, "tile-claim"); }}>
            {busy ? "Loading…" : "Show my numbers (one signature)"}
          </button>
        ) : isConnected ? (
          "Put money in below to start."
        ) : (
          "Connect a wallet to see your numbers."
        )}
      </div>
    </>
  );
}

function DrawPane() {
  const { state } = usePoolState();
  const { draw } = useDraw(state?.epoch);
  const pub = usePublicReveal();
  const now = useNow();
  useEffect(() => { if (draw?.completedAt && draw.completedAt > 0n) void pub.reveal([draw.prize]); }, [draw?.prize, draw?.completedAt, pub.reveal]);
  const prize = draw ? pub.values[draw.prize] : undefined;
  const drawing = !!state && state.phase !== Phase.Open;
  const due = !!state && !drawing && Number(state.nextDrawAt) <= now;
  const slots = state?.winnerSlots ?? 5;
  return (
    <>
      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-mint/60 text-[10px] text-mint">◎</span>
          <span className="font-medium">The prize draw</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className={cn("h-1.5 w-1.5 rounded-full", drawing ? "bg-mint animate-pulse" : due ? "bg-accent" : "bg-ok")} />
          {drawing ? "happening now" : due ? "ready to run" : "counting down"}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center px-5 py-4">
        {drawing ? (
          <>
            <div className="label">Right now</div>
            <div className="mt-1 text-sm">{state?.phase === Phase.Selecting ? "Picking winners in secret…" : "Handing out prizes in secret…"}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="progress-stripes h-full rounded-full bg-mint" style={{ width: `${((state?.phase === Phase.Selecting ? 0 : 50) + (Number(state?.drawCursor ?? 0n) / Math.max(1, Number(state?.participantCount ?? 1n))) * 50)}%` }} /></div>
          </>
        ) : (
          <>
            <div className="label">{due ? "Next draw" : "Next draw in"}</div>
            <div className="mt-1 font-mono text-3xl tabular">{state ? (due ? "Ready" : formatDuration(Number(state.nextDrawAt) - now)) : "…"}</div>
            <div className="mt-2 text-[13px] text-ink-muted">{slots} prizes every draw. Winners are picked in secret. Nobody loses their money.</div>
          </>
        )}
        {draw && draw.completedAt > 0n && (
          <div className="mt-4 rounded-xl border border-line px-3.5 py-3">
            <div className="text-[11px] text-ink-faint">Last draw #{draw.epoch.toString()}</div>
            <div className="mt-0.5 font-mono text-sm">
              {prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : <Reading />}
              <span className="text-ink-faint"> shared by {draw.winnerSlots} winners · {draw.participants} savers took part</span>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-line px-5 py-2.5 text-[12px] text-ink-faint">Anyone can check the draw was fair.</div>
    </>
  );
}
