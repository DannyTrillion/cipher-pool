"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount } from "wagmi";
import { usePoolState, useDraws, useUserDrawCredits, useDrawSeeds, Phase, type DrawRecord } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useActionFlow } from "@/lib/useActionFlow";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { useNow, formatDuration } from "@/components/ui/Countdown";
import { ReelReveal, facesFor } from "@/components/fx/ReelReveal";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { formatAmount } from "@/lib/format";
import { DECIMALS, POOL, SYMBOL, etherscanAddr } from "@/lib/contracts";
import { slotAmounts } from "@/lib/tiers";
import { fire } from "@/lib/scene";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";

const COLORS = ["#FFD600", "#8B9CFF", "#5EEAD4", "#F472B6"];

function Stat({ label, value, suffix }: { label: string; value: bigint | number | undefined; suffix?: string }) {
  const big = typeof value === "bigint" ? value : value !== undefined ? BigInt(Math.round(value)) : undefined;
  const v = useCountUp(big);
  return (
    <div className="glass p-5">
      <div className="label">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="display text-4xl tabular">{v === undefined ? "…" : suffix ? formatAmount(v, DECIMALS, { maxFractionDigits: 2 }) : v.toString()}</span>
        {suffix && <span className="font-mono text-sm text-ink-muted">{suffix}</span>}
      </div>
    </div>
  );
}

