"use client";

import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { usePoolState, useSaversLedger, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useActionFlow } from "@/lib/useActionFlow";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { DecryptText } from "@/components/fx/DecryptText";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { DrawButton, type DrawButtonState } from "@/components/pool/DrawButton";
import { TierOrbits } from "@/components/pool/TierOrbits";
import { Identicon } from "@/components/layout/Identicon";
import { useNow } from "@/components/ui/Countdown";
import { formatAmount } from "@/lib/format";
import { DECIMALS, SYMBOL } from "@/lib/contracts";

/** The launch console: stakes on the left, the big button in the centre, the crowd on the right. */
export function StatConsole() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { state, refetch } = usePoolState();
  const { rows, total } = useSaversLedger(state?.participantCount, 6);
  const { reveal, retry, values, errors } = usePublicReveal();
  const actions = usePoolActions();
  const flow = useActionFlow();
  const now = useNow();

  const h = state?.prizeReserveHandle;
  useEffect(() => { if (h) void reveal([h]); }, [h, reveal]);
  useEffect(() => {
    if (!h || !errors[h]) return;
    const id = setTimeout(() => retry(h), 12_000);
    return () => clearTimeout(id);
  }, [h, errors, retry]);
  const prize = useCountUp(h ? values[h] : undefined);

  const drawing = !!state && state.phase !== Phase.Open;
  const due = !!state && !drawing && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;
  const btnState: DrawButtonState = flow.state.status === "pending" && !drawing ? "busy" : drawing ? "live" : due ? "armed" : "countdown";
  const n = Number(state?.participantCount ?? 0n);
  const cursor = Number(state?.drawCursor ?? 0n);
  const progress = state ? (state.phase === Phase.Selecting ? (cursor / Math.max(1, n)) * 0.5 : state.phase === Phase.Awarding ? 0.5 + (cursor / Math.max(1, n)) * 0.5 : 0) : 0;

  const run = () =>
    flow.run(async (setStep) => {
      await actions.runDraw(setStep, () => void refetch());
      await refetch();
    }, { successMessage: "Draw complete. Prizes are in the winners' savings." });

  return (
    <section className="glass mt-12 p-5 sm:p-7" aria-label="Prize console">
      <div className="grid items-center gap-8 md:grid-cols-[1.2fr_auto_1fr] md:gap-10">
        {/* stakes */}
        <div className="order-2 md:order-1">
          <div className="label">Prize up for grabs · public</div>
          <div className="mt-2 flex items-baseline gap-3">
            {prize !== undefined ? (
              <DecryptText text={formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} className="display prize-glow text-5xl tabular sm:text-6xl" duration={700} />
            ) : (
              <span className="cipher-mask inline-block h-12 w-44 sm:h-14 sm:w-56" aria-label="Loading prize" />
            )}
            <span className="font-mono text-lg text-ink-muted">{SYMBOL}</span>
          </div>
          <div className="mt-2 text-sm text-ink-muted">
            Shared by <span className="text-ink">{state?.winnerSlots ?? 5} winners</span> every {state ? human(Number(state.drawPeriod)) : "…"}. Grows with {state ? `${(Number(state.apyBps) / 100).toFixed(1)}%` : "…"} yield on everyone&apos;s savings.
            {h && errors[h] && prize === undefined && " Relayer catching up…"}
          </div>
          <div className="mt-3 text-xs text-ink-faint">
            {due ? "The draw is ready. Anyone can run it." : drawing ? "Draw in progress — anyone can push it along." : "Deposits and withdrawals are open until the draw."}
          </div>
        </div>

        {/* the button */}
        <div className="order-1 flex flex-col items-center md:order-2">
          {state ? (
            <DrawButton
              state={btnState}
              start={Number(state.epochStart)}
              end={Number(state.nextDrawAt)}
              connected={isConnected}
              progress={progress}
              progressLabel={state.phase === Phase.Selecting ? "picking winners" : state.phase === Phase.Awarding ? "paying prizes" : undefined}
              onRun={run}
              onConnect={() => connectors[0] && connect({ connector: connectors[0] })}
            />
          ) : (
            <div className="h-[176px] w-[176px] rounded-full bg-white/5" />
          )}
          {drawing && isConnected && flow.state.status !== "pending" && (
            <button className="btn-secondary mt-6 text-xs" onClick={run}>Continue the draw</button>
          )}
        </div>

        {/* crowd */}
        <div className="order-3 md:justify-self-end">
          <div className="label">Savers in this draw</div>
          <div className="mt-2 flex items-center gap-3">
            <span className="display text-4xl tabular">{state ? n : "…"}</span>
            <div className="flex -space-x-1.5">
              {rows.slice(0, 5).map((r) => (
                <span key={r.address} className="rounded-md ring-2 ring-[rgb(var(--base))]" title="A saver — balance encrypted"><Identicon address={r.address} size={22} /></span>
              ))}
              {total > 5 && <span className="grid h-[22px] w-[22px] place-items-center rounded-md bg-white/10 font-mono text-[9px] ring-2 ring-[rgb(var(--base))]">+{total - 5}</span>}
            </div>
          </div>
          <div className="mt-1 text-xs text-ink-faint">Draw #{state ? (state.epoch + 1n).toString() : "…"} · every balance encrypted</div>
          {state && (
            <div className="mt-3 inline-flex items-center gap-3 rounded-xl border border-line px-3 py-2" title={state.tiers.map((t) => `${t.winners} × ${(t.shareBps / 100 / t.winners).toFixed(0)}%`).join(" · ")}>
              <TierOrbits tiers={state.tiers} size={44} />
              <div className="text-xs">
                <div className="text-ink">{state.winnerSlots} prizes per draw</div>
                <div className="text-ink-faint">{state.tiers.map((t) => `${t.winners}×${(t.shareBps / 100 / t.winners).toFixed(0)}%`).join(" · ")}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <FlowStatus state={flow.state} className="mt-5" />
    </section>
  );
}

function human(s: number) {
  if (s % 86400 === 0) return `${s / 86400} day${s / 86400 > 1 ? "s" : ""}`;
  if (s % 3600 === 0) return `${s / 3600} hour${s / 3600 > 1 ? "s" : ""}`;
  if (s % 60 === 0) return `${s / 60} minutes`;
  return `${s}s`;
}
