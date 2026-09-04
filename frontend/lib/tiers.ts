import type { Tier } from "@/lib/hooks/usePoolData";

/** "1 × 40% · 2 × 20% · 2 × 10%" */
export function describeTiers(tiers: Tier[]): string {
  return tiers.map((t) => `${t.winners} × ${(t.shareBps / 100).toFixed(t.shareBps % 100 ? 1 : 0)}%`).join(" · ");
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
