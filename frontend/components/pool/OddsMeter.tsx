"use client";

import { motion } from "framer-motion";

/** Honest odds: with n savers and K prizes drawn with replacement, if everyone saved the same. */
export function OddsMeter({ savers, slots }: { savers: number; slots: number }) {
  const n = Math.max(1, savers);
  const p = 1 - Math.pow(1 - 1 / n, slots);
  const pct = Math.round(p * 100);
  return (
    <div className="rounded-xl border border-line bg-black/20 px-3.5 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">Your chance of a prize</div>
        <motion.span key={pct} initial={{ scale: 1.2, color: "#FFD600" }} animate={{ scale: 1, color: "#f6f6f8" }} className="display text-xl tabular">{pct}%</motion.span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-[linear-gradient(90deg,#8B9CFF,#FFD600)]" initial={false} animate={{ width: `${pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
      </div>
      <div className="mt-1.5 text-[11px] text-ink-faint">Rough guess, assuming everyone saved the same. Your real odds depend on your share and stay private.</div>
    </div>
  );
}
