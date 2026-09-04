import Link from "next/link";
import { POOL, TOKEN, YIELD, TUSD, etherscanAddr } from "@/lib/contracts";
import { DrawIllustration } from "@/components/pool/DrawIllustration";

export const metadata = { title: "How it works | Cipher Pool" };

const JOURNEY = [
  { n: "01", t: "Put money in", d: "Your amount is scrambled in your browser before it is sent. The blockchain never sees the number.", icon: (
    <svg viewBox="0 0 48 48" className="h-9 w-9"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" /><g className="icon-orbit"><circle cx="24" cy="4" r="2.5" fill="#FFD600" /></g><rect x="16" y="21" width="16" height="13" rx="3" fill="#8B9CFF" /><path d="M19 21v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#8B9CFF" strokeWidth="2.5" /></svg>) },
  { n: "02", t: "Interest builds the prize", d: "The pool earns interest and puts it into a prize. Only the prize is public. Savings never are.", icon: (
    <svg viewBox="0 0 48 48" className="h-9 w-9"><path d="M6 36 Q18 30 24 22 T42 10" fill="none" stroke="#5EEAD4" strokeWidth="2" className="icon-flow" /><rect x="8" y="28" width="6" height="12" rx="1.5" fill="rgba(255,255,255,0.15)" /><rect x="21" y="22" width="6" height="18" rx="1.5" fill="rgba(255,255,255,0.25)" /><rect x="34" y="14" width="6" height="26" rx="1.5" fill="#FFD600" /></svg>) },
  { n: "03", t: "Winners picked in secret", d: "Five prizes per draw. Each has its own random number, and the pool picks winners from the scrambled balances without learning who.", icon: (
    <svg viewBox="0 0 48 48" className="h-9 w-9"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" /><circle cx="24" cy="24" r="12" fill="none" stroke="#8B9CFF" strokeOpacity="0.6" /><g className="icon-orbit"><circle cx="24" cy="12" r="2.5" fill="#5EEAD4" /><circle cx="24" cy="36" r="2.5" fill="#5EEAD4" /></g><circle cx="24" cy="24" r="4" fill="#FFD600" className="icon-pulse" /></svg>) },
  { n: "04", t: "Take money out any time", d: "Your money is always yours. See your numbers with one signature. Announce a win only if you want to.", icon: (
    <svg viewBox="0 0 48 48" className="h-9 w-9"><rect x="14" y="22" width="20" height="16" rx="3" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.3)" /><path d="M18 22v-5a6 6 0 0 1 12 0" fill="none" stroke="#FFD600" strokeWidth="2.5" /><path d="M24 26v9M20 31l4 4 4-4" fill="none" stroke="#5EEAD4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="icon-pulse" /></svg>) },
];

function Code({ children }: { children: React.ReactNode }) {
  return <pre className="overflow-x-auto rounded-xl border border-line bg-black/40 p-4 font-mono text-xs leading-relaxed text-ink-muted">{children}</pre>;
}

function Section({ n, title, lead, children }: { n: string; title: string; lead: string; children?: React.ReactNode }) {
  return (
    <section className="grid gap-5 md:grid-cols-[72px_1fr]">
      <div className="font-mono text-sm text-accent">{n}</div>
      <div className="space-y-4">
        <h2 className="display text-2xl sm:text-3xl">{title}</h2>
        <p className="text-base leading-relaxed text-ink-muted">{lead}</p>
        {children}
      </div>
    </section>
  );
}

export default function HowItWorks() {
  return (
    <article className="mx-auto max-w-4xl space-y-14">
      <header>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-render.jpg" alt="" className="w-full rounded-3xl border border-line object-cover shadow-card" style={{ aspectRatio: "16/7", objectPosition: "50% 40%" }} />
        <h1 className="display mt-8 text-4xl sm:text-5xl">How Cipher Pool works</h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">A shared savings pool. Everyone puts money in and keeps it. The interest the pool earns is given out as prizes in regular draws. The difference from PoolTogether is that every deposit, balance and prize is scrambled with Zama&apos;s encryption, so nobody can see what you hold.</p>
        <div className="mt-5 flex gap-3">
          <Link href="/#play" className="btn-primary btn-lg btn-arrow shine">Play</Link>
          <Link href="/draws" className="btn-glass btn-lg">See the prizes</Link>
        </div>
      </header>

      <ol className="grid gap-4 md:grid-cols-4">
        {JOURNEY.map((s) => (
          <li key={s.n} className="glass card-hover p-5">
            <div className="flex items-center justify-between">{s.icon}<span className="font-mono text-xs text-ink-faint">{s.n}</span></div>
            <div className="mt-3 font-semibold">{s.t}</div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{s.d}</p>
          </li>
        ))}
      </ol>

      <Section n="01" title="Your deposit is scrambled before it leaves your browser" lead="You start with a plain test token, tUSD. Wrapping it turns it into private cUSD, one for one. The tUSD stays locked in the wrapper, so every cUSD is backed. When you deposit, the app scrambles your amount with the network's public encryption key, ties it to your address and the pool, and sends it with a proof. The pool moves the funds with a private transfer and adds the scrambled amount to your scrambled balance. If you ask for more than you have, nothing moves and nothing fails, because a failure would give away your balance.">
        <Code>{`euint64 moved = asset.confidentialTransferFrom(msg.sender, address(this), requested);
_balances[msg.sender] = FHE.add(_balances[msg.sender], moved);
FHE.allowThis(_balances[msg.sender]);
FHE.allow(_balances[msg.sender], msg.sender);   // only you can decrypt`}</Code>
      </Section>

      <Section n="02" title="Interest builds the prize" lead="The pool never learns the total saved, so on the test network a fake interest rate cannot be worked out from it without giving it away. Instead, the prize grows by a fixed public drip: a set amount of tUSD per second is created, wrapped into cUSD and added to the pool's scrambled prize. Only the prize is made public, so the app can show what is at stake, like PoolTogether does. Anyone can also add to the prize directly. In a real deployment the drip is replaced by real interest from a lending vault, through the same interface." />

      <Section n="03" title="Winners are picked without unscrambling anything" lead="Each draw pays a set of prizes: one top prize of 40%, two of 20% and two of 10%. For every prize the contract draws a scrambled random number and turns it into a scrambled ticket between zero and the total saved. It then goes through the savers once, keeping a scrambled running total, and for each prize counts how many running totals sit below that ticket. That count is the winner's position in the list, still scrambled. In a second pass every saver is credited either the prize or a scrambled zero, so from the outside every account was touched the same way. Prizes wait in each winner's scrambled pot. Collecting moves the prize to the wallet with a private transfer. Anyone can collect, even with nothing to collect, so collecting never gives away who won.">
        <DrawIllustration />
        <Code>{`for each slot k:
    seed_k   = FHE.randEuint64()                                  // on-chain randomness, public afterwards
    ticket_k = (uint128(seed_k) * uint128(totalWeight)) >> 64     // encrypted, < totalWeight
for i in savers:                                                  // pass 1, batched
    cum += weight_i                                               // encrypted running total
    for each slot k: winner_k += asEuint64(cum <= ticket_k)       // encrypted index
for i in savers:                                                  // pass 2, batched
    credit_i   = Σ_k select(winner_k == i, amount_k, 0)           // encrypted
    balance_i += credit_i`}</Code>
        <p className="text-sm text-ink-muted">Your chance at any slot equals your share of the eligible savings, a weighted lottery with replacement, as in PoolTogether. Both passes run in bounded batches so a pool of any size stays under the FHE compute budget per transaction.</p>
      </Section>

      <Section n="04" title="No sniping the prize" lead="Your odds in a draw are based on the smaller of your balance at the start of the round and your balance now. Putting money in just before a draw does not buy odds for that draw, and taking it out just after does not keep them. A new saver is fully in from the next round." />

      <Section n="05" title="Check any draw yourself" lead="Every draw records when it started and finished, how many savers took part, how the prize was split, the prize amount, and one random number per prize. All of that is public. The Prizes page shows it. The way winners are picked is fixed in the contract, so anyone with permission to read the balances could reproduce the result. A winner can also choose to announce their win. Nobody else can.">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>Open the <Link className="text-accent hover:underline" href="/draws">Prizes</Link> page and open <em>Check this draw</em> on any card.</li>
          <li>Compare the seeds and prize with the pool contract&apos;s <code className="font-mono text-xs">getDraw</code> and <code className="font-mono text-xs">getDrawSeeds</code> on Etherscan.</li>
          <li>Check the <code className="font-mono text-xs">DrawStarted</code> and <code className="font-mono text-xs">DrawCompleted</code> events for the same draw number.</li>
          <li>Try to read any saver&apos;s balance from the list on the homepage. The network refuses.</li>
        </ol>
      </Section>

      <Section n="06" title="What stays private, what does not" lead="An app about privacy should be clear about its own.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass p-5">
            <div className="text-sm font-semibold text-cipher">Private</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-muted">
              <li>Every amount you put in or take out</li>
              <li>Every balance, including the pool&apos;s total</li>
              <li>Who won each draw, and how much anyone has won</li>
              <li>Each saver&apos;s odds</li>
            </ul>
          </div>
          <div className="glass p-5">
            <div className="text-sm font-semibold text-accent">Public</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-muted">
              <li>That an address takes part</li>
              <li>The prize, now and for every past draw</li>
              <li>The random numbers and saver count for each draw</li>
              <li>Whatever a winner chooses to announce</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section n="07" title="Contracts on Sepolia" lead="Everything runs on the Ethereum Sepolia test network with Zama's encryption service. The tokens are test tokens with no real value.">
        <ul className="space-y-1.5 font-mono text-sm">
          <li><a className="text-ink-muted hover:text-ink" href={etherscanAddr(POOL.address)} target="_blank" rel="noreferrer">Prize pool · {POOL.address}</a></li>
          <li><a className="text-ink-muted hover:text-ink" href={etherscanAddr(TUSD.address)} target="_blank" rel="noreferrer">tUSD test ERC-20 · {TUSD.address}</a></li>
          <li><a className="text-ink-muted hover:text-ink" href={etherscanAddr(TOKEN.address)} target="_blank" rel="noreferrer">cUSD (ERC-7984 wrapper) · {TOKEN.address}</a></li>
          <li><a className="text-ink-muted hover:text-ink" href={etherscanAddr(YIELD.address)} target="_blank" rel="noreferrer">Yield source (mock) · {YIELD.address}</a></li>
        </ul>
      </Section>
    </article>
  );
}
