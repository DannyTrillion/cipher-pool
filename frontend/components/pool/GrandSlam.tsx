"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { usePoolState, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { useNow, formatDuration } from "@/components/ui/Countdown";
import { formatAmount } from "@/lib/format";
import { DECIMALS, SYMBOL } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { PlayPanel } from "@/components/pool/PlayPanel";
import { ResultsPanel } from "@/components/pool/ResultsPanel";

/** The Grand Slam: one stage with a live status bar, the Play machine and the Results machine. */
export function GrandSlam() {
  const { state } = usePoolState();
  const { reveal, values } = usePublicReveal();
  const now = useNow();
  const h = state?.prizeReserveHandle;
  useEffect(() => { if (h) void reveal([h]); }, [h, reveal]);
  const prize = h ? values[h] : undefined;
  const drawing = !!state && state.phase !== Phase.Open;
  const due = !!state && !drawing && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;
  const n = Number(state?.participantCount ?? 0n);

  const status = !state ? "Loading the pool…" : drawing ? (state.phase === Phase.Selecting ? "Draw running · picking winners in secret" : "Draw running · paying prizes in secret") : due ? "Draw ready · press the button to run it" : `Pool open · next draw in ${formatDuration(Number(state.nextDrawAt) - now)}`;

  return (
    <section id="play" className={cn("relative scroll-mt-20 rounded-[28px] p-[1px] transition-colors", drawing ? "bg-[linear-gradient(120deg,rgb(94_234_212/0.5),rgb(255_214_0/0.4),rgb(139_156_255/0.5))]" : "bg-[linear-gradient(120deg,rgb(255_214_0/0.25),rgb(255_255_255/0.06),rgb(139_156_255/0.25))]")} aria-label="Play">
      <div className="overflow-hidden rounded-[27px] bg-[rgb(var(--base))]/85 p-4 backdrop-blur-xl sm:p-6">
        {/* live status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-black/30 px-4 py-2.5">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className={cn("absolute inline-flex h-full w-full animate-pulseRing rounded-full", drawing ? "bg-mint" : due ? "bg-accent" : "bg-ok")} />
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", drawing ? "bg-mint" : due ? "bg-accent" : "bg-ok")} />
            </span>
            <motion.span key={status} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="font-medium">{status}</motion.span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs text-ink-muted">
            <span>{n} saver{n === 1 ? "" : "s"}</span>
            <span className="text-ink">{prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL} up for grabs` : "…"}</span>
            <span className="hidden sm:inline">{state?.winnerSlots ?? 5} prizes per draw</span>
          </div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2 lg:gap-6 [&>*]:min-w-0">
          <PlayPanel />
          <ResultsPanel />
        </div>
      </div>
    </section>
  );
}
