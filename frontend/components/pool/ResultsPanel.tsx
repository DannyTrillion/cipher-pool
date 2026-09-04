"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { usePoolState, useUserState, useDraw, useDraws, useDrawSeeds, useUserDrawCredits, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useActionFlow } from "@/lib/useActionFlow";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { formatAmount } from "@/lib/format";
import { DECIMALS, POOL, SYMBOL, etherscanAddr } from "@/lib/contracts";
import { slotAmounts } from "@/lib/tiers";
import { fire } from "@/lib/scene";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";

/** Your results: the latest draw for you, your arc, past draws, and a verify drawer. */
export function ResultsPanel() {
  const { isConnected } = useAccount();
  const { state } = usePoolState();
  const { user } = useUserState(state?.epoch);
  const { draw } = useDraw(state?.epoch);
  const { seeds } = useDrawSeeds(state?.epoch);
  const { draws } = useDraws(state?.epoch);
  const done = useMemo(() => draws.filter((d) => d.completedAt > 0n), [draws]);
  const { credits } = useUserDrawCredits(done.map((d) => d.epoch));
  const pub = usePublicReveal();
  const { reveal, get, busy } = useReveal();
  const actions = usePoolActions();
  const revealFlow = useActionFlow();
  const [verify, setVerify] = useState(false);

  useEffect(() => { if (done.length) void pub.reveal(done.map((d) => d.prize)); }, [done, pub.reveal]);
  useEffect(() => { if (verify && seeds.length) void pub.reveal(seeds); }, [verify, seeds, pub.reveal]);

  const latest = done[0];
  const latestCredit = latest ? credits[0] : null;
  const myCredit = get(latestCredit);
  const latestPrize = latest ? pub.values[latest.prize] : undefined;
  const winnings = get(user?.winnings);
  const inProgress = !!state && state.phase !== Phase.Open;

  const steps = user
    ? [
        { t: "Funded", on: !!user.walletBalance || !!user.poolBalance },
        { t: "Saver", on: !!user.poolBalance },
        { t: "In the draw", on: !!user.poolBalance && !!state && user.lastTouchedEpoch !== state.epoch + 1n },
        { t: "Winner", on: winnings !== undefined && winnings > 0n },
      ]
    : [];

  return (
    <section className="card card-hover p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="display text-2xl">Your results</h2>
          <div className="mt-1 text-xs text-ink-faint">Only you can see whether you won. Anyone can check the draw was fair.</div>
        </div>
        {isConnected && steps.length > 0 && (
          <div className="hidden flex-wrap justify-end gap-1.5 sm:flex" aria-label="Your progress">
            {steps.map((s, i) => (
              <span key={s.t} className={cn("pill py-1", s.on && "border-accent/40 bg-accent-faint text-ink")}><span className={cn("grid h-3.5 w-3.5 place-items-center rounded-full text-[8px] font-bold", s.on ? "bg-accent text-black" : "bg-white/10 text-ink-faint")}>{s.on ? "✓" : i + 1}</span>{s.t}</span>
            ))}
          </div>
        )}
      </div>

      {/* latest draw for you */}
      <div className="mt-5 rounded-xl border border-line bg-black/20 p-4">
        {!latest ? (
          <div className="text-sm text-ink-muted">No draw has run yet. When the countdown ends, anyone can press the button.</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Draw #{latest.epoch.toString()}{inProgress ? " · a new draw is running" : ""}</div>
              <div className="text-xs text-ink-faint">{latestPrize !== undefined ? `${formatAmount(latestPrize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL} shared by ${latest.winnerSlots} winners` : "…"} · {new Date(Number(latest.startedAt) * 1000).toLocaleString()}</div>
            </div>
            <div className="mt-3">
              {!isConnected ? (
                <div className="text-sm text-ink-muted">Connect to see whether you won. Your result is encrypted — nobody else can read it.</div>
              ) : !latestCredit ? (
                <div className="text-sm text-ink-muted">You weren&apos;t in this draw. Save before the next one to take part.</div>
              ) : myCredit === undefined ? (
                <button
                  className="btn-primary shine"
                  disabled={!!busy}
                  onClick={async () => {
                    sfx.click(); fire({ type: "reveal" });
                    const v = await reveal(POOL.address, latestCredit, "won");
                    if (v !== null && v !== undefined) fire(v > 0n ? { type: "win", amount: v } : { type: "lose" });
                    if (v === 0n) sfx.lose();
                  }}
                >
                  {busy === "won" ? "Unlocking…" : "Did I win?"}
                </button>
              ) : myCredit > 0n ? (
                <div className="flex flex-wrap items-center gap-3">
                  <motion.div initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} className="rounded-xl border border-accent/40 bg-accent-soft px-3 py-2 text-sm font-semibold text-accent shadow-[0_0_30px_rgb(255_214_0/0.25)]">
                    🏆 You won <EncryptedValue value={myCredit} revealed size="sm" className="text-accent" /> — it&apos;s already in your savings.
                  </motion.div>
                  <button className="btn-ghost text-xs" onClick={() => revealFlow.run((s) => actions.revealWin(latest.epoch, s), { successMessage: "Your win is now public for anyone to check." })} disabled={revealFlow.state.status === "pending"}>Show the world I won</button>
                </div>
              ) : (
                <motion.div initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-sm text-ink-muted">Not this time — <span className="text-ok">your savings are untouched</span>. You&apos;re still in for the next draw.</motion.div>
              )}
              <FlowStatus state={revealFlow.state} className="mt-2" />
            </div>
            <button className="mt-3 text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline" onClick={() => { setVerify((v) => !v); sfx.click(); }} aria-expanded={verify}>
              {verify ? "Hide verification" : "Verify this draw"}
            </button>
            <AnimatePresence initial={false}>
              {verify && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="mt-3 rounded-lg border border-line p-3 font-mono text-[11px] text-ink-muted">
                    <div className="mb-2 text-ink-faint">Each prize slot has its own on-chain random seed, published once the draw starts. The pool picks winners from these seeds over encrypted balances.</div>
                    <ul className="space-y-1">
                      {seeds.map((h, i) => {
                        const amt = latestPrize !== undefined ? slotAmounts(latestPrize, latest.tiers)[i] : undefined;
                        return (
                          <li key={h} className="flex gap-3">
                            <span className="w-16 shrink-0 text-ink-faint">{amt !== undefined ? formatAmount(amt, DECIMALS, { maxFractionDigits: 2 }) : `slot ${i + 1}`}</span>
                            <span className="truncate">{pub.values[h] !== undefined ? pub.values[h].toString() : <span className="cipher-mask">••••••••••</span>}</span>
                          </li>
                        );
                      })}
                    </ul>
                    <a className="mt-2 inline-block text-cipher underline" href={etherscanAddr(POOL.address)} target="_blank" rel="noreferrer">Pool contract on Etherscan ↗</a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* past draws */}
      {isConnected && done.length > 1 && (
        <div className="mt-5">
          <div className="label">Past draws</div>
          <ul className="mt-2 divide-y divide-line text-sm">
            {done.slice(1, 6).map((d, idx) => {
              const i = idx + 1;
              const h = credits[i];
              const v = h ? get(h) : undefined;
              const prize = pub.values[d.prize];
              return (
                <li key={d.epoch.toString()} className="flex items-center justify-between gap-3 py-2">
                  <span className="font-mono text-xs text-ink-muted">#{d.epoch.toString()} · {prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : "…"}</span>
                  <span>
                    {!h ? <span className="text-xs text-ink-faint">not in this draw</span>
                      : v === undefined ? <button className="text-xs text-accent hover:underline" disabled={!!busy} onClick={() => reveal(POOL.address, h, `draw-${d.epoch}`)}>reveal</button>
                      : v > 0n ? <span className="font-mono text-xs text-accent">+{formatAmount(v, DECIMALS, { maxFractionDigits: 2 })}</span>
                      : <span className="text-xs text-ink-faint">no prize</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
