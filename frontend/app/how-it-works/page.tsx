import { POOL, TOKEN, YIELD, etherscanAddr } from "@/lib/contracts";

export const metadata = { title: "How it works — Cipher Pool" };

function Code({ children }: { children: React.ReactNode }) {
  return <pre className="overflow-x-auto rounded-xl border border-line bg-well p-4 font-mono text-xs leading-relaxed text-ink-muted">{children}</pre>;
}

export default function HowItWorks() {
  return (
    <article className="prose-invert mx-auto max-w-3xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">How Cipher Pool works</h1>
        <p className="mt-2 text-ink-muted">
          A confidential, no-loss prize savings pool. Same game as PoolTogether — deposit, keep your principal, the pool&apos;s yield
          goes to a periodic winner — except every deposit, balance and prize credit is a ciphertext handled by the Zama Protocol&apos;s FHEVM.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Deposits are encrypted before they leave your browser</h2>
        <p className="text-sm text-ink-muted">
          The app encrypts your amount with the network&apos;s FHE public key, bound to <em>your</em> address and the pool contract, and submits
          the ciphertext plus a zero-knowledge input proof. The pool pulls funds through an ERC-7984 <code>confidentialTransferFrom</code>,
          then adds the (encrypted) amount to your (encrypted) balance with <code>FHE.add</code>. Insufficient balances never revert — they
          transfer zero — because a revert would leak information.
        </p>
        <Code>{`euint64 moved = asset.confidentialTransferFrom(msg.sender, address(this), requested);
_balances[msg.sender] = FHE.add(_balances[msg.sender], moved);
FHE.allowThis(_balances[msg.sender]);
FHE.allow(_balances[msg.sender], msg.sender);   // only you can decrypt`}</Code>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Yield builds the prize — homomorphically</h2>
        <p className="text-sm text-ink-muted">
          The pool never learns the total principal. The yield source receives the encrypted total and computes
          <code> principal × APY × elapsed / year </code> as FHE scalar operations, mints the result in cUSD to the pool, and the pool adds it
          to an encrypted prize reserve. Only the <strong>aggregate reserve</strong> is made publicly decryptable (so the app can show
          &ldquo;prize up for grabs&rdquo;, just like PoolTogether&apos;s prize display). Anyone can also sponsor the prize directly.
        </p>
        <p className="text-sm text-ink-muted">
          On testnet the yield source is a simulator with a public APY. It sits behind a one-function interface so a production deployment
          swaps in an adapter over a real vault without touching the pool.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. Tiered winners are chosen without decrypting anything</h2>
        <p className="text-sm text-ink-muted">
          Like PoolTogether, each draw pays a tiered set of prizes — by default a grand prize worth 40% of the round, two prizes of 20% and two
          of 10%, five winner slots in all (the owner can reconfigure tiers between draws). When a period elapses, anyone can start the draw.
          For every slot the contract asks the coprocessor for an encrypted random number and derives an encrypted winning ticket in
          <code> [0, totalWeight)</code>. It then walks the participant list once, keeping an encrypted running sum, and for each slot counts how
          many prefix sums are ≤ that slot&apos;s ticket. Each count <em>is</em> that slot&apos;s winner index — still encrypted. In a second pass
          every participant receives the sum over slots of <code>select(index_k == i, amount_k, 0)</code>: winners&apos; balances grow by their
          prizes, everyone else&apos;s by an encrypted zero. From the outside, every account was touched identically.
        </p>
        <Code>{`for each slot k:
    seed_k   = FHE.randEuint64()                                  // coprocessor randomness, public
    ticket_k = (uint128(seed_k) * uint128(totalWeight)) >> 64     // encrypted, < totalWeight
for i in participants:                                            // pass 1, batched
    cum += weight_i                                               // encrypted prefix sum
    for each slot k: winner_k += asEuint64(cum <= ticket_k)       // encrypted indices
for i in participants:                                            // pass 2, batched
    credit_i   = Σ_k select(winner_k == i, amount_k, 0)           // encrypted
    balance_i += credit_i`}</Code>
        <p className="text-sm text-ink-muted">
          Your probability of taking any given slot equals your share of the eligible weight — a weighted lottery with replacement, as in
          PoolTogether (one saver can win more than one slot). Slots whose ticket lands beyond the eligible weight, and integer-division dust,
          roll over to the next draw. Both passes run in bounded batches (<code>advanceDraw</code>) so a pool of any size stays under the FHE
          per-transaction compute budget.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">4. Fairness: no last-second sniping</h2>
        <p className="text-sm text-ink-muted">
          Your weight in a draw is <code>min(balance at the start of the epoch, current balance)</code>, computed lazily and homomorphically the
          first time you touch your position in an epoch. Depositing right before a draw doesn&apos;t buy odds for that draw, and withdrawing
          right after doesn&apos;t keep them. A new depositor becomes fully eligible from the next epoch.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">5. Verifying a draw</h2>
        <p className="text-sm text-ink-muted">
          Each draw stores a record: start and completion time, participant count, the tier structure, the prize handle and one FHE seed handle
          per winner slot, all marked publicly decryptable at draw time. Anyone can fetch the cleartexts through the relayer (the app does this on the Draws page). The
          selection logic itself is on-chain and deterministic given the seed and the encrypted balances, so an auditor with read access to the
          balances — or a court-ordered decryption via the KMS — can reproduce the outcome. A winner may additionally publish a proof of win
          by making their prize credit public; nobody else can.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">6. What stays private, what doesn&apos;t</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <div className="text-sm font-semibold text-cipher">Encrypted</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-muted">
              <li>Every deposit and withdrawal amount</li>
              <li>Every balance, including the pool&apos;s total principal</li>
              <li>Who won each draw, and how much they have won over time</li>
              <li>Per-participant eligibility weights</li>
            </ul>
          </div>
          <div className="card p-4">
            <div className="text-sm font-semibold text-accent">Public</div>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-ink-muted">
              <li>That an address participates (it holds a pool position)</li>
              <li>The aggregate prize reserve and each draw&apos;s prize</li>
              <li>The FHE random seed of each draw and the participant count</li>
              <li>Whatever a winner chooses to publish</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Contracts (Sepolia)</h2>
        <ul className="space-y-1 font-mono text-sm">
          <li><a className="text-ink-muted hover:text-ink" href={etherscanAddr(POOL.address)} target="_blank" rel="noreferrer">ConfidentialPrizePool · {POOL.address}</a></li>
          <li><a className="text-ink-muted hover:text-ink" href={etherscanAddr(TOKEN.address)} target="_blank" rel="noreferrer">ConfidentialUSD (cUSD, ERC-7984) · {TOKEN.address}</a></li>
          <li><a className="text-ink-muted hover:text-ink" href={etherscanAddr(YIELD.address)} target="_blank" rel="noreferrer">MockYieldSource · {YIELD.address}</a></li>
        </ul>
      </section>
    </article>
  );
}
