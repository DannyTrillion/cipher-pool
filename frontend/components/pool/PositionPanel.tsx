"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
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
      <section className="card card-hover p-6 sm:p-7">
        <div className="label">Your position</div>
        <p className="mt-2 text-sm text-ink-muted">Connect a wallet on Sepolia to deposit. Your balance is encrypted — only you can reveal it.</p>
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
          <div className="mt-1"><EncryptedValue value={user ? (user.poolBalance ? poolBal : null) : undefined} revealed={poolBal !== undefined} size="lg" /></div>
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
          <button className="mt-1 text-xs text-accent hover:underline disabled:text-ink-faint disabled:no-underline" onClick={claimFaucet} disabled={faucetFlow.state.status === "pending" || cooldown > 0}>
            {cooldown > 0 ? `Faucet again in ${formatDuration(cooldown)}` : "Get 1,000 test cUSD"}
          </button>
        </div>
      </div>
      <FlowStatus state={faucetFlow.state} className="mt-3" />

      <div className="mt-6 flex gap-1 rounded-xl bg-well p-1">
        {(["deposit", "withdraw", "sponsor"] as Tab[]).map((t) => (
          <button
            key={t}
            className={cn("flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition", tab === t ? "bg-raised text-ink" : "text-ink-muted hover:text-ink")}
            onClick={() => { setTab(t); flow.reset(); }}
          >
            {t === "sponsor" ? "Sponsor prize" : t}
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
        <button className="btn-primary shine w-full" onClick={submit} disabled={!open || !amount || flow.state.status === "pending"}>
          {!open ? "Paused during the draw" : flow.state.status === "pending" ? "Working…" : tab === "deposit" ? "Deposit privately" : tab === "withdraw" ? "Withdraw" : "Sponsor the prize"}
        </button>
        <FlowStatus state={flow.state} />
      </div>
    </section>
  );
}