export function DrawsTimeline() {
  const { isConnected } = useAccount();
  const { state } = usePoolState();
  const { draws, isLoading } = useDraws(state?.epoch);
  const { credits } = useUserDrawCredits(draws.map((d) => d.epoch));
  const pub = usePublicReveal();
  const now = useNow();
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [shown, setShown] = useState(10);

  useEffect(() => { if (draws.length) void pub.reveal(draws.map((d) => d.prize)); }, [draws, pub.reveal]);

  const prizes = draws.map((d) => pub.values[d.prize]);
  const known = prizes.filter((p): p is bigint => p !== undefined);
  const totalPaid = known.length ? known.reduce((a, b) => a + b, 0n) : undefined;
  const biggest = known.length ? known.reduce((a, b) => (a > b ? a : b), 0n) : undefined;
  const drawing = !!state && state.phase !== Phase.Open;
  const due = !!state && !drawing && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;

  const list = useMemo(() => draws.map((d, i) => ({ d, credit: credits[i] ?? null })).filter((x) => filter === "all" || !!x.credit), [draws, credits, filter]);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Paid out in prizes" value={totalPaid} suffix={SYMBOL} />
        <Stat label="Draws run" value={draws.length} />
        <Stat label="Biggest prize" value={biggest} suffix={SYMBOL} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-black/30 px-4 py-2.5">
        <div className="flex items-center gap-2.5 text-sm">
          <span className="relative flex h-2.5 w-2.5">
            <span className={cn("absolute inline-flex h-full w-full animate-pulseRing rounded-full", drawing ? "bg-mint" : due ? "bg-accent" : "bg-ok")} />
            <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", drawing ? "bg-mint" : due ? "bg-accent" : "bg-ok")} />
          </span>
          <span className="font-medium">{!state ? "Loading…" : drawing ? "A draw is running right now" : due ? "The next draw is ready to run" : `Next draw in ${formatDuration(Number(state.nextDrawAt) - now)}`}</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/#console" className="btn-glass text-xs">Go to the button</a>
          {isConnected && (
            <div className="flex rounded-full bg-black/40 p-1">
              {(["all", "mine"] as const).map((f) => (
                <button key={f} className={cn("relative rounded-full px-3 py-1 text-[12px] font-medium transition", filter === f ? "text-black" : "text-ink-muted hover:text-ink")} onClick={() => { setFilter(f); sfx.click(); }}>
                  {filter === f && <motion.span layoutId="draws-filter" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <span className="relative">{f === "all" ? "All draws" : "My draws"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading && <div className="cipher-mask h-24 w-full" />}
      {!isLoading && list.length === 0 && (
        <div className="card p-6 text-sm text-ink-muted">{filter === "mine" ? "You haven't been in a draw yet. Save before the next one to take part." : "No draws yet. When the countdown ends, anyone can press the button."}</div>
      )}

      <ol className="relative space-y-4 before:absolute before:bottom-0 before:left-[19px] before:top-0 before:w-px before:bg-line md:before:left-[27px]">
        {list.slice(0, shown).map(({ d, credit }, i) => (
          <DrawCard key={d.epoch.toString()} draw={d} credit={credit} prize={pub.values[d.prize]} index={i} live={i === 0 && drawing} />
        ))}
      </ol>
      {list.length > shown && (
        <div className="text-center"><button className="btn-glass" onClick={() => setShown((s) => s + 10)}>Show older draws</button></div>
      )}
    </div>
  );
}

function DrawCard({ draw, credit, prize, index, live }: { draw: DrawRecord; credit: `0x${string}` | null; prize?: bigint; index: number; live: boolean }) {
  const { isConnected } = useAccount();
  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const { seeds } = useDrawSeeds(open ? draw.epoch : undefined);
  const pub = usePublicReveal();
  const { reveal, get, busy } = useReveal();
  const actions = usePoolActions();
  const proofFlow = useActionFlow();
  const mine = get(credit);
  const shownPrize = useCountUp(prize);
  const done = draw.completedAt > 0n;
  const slots = prize !== undefined ? slotAmounts(prize, draw.tiers) : [];
  useEffect(() => { if (open && seeds.length) void pub.reveal(seeds); }, [open, seeds, pub.reveal]);

  return (
    <motion.li initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ delay: Math.min(index, 6) * 0.04 }} className="relative pl-12 md:pl-16">
      <span className={cn("absolute left-2.5 top-6 grid h-5 w-5 place-items-center rounded-full border-2 bg-[rgb(var(--base))] md:left-[18px]", live ? "border-mint" : done ? "border-accent" : "border-line")}>
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-mint" />}
      </span>
      <div className={cn("card p-5 sm:p-6", live && "shadow-[0_0_0_1px_rgb(94_234_212/0.4),0_0_40px_-10px_rgb(94_234_212/0.35)]")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="display text-xl">Draw #{draw.epoch.toString()}</span>
              <span className={cn("pill py-0.5 text-[10px]", live ? "border-mint/40 text-mint" : done ? "border-ok/30 text-ok" : "border-warn/30 text-warn")}>{live ? "running" : done ? "complete" : "in progress"}</span>
            </div>
            <div className="mt-1 text-xs text-ink-faint">{new Date(Number(draw.startedAt) * 1000).toLocaleString()} · {draw.participants} saver{draw.participants === 1 ? "" : "s"} took part</div>
          </div>
          <div className="text-right">
            <div className="label">Prize</div>
            <div className="display text-3xl tabular">{shownPrize !== undefined ? formatAmount(shownPrize, DECIMALS, { maxFractionDigits: 2 }) : <span className="cipher-mask inline-block h-8 w-24" />} <span className="font-mono text-sm text-ink-muted">{SYMBOL}</span></div>
          </div>
        </div>

        {/* split bar */}
        <div className="mt-4">
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            {draw.tiers.flatMap((t, ti) => Array.from({ length: t.winners }, (_, k) => (
              <motion.span key={`${ti}-${k}`} initial={{ width: 0 }} whileInView={{ width: `${t.shareBps / 100 / t.winners}%` }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 + (ti * 2 + k) * 0.05 }} className="h-full border-r border-[rgb(var(--base))] last:border-0" style={{ background: COLORS[ti % 4] }} />
            )))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-ink-faint">
            {draw.tiers.map((t, ti) => (
              <span key={ti} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COLORS[ti % 4] }} />{t.winners} × {prize !== undefined ? `${formatAmount((prize * BigInt(t.shareBps)) / BigInt(10_000 * t.winners), DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : `${(t.shareBps / 100 / t.winners).toFixed(0)}%`}</span>
            ))}
          </div>
        </div>

        {/* your lane */}
        {isConnected && done && (
          <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-line bg-black/20 p-3">
            {!credit ? (
              <span className="text-sm text-ink-faint">You weren&apos;t in this draw.</span>
            ) : mine === undefined ? (
              <>
                <ReelReveal spinning={spinning} size={44} />
                <button className="btn-secondary text-xs" disabled={!!busy || spinning} onClick={async () => { sfx.click(); setSpinning(true); const v = await reveal(POOL.address, credit, `d-${draw.epoch}`); setSpinning(false); if (v !== null && v !== undefined) { fire(v > 0n ? { type: "win", amount: v } : { type: "lose" }); if (v === 0n) sfx.lose(); } }}>{spinning ? "Unlocking…" : "Did I win this one?"}</button>
              </>
            ) : mine > 0n ? (
              <>
                <ReelReveal spinning={false} faces={facesFor(mine, slots, draw.tiers)} size={44} />
                <span className="text-sm font-semibold text-accent">🏆 You won {formatAmount(mine, DECIMALS, { maxFractionDigits: 2 })} {SYMBOL}</span>
                <button className="btn-primary text-xs" disabled={proofFlow.state.status === "pending"} onClick={() => proofFlow.run((s) => actions.claim(s), { successMessage: "Claimed. Everything you had won is in your wallet as cUSD." })}>Claim to wallet</button>
                <button className="btn-ghost text-xs" disabled={proofFlow.state.status === "pending"} onClick={() => proofFlow.run((s) => actions.revealWin(draw.epoch, s), { successMessage: "Your win is now public for anyone to check." })}>Show the world</button>
                <FlowStatus state={proofFlow.state} />
              </>
            ) : (
              <>
                <ReelReveal spinning={false} faces={["none", "none", "none"]} size={44} />
                <span className="text-sm text-ink-muted">Not this one — your savings were untouched.</span>
              </>
            )}
          </div>
        )}

        <button className="mt-4 text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline" onClick={() => { setOpen((o) => !o); sfx.click(); }} aria-expanded={open}>{open ? "Hide verification" : "Verify this draw"}</button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="mt-3 rounded-lg border border-line p-3 font-mono text-[11px] text-ink-muted">
                <div className="mb-2 text-ink-faint">One on-chain random seed per prize slot, published when the draw started. Winners were picked from these over encrypted balances — nobody learned who.</div>
                <ul className="space-y-1">
                  {seeds.map((h, i) => (
                    <li key={h} className="flex gap-3"><span className="w-20 shrink-0 text-ink-faint">{slots[i] !== undefined ? `${formatAmount(slots[i], DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : `slot ${i + 1}`}</span><span className="truncate">{pub.values[h] !== undefined ? pub.values[h].toString() : <span className="cipher-mask">••••••••••</span>}</span></li>
                  ))}
                  {seeds.length === 0 && <li className="cipher-mask h-4 w-40" />}
                </ul>
                <a className="mt-2 inline-block text-cipher underline" href={etherscanAddr(POOL.address)} target="_blank" rel="noreferrer">Pool contract on Etherscan ↗</a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.li>
  );
}
