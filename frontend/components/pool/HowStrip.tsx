import Link from "next/link";

const ICONS = [
  // encrypt: lock with orbiting dot
  <svg key="a" viewBox="0 0 48 48" className="h-10 w-10"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" /><g className="icon-orbit"><circle cx="24" cy="4" r="2.5" fill="#FFD600" /></g><rect x="16" y="21" width="16" height="13" rx="3" fill="#8B9CFF" /><path d="M19 21v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#8B9CFF" strokeWidth="2.5" /></svg>,
  // yield: rising bars + flow
  <svg key="b" viewBox="0 0 48 48" className="h-10 w-10"><path d="M6 36 Q18 30 24 22 T42 10" fill="none" stroke="#5EEAD4" strokeWidth="2" className="icon-flow" /><rect x="8" y="28" width="6" height="12" rx="1.5" fill="rgba(255,255,255,0.15)" /><rect x="21" y="22" width="6" height="18" rx="1.5" fill="rgba(255,255,255,0.25)" /><rect x="34" y="14" width="6" height="26" rx="1.5" fill="#FFD600" /></svg>,
  // draw: rings with pulsing centre
  <svg key="c" viewBox="0 0 48 48" className="h-10 w-10"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" /><circle cx="24" cy="24" r="12" fill="none" stroke="#8B9CFF" strokeOpacity="0.6" /><g className="icon-orbit"><circle cx="24" cy="12" r="2.5" fill="#5EEAD4" /><circle cx="24" cy="36" r="2.5" fill="#5EEAD4" /></g><circle cx="24" cy="24" r="4" fill="#FFD600" className="icon-pulse" /></svg>,
  // withdraw: open lock + arrow
  <svg key="d" viewBox="0 0 48 48" className="h-10 w-10"><rect x="14" y="22" width="20" height="16" rx="3" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" /><path d="M18 22v-5a6 6 0 0 1 12 0" fill="none" stroke="#FFD600" strokeWidth="2.5" /><path d="M24 26v9M20 31l4 4 4-4" fill="none" stroke="#5EEAD4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="icon-pulse" /></svg>,
];

const STEPS = [
  { n: "01", t: "Encrypt in the browser", d: "Your amount becomes ciphertext bound to you and the pool before it touches the chain. Then an ERC-7984 confidential transfer." },
  { n: "02", t: "Yield fills the prize", d: "A yield source accrues homomorphically on the encrypted principal. Only the aggregate prize is public — every position stays private." },
  { n: "03", t: "Blind, tiered draw", d: "One FHE seed per winner slot. The contract walks the encrypted balances once and credits winners with select(), never learning who won." },
  { n: "04", t: "Withdraw any time", d: "Principal is always yours. Reveal balances with one signature; publish a proof of win only if you choose to." },
];

export function HowStrip() {
  return (
    <section className="relative">
      <div className="mb-5 flex items-end justify-between">
        <h2 className="display text-2xl sm:text-3xl">How it works</h2>
        <Link href="/how-it-works" className="text-sm text-accent hover:underline">Full mechanism + verification →</Link>
      </div>
      <ol className="grid gap-4 md:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.n} className="glass card-hover relative p-5">
            <div className="flex items-center justify-between">{ICONS[i]}<span className="font-mono text-xs text-ink-faint">{s.n}</span></div>
            <div className="mt-2 font-semibold">{s.t}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
