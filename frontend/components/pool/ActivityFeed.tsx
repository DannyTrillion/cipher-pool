"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useActivity } from "@/lib/hooks/useActivity";
import { truncateAddress } from "@/lib/format";
import { cn } from "@/lib/cn";

const LABEL = {
  deposit: { t: "saved", c: "bg-accent" },
  withdraw: { t: "withdrew", c: "bg-cipher" },
  sponsor: { t: "topped up the prize", c: "bg-mint" },
  drawStart: { t: "Draw started", c: "bg-mint" },
  drawDone: { t: "Draw paid its prizes", c: "bg-mint" },
  harvest: { t: "yield harvested", c: "bg-ok" },
} as const;

function ago(ts?: number) {
  if (!ts) return "";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Real events from the pool contract. Amounts are ciphertext and never shown. */
export function ActivityFeed({ compact = false }: { compact?: boolean }) {
  const { rows, loading } = useActivity(compact ? 6 : 12);
  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="label">Live activity</div>
        <span className="flex items-center gap-1.5 text-[10px] text-ink-faint"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> on-chain</span>
      </div>
      <ul className="mt-2 space-y-1.5 text-[13px]">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li key={r.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-black/20 px-3 py-1.5">
              <span className="flex items-center gap-2 truncate">
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", LABEL[r.kind].c)} />
                {r.who ? (
                  <span className="truncate"><span className="font-mono text-ink-muted">{truncateAddress(r.who)}</span> {LABEL[r.kind].t} <span className="text-ink-faint">· amount encrypted</span></span>
                ) : (
                  <span className="truncate">{LABEL[r.kind].t}{r.epoch !== undefined ? ` #${r.epoch.toString()}` : ""}</span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-ink-faint">{ago(r.ts)}</span>
            </motion.li>
          ))}
        </AnimatePresence>
        {!loading && rows.length === 0 && <li className="text-xs text-ink-faint">Quiet for now. The first deposit shows up here.</li>}
        {loading && <li className="cipher-mask h-7 w-full" />}
      </ul>
    </div>
  );
}
