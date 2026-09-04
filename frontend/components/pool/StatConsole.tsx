"use client";

import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { usePoolState, useSaversLedger, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useActionFlow } from "@/lib/useActionFlow";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { DrawButton, type DrawButtonState } from "@/components/pool/DrawButton";
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
    <section id="console" className="glass mt-12 scroll-mt-24 p-5 sm:p-7" aria-label="Prize console">
      <div className="grid items-center gap-8 md:grid-cols-[1.2fr_auto_1fr] md:gap-10">
        {/* stakes */}
        <div className="order-2 md:order-1">
          <div className="label">Prize up for grabs · public</div>
          <div className="mt-2 flex items-baseline gap-3">
            {prize !== undefined ? (
              <span className="display prize-glow text-5xl tabular sm:text-6xl">{formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })}</span>
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

        {/* this draw, in plain rows */}
        <div className="order-3 w-full md:max-w-[300px] md:justify-self-end">
          <div className="label">This draw</div>
          <dl className="mt-2 divide-y divide-line text-sm">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-muted">Savers taking part</dt>
              <dd className="flex items-center gap-2">
                <span className="display text-xl tabular">{state ? n : "…"}</span>
                <span className="flex -space-x-1.5">
                  {rows.slice(0, 4).map((r) => (
                    <span key={r.address} className="rounded-md ring-2 ring-[rgb(var(--base))]" title="A saver — balance encrypted"><Identicon address={r.address} size={18} /></span>
                  ))}
                  {total > 4 && <span className="grid h-[18px] w-[18px] place-items-center rounded-md bg-white/10 font-mono text-[9px] ring-2 ring-[rgb(var(--base))]">+{total - 4}</span>}
                </span>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-muted">Prizes handed out</dt>
              <dd className="display text-xl tabular">{state?.winnerSlots ?? "…"}</dd>
            </div>
            <div className="py-2.5">
              <dt className="text-ink-muted">How the prize is split</dt>
              {state && (
                <dd className="mt-2">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    {state.tiers.flatMap((t, i) =>
                      Array.from({ length: t.winners }, (_, k) => (
                        <span key={`${i}-${k}`} className="h-full border-r border-[rgb(var(--base))] last:border-0" style={{ width: `${t.shareBps / 100 / t.winners}%`, background: ["#FFD600", "#8B9CFF", "#5EEAD4", "#F472B6"][i % 4] }} />
                      )),
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                    {state.tiers.map((t, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: ["#FFD600", "#8B9CFF", "#5EEAD4", "#F472B6"][i % 4] }} />
                        {i === 0 ? "Top prize" : i === 1 ? "Runners-up" : "Small prizes"}: {t.winners} × {(t.shareBps / 100 / t.winners).toFixed(0)}%
                      </span>
                    ))}
                  </div>
                </dd>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-ink-muted">Draw number</dt>
              <dd className="font-mono text-sm">#{state ? (state.epoch + 1n).toString() : "…"} <span className="text-ink-faint">· every {state ? human(Number(state.drawPeriod)) : "…"}</span></dd>
            </div>
          </dl>
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
