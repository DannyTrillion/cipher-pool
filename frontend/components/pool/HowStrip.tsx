import Link from "next/link";

const STEPS = [
  { t: "Deposit privately", d: "Your amount is encrypted in the browser and pulled into the pool as an ERC-7984 confidential transfer. The chain never sees a number." },
  { t: "Yield builds the prize", d: "A yield source accrues on the encrypted principal. The prize reserve is public — like PoolTogether — but every position stays private." },
  { t: "One winner, chosen blind", d: "The contract draws an FHE random seed and walks the encrypted balances homomorphically. Odds equal your share. Nobody learns who won." },
  { t: "Withdraw any time", d: "Principal is always yours. Reveal your balance or winnings with one signature; publish a proof of win only if you want to." },
];

export function HowStrip() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((s, i) => (
        <div key={s.t} className="card p-5">
          <div className="font-mono text-xs text-accent">0{i + 1}</div>
          <div className="mt-1 font-semibold">{s.t}</div>
          <p className="mt-1.5 text-sm text-ink-muted">{s.d}</p>
        </div>
      ))}
      <div className="sm:col-span-2 lg:col-span-4">
        <Link href="/how-it-works" className="text-sm text-accent hover:underline">Read the full mechanism, including how to verify a draw →</Link>
      </div>
    </section>
  );
}
