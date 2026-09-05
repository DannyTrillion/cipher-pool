# X thread — Cipher Pool

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
