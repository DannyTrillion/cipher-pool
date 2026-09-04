"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect } from "wagmi";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useReveal } from "@/lib/hooks/useReveal";
import { useActionFlow } from "@/lib/useActionFlow";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { POOL, TOKEN } from "@/lib/contracts";
import { formatDuration, useNow } from "@/components/ui/Countdown";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";

/** Guided flow for new savers: five steps, each auto-completing from chain state. */
export function Wizard() {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { state, refetch: refetchPool } = usePoolState();
  const { user, refetch } = useUserState(state?.epoch);
  const actions = usePoolActions();
  const { reveal, get, busy } = useReveal();
  const flow = useActionFlow();
  const now = useNow();
  const [amount, setAmount] = useState("100");

  const poolBal = get(user?.poolBalance);
  const hasWallet = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum && connectors.length > 0;
  const eligible = !!user?.poolBalance && !!state && user.lastTouchedEpoch !== state.epoch + 1n;
  const due = !!state && state.phase === Phase.Open && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;
  const drawing = !!state && state.phase !== Phase.Open;

  const steps = [
    { key: "connect", title: "Connect a wallet", why: "Your wallet is your identity here. It also holds the only key that can read your numbers.", done: isConnected },
    { key: "faucet", title: "Get 1,000 test cUSD", why: "This is play money on the Sepolia test network. It lets you try everything for free.", done: !!user?.walletBalance || !!user?.poolBalance },
    { key: "deposit", title: "Make your first deposit", why: "Your amount is encrypted in your browser before it leaves. The pool never learns it.", done: !!user?.poolBalance },
    { key: "unlock", title: "Unlock your numbers", why: "One signature lets your wallet read your own balance. Nobody else can.", done: poolBal !== undefined },
    { key: "draw", title: "Wait for the draw", why: "Every 10 minutes the pool picks winners in secret. Your savings are never at risk.", done: eligible && !!user?.wonInDraw },
  ];
  const current = Math.max(0, steps.findIndex((s) => !s.done));
  const allDone = steps.every((s) => s.done);
  const step = steps[Math.min(current, steps.length - 1)];

  const doFaucet = () => flow.run(async (s) => { await actions.faucet(s); await refetch(); }, { successMessage: "1,000 test cUSD is in your wallet." });
  const doDeposit = () => flow.run(async (s) => { await actions.deposit(amount, s); await Promise.all([refetch(), refetchPool()]); }, { successMessage: "Saved. Your deposit is encrypted on-chain." });
  const doUnlock = () => flow.run(async (s) => { s("Waiting for your signature…"); await reveal(POOL.address, user?.poolBalance ?? null, "pool"); await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet"); }, { successMessage: "Unlocked. Only you can see these." });

  return (
    <div>
      {/* progress rail */}
      <ol className="flex items-center gap-1.5" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-1.5">
            <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition", s.done ? "bg-accent text-black" : i === current ? "border border-accent text-accent" : "border border-line text-ink-faint")}>{s.done ? "✓" : i + 1}</span>
            {i < steps.length - 1 && <span className={cn("h-[2px] flex-1 rounded-full", s.done ? "bg-accent" : "bg-white/10")} />}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div key={allDone ? "done" : step.key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.25 }} className="mt-5">
          {allDone ? (
            <>
              <div className="label">You&apos;re all set</div>
              <h3 className="mt-1 text-xl font-semibold">You&apos;re in the game.</h3>
              <p className="mt-2 text-sm text-ink-muted">Your savings are encrypted and in the next draw. Check <span className="text-ink">Your results</span> after each draw, or switch to Experienced for the full controls.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-line bg-black/20 px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Your savings</div><div className="mt-1"><EncryptedValue value={poolBal} revealed={poolBal !== undefined} size="sm" /></div></div>
                <div className="rounded-xl border border-line bg-black/20 px-3 py-2.5"><div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Next draw</div><div className="mt-1 font-mono text-lg">{state ? (drawing ? "running" : due ? "ready" : formatDuration(Number(state.nextDrawAt) - now)) : "…"}</div></div>
              </div>
            </>
          ) : (
            <>
              <div className="label">Step {current + 1} of {steps.length}</div>
              <h3 className="mt-1 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.why}</p>

              <div className="mt-4">
                {step.key === "connect" && (hasWallet ? (
                  <button className="btn-primary shine w-full py-3" disabled={isPending} onClick={() => { sfx.click(); connect({ connector: connectors[0] }); }}>{isPending ? "Connecting…" : "Connect wallet"}</button>
                ) : (
                  <a className="btn-primary shine w-full py-3" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install MetaMask, then come back</a>
                ))}
                {step.key === "faucet" && (
                  <button data-anchor="faucet" className="btn-primary shine w-full py-3" disabled={flow.state.status === "pending" || Number(user?.faucetCooldown ?? 0n) > 0} onClick={doFaucet}>
                    {Number(user?.faucetCooldown ?? 0n) > 0 ? `Try again in ${formatDuration(Number(user!.faucetCooldown))}` : flow.state.status === "pending" ? "Minting…" : "Get 1,000 test cUSD"}
                  </button>
                )}
                {step.key === "deposit" && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      {["50", "100", "250"].map((c) => (
                        <button key={c} className={cn("pill flex-1 justify-center py-2", amount === c && "border-accent/50 text-accent")} onClick={() => { setAmount(c); sfx.click(); }}>{c} cUSD</button>
                      ))}
                    </div>
                    <button data-anchor="deposit" className="btn-primary shine w-full py-3" disabled={flow.state.status === "pending" || drawing} onClick={doDeposit}>
                      {drawing ? "Paused while the draw runs" : flow.state.status === "pending" ? "Working…" : `Deposit ${amount} cUSD privately`}
                    </button>
                    <p className="text-xs text-ink-faint">Two quick confirmations the first time: one lets the pool move your cUSD, one is the deposit itself.</p>
                  </div>
                )}
                {step.key === "unlock" && (
                  <button className="btn-primary shine w-full py-3" disabled={!!busy || flow.state.status === "pending"} onClick={doUnlock}>{busy ? "Unlocking…" : "Unlock my numbers"}</button>
                )}
                {step.key === "draw" && (
                  <div className="rounded-xl border border-line bg-black/20 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-ink-muted">{eligible ? "You're in the next draw." : "You'll be in the draw after next — money needs a full round in the pool first."}</span>
                      <span className="font-mono text-lg">{state ? (drawing ? "running" : due ? "ready" : formatDuration(Number(state.nextDrawAt) - now)) : "…"}</span>
                    </div>
                    {due && <a href="#console" className="btn-primary shine mt-3 w-full py-3">Go press the button</a>}
                    {!due && !drawing && <p className="mt-3 text-xs text-ink-faint">When the countdown ends, anyone can press the big button above to run the draw. Then come back here for your result.</p>}
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
