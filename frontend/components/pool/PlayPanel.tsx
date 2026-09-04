"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wizard } from "@/components/pool/Wizard";
import { motion } from "framer-motion";
import { useAccount, useConnect } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useReveal } from "@/lib/hooks/useReveal";
import { useActionFlow } from "@/lib/useActionFlow";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { POOL, TOKEN, DECIMALS } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/components/ui/Countdown";
import { sfx } from "@/lib/sound";

type Tab = "deposit" | "withdraw" | "sponsor";
const TABS: { key: Tab; label: string; verb: string }[] = [
  { key: "deposit", label: "Deposit", verb: "Deposit" },
  { key: "withdraw", label: "Withdraw", verb: "Withdraw" },
  { key: "sponsor", label: "Add to prize", verb: "Add" },
];
const CHIPS = ["25", "100", "250"];

/** The play area: one amount, one big button, everything narrated in plain words. */
export function PlayPanel() {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { state, refetch: refetchPool } = usePoolState();
  const { user, refetch } = useUserState(state?.epoch);
  const actions = usePoolActions();
  const { reveal, get, busy } = useReveal();
  const flow = useActionFlow();
  const faucetFlow = useActionFlow();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"new" | "pro">("new");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try { const m = localStorage.getItem("cipherpool.mode"); if (m === "pro" || m === "new") setMode(m); } catch {}
    const onHash = () => {
      if (window.location.hash === "#deposit") { setMode("pro"); setTab("deposit"); setTimeout(() => inputRef.current?.focus(), 400); }
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const pickMode = (m: "new" | "pro") => { setMode(m); sfx.click(); try { localStorage.setItem("cipherpool.mode", m); } catch {} };

  const open = state?.phase === Phase.Open;
  const poolBal = get(user?.poolBalance);
  const walletBal = get(user?.walletBalance);
  const winnings = get(user?.winnings);
  const revealedAll = poolBal !== undefined && walletBal !== undefined && winnings !== undefined;
  const max = tab === "withdraw" ? poolBal : walletBal;
  const maxNum = max !== undefined ? Number(formatUnits(max, DECIMALS)) : undefined;
  const value = useMemo(() => { try { return amount ? parseUnits(amount, DECIMALS) : 0n; } catch { return 0n; } }, [amount]);
  const tooMuch = max !== undefined && value > max;
  const cooldown = Number(user?.faucetCooldown ?? 0n);
  const eligibleNow = user && state ? user.lastTouchedEpoch !== state.epoch + 1n : false;
  const hasWallet = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum && connectors.length > 0;

  const revealAll = async () => {
    await reveal(POOL.address, user?.poolBalance ?? null, "pool");
    await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet");
    await reveal(POOL.address, user?.winnings ?? null, "win");
  };
  const submit = () =>
    flow.run(async (setStep) => {
      if (tab === "deposit") await actions.deposit(amount, setStep);
      else if (tab === "withdraw") await actions.withdraw(amount, setStep);
      else await actions.donate(amount, setStep);
      setAmount("");
      await Promise.all([refetch(), refetchPool()]);
      if (revealedAll || poolBal !== undefined) await revealAll();
    }, { successMessage: tab === "deposit" ? "Saved. Your deposit is encrypted on-chain." : tab === "withdraw" ? "Withdrawn. It's back in your wallet." : "Added to the prize. Thank you!" });
  const claimFaucet = () =>
    faucetFlow.run(async (setStep) => { await actions.faucet(setStep); await refetch(); if (walletBal !== undefined) await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet"); }, { successMessage: "1,000 test cUSD is in your wallet." });

  const verb = TABS.find((t) => t.key === tab)!.verb;
  const buttonLabel = !open ? "Paused while the draw runs" : value > 0n ? `${verb} ${amount} cUSD` : `${verb} cUSD`;

  return (
    <section className="card min-w-0 overflow-hidden p-6 sm:p-7" id="deposit">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="display text-2xl">Play</h2>
          <div className="mt-1 text-xs text-ink-faint">Save, win, withdraw. Everything about you stays encrypted.</div>
        </div>
        <div className="flex rounded-full bg-black/40 p-1" role="tablist" aria-label="Experience">
          {(["new", "pro"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={cn("relative rounded-full px-3 py-1 text-[12px] font-medium transition", mode === m ? "text-black" : "text-ink-muted hover:text-ink")} onClick={() => pickMode(m)}>
              {mode === m && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{m === "new" ? "New here" : "Experienced"}</span>
            </button>
          ))}
        </div>
      </div>
      {mode === "new" ? (
        <div className="mt-5"><Wizard /></div>
      ) : (
      <>
      {isConnected && (
        <div className="mt-4 flex justify-end">
          <button className="btn-secondary text-xs" onClick={revealAll} disabled={!!busy || !user}>{busy ? "Unlocking…" : revealedAll ? "Refresh numbers" : "Unlock my numbers"}</button>
        </div>
      )}

      {/* your three numbers */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[
          { l: "Your savings", v: user?.poolBalance ? poolBal : isConnected ? null : undefined, key: "position-balance" },
          { l: "Prizes you've won", v: user?.winnings ? winnings : isConnected ? null : undefined },
          { l: "In your wallet", v: user?.walletBalance ? walletBal : isConnected ? null : undefined },
        ].map((x) => (
          <div key={x.l} className="rounded-xl border border-line bg-black/20 px-3 py-2.5" data-anchor={x.key}>
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{x.l}</div>
            <div className="mt-1"><EncryptedValue value={x.v} revealed={x.v !== undefined && x.v !== null} size="sm" /></div>
          </div>
        ))}
      </div>
      {isConnected && user?.isParticipant && (
        <div className={cn("mt-2 text-xs", eligibleNow ? "text-ok" : "text-warn")}>
          {eligibleNow ? "You're in the next draw." : "Money moved this round counts from the draw after next."}
        </div>
      )}

      {!isConnected ? (
        <div className="mt-5">
          <p className="text-sm leading-relaxed text-ink-muted">This is all anyone can see of you — including the pool itself. Connect to get test cUSD, save privately, and unlock your own numbers.</p>
          {hasWallet ? (
            <button className="btn-primary shine mt-4 w-full" disabled={isPending} onClick={() => { sfx.click(); connect({ connector: connectors[0] }); }}>{isPending ? "Connecting…" : "Connect wallet to play"}</button>
          ) : (
            <a className="btn-primary shine mt-4 w-full" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install a wallet to play</a>
          )}
        </div>
      ) : (
        <>
          {/* tabs */}
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex rounded-full bg-black/40 p-1">
              {TABS.map((t) => (
                <button key={t.key} className={cn("relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", tab === t.key ? "text-black" : "text-ink-muted hover:text-ink")} onClick={() => { setTab(t.key); setAmount(""); flow.reset(); sfx.click(); }}>
                  {tab === t.key && <motion.span layoutId="play-tab" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                  <span className="relative">{t.label}</span>
                </button>
              ))}
            </div>
            <button data-anchor="faucet" className="pill py-1.5 text-accent hover:bg-accent-faint disabled:text-ink-faint" onClick={claimFaucet} disabled={faucetFlow.state.status === "pending" || cooldown > 0} title="Free test tokens on Sepolia">
              {cooldown > 0 ? `More test cUSD in ${formatDuration(cooldown)}` : "Need test cUSD? Get 1,000"}
            </button>
          </div>
          <FlowStatus state={faucetFlow.state} className="mt-2" />

          {/* amount */}
          <div className="mt-4">
            <div className="relative">
              <input
                ref={inputRef}
                inputMode="decimal"
                className="input pr-20 text-2xl"
                placeholder="0"
                value={amount}
                disabled={flow.state.status === "pending" || !open}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) ?? []).length > 1) return; setAmount(v); }}
              />
              <span className="absolute inset-y-0 right-4 flex items-center font-mono text-sm text-ink-muted">cUSD</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {CHIPS.map((c) => (
                <button key={c} className={cn("pill py-1.5 hover:bg-white/10", amount === c && "border-accent/50 text-accent")} onClick={() => { setAmount(c); sfx.click(); }}>{c}</button>
              ))}
              <button className={cn("pill py-1.5 hover:bg-white/10", maxNum === undefined && "opacity-60")} onClick={() => { if (max !== undefined) setAmount(formatUnits(max, DECIMALS)); else void revealAll(); }} title={maxNum === undefined ? "Unlock your numbers to use MAX" : ""}>
                MAX{maxNum !== undefined ? ` · ${maxNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}
              </button>
            </div>
            {maxNum !== undefined && maxNum > 0 && (
              <input type="range" min={0} max={maxNum} step={maxNum / 100} value={Math.min(maxNum, Number(amount || 0))} onChange={(e) => setAmount(Number(e.target.value).toFixed(2).replace(/\.?0+$/, ""))} className="range mt-3 w-full" aria-label="Amount" />
            )}
            {tooMuch && <div className="mt-2 text-xs text-warn">That&apos;s more than you have. Anything above your balance simply won&apos;t move.</div>}
            <p className="mt-2 text-xs text-ink-faint">
              {tab === "deposit" && "Encrypted in your browser before it touches the chain. First time includes a one-off approval."}
              {tab === "withdraw" && "Take out any amount, any time the pool is open. Your money never went anywhere else."}
              {tab === "sponsor" && "Goes straight into the prize for the next draw. It can't be withdrawn."}
            </p>
          </div>

          <button data-anchor="deposit" className="btn-primary shine mt-4 w-full py-3.5 text-[15px]" onClick={submit} disabled={!open || value === 0n || flow.state.status === "pending"}>
            {flow.state.status === "pending" ? "Working…" : buttonLabel}
          </button>
          <FlowStatus state={flow.state} className="mt-3" />
        </>
      )}
      </>
      )}
    </section>
  );
}
