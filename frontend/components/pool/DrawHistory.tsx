"use client";

import { useEffect } from "react";
import { usePoolState, useDraws } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { formatAmount } from "@/lib/format";
import { DECIMALS, SYMBOL, etherscanAddr, POOL } from "@/lib/contracts";

export function DrawHistory() {
  const { state } = usePoolState();
  const { draws, isLoading } = useDraws(state?.epoch);
  const pub = usePublicReveal();

  useEffect(() => {
    const done = draws.filter((d) => d.completedAt > 0n);
    if (done.length) void pub.reveal(done.flatMap((d) => [d.seed, d.prize]));
  }, [draws, pub.reveal]);

  if (isLoading) return <p className="text-sm text-ink-muted">Loading draws…</p>;
  if (draws.length === 0)
    return (
      <div className="card p-6 text-sm text-ink-muted">
        No draws yet. Once the first period elapses, anyone can run the draw from the Pool page.
      </div>
    );

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="px-4 py-3">Draw</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3">Savers</th>
            <th className="px-4 py-3">Prize</th>
            <th className="px-4 py-3">FHE seed</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {draws.map((d) => {
            const prize = pub.values[d.prize];
            const seed = pub.values[d.seed];
            const done = d.completedAt > 0n;
            return (
              <tr key={d.epoch.toString()} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono">#{d.epoch.toString()}</td>
                <td className="px-4 py-3 text-ink-muted">{new Date(Number(d.startedAt) * 1000).toLocaleString()}</td>
                <td className="px-4 py-3 font-mono tabular">{d.participants}</td>
                <td className="px-4 py-3 font-mono tabular">{prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : <span className="cipher-mask">•••••</span>}</td>
                <td className="max-w-[220px] truncate px-4 py-3 font-mono text-xs text-ink-muted" title={seed?.toString()}>{seed !== undefined ? seed.toString() : <span className="cipher-mask">••••••••••</span>}</td>
                <td className="px-4 py-3">{done ? <span className="pill border-ok/30 text-ok">Complete</span> : <span className="pill border-warn/30 text-warn">In progress</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-line px-4 py-3 text-xs text-ink-faint">
        Seed and prize are made publicly decryptable at draw time. Winner identity stays encrypted unless the winner publishes a proof of win.{" "}
        <a className="text-ink-muted underline" href={etherscanAddr(POOL.address)} target="_blank" rel="noreferrer">Contract on Etherscan</a>
      </div>
    </div>
  );
}
