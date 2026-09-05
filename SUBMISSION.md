# Submission — Zama Developer Program Mainnet Season 4 · Bounty Track

**Project:** Cipher Pool — Confidential Prize Savings (confidential PoolTogether)

## Links
- Live demo: https://cipher-pool-beta.vercel.app
- Repository: https://github.com/DannyTrillion/cipher-pool
- Video (3 min, real-person pitch): _TBD_
- X thread: _TBD_
- Contracts (Sepolia): see `frontend/lib/contracts/deployment.json` and the app's "How it works" page

## Requirement → implementation map

| Requirement | Where |
|---|---|
| Deposit a test ERC-20 | USDT faucet → `approve` → `cUSD.wrap` (ERC-7984 wrapper) → `deposit` (encrypted input + `confidentialTransferFrom`) |
| Yield distributed through periodic draws | `harvest` → encrypted prize reserve → `startDraw` / `advanceDraw` |
| Withdraw principal at any time | `withdraw` (any time the pool is open; never reverts on over-request) |
| Deposits, balances, winnings encrypted | `euint64` everywhere; ACL only to holder + pool; tests prove other users cannot decrypt |
| Winner selection over encrypted balances | encrypted ticket + encrypted prefix-sum walk + encrypted index (`advanceDraw`) |
| Claim | `claimableOf` (EIP-712 decrypt) → `claimPrize()` confidential transfer to wallet; constant-cost, safe for non-winners |
| Only winners decrypt prizes | `wonInDraw[epoch][user]` and `claimableOf` ACL'd to the user only |
| Draw publicly verifiable | per-draw `DrawRecord` with publicly decryptable seed + prize; optional proof-of-win |
| Production quality | 14 mock tests, batched draws for HCU budget, sign-once reveal, graceful errors, no owner access to funds |

## Demo script (3 minutes)
1. Connect → faucet 1,000 USDT → Shield into cUSDT (approve + wrap).
2. Deposit 400 → balance shows as cipher; Unlock (one signature) → 400.
3. Second wallet deposits; sponsor 25 cUSDT to the prize → hero shows public prize.
4. Countdown hits zero → Run draw: start (seed) → batches (progress bar) → complete.
5. "Did I win?" → reel reveal; Claim to wallet (confidential transfer); optionally publish proof.
6. Draws page: seed + prize public; Etherscan shows identical touches for every account.
7. Withdraw everything, any time.
