# X thread draft — Cipher Pool

1/ PoolTogether, but nobody can see your balance.

Cipher Pool is a no-loss prize savings pool where deposits, balances and winnings are encrypted end-to-end on Ethereum, built on @zama's FHEVM for the Developer Program Season 4 bounty.

[demo link] 🧵

2/ The game is the same one that made PoolTogether famous: deposit, keep your principal, and each round the pool's yield goes to one saver. Odds scale with your share.

The difference: the chain never sees a single number.

3/ You start with a plain test ERC-20 and wrap it into a confidential ERC-7984 token, one to one. From there, deposits are encrypted in your browser, bound to your address and the pool, and added to your encrypted balance with FHE.add.

Even the pool's total stays encrypted.

4/ The hard part: picking a winner weighted by balances you cannot read.

The contract draws an FHE random seed from the coprocessor, derives an encrypted ticket, then walks the encrypted balances keeping an encrypted running sum. The count of prefix sums below the ticket IS the winner's index. Still encrypted.

5/ Then every participant's encrypted claimable pot gets select(index == i, prize, 0). Winners' pots grow; everyone else's by an encrypted zero. Claiming is a confidential transfer anyone can call at constant cost.

From the outside, every account was touched identically. Not even the contract owner learns who won.

6/ Verifiable anyway: each draw publishes its FHE seed, prize and participant count for public decryption. A winner can publish a proof of win if they want to brag. Nobody else can.

7/ Fairness built in: your weight for a draw is min(balance at epoch start, current balance), computed homomorphically. No sniping the prize with a last-second deposit.

8/ Production details that matter:
• Both draw passes run in bounded batches to stay under the FHE compute budget at any pool size
• Withdrawals never revert on over-request (a revert would leak your balance)
• Sign once, reveal everything for the session
• 14 FHEVM tests, no owner access to funds

9/ Try it on Sepolia: take test tUSD, shield it into cUSD, deposit, hold the big button to run a draw, reveal privately whether you won, claim, withdraw any time.

Demo: [link]
Code: [link]
Video: [link]

Built with @zama FHEVM, OpenZeppelin confidential contracts and the Zama relayer SDK.
