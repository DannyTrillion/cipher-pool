"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

/**
 * Hands-on illustration of the weighted blind draw with MADE-UP numbers.
 * Drag the ticket: the winner is the first saver whose running total passes it.
 * In the real pool every bar and the total are ciphertext; only the comparison
 * result, never the numbers, flows through the contract.
 */
const SAVERS = [
  { name: "Ada", amount: 300 },
  { name: "Ben", amount: 100 },
  { name: "Cy", amount: 500 },
  { name: "Dee", amount: 100 },
];

export function DrawIllustration() {
  const total = SAVERS.reduce((a, s) => a + s.amount, 0);
  const [ticket, setTicket] = useState(640);
  const [hidden, setHidden] = useState(true);
  const cum = useMemo(() => { let c = 0; return SAVERS.map((s) => (c += s.amount)); }, []);
  const winner = cum.findIndex((c) => ticket < c);

  return (
    <div className="glass p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label">Try it · made-up numbers</div>
          <div className="mt-1 text-sm text-ink-muted">Drag the ticket. The winner is the first saver whose running total passes it. Bigger savers cover more of the line, so they win more often.</div>
        </div>
        <button className="pill" onClick={() => setHidden((h) => !h)}>{hidden ? "Show the numbers" : "Hide the numbers (as the pool sees them)"}</button>
      </div>

      <div className="relative mt-5">
        <div className="flex h-8 w-full overflow-hidden rounded-full bg-white/10">
          {SAVERS.map((s, i) => (
            <motion.div key={s.name} className={cn("flex h-full items-center justify-center border-r border-[rgb(var(--base))] font-mono text-[11px] last:border-0", i === winner ? "bg-accent text-black" : "bg-cipher/40 text-ink")} initial={false} animate={{ width: `${(s.amount / total) * 100}%` }}>
              {s.name}{!hidden && ` · ${s.amount}`}
            </motion.div>
          ))}
        </div>
        <motion.div className="pointer-events-none absolute -top-2 h-12 w-[2px] bg-white" initial={false} animate={{ left: `${(ticket / total) * 100}%` }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
          <span className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-ink">ticket{hidden ? "" : ` ${ticket}`}</span>
        </motion.div>
      </div>
      <input type="range" min={0} max={total - 1} value={ticket} onChange={(e) => setTicket(Number(e.target.value))} className="range mt-4 w-full" aria-label="Random ticket" />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-black/20 p-3 text-sm">
          <div className="text-ink-faint">Winner</div>
          <div className="mt-0.5 font-semibold text-accent">{SAVERS[winner]?.name ?? "—"} <span className="font-normal text-ink-muted">· chance ≈ {Math.round((SAVERS[winner].amount / total) * 100)}%</span></div>
        </div>
        <div className="rounded-xl border border-line bg-black/20 p-3 text-sm text-ink-muted">
          In the real pool, every bar and the total are ciphertext. The contract only learns <span className="text-ink">how many running totals are below the ticket</span> — and even that stays encrypted.
        </div>
      </div>
    </div>
  );
}
