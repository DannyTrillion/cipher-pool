"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect } from "wagmi";
import { usePoolState, useUserState, useDraws, useDrawSeeds, useUserDrawCredits, Phase, type DrawRecord } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useActionFlow } from "@/lib/useActionFlow";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { useNow, formatDuration } from "@/components/ui/Countdown";
import { ReelReveal, facesFor } from "@/components/fx/ReelReveal";
import { OddsMeter } from "@/components/pool/OddsMeter";
import { ActivityFeed } from "@/components/pool/ActivityFeed";
import { formatAmount } from "@/lib/format";
import { Reading } from "@/components/ui/Reading";
import { DECIMALS, POOL, SYMBOL, etherscanAddr } from "@/lib/contracts";
import { slotAmounts } from "@/lib/tiers";
import { fire } from "@/lib/scene";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";

type Situation = "disconnected" | "noDraw" | "running" | "notIn" | "check" | "won" | "lost" | "settled";

/** Your results: one clear situation at the top, the win moment as the hero, then history. */
export function ResultsPanel() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { state } = usePoolState();
  const { user, refetch, waitFor } = useUserState(state?.epoch);
  const { draws } = useDraws(state?.epoch);
  const done = useMemo(() => draws.filter((d) => d.completedAt > 0n), [draws]);
  const { credits } = useUserDrawCredits(done.map((d) => d.epoch));
  const { seeds } = useDrawSeeds(done[0]?.epoch);
  const pub = usePublicReveal();
  const { reveal, get, busy } = useReveal();
  const actions = usePoolActions();
  const claimFlow = useActionFlow();
  const proofFlow = useActionFlow();
  const now = useNow();
  const [spinning, setSpinning] = useState(false);
  const [verify, setVerify] = useState(false);
  const [history, setHistory] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [settled, setSettled] = useState<string | null>(null);
  useEffect(() => { try { setSettled(localStorage.getItem("cipherpool.settled")); } catch {} }, []);

  useEffect(() => { if (done.length) void pub.reveal(done.map((d) => d.prize)); }, [done, pub.reveal]);
  useEffect(() => { if (verify && seeds.length) void pub.reveal(seeds); }, [verify, seeds, pub.reveal]);

  const latest = done[0];
  const latestCredit = latest ? credits[0] ?? null : null;
  const mine = get(latestCredit);
  const latestPrize = latest ? pub.values[latest.prize] : undefined;
  const claimable = get(user?.claimable);
  const winnings = get(user?.winnings);
  const running = !!state && state.phase !== Phase.Open;
  const nextIn = state ? Math.max(0, Number(state.nextDrawAt) - now) : 0;

  const situation: Situation = !isConnected ? "disconnected" : !latest ? "noDraw" : running ? "running" : !latestCredit ? "notIn" : mine === undefined ? "check" : mine > 0n ? (settled === latest.epoch.toString() ? "settled" : "won") : "lost";

  const entered = credits.filter(Boolean).length;
  const checked = credits.filter((h) => h && get(h) !== undefined).length;
  const wins = credits.filter((h) => { const v = h ? get(h) : undefined; return v !== undefined && v > 0n; }).length;
  const wonAnim = useCountUp(winnings);

  const check = async (h: `0x${string}`, key: string) => {
    sfx.click(); fire({ type: "reveal" }); setSpinning(true);
    const v = await reveal(POOL.address, h, key);
    if (user?.claimable) await reveal(POOL.address, user.claimable, "claim");
    setSpinning(false);
    if (v !== null && v !== undefined) { fire(v > 0n ? { type: "win", amount: v } : { type: "lose" }); if (v === 0n) sfx.lose(); }
  };
  const checkAll = async () => {
    setCheckingAll(true);
    for (let i = 0; i < done.length; i++) { const h = credits[i]; if (h && get(h) === undefined) await reveal(POOL.address, h, `d-${done[i].epoch}`); }
    setCheckingAll(false);
  };
  const collect = () => claimFlow.run(async (s) => {
    const before = user?.claimable ?? null;
    await actions.claim(s);
    s("Confirmed. Reading your new balance…");
    const u = await waitFor((x) => x.claimable !== before) ? await refetch() : user;
    await reveal(POOL.address, u?.claimable ?? null, "claim");
    if (latest) { const key = latest.epoch.toString(); try { localStorage.setItem("cipherpool.settled", key); } catch {} setTimeout(() => setSettled(key), 1200); }
  }, { successMessage: "Collected. Your prize is in your wallet as cUSDT." });

  return (
    <section className="card min-w-0 overflow-hidden p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="display text-2xl">Your results</h2>
          <div className="mt-1 text-xs text-ink-faint">Only you can see if you won. Anyone can check a draw was fair.</div>
        </div>
        {isConnected && entered > 0 && <span className="pill">{checked}/{entered} checked</span>}
      </div>

      {/* unclaimed prizes banner */}
      <AnimatePresence>
        {isConnected && claimable !== undefined && claimable > 0n && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mint/40 bg-mint/10 px-4 py-3">
            <div className="text-sm"><span className="font-semibold text-mint">{formatAmount(claimable, DECIMALS, { maxFractionDigits: 2 })} {SYMBOL}</span> is waiting for you.</div>
            <button className="btn-mint btn-sm" disabled={claimFlow.state.status === "pending"} onClick={collect}>{claimFlow.state.status === "pending" ? "Collecting…" : "Collect to wallet"}</button>
          </motion.div>
        )}
      </AnimatePresence>
      <FlowStatus state={claimFlow.state} className="mt-2" />

      {/* the situation */}
      <div className="mt-4 rounded-2xl border border-line bg-black/20 p-5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={situation} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22 }}>
            {situation === "disconnected" && (
              <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-lg font-semibold">See if you won</div>
                  <div className="mt-1 text-sm text-ink-muted">Your result is scrambled. Only your wallet can read it.</div>
                </div>
                {connectors.length > 0 && <button className="btn-primary btn-arrow" onClick={() => { sfx.click(); connect({ connector: connectors[0] }); }}>Connect</button>}
              </div>
            )}
            {situation === "noDraw" && (
              <div>
                <div className="label">First draw</div>
                <div className="mt-1 font-mono text-3xl tabular">{nextIn > 0 ? formatDuration(nextIn) : "ready"}</div>
                <div className="mt-2 text-sm text-ink-muted">No draw has run yet. When the countdown ends, anyone can press the big button.</div>
              </div>
            )}
            {situation === "running" && (
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold"><span className="h-2 w-2 animate-pulse rounded-full bg-mint" />Draw running now</div>
                <div className="mt-1 text-sm text-ink-muted">{state?.phase === Phase.Selecting ? "Picking winners in secret…" : "Paying prizes in secret…"} Your result appears here when it finishes.</div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="progress-stripes h-full rounded-full bg-mint" style={{ width: `${(state?.phase === Phase.Selecting ? 0 : 50) + (Number(state?.drawCursor ?? 0n) / Math.max(1, Number(state?.participantCount ?? 1n))) * 50}%` }} /></div>
              </div>
            )}
            {situation === "notIn" && (
              <div>
                <div className="text-lg font-semibold">You were not in draw #{latest?.epoch.toString()}</div>
                <div className="mt-1 text-sm text-ink-muted">{user?.poolBalance ? `You are in the next one, in ${formatDuration(nextIn)}.` : "Put money in to join the next one."}</div>
              </div>
            )}
            {situation === "check" && (
              <div>
                <div className="flex items-center gap-2 text-sm text-accent"><span className="h-2 w-2 animate-pulse rounded-full bg-accent" />New result to check</div>
                <div className="mt-1 text-lg font-semibold">Draw #{latest?.epoch.toString()} paid {latestPrize !== undefined ? `${formatAmount(latestPrize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : <Reading />} to {latest?.winnerSlots} winners.</div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <ReelReveal spinning={spinning} size={56} />
                  <button className="btn-primary btn-lg shine" disabled={!!busy || spinning} onClick={() => latestCredit && check(latestCredit, "won")}>{spinning ? "Checking…" : "Did I win?"}</button>
                </div>
              </div>
            )}
            {situation === "won" && mine !== undefined && latest && (
              <div>
                <div className="flex flex-wrap items-center gap-4">
                  <ReelReveal spinning={false} faces={facesFor(mine, latestPrize !== undefined ? slotAmounts(latestPrize, latest.tiers) : [], latest.tiers)} size={56} />
                  <motion.div initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.6 }}>
                    <div className="label">Draw #{latest.epoch.toString()}</div>
                    <div className="display prize-glow text-3xl text-accent">You won <EncryptedValue value={mine} revealed size="lg" className="text-accent" /></div>
                  </motion.div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="btn-mint" disabled={claimFlow.state.status === "pending"} onClick={collect}>{claimFlow.state.status === "pending" ? "Collecting…" : "Collect prize"}</button>
                  <button className="btn-glass" disabled={proofFlow.state.status === "pending"} onClick={() => proofFlow.run((s) => actions.revealWin(latest.epoch, s), { successMessage: "Your win is now public." })}>Announce my win</button>
                </div>
                <FlowStatus state={proofFlow.state} className="mt-2" />
              </div>
            )}
            {situation === "settled" && (
              <div className="flex flex-wrap items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-mint/15 text-mint"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg></span>
                <div>
                  <div className="text-lg font-semibold">Prize collected</div>
                  <div className="mt-1 text-sm text-ink-muted">It is in your wallet as cUSDT. {user?.poolBalance ? `You are in the next draw, in ${formatDuration(nextIn)}.` : "Put money in to join the next draw."}</div>
                </div>
              </div>
            )}
            {situation === "lost" && (
              <div className="flex flex-wrap items-center gap-4">
                <ReelReveal spinning={false} faces={["none", "none", "none"]} size={56} />
                <div>
                  <div className="text-lg font-semibold">Not this time</div>
                  <div className="mt-1 text-sm text-ink-muted"><span className="text-ok">Your money is untouched.</span> Next draw in {formatDuration(nextIn)}.</div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* your record */}
      {isConnected && (
        <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-line bg-black/20 [&>*]:border-line [&>*:not(:last-child)]:border-r">
          <div className="px-4 py-3"><div className="text-[12px] text-ink-muted">Draws entered</div><div className="mt-1 font-mono text-[15px] tabular">{entered}</div></div>
          <div className="px-4 py-3"><div className="text-[12px] text-ink-muted">Prizes won</div><div className="mt-1 font-mono text-[15px] tabular">{checked > 0 ? wins : "—"}<span className="text-ink-faint">{checked > 0 && checked < entered ? ` of ${checked} checked` : ""}</span></div></div>
          <div className="group px-4 py-3">
            <div className="text-[12px] text-ink-muted">Total won</div>
            <div className="mt-1 flex items-center gap-2 text-[15px]">
              {user?.winnings ? <EncryptedValue value={wonAnim} revealed={winnings !== undefined} size="sm" /> : <span className="font-mono text-ink-faint">—</span>}
              {user?.winnings && winnings === undefined && <button className="text-[11px] text-accent opacity-0 group-hover:opacity-100 focus:opacity-100" disabled={!!busy} onClick={() => reveal(POOL.address, user.winnings, "win")}>show</button>}
            </div>
          </div>
        </div>
      )}

      {/* odds + next draw */}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <OddsMeter savers={Number(state?.participantCount ?? 0n)} slots={state?.winnerSlots ?? 5} />
        <div className="rounded-xl border border-line bg-black/20 px-3.5 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{running ? "Draw" : "Next draw in"}</div>
          <div className="mt-1 font-mono text-2xl tabular">{!state ? "…" : running ? "running" : nextIn > 0 ? formatDuration(nextIn) : "ready"}</div>
          <div className="mt-1 text-[11px] text-ink-faint">{state?.winnerSlots ?? 5} prizes per draw</div>
        </div>
      </div>

      {/* past draws (collapsible) */}
      {isConnected && done.length > 0 && (
        <div className="mt-4 rounded-2xl border border-line bg-black/20">
          <button className="flex w-full items-center justify-between px-4 py-3 text-sm" onClick={() => { setHistory((h) => !h); sfx.click(); }} aria-expanded={history}>
            <span className="font-semibold">Past draws <span className="font-normal text-ink-faint">· {done.length}</span></span>
            <span className="flex items-center gap-3">
              {history && checked < entered && <button className="text-[11px] text-accent hover:underline" disabled={checkingAll} onClick={(e) => { e.stopPropagation(); void checkAll(); }}>{checkingAll ? "Checking…" : "Check all"}</button>}
              <span className={cn("transition", history && "rotate-180")}>▾</span>
            </span>
          </button>
          <AnimatePresence initial={false}>
            {history && (
              <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-line">
                {done.slice(0, 8).map((d, i) => <HistoryRow key={d.epoch.toString()} d={d} h={credits[i] ?? null} prize={pub.values[d.prize]} v={credits[i] ? get(credits[i]) : undefined} busy={!!busy} onCheck={() => credits[i] && check(credits[i]!, `d-${d.epoch}`)} />)}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* verify latest */}
      {latest && (
        <div className="mt-3">
          <button className="text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline" onClick={() => { setVerify((v) => !v); sfx.click(); }} aria-expanded={verify}>{verify ? "Hide the numbers" : `Check draw #${latest.epoch.toString()} was fair`}</button>
          <AnimatePresence initial={false}>
            {verify && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-2 rounded-lg border border-line p-3 font-mono text-[11px] text-ink-muted">
                  <div className="mb-2 text-ink-faint">Each prize has its own random number, published when the draw starts. Winners are picked from these numbers.</div>
                  <ul className="space-y-1">
                    {seeds.map((h, i) => { const amt = latestPrize !== undefined ? slotAmounts(latestPrize, latest.tiers)[i] : undefined; return (
                      <li key={h} className="flex gap-3"><span className="w-16 shrink-0 text-ink-faint">{amt !== undefined ? formatAmount(amt, DECIMALS, { maxFractionDigits: 2 }) : `prize ${i + 1}`}</span><span className="truncate">{pub.values[h] !== undefined ? pub.values[h].toString() : <Reading width={8} />}</span></li>
                    ); })}
                  </ul>
                  <a className="mt-2 inline-block text-cipher underline" href={etherscanAddr(POOL.address)} target="_blank" rel="noreferrer">Pool contract on Etherscan ↗</a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-5"><ActivityFeed compact /></div>
    </section>
  );
}

function HistoryRow({ d, h, prize, v, busy, onCheck }: { d: DrawRecord; h: `0x${string}` | null; prize?: bigint; v?: bigint; busy: boolean; onCheck: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm [&:not(:last-child)]:border-b [&:not(:last-child)]:border-line">
      <span className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink-muted">#{d.epoch.toString()}</span>
        <span className="font-mono text-xs">{prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : <Reading />}</span>
        <span className="text-[11px] text-ink-faint">{d.winnerSlots} winners</span>
      </span>
      <span>
        {!h ? <span className="text-[11px] text-ink-faint">not in</span>
          : v === undefined ? <button className="btn-glass btn-sm" disabled={busy} onClick={onCheck}>Check</button>
          : v > 0n ? <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">+{formatAmount(v, DECIMALS, { maxFractionDigits: 2 })}</span>
          : <span className="text-[11px] text-ink-faint">no prize</span>}
      </span>
    </li>
  );
}
