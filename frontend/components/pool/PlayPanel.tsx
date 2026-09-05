"use client";
import { humanizeError } from "@/lib/format";

import { useEffect, useMemo, useRef, useState } from "react";
import { Wizard } from "@/components/pool/Wizard";
import { motion, AnimatePresence } from "framer-motion";
import { SuccessTick } from "@/components/ui/SuccessTick";
import { NetworkAlert } from "@/components/ui/NetworkAlert";
import { useActivity } from "@/lib/hooks/useActivity";
import { sameAddress } from "@/lib/format";
import { useAccount, useConnect } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import { usePoolState, useUserState, type UserState, Phase } from "@/lib/hooks/usePoolData";
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


/** The play area: one amount, one big button, everything narrated in plain words. */
export function PlayPanel() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { state, refetch: refetchPool } = usePoolState();
  const { user, refetch, waitFor, error: readError } = useUserState(state?.epoch);
  const actions = usePoolActions();
  const { reveal, get, busy } = useReveal();
  const flow = useActionFlow();
  const faucetFlow = useActionFlow();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"new" | "pro">("new");
  const [tick, setTick] = useState(false);
  const { rows: activity } = useActivity(12);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try { const m = localStorage.getItem("cipherpool.mode"); if (m === "pro" || m === "new") setMode(m); } catch {}
    const onHash = () => {
      const map: Record<string, Tab> = { "#deposit": "deposit", "#withdraw": "withdraw", "#wrap": "shield", "#unwrap": "unwrap", "#sponsor": "sponsor" };
      const t = map[window.location.hash];
      if (t) { setMode("pro"); setTab(t); setTimeout(() => { document.getElementById("deposit")?.scrollIntoView({ block: "start", behavior: "smooth" }); inputRef.current?.focus(); }, 400); }
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
  const max = tab === "withdraw" ? poolBal : tab === "shield" ? user?.tusdBalance : walletBal; // unwrap + deposit + sponsor draw from cUSDT in wallet
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
  const celebrate = () => { setTick(true); setTimeout(() => setTick(false), 1400); };
  const submit = () =>
    flow.run(async (setStep) => {
      const before = { pool: user?.poolBalance ?? null, wallet: user?.walletBalance ?? null, tusd: user?.tusdBalance ?? 0n };
      if (tab === "shield") await actions.shield(amount, setStep);
      else if (tab === "deposit") await actions.deposit(amount, setStep);
      else if (tab === "withdraw") await actions.withdraw(amount, setStep);
      else if (tab === "unwrap") await actions.unwrap(amount, setStep);
      else await actions.donate(amount, setStep);
      setAmount("");
      celebrate();
      setStep("Confirmed. Reading your new balances…");
      const changed = (u: UserState) =>
        tab === "shield" ? u.tusdBalance < before.tusd
        : tab === "unwrap" ? u.tusdBalance > before.tusd
        : tab === "deposit" || tab === "withdraw" ? u.poolBalance !== before.pool || u.walletBalance !== before.wallet
        : u.walletBalance !== before.wallet;
      await Promise.all([waitFor(changed), refetchPool()]);
      if (revealedAll || poolBal !== undefined) await revealAll();
      if (isConvert(tab)) setTimeout(() => setTab("deposit"), 1600); // back to the main actions
    }, { successMessage: tab === "shield" ? "Wrapped. Your cUSDT is private now." : tab === "deposit" ? "Done. Your money is in the pool, scrambled." : tab === "withdraw" ? "Done. It is back in your wallet as cUSDT." : tab === "unwrap" ? "Done. Your USDT is back in your wallet." : "Added to the prize. Thank you!" });
  const claimFaucet = () =>
    faucetFlow.run(async (setStep) => { const before = user?.tusdBalance ?? 0n; await actions.faucet(setStep); setStep("Confirmed. Reading your new balance…"); await waitFor((u) => u.tusdBalance > before); }, { successMessage: "1,000 test USDT is in your wallet. Wrap it into cUSDT to use it." });

  const verb = TABS.find((t) => t.key === tab)!.verb;
  const unit = tab === "shield" ? UNDERLYING_SYMBOL : "cUSDT";
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


      {isConnected && !user && readError && (
        <div className="mt-5 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-xs text-warn">
          Could not read your wallet from the network. {humanizeError(readError)} <button className="underline" onClick={() => void refetch()}>Try again</button>
        </div>
      )}
      {/* balance strip: one row, four cells, hairlines between */}
      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-black/20">
        <div className="flex items-center justify-between border-b border-line px-4 py-2">
          <div className="text-[11px] text-ink-faint">{isConnected ? "Your numbers. Private to you." : "Your numbers. Connect to see yours."}</div>
          {isConnected && <button className="text-[11px] text-accent hover:underline disabled:text-ink-faint" onClick={revealAll} disabled={!!busy || !user}>{busy ? "Loading…" : revealedAll ? "Refresh" : "Decrypt all"}</button>}
        </div>
        <div className="grid grid-cols-2 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b [&>*]:border-line">
          {[
            { l: "Savings", v: user?.poolBalance ? poolBal : isConnected ? null : undefined, h: user?.poolBalance ?? null, c: POOL.address, k: "pool", anchor: "position-balance", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="7" /><path d="M12 3v6M9 6l3 3 3-3" /></svg> },
            { l: "Prizes to collect", v: user?.claimable ? claimable : isConnected ? null : undefined, h: user?.claimable ?? null, c: POOL.address, k: "claim", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 text-mint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 21h8M12 17v4M5 4h14v4a7 7 0 0 1-14 0z" /><path d="M5 6H3v2a3 3 0 0 0 3 3M19 6h2v2a3 3 0 0 1-3 3" /></svg> },
            { l: "Wallet cUSDT", v: user?.walletBalance ? walletBal : isConnected ? null : undefined, h: user?.walletBalance ?? null, c: TOKEN.address, k: "wallet", icon: <svg viewBox="0 0 24 24" className="h-4 w-4 text-cipher" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg> },
          ].map((x) => (
            <div key={x.l} className="group px-4 py-3" data-anchor={x.anchor}>
              <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">{x.icon}<span>{x.l}</span></div>
              <div className="mt-1.5 flex min-h-[28px] items-center gap-2 text-[15px]">
                {!isConnected ? (
                  <span className="font-mono text-ink-faint">—</span>
                ) : (
                  <motion.span key={x.v === undefined || x.v === null ? "masked" : x.v.toString()} initial={{ scale: 0.96, opacity: 0.6 }} animate={{ scale: 1, opacity: 1 }}>
                    <EncryptedValue value={x.v} revealed={x.v !== undefined && x.v !== null} size="sm" />
                  </motion.span>
                )}
                {isConnected && x.h && x.v === undefined && (
                  <button className="text-[11px] text-accent opacity-0 transition group-hover:opacity-100 focus:opacity-100 disabled:opacity-60" disabled={!!busy} onClick={() => reveal(x.c, x.h, x.k)}>{busy === x.k ? "…" : "show"}</button>
                )}
              </div>
              {isConnected && x.k === "wallet" && (
                <div className="mt-1 flex gap-3 text-[11px]">
                  <button className="text-ink-faint hover:text-ink hover:underline" onClick={() => { setTab("shield"); setAmount(""); flow.reset(); sfx.click(); }}>Wrap USDT</button>
                  <button className="text-ink-faint hover:text-ink hover:underline" onClick={() => { setTab("unwrap"); setAmount(""); flow.reset(); sfx.click(); }}>Unwrap</button>
                </div>
              )}
            </div>
          ))}
          <div className="px-4 py-3" title="USDT is a plain test token. Anyone can see this number.">
            <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              <svg viewBox="0 0 24 24" className="h-4 w-4 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></svg>
              <span>Wallet USDT</span>
              <span className="rounded-full border border-line px-1.5 text-[9px] uppercase tracking-wider text-ink-faint">public</span>
            </div>
            <div className="mt-1.5 flex min-h-[28px] items-center font-mono text-[15px] tabular">{isConnected && user ? `${formatUnits(user.tusdBalance, DECIMALS)}` : <span className="text-ink-faint">—</span>}</div>
            {isConnected && user && user.tusdBalance > 0n && !user.walletBalance && <div className="mt-1 text-[11px] text-accent">Wrap this to start</div>}
          </div>
        </div>
      </div>
      {isConnected && address && (() => {
        const mine = activity.find((r) => r.who && sameAddress(r.who, address));
        if (!mine) return null;
        const verb = mine.kind === "deposit" ? "put money in" : mine.kind === "withdraw" ? "took money out" : mine.kind === "sponsor" ? "added to the prize" : mine.kind === "claim" ? "collected a prize" : "";
        const ago = mine.ts ? Math.max(0, Math.floor(Date.now() / 1000) - mine.ts) : undefined;
        const when = ago === undefined ? "" : ago < 60 ? "just now" : ago < 3600 ? `${Math.floor(ago / 60)} min ago` : ago < 86400 ? `${Math.floor(ago / 3600)} h ago` : `${Math.floor(ago / 86400)} d ago`;
        return verb ? <div className="mt-2 text-[11px] text-ink-faint">Last: you {verb} {when}.</div> : null;
      })()}
      {isConnected && claimable !== undefined && claimable > 0n && (
        <button className="btn-mint btn-lg shine mt-3 w-full" disabled={flow.state.status === "pending"} onClick={() => flow.run(async (s) => { const before = user?.claimable ?? null; await actions.claim(s); await waitFor((u) => u.claimable !== before); await revealAll(); }, { successMessage: "Collected. Your prize is in your wallet as cUSDT." })}>
          Collect my {formatUnits(claimable, DECIMALS)} cUSDT prize
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
                <span className="font-semibold">{tab === "shield" ? "Wrap USDT into cUSDT" : "Unwrap cUSDT into USDT"}</span>
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
            {user && user.tusdBalance === 0n && !user.walletBalance && (
              <button data-anchor="faucet" className="pill py-1.5 text-accent hover:bg-accent-faint disabled:text-ink-faint" onClick={claimFaucet} disabled={faucetFlow.state.status === "pending" || cooldown > 0} title="Free test tokens on Sepolia">
                {cooldown > 0 ? `More test USDT in ${formatDuration(cooldown)}` : "Need test USDT? Get 1,000"}
              </button>
            )}
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
              <span className="absolute inset-y-0 right-4 flex items-center font-mono text-sm text-ink-muted">{tab === "shield" ? UNDERLYING_SYMBOL : "cUSDT"}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {(() => {
                const fmt = (v: bigint) => formatUnits(v, DECIMALS).replace(/\.?0+$/, "");
                const presets: { l: string; v: string }[] = [];
                if (tab === "withdraw" && poolBal !== undefined && poolBal > 0n) presets.push({ l: "Half", v: fmt(poolBal / 2n) }, { l: "All", v: fmt(poolBal) });
                else if (tab === "unwrap" && walletBal !== undefined && walletBal > 0n) presets.push({ l: "Half", v: fmt(walletBal / 2n) }, { l: "All", v: fmt(walletBal) });
                else if (tab === "shield" && user && user.tusdBalance > 0n) presets.push({ l: "Half", v: fmt(user.tusdBalance / 2n) }, { l: "All", v: fmt(user.tusdBalance) });
                else if (walletBal !== undefined && walletBal >= 1000n * 10n ** BigInt(DECIMALS)) presets.push({ l: "250", v: "250" }, { l: "500", v: "500" }, { l: "All", v: fmt(walletBal) });
                else presets.push({ l: "25", v: "25" }, { l: "100", v: "100" }, { l: "250", v: "250" });
                return presets.map((c) => (
                  <button key={c.l} className={cn("pill py-1.5 hover:bg-white/10", amount === c.v && "border-accent/50 text-accent")} onClick={() => { setAmount(c.v); sfx.click(); }}>{c.l}</button>
                ));
              })()}
              <button className={cn("pill py-1.5 hover:bg-white/10", maxNum === undefined && "opacity-60")} onClick={() => { if (max !== undefined) setAmount(formatUnits(max, DECIMALS)); else void revealAll(); }} title={maxNum === undefined ? "Unlock your numbers to use MAX" : ""}>
                MAX{maxNum !== undefined ? ` · ${maxNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}
              </button>
            </div>
            {maxNum !== undefined && maxNum > 0 && (
              <input type="range" min={0} max={maxNum} step={maxNum / 100} value={Math.min(maxNum, Number(amount || 0))} onChange={(e) => setAmount(Number(e.target.value).toFixed(2).replace(/\.?0+$/, ""))} className="range mt-3 w-full" aria-label="Amount" />
            )}
            {tooMuch && <div className="mt-2 text-xs text-warn">That is more than you have. Only what you have will move.</div>}
            {!tooMuch && value > 0n && poolBal !== undefined && (tab === "deposit" || tab === "withdraw") && (
              <div className="mt-2 text-xs text-ink-muted">After this you will have <span className="font-mono text-ink">{formatUnits(tab === "deposit" ? poolBal + value : poolBal > value ? poolBal - value : 0n, DECIMALS)} cUSDT</span> in the pool.</div>
            )}
            <p className="mt-2 text-xs text-ink-faint">
              {tab === "shield" && "Turns your public USDT into private cUSDT, one for one. Two quick confirmations. After this, nobody can see your amounts."}
              {tab === "deposit" && "Your amount is scrambled in your browser before it is sent. The first time asks for one extra approval."}
              {tab === "withdraw" && "Take out any amount whenever the pool is open. It comes back as cUSDT. Use Unwrap to turn it back into USDT."}
              {tab === "unwrap" && "Turns private cUSDT back into public USDT, one for one. Two confirmations, with a short wait in between while the network confirms the amount."}
              {tab === "sponsor" && "Goes straight into the next prize. It cannot be taken back."}
            </p>
          </motion.div>
          </AnimatePresence>

          <NetworkAlert className="mt-4" />
          <div className="relative mt-4">
            <button data-anchor={tab === "shield" ? "shield" : "deposit"} className="btn-primary btn-lg shine w-full" onClick={submit} disabled={(!open && pausable) || value === 0n || flow.state.status === "pending"}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={flow.state.status === "pending" ? "working" : buttonLabel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.12 }}>
                  {flow.state.status === "pending" ? "Working…" : buttonLabel}
                </motion.span>
              </AnimatePresence>
            </button>
            <SuccessTick show={tick} />
          </div>
          <FlowStatus state={flow.state} className="mt-3" />
        </>
      )}
      </>
      )}
    </section>
  );
}
