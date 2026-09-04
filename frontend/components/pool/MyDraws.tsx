"use client";

import { useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { usePoolState, useDraws, useUserDrawCredits } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { formatAmount } from "@/lib/format";
import { DECIMALS, POOL, SYMBOL } from "@/lib/contracts";
import { EncryptedValue } from "@/components/ui/EncryptedValue";

/** Account-style history: every past draw and, privately, what you won in it. */
export function MyDraws() {
  const { isConnected } = useAccount();
  const { state } = usePoolState();
  const { draws } = useDraws(state?.epoch);
  const done = useMemo(() => draws.filter((d) => d.completedAt > 0n), [draws]);
  const { credits } = useUserDrawCredits(done.map((d) => d.epoch));
  const pub = usePublicReveal();
  const { reveal, get, busy } = useReveal();

  useEffect(() => {
    if (done.length) void pub.reveal(done.map((d) => d.prize));
  }, [done, pub.reveal]);

  if (!isConnected || done.length === 0) return null;

  const revealAll = async () => {
    for (let i = 0; i < done.length; i++) {
      const h = credits[i];
      if (h && get(h) === undefined) await reveal(POOL.address, h, `draw-${done[i].epoch}`);
    }
  };
  const total = done.reduce((acc, _d, i) => {
    const v = credits[i] ? get(credits[i]) : 0n;
    return v === undefined ? acc : acc + v;
  }, 0n);
  const allRevealed = done.every((_d, i) => !credits[i] || get(credits[i]) !== undefined);

  return (
    <section className="card card-hover p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label">Your draws</div>
          <div className="mt-1 text-xs text-ink-faint">What you won in each draw — encrypted on-chain, only you can read it</div>
        </div>
        <button className="btn-secondary" onClick={revealAll} disabled={!!busy || allRevealed}>
          {busy ? "Revealing…" : allRevealed ? "All revealed" : "Reveal all"}
        </button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-ink-faint">
            <tr className="border-b border-line">
              <th className="py-2 pr-4">Draw</th>
              <th className="py-2 pr-4">Prize pool</th>
              <th className="py-2 pr-4">Winners</th>
              <th className="py-2 pr-4">You won</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {done.map((d, i) => {
              const h = credits[i];
              const v = h ? get(h) : undefined;
              const prize = pub.values[d.prize];
              return (
                <tr key={d.epoch.toString()} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-4 font-mono">#{d.epoch.toString()}</td>
                  <td className="py-2.5 pr-4 font-mono tabular">{prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : <span className="cipher-mask">•••••</span>}</td>
                  <td className="py-2.5 pr-4 font-mono tabular">{d.winnerSlots}</td>
                  <td className="py-2.5 pr-4">
                    {!h ? (
                      <span className="text-xs text-ink-faint">Not in this draw</span>
                    ) : v === undefined ? (
                      <EncryptedValue value={undefined} revealed={false} size="sm" />
                    ) : v > 0n ? (
                      <span className="font-mono text-accent">+{formatAmount(v, DECIMALS, { maxFractionDigits: 2 })} {SYMBOL}</span>
                    ) : (
                      <span className="text-xs text-ink-muted">No prize · principal untouched</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {h && v === undefined && (
                      <button className="btn-ghost text-xs" onClick={() => reveal(POOL.address, h, `draw-${d.epoch}`)} disabled={!!busy}>
                        Reveal
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {allRevealed && (
        <div className="mt-3 text-xs text-ink-muted">
          Revealed winnings across {done.length} draw{done.length === 1 ? "" : "s"}: <span className="font-mono text-ink">{formatAmount(total, DECIMALS, { maxFractionDigits: 2 })} {SYMBOL}</span>
        </div>
      )}
    </section>
  );
}
