"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import { usePoolState, useUserState, useDraws, useUserDrawCredits, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useActivity } from "@/lib/hooks/useActivity";
import { useActionFlow } from "@/lib/useActionFlow";
import { Identicon } from "@/components/layout/Identicon";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { useNow, formatDuration } from "@/components/ui/Countdown";
import { truncateAddress, sameAddress, formatAmount } from "@/lib/format";
import { POOL, TOKEN, TUSD, DECIMALS, SYMBOL, UNDERLYING_SYMBOL, etherscanAddr, etherscanTx } from "@/lib/contracts";
import { getSessionInfo } from "@/lib/fhevm/useDecryptSession";
import { sfx } from "@/lib/sound";
import { NetworkAlert } from "@/components/ui/NetworkAlert";
import { cn } from "@/lib/cn";

const VERB: Record<string, string> = { deposit: "Put money in", withdraw: "Took money out", sponsor: "Added to the prize", claim: "Collected a prize" };

export function WalletView() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { state } = usePoolState();
  const { user, refetch } = useUserState(state?.epoch);
  const { draws } = useDraws(state?.epoch);
  const done = useMemo(() => draws.filter((d) => d.completedAt > 0n), [draws]);
  const { credits } = useUserDrawCredits(done.map((d) => d.epoch));
  const { rows } = useActivity(40);
  const pub = usePublicReveal();
  const { reveal, get, busy } = useReveal();
  const actions = usePoolActions();
  const flow = useActionFlow();
  const now = useNow();
  const [copied, setCopied] = useState(false);

  const poolBal = get(user?.poolBalance);
  const walletBal = get(user?.walletBalance);
  const claimable = get(user?.claimable);
  const winnings = get(user?.winnings);
  const session = getSessionInfo(chainId, address);
  const wrongChain = isConnected && chainId !== sepolia.id;
  const running = !!state && state.phase !== Phase.Open;
  const nextIn = state ? Math.max(0, Number(state.nextDrawAt) - now) : 0;
  const mineRows = rows.filter((r) => r.who && address && sameAddress(r.who, address));
  const entered = credits.filter(Boolean).length;
  const wins = credits.filter((h) => { const v = h ? get(h) : undefined; return v !== undefined && v > 0n; }).length;

  const showAll = async () => {
    await reveal(POOL.address, user?.poolBalance ?? null, "pool");
    await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet");
    await reveal(POOL.address, user?.claimable ?? null, "claim");
    await reveal(POOL.address, user?.winnings ?? null, "win");
  };
  const copy = async () => { if (address) { await navigator.clipboard.writeText(address); setCopied(true); sfx.click(); setTimeout(() => setCopied(false), 1200); } };

  if (!isConnected) {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-line bg-black/20"><svg viewBox="0 0 24 24" className="h-6 w-6 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M16 12h.01M3 10h18" /></svg></div>
        <h1 className="display mt-4 text-2xl">Your wallet</h1>
        <p className="mt-2 text-sm text-ink-muted">Connect to see your balances, prizes waiting for you, your draws and everything you have done here.</p>
        {connectors.length > 0 ? (
          <button className="btn-primary btn-lg btn-arrow shine mt-5" disabled={isPending} onClick={() => { sfx.click(); connect({ connector: connectors[0] }); }}>{isPending ? "Connecting…" : "Connect wallet"}</button>
        ) : (
          <a className="btn-primary btn-lg btn-arrow shine mt-5" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get MetaMask</a>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* account */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <span className="rounded-xl ring-2 ring-accent/40"><Identicon address={address!} size={48} /></span>
          <div>
            <div className="flex items-center gap-2 font-mono text-lg">{truncateAddress(address, 8, 6)}
              <button className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-faint hover:text-ink" onClick={copy}>{copied ? "copied" : "copy"}</button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
              <span className={cn("inline-flex items-center gap-1.5", wrongChain ? "text-warn" : "text-ink-muted")}><span className={cn("h-1.5 w-1.5 rounded-full", wrongChain ? "bg-warn" : "bg-ok")} />{wrongChain ? "Wrong network" : "Sepolia test network"}</span>
              {wrongChain && <button className="text-warn underline" onClick={() => switchChain({ chainId: sepolia.id })}>Switch</button>}
              <a className="text-ink-faint hover:text-ink" href={etherscanAddr(address!)} target="_blank" rel="noreferrer">Etherscan ↗</a>
              <span className="text-ink-faint">{session.active ? `Numbers unlocked · ${session.daysLeft}d left` : "Numbers locked"}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary btn-sm" onClick={showAll} disabled={!!busy}>{busy ? "Loading…" : "Show all numbers"}</button>
          <button className="btn-ghost btn-sm text-danger" onClick={() => disconnect()}>Disconnect</button>
        </div>
      </div>

      <NetworkAlert />
      {/* prizes waiting */}
      <AnimatePresence>
        {claimable !== undefined && claimable > 0n && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-mint/40 bg-mint/10 px-5 py-4">
            <div><div className="text-sm text-ink-muted">Prize waiting for you</div><div className="display text-2xl text-mint">{formatAmount(claimable, DECIMALS, { maxFractionDigits: 2 })} {SYMBOL}</div></div>
            <button className="btn-mint" disabled={flow.state.status === "pending"} onClick={() => flow.run(async (s) => { await actions.claim(s); await refetch(); await reveal(POOL.address, user?.claimable ?? null, "claim"); await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet"); }, { successMessage: "Collected. It is in your wallet as cUSD." })}>{flow.state.status === "pending" ? "Collecting…" : "Collect to wallet"}</button>
          </motion.div>
        )}
      </AnimatePresence>
      <FlowStatus state={flow.state} />

      {/* balances */}
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="display text-xl">Balances</h2><span className="text-[11px] text-ink-faint">Private to you unless marked</span></div>
          <div className="mt-4 grid grid-cols-2 overflow-hidden rounded-2xl border border-line bg-black/20 [&>*:nth-child(odd)]:border-r [&>*:nth-child(-n+2)]:border-b [&>*]:border-line">
            {[
              { l: "Savings in the pool", v: user?.poolBalance ? poolBal : null, h: user?.poolBalance ?? null, c: POOL.address, k: "pool", tone: "bg-accent" },
              { l: "Prizes to collect", v: user?.claimable ? claimable : null, h: user?.claimable ?? null, c: POOL.address, k: "claim", tone: "bg-mint" },
              { l: "cUSD in wallet", v: user?.walletBalance ? walletBal : null, h: user?.walletBalance ?? null, c: TOKEN.address, k: "wallet", tone: "bg-cipher" },
              { l: "Total won so far", v: user?.winnings ? winnings : null, h: user?.winnings ?? null, c: POOL.address, k: "win", tone: "bg-accent" },
            ].map((x) => (
              <div key={x.l} className="group px-4 py-3">
                <div className="flex items-center gap-1.5 text-[12px] text-ink-muted"><span className={cn("h-1.5 w-1.5 rounded-full", x.tone)} />{x.l}</div>
                <div className="mt-1.5 flex min-h-[28px] items-center gap-2 text-[15px]">
                  <EncryptedValue value={x.v} revealed={x.v !== undefined && x.v !== null} size="sm" />
                  {x.h && x.v === undefined && <button className="text-[11px] text-accent opacity-0 group-hover:opacity-100 focus:opacity-100" disabled={!!busy} onClick={() => reveal(x.c, x.h, x.k)}>{busy === x.k ? "…" : "show"}</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-black/20 px-4 py-3">
            <div className="text-[12px] text-ink-muted">tUSD in wallet <span className="ml-1 rounded-full border border-line px-1.5 text-[9px] uppercase tracking-wider text-ink-faint">public</span></div>
            <div className="font-mono text-[15px] tabular">{user ? formatUnits(user.tusdBalance, DECIMALS) : "…"} {UNDERLYING_SYMBOL}</div>
          </div>
        </div>

        {/* actions */}
        <div className="card p-5 sm:p-6">
          <h2 className="display text-xl">Do something</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              { l: "Deposit", d: "Put money in", href: "/#deposit", primary: true },
              { l: "Withdraw", d: "Take money out", href: "/#withdraw" },
              { l: "Wrap", d: "tUSD → cUSD", href: "/#wrap" },
              { l: "Unwrap", d: "cUSD → tUSD", href: "/#unwrap" },
            ].map((a) => (
              <Link key={a.l} href={a.href} className={cn("rounded-xl border px-4 py-3 transition hover:-translate-y-0.5", a.primary ? "border-accent/50 bg-accent-faint" : "border-line bg-black/20 hover:border-line-strong")} onClick={() => sfx.click()}>
                <div className={cn("font-semibold", a.primary && "text-accent")}>{a.l}</div>
                <div className="text-[11px] text-ink-faint">{a.d}</div>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-line bg-black/20 px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">{running ? "Draw" : "Next draw in"}</div>
            <div className="mt-1 font-mono text-2xl tabular">{!state ? "…" : running ? "running" : nextIn > 0 ? formatDuration(nextIn) : "ready"}</div>
            <Link href="/#console" className="mt-2 inline-block text-xs text-accent hover:underline">Go to the button →</Link>
          </div>
        </div>
      </div>

      {/* draws + activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="display text-xl">Your draws</h2><span className="pill">{entered} entered · {wins} won</span></div>
          <ul className="mt-4 divide-y divide-line text-sm">
            {done.slice(0, 8).map((d, i) => { const h = credits[i] ?? null; const v = h ? get(h) : undefined; const prize = pub.values[d.prize]; return (
              <li key={d.epoch.toString()} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-3"><span className="font-mono text-xs text-ink-muted">#{d.epoch.toString()}</span><span className="font-mono text-xs">{prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : "…"}</span></span>
                <span>{!h ? <span className="text-[11px] text-ink-faint">not in</span> : v === undefined ? <button className="btn-glass btn-sm" disabled={!!busy} onClick={() => reveal(POOL.address, h, `d-${d.epoch}`)}>Check</button> : v > 0n ? <span className="rounded-full bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">+{formatAmount(v, DECIMALS, { maxFractionDigits: 2 })}</span> : <span className="text-[11px] text-ink-faint">no prize</span>}</span>
              </li>
            ); })}
            {done.length === 0 && <li className="py-2 text-xs text-ink-faint">No draws yet.</li>}
          </ul>
          <Link href="/draws" className="mt-3 inline-block text-xs text-accent hover:underline">All prizes →</Link>
        </div>
        <div className="card p-5 sm:p-6">
          <h2 className="display text-xl">What you have done</h2>
          <ul className="mt-4 space-y-1.5 text-sm">
            {mineRows.slice(0, 10).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-black/20 px-3 py-2">
                <span>{VERB[r.kind] ?? r.kind} <span className="text-ink-faint">(amount hidden)</span></span>
                <a className="font-mono text-[11px] text-ink-faint hover:text-ink" href={etherscanTx(r.id.split("-")[0])} target="_blank" rel="noreferrer">{r.ts ? ago(r.ts) : ""} ↗</a>
              </li>
            ))}
            {mineRows.length === 0 && <li className="text-xs text-ink-faint">Nothing yet. Your deposits, withdrawals and prizes show up here.</li>}
          </ul>
        </div>
      </div>

      <div className="text-[11px] text-ink-faint">Contracts: <a className="hover:text-ink" href={etherscanAddr(POOL.address)} target="_blank" rel="noreferrer">pool</a> · <a className="hover:text-ink" href={etherscanAddr(TOKEN.address)} target="_blank" rel="noreferrer">cUSD</a> · <a className="hover:text-ink" href={etherscanAddr(TUSD.address)} target="_blank" rel="noreferrer">tUSD</a></div>
    </div>
  );
}

function ago(ts: number) {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
