# Cipher Pool — Confidential Prize Savings on the Zama Protocol

**Live app (Sepolia): https://cipher-pool-beta.vercel.app**
**Source: https://github.com/DannyTrillion/cipher-pool**

A production-grade, no-loss prize savings pool in the PoolTogether mould, where **deposits, balances, odds and winnings are encrypted end-to-end** with Zama's FHEVM, **winners are selected on-chain over encrypted balances with FHE randomness**, and every draw is publicly verifiable.

Built for the **Zama Developer Program — Mainnet Season 4 Bounty Track** (Confidential Prize Savings App).

## The full cycle, end to end on Sepolia

| Step | What happens | Where |
|---|---|---|
| **Get test tokens** | `tUSDC` is a plain 6-decimal test ERC-20 with a public faucet (1,000 per hour per address). | `MockUSD.faucet()` — "Need test tUSDC?" in the app |
| **Shield** | `tUSDC.approve(cUSDC, amount)` → `cUSD.wrap(you, amount)`. `cUSDC` is an OpenZeppelin **ERC-7984 wrapper** over `tUSDC`; your cUSDC balance is an encrypted `euint64`, backed 1:1 by tUSDC locked in the wrapper. | Shield tab / wizard step 3 |
| **Deposit** | One-time `cUSD.setOperator(pool)`, then the app encrypts your amount in the browser (bound to you and the pool) and calls `deposit(externalEuint64, proof)`. The pool pulls it with `confidentialTransferFrom` and adds it to your encrypted balance with `FHE.add`. Over-requests move zero and never revert (a revert would leak your balance). | Deposit tab |
| **Hold a confidential balance** | `balanceOf(you)` is a ciphertext handle only you (and the pool) are allowed on. Not even the pool's total is readable. | "Unlock my numbers" (EIP-712 user decryption, one signature per session) |
| **Draw** | Permissionless. After `drawPeriod`, anyone calls `startDraw()` then `advanceDraw(batch)` until complete — the app's hold-to-run button does this, or run `npm run keeper:sepolia`. | Launch console |
| **Win** | Tiered prizes (default grand 40% ×1, 20% ×2, 10% ×2). Each slot gets its own `FHE.randEuint64()` seed; selection is a deposit-weighted walk over encrypted balances (below). Prizes land in each winner's **encrypted claimable pot**. | Results panel: reel reveal |
| **Claim** | Decrypt `claimableOf(you)` (EIP-712) to learn you won, then `claimPrize()` moves it to your wallet by **confidential transfer**. Anyone can call claim at constant cost — non-winners move an encrypted zero — so claiming reveals nothing. | "Claim to wallet" |
| **Withdraw** | `withdraw(externalEuint64, proof)` any time the pool is open. Principal is never at risk. | Withdraw tab |
| **Unwrap** | Back to the original ERC-20: `cUSD.unwrap(you, you, encAmount, proof)` burns and publishes the burned amount; the app fetches the relayer's public decryption + proof and calls `finalizeUnwrap(requestId, amount, proof)`, which releases tUSDC 1:1. | Unwrap tab |

## How winner selection works (all encrypted unless noted)

```
for each prize slot k (tiers → amount_k = prize × share / winners):
    seed_k   = FHE.randEuint64()                            // coprocessor randomness — public after the draw
    ticket_k = (uint128(seed_k) * uint128(total)) >> 64     // encrypted, uniform in [0, total)
for i in savers:                                            // pass 1, batched
    cum += weight_i                                         // weight_i = min(balance at epoch start, balance now)
    for each k: winner_k += asEuint64(cum <= ticket_k)      // encrypted index
for i in savers:                                            // pass 2, batched
    claimable_i += Σ_k select(winner_k == i, amount_k, 0)   // only i can decrypt
reserve -= Σ_k select(winner_k < n, amount_k, 0)            // unfilled slots + dust roll over
```

- **Deposit-weighted:** a saver's chance at each slot equals their share of the eligible weight (a weighted lottery with replacement, like PoolTogether).
- **Fair:** weight is `min(balance at epoch start, current balance)`, computed lazily and homomorphically, so last-second deposits cannot buy odds and early withdrawals cannot keep them.
- **No plaintext anywhere:** balances, weights, tickets, indices and credits are `euint64`. The contract only ever branches with `FHE.select`.
- **Bounded gas:** both passes run in batches (`advanceDraw(maxSteps)`) to respect the FHE per-transaction HCU budget at any pool size.

## Confidentiality design — what stays encrypted, what leaks

