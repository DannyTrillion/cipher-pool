# Submission pack — Zama Developer Program Mainnet Season 4 · Bounty Track

Everything to paste into the form, plus the X thread. Fill the two `[link]` slots once the video and thread are up.

## Form answers

**Project name**
Cipher Pool

**One line**
A confidential PoolTogether on Zama FHEVM: no-loss prize savings where deposits, balances, odds and winnings stay encrypted end to end, and every draw is verifiable.

**Description (short)**
Cipher Pool is a no-loss prize savings pool. Savers wrap Zama's official test USDT into confidential cUSDT and deposit it. Every 5 minutes the pool's yield is awarded as five prizes across three tiers. Winners are picked on chain with FHE randomness, weighted by deposit size, computed over encrypted balances; nothing is ever decrypted to run a draw. Every saver gets an encrypted result written, winners and non-winners alike, so from the outside every account looks identical. Winners decrypt their result with one EIP-712 signature and collect by confidential transfer. Principal is withdrawable whenever the pool is open. Prizes, seeds and saver counts are public so anyone can check a draw was honest; who won and how much anyone holds is not.

**Description (long, if the form has room)**
- Tokens: Zama's official Sepolia mocks, USDTMock (public mint) and cUSDTMock (ERC-7984 wrapper). No custom tokens.
- Deposit flow: ERC-20 approve → wrap → one-time operator approval → encrypted deposit (amount encrypted in the browser, bound to the wallet and the pool).
- Accounting: every balance, weight, ticket and prize is a `euint64`; the pool total is encrypted too.
- Draw: `FHE.randEuint64` seeds per prize slot, encrypted tickets, prefix-sum walk over encrypted balances with `winner += (cumulative <= ticket)`, then `FHE.select` credits each saver's encrypted pot. Runs in bounded batches so any pool size fits the FHE compute budget. Tiers: 1 × 40%, 2 × 20%, 2 × 10%.
- Fairness: a saver's weight is `min(balance at round start, current balance)`, so a deposit only counts after a full round and last-second sniping is impossible.
- Claim: `claimPrize()` is a confidential transfer anyone can call at constant cost; non-winners move an encrypted zero, so claiming reveals nothing.
- Withdraw: never reverts on an over-request (a revert would leak the balance); moves what you have.
- Yield: admin-funded drip on testnet; the README documents the two-function adapter interface a real vault plugs into.
- Draws are permissionless: the big button on the site, or `npm run keeper:sepolia` for automation.
- Frontend: Next.js + wagmi + Zama relayer SDK. Encrypted inputs, sign-once EIP-712 user decryption, public decryption with proof for unwrap, error handling for approvals, balance, network mismatch and stale RPC reads.
- Tests: 17 on Zama's FHEVM Hardhat mock. Both contracts source-verified on Sourcify (exact match).

**Live demo**
https://cipher-pool-beta.vercel.app

**Repository**
https://github.com/DannyTrillion/cipher-pool

**Video**
[link]

**X thread**
[link]

**Contracts (Sepolia)**
- ConfidentialPrizePool: 0x2E91CbcD154cffA4ac31f5BfDF186E536A9aDeF5 · verified: https://repo.sourcify.dev/11155111/0x2E91CbcD154cffA4ac31f5BfDF186E536A9aDeF5
- MockYieldSource (prize drip): 0x86706136F477D3bE74a6F9d0dCd04a86A1Ef9b60 · verified: https://repo.sourcify.dev/11155111/0x86706136F477D3bE74a6F9d0dCd04a86A1Ef9b60
- cUSDT (Zama official wrapper): 0x4E7B06D78965594eB5EF5414c357ca21E1554491
- USDT (Zama official mock, public mint): 0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0

**How judges can try it**
Connect any wallet on Sepolia, press "Get 1,000 test USDT" (Zama's faucet mint), wrap, deposit, hold the big button when the countdown ends, press "Decrypt: did I win?", collect, withdraw. The guided "New here" mode walks all six steps.

**Where Zama is used**
`@fhevm/solidity` (FHE ops, `randEuint64`, ACL, `makePubliclyDecryptable`, `checkSignatures`), `ZamaEthereumConfig`, OpenZeppelin confidential contracts (ERC-7984), `@zama-fhe/relayer-sdk` for encrypted inputs and user/public decryption, Zama's official cUSDT/USDT mocks. Every pool transaction emits through Zama's Sepolia ACL (0xf0Ff…433D) and coprocessor (0x92C9…c127).

**Known limitation, stated up front**
Withdrawals pause for the few blocks a draw is running, so balances cannot change mid-draw. Anyone can finish a stalled draw; batches are bounded, so it can never lock.

**Team / contact**
Daniel Makinde · GitHub DannyTrillion · makindedaniel45@gmail.com

**Reward address**
Use a wallet you control on Ethereum mainnet (the reward is cUSDT). Do not use the deployer wallet whose key sat in this project.

---

## X thread (final)

1/ PoolTogether, but nobody can see your balance.

Cipher Pool is a no-loss prize savings pool where deposits, balances, odds and winnings are encrypted end to end on Ethereum, built on @zama's FHEVM for the Developer Program Season 4 bounty.

Try it: https://cipher-pool-beta.vercel.app 🧵

2/ Same game that made PoolTogether famous: deposit, keep your principal, and each round the pool's yield goes to a few savers. Five prizes across three tiers. Odds scale with your share.

The difference: the chain never sees a single number.

3/ You start with Zama's official test USDT and wrap it into their confidential cUSDT, one to one. From there every deposit is encrypted in your browser, bound to your wallet and the pool, and added to your encrypted balance with FHE.add.

Even the pool's total stays encrypted.

4/ The hard part: picking winners weighted by balances you cannot read.

The contract draws FHE random seeds from Zama's coprocessor, derives encrypted tickets, then walks the encrypted balances keeping an encrypted running total. The count of totals below a ticket IS that winner's index. Still encrypted.

5/ Then every saver's encrypted pot gets select(index == i, prize, 0). Winners' pots grow; everyone else's by an encrypted zero. Collecting is a confidential transfer anyone can call at constant cost.

From the outside, every account was touched identically. Not even the contract owner learns who won.

6/ Verifiable anyway: each draw publishes its FHE seeds, prize and saver count for public decryption. Anyone can check a draw was honest. A winner can announce a win if they want. Nobody else can.

7/ Fairness built in: your weight for a draw is min(balance at round start, current balance), computed homomorphically. No sniping the prize with a last-second deposit.

8/ Production details that matter:
• Draws run in bounded batches to stay under the FHE compute budget at any pool size
• Withdrawals never revert on an over-request (a revert would leak your balance)
• Sign once, decrypt everything for the session
• 17 FHEVM tests, contracts source-verified, no owner access to funds
• Keeper script for automated draws

9/ Try it on Sepolia: get test USDT, wrap to cUSDT, deposit, hold the big button when the countdown ends, decrypt whether you won, collect, withdraw any time.

Demo: https://cipher-pool-beta.vercel.app
Code: https://github.com/DannyTrillion/cipher-pool
Video: [link]

Built with @zama FHEVM, OpenZeppelin confidential contracts and the Zama relayer SDK.
