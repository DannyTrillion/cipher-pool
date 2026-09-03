# Submission — Zama Developer Program Mainnet Season 4 · Bounty Track

**Project:** Cipher Pool — Confidential Prize Savings (confidential PoolTogether)

## Links
- Live demo: _TBD_
- Repository: _TBD_
- Video (3 min, real-person pitch): _TBD_
- X thread: _TBD_
- Contracts (Sepolia): see `frontend/lib/contracts/deployment.json` and the app's "How it works" page

## Requirement → implementation map

| Requirement | Where |
|---|---|
| Deposit into a shared pool | `ConfidentialPrizePool.deposit` (encrypted input + ERC-7984 `confidentialTransferFrom`) |
| Yield distributed through periodic draws | `harvest` → encrypted prize reserve → `startDraw` / `advanceDraw` |
| Withdraw principal at any time | `withdraw` (any time the pool is open; never reverts on over-request) |
| Deposits, balances, winnings encrypted | `euint64` everywhere; ACL only to holder + pool; tests prove other users cannot decrypt |
| Winner selection over encrypted balances | encrypted ticket + encrypted prefix-sum walk + encrypted index (`advanceDraw`) |
| Only winners decrypt prizes | `wonInDraw[epoch][user]` ACL'd to the user only; credit lands in encrypted balance |
| Draw publicly verifiable | per-draw `DrawRecord` with publicly decryptable seed + prize; optional proof-of-win |
| Production quality | 14 mock tests, batched draws for HCU budget, sign-once reveal, graceful errors, no owner access to funds |

## Demo script (3 minutes)
1. Connect → faucet 1,000 cUSD (encrypted mint).
2. Deposit 400 → balance shows as cipher; Reveal (one signature) → 400.
3. Second wallet deposits; sponsor 25 cUSD to the prize → hero shows public prize.
4. Countdown hits zero → Run draw: start (seed) → batches (progress bar) → complete.
5. "Did I win?" → private reveal; winner sees prize in balance; optionally publish proof.
6. Draws page: seed + prize public; Etherscan shows identical touches for every account.
7. Withdraw everything, any time.
