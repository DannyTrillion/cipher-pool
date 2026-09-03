"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { usePoolState, useUserState, useDraw, Phase } from "@/lib/hooks/usePoolData";
import { usePoolActions, DRAW_BATCH } from "@/lib/hooks/usePoolActions";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { useActionFlow } from "@/lib/useActionFlow";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { useNow } from "@/components/ui/Countdown";
import { formatAmount } from "@/lib/format";
import { DECIMALS, POOL, SYMBOL } from "@/lib/contracts";

export function DrawPanel() {
  const { isConnected } = useAccount();
  const { state, refetch } = usePoolState();
  const { user, refetch: refetchUser } = useUserState(state?.epoch);
  const { draw } = useDraw(state?.epoch);
  const actions = usePoolActions();
  const flow = useActionFlow();
  const revealFlow = useActionFlow();
  const pub = usePublicReveal();
  const { reveal, get, busy } = useReveal();
  const now = useNow();

  useEffect(() => {
    if (draw?.completedAt && draw.completedAt > 0n) void pub.reveal([draw.seed, draw.prize]);
  }, [draw?.seed, draw?.prize, draw?.completedAt, pub.reveal]);

  const inProgress = state && state.phase !== Phase.Open;
  const due = state ? state.phase === Phase.Open && Number(state.nextDrawAt) <= now : false;
  const n = Number(state?.participantCount ?? 0n);
  const cursor = Number(state?.drawCursor ?? 0n);
  const progress = state
    ? state.phase === Phase.Selecting
      ? (cursor / Math.max(n, 1)) * 50
      : state.phase === Phase.Awarding
        ? 50 + (cursor / Math.max(n, 1)) * 50
        : 0
    : 0;

  const run = () =>
    flow.run(
      async (setStep) => {
        await actions.runDraw(setStep, () => void refetch());
        await Promise.all([refetch(), refetchUser()]);
      },
      { successMessage: "Draw complete. Check whether you won below." },
    );

  const myCredit = get(user?.wonInDraw);
  const lastEpoch = state?.epoch ?? 0n;
  const lastDone = draw && draw.completedAt > 0n;
  const seed = draw ? pub.values[draw.seed] : undefined;
  const prize = draw ? pub.values[draw.prize] : undefined;

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label">Draw</div>
          <div className="mt-1 text-xs text-ink-faint">Winner picked over encrypted balances · seed and prize published for verification</div>
        </div>
        {isConnected && (due || inProgress) && (
          <button className="btn-primary" onClick={run} disabled={flow.state.status === "pending" || n === 0}>
            {inProgress ? "Continue draw" : "Run draw"}
          </button>
        )}
      </div>

      {inProgress && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-ink-muted">
            <span>{state?.phase === Phase.Selecting ? "Pass 1 · selecting winner" : "Pass 2 · crediting prize"}</span>
            <span className="font-mono">{cursor}/{n} · batches of {DRAW_BATCH}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-well">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Deposits and withdrawals pause while the draw runs. Anyone can continue it — every batch is bounded to fit the FHE compute budget.
          </p>
        </div>
      )}
      {!inProgress && !due && state && (
        <p className="mt-4 text-sm text-ink-muted">
          The next draw unlocks when the countdown hits zero. It harvests yield into the prize, draws an on-chain FHE random seed and picks the winner without ever decrypting a balance.
        </p>
      )}
      {due && n === 0 && <p className="mt-4 text-sm text-warn">No savers yet — the draw needs at least one deposit.</p>}
      <FlowStatus state={flow.state} className="mt-3" />

      {lastEpoch > 0n && (
        <div className="mt-6 rounded-xl border border-line bg-raised/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Draw #{lastEpoch.toString()} {lastDone ? "· complete" : "· in progress"}</div>
            {draw && <div className="text-xs text-ink-faint">{draw.participants} savers · {new Date(Number(draw.startedAt) * 1000).toLocaleString()}</div>}
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="label">Prize</div>
              <div className="mt-1 font-mono text-lg tabular">{prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : lastDone ? <span className="cipher-mask">••••••</span> : "—"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="label">FHE random seed (public)</div>
              <div className="mt-1 break-all font-mono text-sm text-ink-muted">{seed !== undefined ? seed.toString() : lastDone ? <span className="cipher-mask">••••••••••••••••</span> : "—"}</div>
            </div>
          </div>

          {isConnected && lastDone && user?.wonInDraw && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              {myCredit === undefined ? (
                <button className="btn-secondary" onClick={() => reveal(POOL.address, user.wonInDraw, "won")} disabled={!!busy}>
                  {busy === "won" ? "Revealing…" : "Did I win? (private)"}
                </button>
              ) : myCredit > 0n ? (
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent animate-reveal">
                    🎉 You won <EncryptedValue value={myCredit} revealed size="sm" className="text-accent" /> — already in your pool balance.
                  </div>
                  <button className="btn-ghost text-xs" onClick={() => revealFlow.run((s) => actions.revealWin(lastEpoch, s), { successMessage: "Your win is now publicly verifiable." })} disabled={revealFlow.state.status === "pending"}>
                    Publish proof of win
                  </button>
                </div>
              ) : (
                <div className="text-sm text-ink-muted">Not this time — your principal is untouched. Odds scale with your share of the pool.</div>
              )}
              <FlowStatus state={revealFlow.state} />
            </div>
          )}
          {isConnected && lastDone && user && !user.wonInDraw && (
            <p className="mt-3 text-xs text-ink-faint">You weren&apos;t in this draw.</p>
          )}
        </div>
      )}
    </section>
  );
}
