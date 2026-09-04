import Link from "next/link";
import { POOL, TOKEN, YIELD, TUSD, etherscanAddr } from "@/lib/contracts";
import { DrawIllustration } from "@/components/pool/DrawIllustration";

export const metadata = { title: "How it works — Cipher Pool" };

const JOURNEY = [
  { n: "01", t: "Save privately", d: "Your amount is encrypted in your browser and pulled into the pool as a confidential transfer. The chain never sees a number.", icon: (
    <svg viewBox="0 0 48 48" className="h-9 w-9"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" /><g className="icon-orbit"><circle cx="24" cy="4" r="2.5" fill="#FFD600" /></g><rect x="16" y="21" width="16" height="13" rx="3" fill="#8B9CFF" /><path d="M19 21v-4a5 5 0 0 1 10 0v4" fill="none" stroke="#8B9CFF" strokeWidth="2.5" /></svg>) },
  { n: "02", t: "Yield fills the prize", d: "A yield source accrues on the encrypted total and pays into the prize. Only the prize is public. Savings never are.", icon: (
    <svg viewBox="0 0 48 48" className="h-9 w-9"><path d="M6 36 Q18 30 24 22 T42 10" fill="none" stroke="#5EEAD4" strokeWidth="2" className="icon-flow" /><rect x="8" y="28" width="6" height="12" rx="1.5" fill="rgba(255,255,255,0.15)" /><rect x="21" y="22" width="6" height="18" rx="1.5" fill="rgba(255,255,255,0.25)" /><rect x="34" y="14" width="6" height="26" rx="1.5" fill="#FFD600" /></svg>) },
  { n: "03", t: "Winners picked in secret", d: "Five prizes per draw. Each gets its own on-chain random seed, and the pool picks winners over encrypted balances without learning who.", icon: (
    <svg viewBox="0 0 48 48" className="h-9 w-9"><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" /><circle cx="24" cy="24" r="12" fill="none" stroke="#8B9CFF" strokeOpacity="0.6" /><g className="icon-orbit"><circle cx="24" cy="12" r="2.5" fill="#5EEAD4" /><circle cx="24" cy="36" r="2.5" fill="#5EEAD4" /></g><circle cx="24" cy="24" r="4" fill="#FFD600" className="icon-pulse" /></svg>) },
  { n: "04", t: "Withdraw any time", d: "Your savings are always yours. Unlock your numbers with one signature; tell the world you won only if you want to.", icon: (
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
        <p className="mt-3 max-w-2xl text-lg text-ink-muted">The same game as PoolTogether: save, keep your principal, win the pool&apos;s yield. The difference is that every deposit, balance and prize credit is ciphertext handled by Zama&apos;s FHEVM, so nobody can see what you hold.</p>
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

      <Section n="01" title="Your deposit is encrypted before it leaves your browser" lead="You start with a plain test ERC-20, tUSD. Approving and wrapping it turns it into confidential cUSD one to one; the tUSD stays locked in the wrapper, so every cUSD is backed. When you deposit, the app encrypts your amount with the network's FHE public key, bound to your address and the pool contract, and sends the ciphertext with a proof. The pool pulls the funds through a confidential ERC-7984 transfer and adds the encrypted amount to your encrypted balance. If you ask for more than you have, nothing moves — it never reverts, because a revert would leak your balance.">
        <Code>{`euint64 moved = asset.confidentialTransferFrom(msg.sender, address(this), requested);
_balances[msg.sender] = FHE.add(_balances[msg.sender], moved);
FHE.allowThis(_balances[msg.sender]);
FHE.allow(_balances[msg.sender], msg.sender);   // only you can decrypt`}</Code>
      </Section>

      <Section n="02" title="Yield builds the prize" lead="The pool never learns the total saved, so a testnet mock cannot compute APY on it without leaking it. Instead the yield source is an admin-funded drip: a public, fixed amount of tUSD per second is minted, wrapped into cUSD and handed to the pool's encrypted prize reserve. Only the prize reserve is made publicly readable, so the app can show what is up for grabs, like PoolTogether. Anyone can also sponsor the prize directly. In production the drip is replaced by an adapter that harvests real yield from a vault into the wrapper, behind the same one-function interface." />

      <Section n="03" title="Winners are picked without decrypting anything" lead="Each draw pays a tiered set of prizes, by default one top prize of 40%, two of 20% and two of 10%. For every prize slot the contract draws an encrypted random number from the coprocessor and turns it into an encrypted ticket between zero and the total saved. It then walks the savers once, keeping an encrypted running total, and for each slot counts how many running totals sit below that slot's ticket. That count is the winner's index, still encrypted. In a second pass every saver is credited select(index == me, amount, 0): winners' balances grow, everyone else's grow by an encrypted zero, and from the outside every account was touched identically. Prizes land in each winner's encrypted claimable pot; claiming moves them to the wallet by confidential transfer, and anyone can call claim at constant cost, so a claim never reveals who won.">
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

      <Section n="04" title="No sniping the prize" lead="Your weight in a draw is the smaller of your balance at the start of the round and your balance now, computed on encrypted values the first time you touch your position in a round. Depositing just before a draw doesn't buy odds for that draw, and withdrawing just after doesn't keep them. A new saver is fully in from the next round." />

      <Section n="05" title="Verify any draw yourself" lead="Every draw records its start and completion time, how many savers took part, the tier structure, the prize, and one random seed per prize slot, all marked publicly readable at draw time. The app fetches those cleartexts through the relayer on the Draws page. The selection logic is on-chain and deterministic, so anyone with read access to the balances, or a court-ordered decryption through the key network, can reproduce the outcome. A winner can additionally publish their prize credit; nobody else can.">
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
          <li>Open the <Link className="text-accent hover:underline" href="/draws">Draws</Link> page and expand <em>Verify this draw</em> on any card.</li>
          <li>Compare the seeds and prize with the pool contract&apos;s <code className="font-mono text-xs">getDraw</code> and <code className="font-mono text-xs">getDrawSeeds</code> on Etherscan.</li>
          <li>Check the <code className="font-mono text-xs">DrawStarted</code> and <code className="font-mono text-xs">DrawCompleted</code> events for the same draw number.</li>
          <li>Ask any saver to try reading your balance from the ledger on the homepage. The relayer refuses.</li>
        </ol>
      </Section>

      <Section n="06" title="What stays private, what doesn't" lead="An app about privacy should be precise about its own.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="glass p-5">
            <div className="text-sm font-semibold text-cipher">Encrypted</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-muted">
              <li>Every deposit and withdrawal amount</li>
              <li>Every balance, including the pool&apos;s total</li>
              <li>Who won each draw, and lifetime winnings</li>
              <li>Each saver&apos;s eligibility weight</li>
            </ul>
          </div>
          <div className="glass p-5">
            <div className="text-sm font-semibold text-accent">Public</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-muted">
              <li>That an address takes part</li>
              <li>The prize reserve and each draw&apos;s prize</li>
              <li>The random seeds and saver count per draw</li>
              <li>Whatever a winner chooses to publish</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section n="07" title="Contracts on Sepolia" lead="Everything runs on the Ethereum Sepolia testnet with Zama's FHEVM coprocessor. Tokens are test tokens with no value.">
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
