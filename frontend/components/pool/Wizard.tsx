"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect } from "wagmi";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useReveal } from "@/lib/hooks/useReveal";
import { useActionFlow } from "@/lib/useActionFlow";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { POOL, TOKEN, DECIMALS, UNDERLYING_SYMBOL } from "@/lib/contracts";
import { humanizeError } from "@/lib/format";
import { formatUnits } from "viem";
import { formatDuration, useNow } from "@/components/ui/Countdown";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";
import { SuccessTick } from "@/components/ui/SuccessTick";
import { NetworkAlert } from "@/components/ui/NetworkAlert";

/** Guided flow for new savers: five steps, each auto-completing from chain state. */
export function Wizard({ onSkip }: { onSkip?: () => void } = {}) {
  const { isConnected, address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { state, refetch: refetchPool } = usePoolState();
  const { user, refetch, waitFor, error: readError } = useUserState(state?.epoch);
  const actions = usePoolActions();
  const { reveal, get, busy } = useReveal();
  const flow = useActionFlow();
  const now = useNow();
  const [amount, setAmount] = useState("100");
  const [tick, setTick] = useState(false);
  // "Start over": ignore what the chain already knows about this wallet and tick
  // steps only as they are done in this session (persisted per wallet).
  const freshKey = address ? `cipherpool.guide.${address.toLowerCase()}` : null;
  const [fresh, setFresh] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    if (!freshKey) { setFresh(null); return; }
    try { const raw = localStorage.getItem(freshKey); setFresh(raw ? JSON.parse(raw) : null); } catch { setFresh(null); }
  }, [freshKey]);
  const saveFresh = (next: Record<string, boolean> | null) => {
    setFresh(next);
    if (!freshKey) return;
    try { if (next) localStorage.setItem(freshKey, JSON.stringify(next)); else localStorage.removeItem(freshKey); } catch {}
  };
  const startOver = () => { sfx.click(); saveFresh({}); };
  const mark = (key: string) => { if (fresh) saveFresh({ ...fresh, [key]: true }); };
  const celebrate = () => { setTick(true); setTimeout(() => setTick(false), 1400); };

  const poolBal = get(user?.poolBalance);
  const hasWallet = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum && connectors.length > 0;
  const eligible = !!user?.poolBalance && !!state && user.lastTouchedEpoch !== state.epoch + 1n;
  const due = !!state && state.phase === Phase.Open && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;
  const drawing = !!state && state.phase !== Phase.Open;

  const ICON: Record<string, JSX.Element> = {
    connect: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M16 12h.01M3 10h18" /></svg>,
    faucet: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v10M8 9l4 4 4-4" /><path d="M5 17a7 7 0 0 0 14 0" /></svg>,
    shield: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>,
    deposit: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="7" /><path d="M12 3v6M9 6l3 3 3-3" /></svg>,
    unlock: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
    draw: <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>,
  };
  const SHORT: Record<string, string> = { connect: "Connect", faucet: "Get USDT", shield: "Wrap", deposit: "Deposit", unlock: "Decrypt", draw: "Draw" };

  const steps = [
    { key: "connect", title: "Connect a wallet", why: "Your wallet is your login. It is also the only key that can decrypt your numbers.", done: isConnected },
    { key: "faucet", title: "Get 1,000 test USDT", why: "Free play money from Zama's official test token on Sepolia. Nothing here is real money.", done: fresh ? !!fresh.faucet : (user?.tusdBalance ?? 0n) > 0n || !!user?.walletBalance || !!user?.poolBalance },
    { key: "shield", title: "Wrap it into cUSDT", why: "Wrapping turns public USDT into private cUSDT, one for one. After this, nobody can see your amounts.", done: fresh ? !!fresh.shield : !!user?.walletBalance || !!user?.poolBalance },
    { key: "deposit", title: "Make your first deposit", why: "Your amount is scrambled in your browser before it is sent. The pool never sees it.", done: fresh ? !!fresh.deposit : !!user?.poolBalance },
    { key: "unlock", title: "Decrypt your numbers", why: "One signature lets your wallet decrypt your own balance. Nobody else can.", done: fresh ? !!fresh.unlock : poolBal !== undefined },
    { key: "draw", title: "Wait for the draw", why: "Every 10 minutes the pool picks winners in secret. If you win, the prize waits until you collect it. Your money is never at risk.", done: fresh ? !!fresh.deposit && eligible && !!user?.wonInDraw : eligible && !!user?.wonInDraw },
  ];
  const current = Math.max(0, steps.findIndex((s) => !s.done));
  const allDone = steps.every((s) => s.done);
  const step = steps[Math.min(current, steps.length - 1)];

  const doFaucet = () => flow.run(async (s) => { const before = user?.tusdBalance ?? 0n; await actions.faucet(s); celebrate(); s("Confirmed. Reading your new balance…"); await waitFor((u) => u.tusdBalance > before); mark("faucet"); }, { successMessage: "1,000 test USDT is in your wallet." });
  const doShield = () => flow.run(async (s) => { const before = user?.walletBalance ?? null; await actions.shield(formatUnits(user?.tusdBalance ?? 0n, DECIMALS), s); celebrate(); s("Confirmed. Reading your new balance…"); await waitFor((u) => !!u.walletBalance && u.walletBalance !== before); mark("shield"); }, { successMessage: "Wrapped. Your cUSDT is private now." });
  const doDeposit = () => flow.run(async (s) => { const before = user?.poolBalance ?? null; await actions.deposit(amount, s); celebrate(); s("Confirmed. Reading your new balance…"); await Promise.all([waitFor((u) => !!u.poolBalance && u.poolBalance !== before), refetchPool()]); mark("deposit"); }, { successMessage: "Done. Your money is in the pool, scrambled." });
  const doUnlock = () => flow.run(async (s) => { s("Waiting for your signature, then Zama's relayer decrypts for you…"); await reveal(POOL.address, user?.poolBalance ?? null, "pool"); await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet"); await reveal(POOL.address, user?.claimable ?? null, "claim"); celebrate(); mark("unlock"); }, { successMessage: "Here they are. Only you can see these." });

  return (
    <div>
      {/* progress: labelled bar that fills as steps complete */}
      <div>
        <div className="flex items-center justify-between">
          <div className="label">{allDone ? "All done" : `Step ${current + 1} of ${steps.length}`}</div>
          <span className="flex items-center gap-3 text-[11px]">
            {isConnected && (fresh ? current > 0 || allDone : current > 0) && <button className="text-ink-faint underline-offset-4 hover:text-ink hover:underline" onClick={startOver}>Start over</button>}
            {onSkip && <button className="text-ink-faint underline-offset-4 hover:text-ink hover:underline" onClick={onSkip}>I know this, skip the guide</button>}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#8B9CFF,#FFD600)]" initial={false} animate={{ width: `${(steps.filter((x) => x.done).length / steps.length) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
        </div>
        <ol className="mt-2 grid grid-cols-6 gap-1" aria-label="Steps">
          {steps.map((x, i) => (
            <li key={x.key} className={cn("flex flex-col items-center gap-1 text-[10px]", x.done ? "text-accent" : i === current ? "text-ink" : "text-ink-faint")}>
              <span className={cn("grid h-6 w-6 place-items-center rounded-full border", x.done ? "border-accent bg-accent text-black" : i === current ? "border-accent" : "border-line")}>
                {x.done ? (
                  <motion.svg key="check" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}><path d="M5 12l5 5L20 7" /></motion.svg>
                ) : (
                  <span className="scale-75">{ICON[x.key]}</span>
                )}
              </span>
              <span className="hidden sm:block">{SHORT[x.key]}</span>
            </li>
          ))}
        </ol>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={allDone ? "done" : step.key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="mt-5">
          {allDone ? (
            <>
              <div className="flex items-center gap-3">
                <motion.span initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 16 }} className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-black">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </motion.span>
                <h3 className="text-xl font-semibold">You&apos;re in.</h3>
              </div>
              <p className="mt-2 text-sm text-ink-muted">Your money is in the pool and in the next draw. Check <span className="text-ink">Your results</span> after each draw. Switch to Experienced for full controls.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-black/20 px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Your savings</div><div className="mt-1"><EncryptedValue value={poolBal} revealed={poolBal !== undefined} size="sm" /></div></div>
                <div className="rounded-xl border border-line bg-black/20 px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Next draw</div><div className="mt-1 font-mono text-lg">{state ? (drawing ? "running" : due ? "ready" : formatDuration(Number(state.nextDrawAt) - now)) : "…"}</div></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-accent/40 bg-accent-faint text-accent">{ICON[step.key]}</span>
                <h3 className="text-xl font-semibold">{step.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.why}</p>

              <NetworkAlert className="mt-4" />
              {isConnected && !user && readError && (
                <div className="mt-4 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-xs text-warn">
                  Could not read your wallet from the network. {humanizeError(readError)} <button className="underline" onClick={() => void refetch()}>Try again</button>
                </div>
              )}
              <div className="relative mt-4">
                <SuccessTick show={tick} />
                {step.key === "connect" && (hasWallet ? (
                  <button className="btn-primary btn-lg btn-arrow shine w-full" disabled={isPending} onClick={() => { sfx.click(); connect({ connector: connectors[0] }); }}>{isPending ? "Connecting…" : "Connect wallet"}</button>
                ) : (
                  <a className="btn-primary btn-lg btn-arrow shine w-full" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install a wallet (MetaMask or Rabby)</a>
                ))}
                {step.key === "faucet" && (
                  <button data-anchor="faucet" className="btn-primary btn-lg shine w-full" disabled={flow.state.status === "pending" || Number(user?.faucetCooldown ?? 0n) > 0} onClick={doFaucet}>
                    {Number(user?.faucetCooldown ?? 0n) > 0 ? `Try again in ${formatDuration(Number(user!.faucetCooldown))}` : flow.state.status === "pending" ? "Minting…" : "Get 1,000 test USDT"}
                  </button>
                )}
                {step.key === "shield" && (
                  <div className="space-y-3">
                    <button data-anchor="shield" className="btn-primary btn-lg shine w-full" disabled={flow.state.status === "pending" || !user || user.tusdBalance === 0n} onClick={doShield}>
                      {flow.state.status === "pending" ? "Working…" : !user ? "Reading your wallet…" : `Wrap ${formatUnits(user.tusdBalance, DECIMALS)} ${UNDERLYING_SYMBOL} into cUSDT`}
                    </button>
                    <p className="text-xs text-ink-faint">Two confirmations: an approval, then the wrap.</p>
                  </div>
                )}
                {step.key === "deposit" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {["50", "100", "250"].map((c) => (
                        <button key={c} className={cn("pill flex-1 justify-center py-2", amount === c && "border-accent/50 text-accent")} onClick={() => { setAmount(c); sfx.click(); }}>{c} cUSDT</button>
                      ))}
                    </div>
                    <button data-anchor="deposit" className="btn-primary btn-lg shine w-full" disabled={flow.state.status === "pending" || drawing} onClick={doDeposit}>
                      {drawing ? "Paused during the draw" : flow.state.status === "pending" ? "Working…" : `Put in ${amount} cUSDT`}
                    </button>
                    <p className="text-xs text-ink-faint">Two confirmations the first time: one lets the pool move your cUSDT, one is the deposit.</p>
                  </div>
                )}
                {step.key === "unlock" && (
                  <button className="btn-primary btn-lg shine w-full" disabled={!!busy || flow.state.status === "pending"} onClick={doUnlock}>{busy ? "Loading…" : "Decrypt my numbers"}</button>
                )}
                {step.key === "draw" && (
                  <div className="rounded-xl border border-line bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-muted">{eligible ? "You're in the next draw." : "You will be in the draw after next. Money needs a full round in the pool first."}</span>
                      <span className="font-mono text-lg">{state ? (drawing ? "running" : due ? "ready" : formatDuration(Number(state.nextDrawAt) - now)) : "…"}</span>
                    </div>
                    {due && <a href="#console" className="btn-primary btn-lg btn-arrow shine mt-3 w-full">Go press the button</a>}
                    {!due && !drawing && <p className="mt-3 text-xs text-ink-faint">When the countdown ends, anyone can press the big button above to run the draw. Then check Your results.</p>}
                  </div>
                )}
              </div>
              <FlowStatus state={flow.state} className="mt-3" />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
