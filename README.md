# Cipher Pool — Confidential Prize Savings on the Zama Protocol

A production-grade, no-loss prize savings pool (PoolTogether-style) where **deposits, balances and winnings are encrypted end-to-end** with Zama's FHEVM, and **winner selection runs over encrypted balances on-chain**.

Built for the **Zama Developer Program — Mainnet Season 4 Bounty Track**.

> **Live demo:** https://cipher-pool-beta.vercel.app
> **Network:** Sepolia · **Asset:** cUSD (ERC-7984 confidential token, testnet faucet)

## What it does

| | Feature | How |
|---|---|---|
| 1 | **Private deposits** | Amount is encrypted in the browser (bound to your address + the pool), pulled via ERC-7984 `confidentialTransferFrom`, added to your encrypted balance with `FHE.add`. |
| 2 | **Withdraw any time** | Any amount up to your balance while the pool is open. Over-requests move zero and never revert (a revert would leak the balance). |
| 3 | **Yield → prize** | A yield source accrues homomorphically on the *encrypted* principal and mints into an encrypted prize reserve. Anyone can also sponsor the prize. |
| 4 | **Tiered, blind weighted draw** | PoolTogether-style tiers (default: grand 40% ×1, 20% ×2, 10% ×2 — five winners per draw, owner-configurable). Each slot draws its own coprocessor FHE seed → encrypted ticket → one encrypted prefix-sum walk → encrypted winner indices → `select`-based credits. Odds = your share of the pool. **Nobody, including the owner, learns who won.** |
| 5 | **Verifiable** | Seed, prize and participant count are made publicly decryptable per draw. Winners can optionally publish a proof of win. |
| 6 | **Fair** | Draw weight = `min(balance at epoch start, current balance)`, computed lazily on-chain — no last-second sniping. |
| 7 | **Scales** | Both draw passes run in bounded batches (`advanceDraw(maxSteps)`) to stay under the FHE per-tx HCU budget at any pool size. |
| 8 | **Polished UX** | Sign-once reveal session, staged transaction narration, graceful error recovery, faucet, live prize, countdown, draw progress, history. |

## Architecture

```
contracts/
  ConfidentialPrizePool.sol   The pool: encrypted balances, eligibility, batched draws, proof-of-win
  ConfidentialUSD.sol         Testnet ERC-7984 (OpenZeppelin) cUSD with faucet + minter role
  MockYieldSource.sol         Simulated APY strategy computing yield over the encrypted principal
  interfaces/IYieldSource.sol One-function adapter boundary for a real vault in production
  test/                       16 FHEVM-mock tests (deposit/withdraw, privacy, draw correctness,
                              tiers & dust, batching, weighting, proof-of-win, yield, admin)
frontend/                     Next.js 14 · wagmi · @zama-fhe/relayer-sdk
  lib/fhevm/                  Singleton SDK instance, sign-once EIP-712 user-decrypt session
  lib/hooks/                  Pool reads (polled), actions (encrypt → tx), reveal helpers
  components/pool/            Prize hero, position panel, draw panel, history, owner controls
```

### Draw algorithm (all encrypted unless noted)

```
for each winner slot k (tiers → amounts_k = prize × share / winners):
    seed_k   = FHE.randEuint64()                          // public after the draw
    ticket_k = (uint128(seed_k) * uint128(total)) >> 64   // in [0, total)
for i in participants:                                    // pass 1, batched
    cum += weight_i                                       // weight_i = min(eligible_i, balance_i)
    for each k: winner_k += (cum <= ticket_k)             // encrypted indices
for i in participants:                                    // pass 2, batched
    credit_i   = Σ_k select(winner_k == i, amount_k, 0)
    balance_i += credit_i;  wonInDraw[epoch][i] = credit_i   // only i can decrypt
reserve -= Σ_k select(winner_k < n, amount_k, 0)          // unfilled slots + dust roll over
```

### Privacy model

| Encrypted | Public |
|---|---|
| Every deposit / withdrawal amount | That an address holds a position |
| Every balance, incl. the pool's total principal | Aggregate prize reserve & each draw's prize |
| Who won, and lifetime winnings | FHE seed and participant count per draw |
| Per-user eligibility weights | Anything a winner chooses to publish |

## Deployed contracts (Sepolia)

| Contract | Address |
|---|---|
| ConfidentialPrizePool | [`0x3217682C1290e3a4689de75686C5a63D6DE7e12C`](https://sepolia.etherscan.io/address/0x3217682C1290e3a4689de75686C5a63D6DE7e12C) |
| ConfidentialUSD (cUSD, ERC-7984) | [`0xaaF5Ff634dF99Eb4c3d9ea24c2Ef5AA033256Cf4`](https://sepolia.etherscan.io/address/0xaaF5Ff634dF99Eb4c3d9ea24c2Ef5AA033256Cf4) |
| MockYieldSource | [`0x21FDaDD312420Ead95d6177aF4538A38AE829Bd6`](https://sepolia.etherscan.io/address/0x21FDaDD312420Ead95d6177aF4538A38AE829Bd6) |

Draw period 10 minutes · simulated APY 5% · faucet 1,000 cUSD per hour per address.

## Run it

```bash
# Contracts
cd contracts && npm install
npx hardhat test                      # FHEVM mock
cp .env.example .env                  # SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY
DRAW_PERIOD=600 APY_BPS=500 npm run deploy:sepolia   # writes frontend/lib/contracts/deployment.json

# Frontend
cd ../frontend && npm install
npm run dev                           # http://localhost:3000
```

The frontend reads all addresses and ABIs from `frontend/lib/contracts/deployment.json`, written by the deploy script. Nothing is hardcoded.

## Production notes

- `MockYieldSource` is the only testnet stand-in. It sits behind `IYieldSource`; a mainnet deployment swaps in an adapter over a real vault and points the pool at a registry-listed confidential token (e.g. cUSDT).
- Draw batch size is a client parameter (`DRAW_BATCH`, default 5). Per-participant cost is ~(2 + 3·K) FHE ops in pass 1 and ~(1 + 3·K) in pass 2 for K winner slots (K = 5 by default, max 8).
- Measured on Sepolia (real coprocessor, default 5 winner slots): faucet ~330k gas · operator approval 46k · encrypted deposit ~870k · sponsor prize ~640k · `startDraw` ~2.0–2.3M (5 seeds, 5 tickets, per-tier amounts) · `advanceDraw` pass 1 ≈ 210k + ~300k per participant · pass 2 ≈ 520k + ~450k per participant. The default batch of 5 stays under ~3M gas per transaction.
- The 96-block reorg window applies to ACL grants as on any FHEVM app; prize credits are in-balance (no one-shot key reveal), so a reorg can only delay, not misdirect, a payout.
- Owner powers are limited to the draw period and (testnet) APY. There is no pause, no upgrade, no ability to read or move user funds.

## Versions

`@fhevm/solidity` 0.11.1 · `@fhevm/hardhat-plugin` 0.4.x · `@openzeppelin/confidential-contracts` 0.4.0 · `@zama-fhe/relayer-sdk` 0.4.x · Solidity 0.8.27 (cancun)

## License

MIT