| Encrypted (only the owner can decrypt) | Public |
|---|---|
| Every deposit and withdrawal amount | That an address participates (it holds a pool position) |
| Every balance, **including the pool's total principal** | The aggregate prize reserve and each draw's prize (like PoolTogether's prize display) |
| Who won each draw; per-draw and lifetime winnings; the claimable pot | The FHE seeds, tier structure and saver count per draw |
| Per-saver eligibility weights | Anything a winner chooses to publish (`revealWin`) |

Documented leakage:
- **Participation is public** (addresses are iterated by the draw). Amounts are not.
- **The wrap amount is public** — it is an ERC-20 transfer (inherent to the ERC-20 → ERC-7984 boundary). Everything after wrapping is encrypted.
- **Prize reserve is public** by design so the app can show what is up for grabs. Because the mock yield is a fixed public drip (see below), the reserve does not reveal TVL.
- **Transactions are visible**: that you deposited, withdrew, or called `claimPrize` is on-chain; the amounts (including a claim of zero) are ciphertext. Claim is safe for non-winners so a claim never singles out a winner.
- **Timing side channels** (e.g. a user claiming right after a draw) are possible as in any on-chain system; the constant-cost claim mitigates them.

## Yield-source mock, and how a real one plugs in

`MockYieldSource` is an **admin-funded prize drip**: a public fixed rate of tUSDC per second (`ratePerSecond`, default 2,777 units ≈ 10 cUSDC/hour) is minted, wrapped into cUSDC and handed to the pool's encrypted prize reserve on every `harvest()` (called automatically at draw start; callable by anyone). It does *not* compute APY on the encrypted principal, because a plaintext mock cannot do that without leaking TVL. Every dripped cUSDC is backed by tUSDC held in the wrapper.

Production: implement `IYieldSource.harvest(euint64 principal, uint256 elapsed) → euint64` with an adapter that deposits the pool's underlying into an ERC-4626 vault and harvests realised yield into the wrapper, then point the pool at a registry-listed confidential token (e.g. cUSDT) via `setYieldSource`. The pool only depends on `IERC7984` and `IYieldSource`.

## Deployed contracts (Sepolia)

| Contract | Address |
|---|---|
| ConfidentialPrizePool | [`0xAE4a6f8c8e3F0B76F07968C34064BA65A5F0bc9b`](https://sepolia.etherscan.io/address/0xAE4a6f8c8e3F0B76F07968C34064BA65A5F0bc9b) |
| ConfidentialUSD (cUSDC, ERC-7984 wrapper) | [`0xAb953cAC2DF2Fd46F8296cff6eE420f73733410F`](https://sepolia.etherscan.io/address/0xAb953cAC2DF2Fd46F8296cff6eE420f73733410F) |
| MockUSD (tUSDC, test ERC-20) | [`0x4324b6425E1714C6a7cE5CDAEBf32aBa18AB6d0E`](https://sepolia.etherscan.io/address/0x4324b6425E1714C6a7cE5CDAEBf32aBa18AB6d0E) |
| MockYieldSource (prize drip) | [`0xDa9DdC9e1577e1a287bba8506a889FDA3F2515CA`](https://sepolia.etherscan.io/address/0xDa9DdC9e1577e1a287bba8506a889FDA3F2515CA) |

Draw period 10 minutes · prize drip ≈ 10 cUSDC/hour · faucet 1,000 tUSDC per hour per address.

## Repository layout

```
contracts/
  contracts/ConfidentialPrizePool.sol   encrypted balances, lazy eligibility, tiered batched blind draw, claimable pots, proof-of-win
  contracts/ConfidentialUSD.sol         ERC-7984 wrapper over tUSDC (OpenZeppelin ERC7984ERC20Wrapper)
  contracts/MockUSD.sol                 test ERC-20 with faucet + minter role
  contracts/MockYieldSource.sol         admin-funded prize drip behind IYieldSource
  contracts/interfaces/IYieldSource.sol adapter boundary for a real vault
  test/ConfidentialPrizePool.ts         17 FHEVM-mock tests (wrap, deposit/withdraw, privacy, draw correctness,
                                        tiers & dust, batching, weighting, proof-of-win, drip, claim, admin)
  scripts/deploy.ts                     deploys all four, wires roles, writes deployments/<net>.json + frontend ABI/addresses
  scripts/keeper.ts                     minimal keeper that runs draws when due
  scripts/export-abi.ts                 refresh frontend ABIs without redeploying
frontend/                               Next.js 14 · wagmi · @zama-fhe/relayer-sdk
  lib/fhevm/                            singleton SDK instance, sign-once EIP-712 user-decrypt session, public decrypt
  lib/hooks/                            pool reads (polled), actions (encrypt → tx → scene events), on-chain activity feed
  components/pool/                      hero + live sphere, launch console (hold-to-run draw), Play (wizard / expert), Results (reel reveal), ledger, draws timeline
```

## Run it

```bash
# Contracts
cd contracts && npm install
npx hardhat test                                   # FHEVM mock
cp .env.example .env                               # SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY
DRAW_PERIOD=600 DRIP_PER_SEC=2777 npm run deploy:sepolia   # writes frontend/lib/contracts/deployment.json
npm run keeper:sepolia                             # optional: automate draws

# Frontend
cd ../frontend && npm install
npm run dev                                        # http://localhost:3000
```

The frontend reads every address and ABI from `frontend/lib/contracts/deployment.json`; nothing is hardcoded.

## Error handling

- **Missing approval / operator**: the app detects allowance and operator state and asks for the one-off approval first, with a plain-words step narration.
- **Insufficient balance**: deposits and withdrawals never revert on over-request (that would leak balances); the UI warns before sending and explains that anything above your balance won't move.
- **Network mismatch**: the header shows an amber status and a one-click switch to Sepolia; all writes are pinned to chain 11155111.
- **Unsupported tokens**: the pool is single-asset (cUSDC over tUSDC) by design; there is no token picker to misuse.
- **Relayer latency**: freshly changed public handles are retried automatically; every failure surfaces a human message with the raw error available.

## Versions

`@fhevm/solidity` 0.11.1 · `@fhevm/hardhat-plugin` 0.4.x · `@openzeppelin/confidential-contracts` 0.4.0 · `@zama-fhe/relayer-sdk` 0.4.x · Solidity 0.8.27 (cancun)

## License

MIT
