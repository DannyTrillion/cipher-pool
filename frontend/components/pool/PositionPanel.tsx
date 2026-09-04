"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useAccount, useConnect } from "wagmi";
import { formatUnits } from "viem";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useReveal } from "@/lib/hooks/useReveal";
import { useActionFlow } from "@/lib/useActionFlow";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { AmountInput } from "@/components/ui/AmountInput";
import { POOL, TOKEN, DECIMALS } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/components/ui/Countdown";

type Tab = "deposit" | "withdraw" | "sponsor";

function ConnectInline() {
  const { connect, connectors, isPending } = useConnect();
  const hasWallet = typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum && connectors.length > 0;
  return hasWallet ? (
    <button className="btn-primary shine mt-5 w-full" disabled={isPending} onClick={() => connect({ connector: connectors[0] })}>
      {isPending ? "Connecting…" : "Connect wallet to start"}
    </button>
  ) : (
    <a className="btn-primary shine mt-5 w-full" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Install a wallet to start</a>
  );
}

export function PositionPanel() {
  const { isConnected } = useAccount();
  const { state, refetch: refetchPool } = usePoolState();
  const { user, refetch } = useUserState(state?.epoch);
  const actions = usePoolActions();
  const { reveal, get, busy } = useReveal();
  const flow = useActionFlow();
  const faucetFlow = useActionFlow();
  const [tab, setTab] = useState<Tab>("deposit");
  const [amount, setAmount] = useState("");

  const open = state?.phase === Phase.Open;
  const poolBal = get(user?.poolBalance);
  const walletBal = get(user?.walletBalance);
  const winnings = get(user?.winnings);
  const revealedAll = poolBal !== undefined && walletBal !== undefined && winnings !== undefined;

  const revealAll = async () => {
    await reveal(POOL.address, user?.poolBalance ?? null, "pool");
    await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet");
    await reveal(POOL.address, user?.winnings ?? null, "win");
  };

  const submit = async () => {
    await flow.run(
      async (setStep) => {
        if (tab === "deposit") await actions.deposit(amount, setStep);
        else if (tab === "withdraw") await actions.withdraw(amount, setStep);
        else await actions.donate(amount, setStep);
        setAmount("");
        await Promise.all([refetch(), refetchPool()]);
        // Re-reveal the affected balances so the user sees the change.
        if (poolBal !== undefined || walletBal !== undefined) await revealAll();
      },
      { successMessage: tab === "deposit" ? "Deposit confirmed — encrypted on-chain." : tab === "withdraw" ? "Withdrawal confirmed." : "Prize sponsored — thank you!" },
    );
  };

  const claimFaucet = () =>
    faucetFlow.run(
      async (setStep) => {
        await actions.faucet(setStep);
        await refetch();
        if (walletBal !== undefined) await reveal(TOKEN.address, user?.walletBalance ?? null, "wallet");
      },
      { successMessage: "1,000 cUSD minted to your wallet." },
    );

  const setMax = () => {
    if (tab === "withdraw" && poolBal !== undefined) setAmount(formatUnits(poolBal, DECIMALS));
    if (tab !== "withdraw" && walletBal !== undefined) setAmount(formatUnits(walletBal, DECIMALS));
  };

  if (!isConnected) {
    return (
      <section className="card card-hover p-6 sm:p-7" id="position">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">Your position</div>
            <div className="mt-1 text-xs text-ink-faint">Encrypted on-chain · reveal with one signature</div>
          </div>
          <span className="pill border-cipher/30 text-cipher">Preview</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {["In the pool", "Lifetime winnings", "Wallet cUSD"].map((l) => (
            <div key={l}>
              <div className="label">{l}</div>
              <div className="mt-1"><EncryptedValue value={undefined} revealed={false} size="lg" /></div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm leading-relaxed text-ink-muted">
          This is what everyone else sees of your position — including the contract. Connect a wallet on Sepolia to take test cUSD from the faucet, deposit privately, and reveal your own numbers.
        </p>
        <ol className="mt-4 grid grid-cols-3 gap-2 text-xs">
          {["Get test cUSD", "Deposit privately", "Wait for the draw"].map((t, i) => (
            <li key={t} className="rounded-xl border border-line px-2.5 py-2 text-ink-faint">
              <span className="font-mono text-accent">{i + 1}.</span> {t}
            </li>
          ))}
        </ol>
        <ConnectInline />
      </section>
    );
  }

  const cooldown = Number(user?.faucetCooldown ?? 0n);
  const eligibleNow = user && state ? user.lastTouchedEpoch !== state.epoch + 1n : false;
  const step = !user ? 0 : !user.walletBalance && !user.poolBalance ? 1 : !user.poolBalance ? 2 : 3;

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label">Your position</div>
          <div className="mt-1 text-xs text-ink-faint">Encrypted on-chain · reveal with one signature</div>
        </div>
        <button className="btn-secondary" onClick={revealAll} disabled={!!busy || !user}>
          {busy ? "Revealing…" : revealedAll ? "Refresh" : "Reveal balances"}
        </button>
      </div>

      {step > 0 && step < 3 && (
        <ol className="mt-4 grid grid-cols-3 gap-2 text-xs">
          {["Get test cUSD", "Deposit privately", "Wait for the draw"].map((t, i) => (
            <li key={t} className={cn("rounded-lg border px-2.5 py-2", i + 1 === step ? "border-accent/50 bg-accent-faint text-ink" : i + 1 < step ? "border-line text-ink-faint line-through" : "border-line text-ink-faint")}>
              <span className="font-mono text-accent">{i + 1}.</span> {t}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <div className="label">In the pool</div>
          <div className="mt-1" data-anchor="position-balance"><EncryptedValue value={user ? (user.poolBalance ? poolBal : null) : undefined} revealed={poolBal !== undefined} size="lg" /></div>
          {user?.isParticipant && (
            <div className={cn("mt-1 text-xs", eligibleNow ? "text-ok" : "text-warn")}>
              {eligibleNow ? "Fully eligible for the next draw" : "Moved this epoch — only the part held all epoch counts"}
            </div>
          )}
          {user?.isParticipant && state && (
            <div className="mt-1 text-xs text-ink-faint" title="The pool keeps total deposits encrypted, so it cannot publish your odds. Your chance per slot equals your eligible balance divided by everyone's eligible balance.">
              Odds per slot = your share of the pool · {state.winnerSlots} slots per draw · odds stay private
            </div>
          )}
        </div>
        <div>
          <div className="label">Lifetime winnings</div>
          <div className="mt-1"><EncryptedValue value={user ? (user.winnings ? winnings : null) : undefined} revealed={winnings !== undefined} size="lg" /></div>
        </div>
        <div>
          <div className="label">Wallet cUSD</div>
          <div className="mt-1"><EncryptedValue value={user ? (user.walletBalance ? walletBal : null) : undefined} revealed={walletBal !== undefined} size="lg" /></div>
          <button data-anchor="faucet" className="mt-1 text-xs text-accent hover:underline disabled:text-ink-faint disabled:no-underline" onClick={claimFaucet} disabled={faucetFlow.state.status === "pending" || cooldown > 0}>
            {cooldown > 0 ? `Faucet again in ${formatDuration(cooldown)}` : "Get 1,000 test cUSD"}
          </button>
        </div>
      </div>
      <FlowStatus state={faucetFlow.state} className="mt-3" />

      <div className="mt-6 flex gap-1 rounded-full bg-black/40 p-1">
        {(["deposit", "withdraw", "sponsor"] as Tab[]).map((t) => (
          <button
            key={t}
            className={cn("relative flex-1 rounded-full px-3 py-2 text-sm font-medium capitalize transition", tab === t ? "text-black" : "text-ink-muted hover:text-ink")}
            onClick={() => { setTab(t); flow.reset(); }}
          >
            {tab === t && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-accent shadow-[0_0_24px_rgb(255_214_0/0.35)]" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            <span className="relative">{t === "sponsor" ? "Sponsor prize" : t}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        <AmountInput id="amount" value={amount} onChange={setAmount} onMax={setMax} disabled={flow.state.status === "pending"} />
        <p className="text-xs text-ink-faint">
          {tab === "deposit" && "Amounts are encrypted in your browser before they touch the chain. First deposit includes a one-time operator approval."}
          {tab === "withdraw" && "Withdraw any amount up to your balance, any time the pool is open. Requests above your balance move nothing — and never reveal it."}
          {tab === "sponsor" && "Add cUSD straight to the prize. Sponsorships never join the principal and cannot be withdrawn."}
        </p>
        <button data-anchor="deposit" className="btn-primary shine w-full" onClick={submit} disabled={!open || !amount || flow.state.status === "pending"}>
          {!open ? "Paused during the draw" : flow.state.status === "pending" ? "Working…" : tab === "deposit" ? "Deposit privately" : tab === "withdraw" ? "Withdraw" : "Sponsor the prize"}
        </button>
        <FlowStatus state={flow.state} />
      </div>
    </section>
  );
}
