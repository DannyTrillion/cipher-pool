"use client";

import { useEffect } from "react";
import { usePoolState, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { Countdown, useNow } from "@/components/ui/Countdown";
import { formatAmount } from "@/lib/format";
import { DECIMALS, SYMBOL } from "@/lib/contracts";

export function PrizeHero() {
  const { state } = usePoolState();
  const { reveal, values, pending, errors } = usePublicReveal();
  const now = useNow();

  const h = state?.prizeReserveHandle;
  useEffect(() => {
    if (h) void reveal([h]);
  }, [h, reveal]);
  const prize = h ? values[h] : undefined;

  const phaseLabel =
    state?.phase === Phase.Selecting ? "Drawing — selecting winner" : state?.phase === Phase.Awarding ? "Drawing — awarding prize" : state?.isDrawDue ? "Draw ready" : "Open";
  const due = state ? Number(state.nextDrawAt) <= now : false;

  return (
    <section className="card relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      <div className="relative grid gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="label mb-2">Prize up for grabs</div>
          <div className="flex items-end gap-3">
            {prize !== undefined ? (
              <div className="animate-reveal font-mono text-5xl font-semibold tabular sm:text-6xl">
                {formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })}
                <span className="ml-2 text-xl text-ink-muted">{SYMBOL}</span>
              </div>
            ) : (
              <div className="cipher-mask h-14 w-56 sm:h-16 sm:w-72" aria-label={h && errors[h] ? "Prize unavailable" : "Loading prize"} />
            )}
          </div>
          <p className="mt-3 max-w-md text-sm text-ink-muted">
            Yield from everyone&apos;s deposits goes to one winner each draw. Your principal is never at risk and your
            balance is encrypted end-to-end.
          </p>
          {h && errors[h] && prize === undefined && (
            <p className="mt-2 text-xs text-warn">
              The prize reserve was just updated; the relayer is still processing it. It will appear shortly.
            </p>
          )}
          {pending[h ?? ""] && <p className="mt-2 text-xs text-ink-faint">Decrypting the public prize…</p>}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
          <div>
            <div className="label">{due ? "Draw" : "Next draw in"}</div>
            <div className="mt-1 text-2xl font-semibold">
              {state ? (state.phase === Phase.Open ? <Countdown target={Number(state.nextDrawAt)} /> : "In progress") : "…"}
            </div>
            <div className="mt-0.5 text-xs text-ink-faint">{phaseLabel}</div>
          </div>
          <div>
            <div className="label">Savers</div>
            <div className="mt-1 text-2xl font-semibold tabular">{state ? state.participantCount.toString() : "…"}</div>
            <div className="mt-0.5 text-xs text-ink-faint">Draw #{state ? (state.epoch + 1n).toString() : "…"}</div>
          </div>
          <div>
            <div className="label">Yield source</div>
            <div className="mt-1 text-2xl font-semibold tabular">{state ? `${(Number(state.apyBps) / 100).toFixed(2)}%` : "…"} <span className="text-sm text-ink-muted">APY</span></div>
            <div className="mt-0.5 text-xs text-ink-faint">Simulated strategy (testnet)</div>
          </div>
          <div>
            <div className="label">Draw period</div>
            <div className="mt-1 text-2xl font-semibold tabular">{state ? humanPeriod(Number(state.drawPeriod)) : "…"}</div>
            <div className="mt-0.5 text-xs text-ink-faint">Anyone can trigger</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function humanPeriod(s: number) {
  if (s % 86400 === 0) return `${s / 86400}d`;
  if (s % 3600 === 0) return `${s / 3600}h`;
  if (s % 60 === 0) return `${s / 60}m`;
  return `${s}s`;
}
