import type { Tier } from "@/lib/hooks/usePoolData";

/** Per-winner shares: "1 × 40% · 2 × 20% · 2 × 10%" */
export function describeTiers(tiers: Tier[]): string {
  return tiers
    .map((t) => {
      const pct = t.shareBps / 100 / t.winners;
      return `${t.winners} × ${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
    })
    .join(" · ");
}

/** Per-slot amounts for a prize, in slot order (matches the contract's integer maths). */
export function slotAmounts(prize: bigint, tiers: Tier[]): bigint[] {
  const out: bigint[] = [];
  for (const t of tiers) {
    const per = (prize * BigInt(t.shareBps)) / BigInt(10_000 * t.winners);
    for (let i = 0; i < t.winners; i++) out.push(per);
  }
  return out;
}
