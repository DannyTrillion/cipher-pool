"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { usePoolState, useUserState, useDraw, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { formatAmount, truncateAddress } from "@/lib/format";
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
 * One fused game card with a sliding segmented control. Auto-advances every
 * 8s like a gentle carousel until the visitor interacts, then stays put.
 */
export function GameCard() {
  const [pane, setPane] = useState<Pane>("position");
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (touched) return;
    const id = setInterval(() => setPane((p) => (p === "position" ? "draw" : "position")), 8000);
    return () => clearInterval(id);
  }, [touched]);
  const pick = (p: Pane) => { setTouched(true); setPane(p); sfx.click(); };

  return (
    <div className="tile flex h-full min-h-[380px] flex-col">
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
        <div className="flex items-center gap-1.5 pr-1" aria-hidden="true">
          {PANES.map((p) => (
            <button key={p.key} className={cn("h-1.5 rounded-full transition-all", pane === p.key ? "w-5 bg-accent" : "w-1.5 bg-white/20")} onClick={() => pick(p.key)} tabIndex={-1} />
          ))}
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={pane}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
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
  const winnings = get(user?.winnings);
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
          <div className="label">Prizes you&apos;ve won</div>
          <div className="mt-1"><EncryptedValue value={isConnected ? (user?.winnings ? winnings : null) : undefined} revealed={winnings !== undefined} size="md" /></div>
          <div className="mt-1 text-[11px] text-ink-faint">Added straight to your savings</div>
        </div>
        <div className="col-span-2 rounded-xl border border-line px-3.5 py-3 text-[13px] leading-relaxed text-ink-muted">
          Your chance of winning equals your share of everyone&apos;s savings. Nobody, not even the pool, can see how much you saved.
        </div>
      </div>
      <div className="border-t border-line px-5 py-2.5 text-[12px] text-ink-faint">
        {isConnected && user?.poolBalance ? (
          <button className="text-accent hover:underline" disabled={!!busy} onClick={() => { void reveal(POOL.address, user.poolBalance, "tile-pool"); void reveal(POOL.address, user.winnings, "tile-win"); }}>
            {busy ? "Unlocking…" : "Unlock my numbers (one signature)"}
          </button>
        ) : isConnected ? (
          "Deposit below to start saving."
        ) : (
          "Connect a wallet to unlock your own numbers."
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
            <div className="mt-2 text-[13px] text-ink-muted">{slots} prizes every draw. Winners are picked in secret, on-chain. Nobody loses their savings.</div>
          </>
        )}
        {draw && draw.completedAt > 0n && (
          <div className="mt-4 rounded-xl border border-line px-3.5 py-3">
            <div className="text-[11px] text-ink-faint">Last draw #{draw.epoch.toString()}</div>
            <div className="mt-0.5 font-mono text-sm">
              {prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : <span className="cipher-mask">•••••</span>}
              <span className="text-ink-faint"> shared by {draw.winnerSlots} winners · {draw.participants} savers took part</span>
            </div>
          </div>
        )}
      </div>
      <div className="border-t border-line px-5 py-2.5 text-[12px] text-ink-faint">Anyone can check every draw was fair.</div>
    </>
  );
}
