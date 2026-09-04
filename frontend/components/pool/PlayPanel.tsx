"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wizard } from "@/components/pool/Wizard";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useReveal } from "@/lib/hooks/useReveal";
import { useActionFlow } from "@/lib/useActionFlow";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { POOL, TOKEN, DECIMALS, UNDERLYING_SYMBOL } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/components/ui/Countdown";
import { sfx } from "@/lib/sound";

type Tab = "shield" | "deposit" | "withdraw" | "unwrap" | "sponsor";
const TABS: { key: Tab; label: string; verb: string }[] = [
  { key: "shield", label: "Wrap", verb: "Wrap" },
  { key: "deposit", label: "Deposit", verb: "Deposit" },
  { key: "withdraw", label: "Withdraw", verb: "Withdraw" },
  { key: "unwrap", label: "Unwrap", verb: "Unwrap" },
  { key: "sponsor", label: "Add to prize", verb: "Add" },
];
const MAIN_TABS = TABS.filter((t) => t.key === "deposit" || t.key === "withdraw" || t.key === "sponsor");
const isConvert = (t: Tab) => t === "shield" || t === "unwrap";
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
  const claimable = get(user?.claimable);
  const revealedAll = poolBal !== undefined && walletBal !== undefined && claimable !== undefined;
  const max = tab === "withdraw" ? poolBal : tab === "shield" ? user?.tusdBalance : walletBal; // unwrap + deposit + sponsor draw from cUSD in wallet
  const maxNum = max !== undefined ? Number(formatUnits(max, DECIMALS)) : undefined;
  const value = useMemo(() => { try { return amount ? parseUnits(amount, DECIMALS) : 0n; } catch { return 0n; } }, [amount]);
  const tooMuch = max !== undefined && value > max;
  const cooldown = Number(user?.faucetCooldown ?? 0n);
  const eligibleNow = user && state ? user.lastTouchedEpoch !== state.epoch + 1n : false;
  const hasWallet = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum && connectors.length > 0;

  const revealAll = async () => {
    await reveal(POOL.address, user?.poolBalance ?? null, "pool");
    await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet");
    await reveal(POOL.address, user?.claimable ?? null, "claim");
  };
  const submit = () =>
    flow.run(async (setStep) => {
      if (tab === "shield") await actions.shield(amount, setStep);
      else if (tab === "deposit") await actions.deposit(amount, setStep);
      else if (tab === "withdraw") await actions.withdraw(amount, setStep);
      else if (tab === "unwrap") await actions.unwrap(amount, setStep);
      else await actions.donate(amount, setStep);
      setAmount("");
      await Promise.all([refetch(), refetchPool()]);
      if (revealedAll || poolBal !== undefined) await revealAll();
    }, { successMessage: tab === "shield" ? "Wrapped. Your cUSD is private now." : tab === "deposit" ? "Done. Your money is in the pool, scrambled." : tab === "withdraw" ? "Done. It is back in your wallet as cUSD." : tab === "unwrap" ? "Done. Your tUSD is back in your wallet." : "Added to the prize. Thank you!" });
  const claimFaucet = () =>
    faucetFlow.run(async (setStep) => { await actions.faucet(setStep); await refetch(); }, { successMessage: "1,000 test tUSD is in your wallet. Wrap it into cUSD to use it." });

  const verb = TABS.find((t) => t.key === tab)!.verb;
  const unit = tab === "shield" ? UNDERLYING_SYMBOL : "cUSD";
  const pausable = tab === "deposit" || tab === "withdraw" || tab === "sponsor";
  const buttonLabel = !open && pausable ? "Paused during the draw" : value > 0n ? `${verb} ${amount} ${unit}` : `${verb} ${unit}`;

  return (
    <section className="card min-w-0 overflow-hidden p-6 sm:p-7" id="deposit">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="display text-2xl">Play</h2>
          <div className="mt-1 text-xs text-ink-faint">Put money in, win prizes, take money out. Your numbers stay private.</div>
        </div>
        <div className="flex w-max rounded-full bg-black/40 p-1" role="tablist" aria-label="Experience">
          {(["new", "pro"] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className={cn("relative whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition", mode === m ? "text-black" : "text-ink-muted hover:text-ink")} onClick={() => pickMode(m)}>
              {mode === m && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">{m === "new" ? "New here" : "Experienced"}</span>
            </button>
          ))}
        </div>
      </div>
      {mode === "new" ? (
        <div className="mt-5"><Wizard onSkip={() => pickMode("pro")} /></div>
      ) : (
      <>
      {isConnected && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-ink-faint">Your numbers are private. One signature shows them to you only.</div>
          <button className="btn-secondary btn-sm" onClick={revealAll} disabled={!!busy || !user}>{busy ? "Loading…" : revealedAll ? "Refresh" : "Show all"}</button>
        </div>
      )}

      {/* your numbers: four cards, each can be shown on its own */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { l: "Your savings", v: user?.poolBalance ? poolBal : isConnected ? null : undefined, h: user?.poolBalance ?? null, c: POOL.address, k: "pool", anchor: "position-balance", tone: "accent" },
          { l: "Prizes to claim", v: user?.claimable ? claimable : isConnected ? null : undefined, h: user?.claimable ?? null, c: POOL.address, k: "claim", tone: "mint" },
          { l: "cUSD in wallet", v: user?.walletBalance ? walletBal : isConnected ? null : undefined, h: user?.walletBalance ?? null, c: TOKEN.address, k: "wallet", tone: "cipher" },
        ].map((x) => (
          <motion.div key={x.l} layout className="group relative rounded-xl border border-line bg-black/20 px-3 py-2.5" data-anchor={x.anchor}>
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{x.l}</div>
              <span className={cn("h-1.5 w-1.5 rounded-full", x.tone === "accent" ? "bg-accent" : x.tone === "mint" ? "bg-mint" : "bg-cipher")} />
            </div>
            <motion.div key={x.v === undefined || x.v === null ? "masked" : x.v.toString()} initial={{ scale: 0.96, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }} className="mt-1">
              <EncryptedValue value={x.v} revealed={x.v !== undefined && x.v !== null} size="sm" />
            </motion.div>
            {isConnected && x.h && x.v === undefined && (
              <button className="mt-1 text-[11px] text-accent hover:underline disabled:text-ink-faint" disabled={!!busy} onClick={() => reveal(x.c, x.h, x.k)}>{busy === x.k ? "Loading…" : "Show"}</button>
            )}
            {isConnected && x.k === "wallet" && (
              <div className="mt-1 flex gap-2 text-[11px]">
                <button className="text-ink-muted hover:text-ink hover:underline" onClick={() => { setTab("shield"); setAmount(""); flow.reset(); sfx.click(); }}>Wrap tUSD</button>
                <button className="text-ink-muted hover:text-ink hover:underline" onClick={() => { setTab("unwrap"); setAmount(""); flow.reset(); sfx.click(); }}>Unwrap</button>
              </div>
            )}
          </motion.div>
        ))}
        <div className="rounded-xl border border-line bg-black/20 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">tUSD in wallet</div>
            <span className="rounded-full border border-line px-1.5 text-[9px] uppercase tracking-wider text-ink-faint">public</span>
          </div>
          <div className="mt-1 font-mono text-sm tabular">{isConnected && user ? `${formatUnits(user.tusdBalance, DECIMALS)} ${UNDERLYING_SYMBOL}` : "—"}</div>
          {isConnected && user && user.tusdBalance > 0n && !user.walletBalance && <div className="mt-1 text-[11px] text-accent">Wrap this to start</div>}
        </div>
      </div>
      {isConnected && claimable !== undefined && claimable > 0n && (
        <button className="btn-mint btn-lg shine mt-3 w-full" disabled={flow.state.status === "pending"} onClick={() => flow.run(async (s) => { await actions.claim(s); await refetch(); await revealAll(); }, { successMessage: "Collected. Your prize is in your wallet as cUSD." })}>
          Collect my {formatUnits(claimable, DECIMALS)} cUSD prize
        </button>
      )}
      {isConnected && user?.isParticipant && (
        <div className={cn("mt-2 text-xs", eligibleNow ? "text-ok" : "text-warn")}>
          {eligibleNow ? "You're in the next draw." : "Money moved this round counts from the draw after next."}
        </div>
      )}

      {!isConnected ? (
        <div className="mt-5">
          <p className="text-sm leading-relaxed text-ink-muted">This is all anyone can see about you. Connect a wallet to get free test money, put some in, and see your own numbers.</p>
          {hasWallet ? (
            <button className="btn-primary btn-lg btn-arrow shine mt-4 w-full" disabled={isPending} onClick={() => { sfx.click(); connect({ connector: connectors[0] }); }}>{isPending ? "Connecting…" : "Connect wallet to play"}</button>
          ) : (
            <a className="btn-primary btn-lg btn-arrow shine mt-4 w-full" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install a wallet to play</a>
          )}
        </div>
      ) : (
        <>
          {/* actions */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {isConvert(tab) ? (
              <div className="flex items-center gap-2 text-sm">
                <button className="btn-ghost btn-sm !px-2" onClick={() => { setTab("deposit"); setAmount(""); flow.reset(); sfx.click(); }} aria-label="Back to actions">←</button>
                <span className="font-semibold">{tab === "shield" ? "Wrap tUSD into cUSD" : "Unwrap cUSD into tUSD"}</span>
              </div>
            ) : (
              <div className="flex rounded-full bg-black/40 p-1">
                {MAIN_TABS.map((t) => (
                  <button key={t.key} className={cn("relative rounded-full px-3.5 py-1.5 text-[13px] font-medium transition", tab === t.key ? "text-black" : "text-ink-muted hover:text-ink")} onClick={() => { setTab(t.key); setAmount(""); flow.reset(); sfx.click(); }}>
                    {tab === t.key && <motion.span layoutId="play-tab" className="absolute inset-0 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
                    <span className="relative">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
            <button data-anchor="faucet" className="pill py-1.5 text-accent hover:bg-accent-faint disabled:text-ink-faint" onClick={claimFaucet} disabled={faucetFlow.state.status === "pending" || cooldown > 0} title="Free test tokens on Sepolia">
              {cooldown > 0 ? `More test tUSD in ${formatDuration(cooldown)}` : "Need test tUSD? Get 1,000"}
            </button>
          </div>
          <FlowStatus state={faucetFlow.state} className="mt-2" />

          {/* amount */}
          <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} className="mt-4">
            <div className="relative">
              <input
                ref={inputRef}
                inputMode="decimal"
                className="input pr-20 text-2xl"
                placeholder="0"
                value={amount}
                disabled={flow.state.status === "pending" || (!open && pausable)}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if ((v.match(/\./g) ?? []).length > 1) return; setAmount(v); }}
              />
              <span className="absolute inset-y-0 right-4 flex items-center font-mono text-sm text-ink-muted">{tab === "shield" ? UNDERLYING_SYMBOL : "cUSD"}</span>
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
            {tooMuch && <div className="mt-2 text-xs text-warn">That is more than you have. Only what you have will move.</div>}
            {!tooMuch && value > 0n && poolBal !== undefined && (tab === "deposit" || tab === "withdraw") && (
              <div className="mt-2 text-xs text-ink-muted">After this you will have <span className="font-mono text-ink">{formatUnits(tab === "deposit" ? poolBal + value : poolBal > value ? poolBal - value : 0n, DECIMALS)} cUSD</span> in the pool.</div>
            )}
            <p className="mt-2 text-xs text-ink-faint">
              {tab === "shield" && "Turns your public tUSD into private cUSD, one for one. Two quick confirmations. After this, nobody can see your amounts."}
              {tab === "deposit" && "Your amount is scrambled in your browser before it is sent. The first time asks for one extra approval."}
              {tab === "withdraw" && "Take out any amount whenever the pool is open. It comes back as cUSD. Use Unwrap to turn it back into tUSD."}
              {tab === "unwrap" && "Turns private cUSD back into public tUSD, one for one. Two confirmations, with a short wait in between while the network confirms the amount."}
              {tab === "sponsor" && "Goes straight into the next prize. It cannot be taken back."}
            </p>
          </motion.div>
          </AnimatePresence>

          <button data-anchor={tab === "shield" ? "shield" : "deposit"} className="btn-primary btn-lg shine mt-4 w-full" onClick={submit} disabled={(!open && pausable) || value === 0n || flow.state.status === "pending"}>
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
