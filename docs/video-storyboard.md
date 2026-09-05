# Cipher Pool — demo video storyboard

Runs 2:58, under the bounty's 3:00 cap. Real person on camera at the start and end, screen recording between, normal speed only. Covers the five required moments: deposit, decrypt your pool balance, trigger a draw, claim a prize, withdraw principal, plus the fairness explanation during the draw.

## Before you press record

- Browser at 1440 × 900, bookmarks bar hidden, dark theme.
- Rabby on your wallet `0x329e…9B41`. Two savers are in the pool (`0x2E91…DeF5`): you and the deployer `0xB3Bf…7A58`.
- **Prep is done.** Draw #1 has run and your wallet won it. Leave that prize uncollected until the claim scene. Press Start over in the guide right before recording.
- Money put in during a round counts from the next round, so the on-camera 300 is not in draw #2. Your earlier deposit is. The draw #1 prize is the guaranteed claim.
- Start the screen part when the countdown reads about 1:20. The first scenes take ~75 s and land you at the button as it turns yellow. If it already reads RUN DRAW, that is fine too.
- Tabs open: the app, the pool on Etherscan, the Sourcify page (optional).
- Keep the whole cut under 3:00 including the camera parts. No speed-ups.

---

## 0:00 – 0:15 · Camera · The pitch

**Shot:** You, straight to camera. No screen yet.

**Say:**

> Hi, I'm Daniel. This is Cipher Pool: a prize savings pool like PoolTogether, except nobody can see how much anyone saved. Not other users, not me, not even the contract. Every balance is encrypted with Zama's FHE. Live on Sepolia.

---

## 0:15 – 0:30 · Screen · The home page

**Shot:** Top of the app. Move the mouse across the sphere so it reacts, then rest on the account card. Point at the sphere caption, then the asterisks on the account card.

![Home: headline, Play and Deposit buttons](storyboard/01_hero.png)
![Sphere of encrypted deposits and the account card with masked values](storyboard/02_sphere_card.png)

**Say:**

> Every point on this sphere is an encrypted deposit. The account card shows what anyone can see: nothing. Those asterisks are real ciphertexts on chain. Only the owner's wallet can turn them into numbers.

---

## 0:30 – 0:50 · Screen · Connect, get test money, wrap it

**Shot:** Scroll to the Play section. "New here" is selected and the guide sits at Step 1 (you pressed Start over in the prep).

![Play panel beside the draw chamber](storyboard/03_play_chamber.png)

**Do, in order:**

1. Click **Connect** top right, pick the owner wallet in Rabby.
   *On screen:* Header shows your identicon. The wizard moves to Step 2.
2. Press **Get 1,000 test USDT**. Confirm.
   *On screen:* "Minting 1,000 test USDT from Zama's official mock…", then the tick. Step 3 opens by itself.
3. Press **Wrap … USDT into cUSDT**. The button wraps your whole USDT balance. Confirm the approval, then the wrap.
   *On screen:* "Wrapping into cUSDT on Zama FHEVM, your balance becomes encrypted…", then Step 4.

**Say:**

> I connect, grab test USDT from Zama's official faucet token, and wrap it into cUSDT, Zama's confidential token. From here on, every amount is a ciphertext.

---

## 0:50 – 1:15 · Screen · Deposit, then decrypt your pool balance

**Shot:** Still the guided steps.

**Do, in order:**

1. Step 4: type **300**, press **Put in 300 cUSDT**. Confirm the one-time approval, then the deposit.
   *On screen:* "Encrypting with Zama's FHE key…", "Sending your encrypted deposit to the pool on Zama FHEVM…", then "Done. Your money is in the pool, scrambled." Coins fly into the sphere. Step 5.
2. Step 5: press **Decrypt my numbers**. Sign the one message in Rabby.
   *On screen:* The asterisks unscramble everywhere on the page: your savings (earlier deposit plus this 300), wallet cUSDT, and prizes to collect (the draw #1 prize). Point at the savings figure.

**Say:**

> I put in 300. It's encrypted in my browser before it leaves, so the transaction carries a ciphertext, not a number. To read my pool balance I sign one message. Zama's relayer checks my wallet is allowed, then hands me the figure. There it is. Nothing on the public chain carries an amount.

---

## 1:15 – 1:50 · Screen · Trigger the draw

**Shot:** The draw chamber. The status bar reads "Draw ready. Press the button to run it" and the button is lit yellow.

**Do, in order:**

1. Press and **hold** the big button for one second. Confirm "startDraw", then each "advanceDraw" batch as Rabby asks (two or three).
   *On screen:* Drum spins, balls tumble. Status: "Zama's coprocessor is drawing the encrypted random seeds…", then "Selecting the winner over encrypted balances", then "Crediting the prize to the encrypted winner". Prize balls drop into the tray.
2. Scroll to **Your results**, press **Decrypt: did I win?**
   *On screen:* Two savers are in this draw, so the reel can land on a prize or on "Not this time". Either is fine: the claim scene uses the draw #1 prize already waiting.

![Your results: see if you won, odds, next draw, live activity](storyboard/04_results.png)

**Say:**

> The countdown is at zero, so anyone can run the draw, and the runner has no say in who wins. The pool harvests the interest, draws random seeds inside Zama's coprocessor, and walks every encrypted balance with an encrypted running total. Bigger savers win more often, but nothing is ever decrypted. Every saver gets an encrypted result written, winners and non-winners alike, so from outside every account looks identical. Now I decrypt my result: did I win?

---

## 1:50 – 2:10 · Screen · Claim a prize

**Shot:** Same wallet. The prize from draw #1 is waiting, plus whatever draw #2 just paid you.

**Do, in order:**

1. After the reel lands, look just above it.
   *On screen:* A banner: "… cUSDT is waiting for you" with **Collect to wallet**. It holds the draw #1 prize plus anything from this draw.
2. Press **Collect to wallet**. Confirm.
   *On screen:* "Sending your prize by confidential transfer on Zama FHEVM…", then "Collected. Your prize is in your wallet as cUSDT."

**Say:**

> Prizes sit in an encrypted pot until I collect them, and collecting is a confidential transfer, so even the payout stays hidden. A non-winner who claims just moves an encrypted zero, so the act of claiming reveals nothing.

---

## 2:10 – 2:30 · Screen · Withdraw principal

**Shot:** Same wallet. In Play, click Experienced.

**Do, in order:**

1. Click **Experienced**. The balance strip is already decrypted from the earlier signature.
   *On screen:* Savings, wallet cUSDT, prizes to collect now 0.
2. Tab **Withdraw**: type **100**, press **Withdraw 100 cUSDT**. Confirm.
   *On screen:* "Withdrawing through Zama FHEVM, amount stays encrypted…", then "Done. It is back in your wallet as cUSDT." Savings drop by 100, wallet goes up by 100.

**Say:**

> My money was never at risk. I take 100 back out, encrypted like everything else, and it lands in my wallet as cUSDT. Ask for more than you have and the pool moves zero instead of failing, because a failed transaction would leak your balance.

---

## 2:30 – 2:45 · Screen · Anyone can verify, nobody can peek

**Shot:** Two quick stops.

**Do, in order:**

1. Click **Prizes**. Point at the draw you just ran, its public prize and split.
2. Back on **Pool**, scroll to the savers ledger. Click a row that is not yours, press **Try to decrypt it**.
   *On screen:* The relayer's refusal, word for word.

![Prizes page: prize building up, totals, past draws](storyboard/06_prizes.png)
![Savers ledger with hidden balances and verified-source links in the footer](storyboard/05_ledger_footer.png)

**Say:**

> The prize, the seeds and the saver count are public, so anyone can check a draw was honest. Everything about a person is private: here I try to read another saver's balance and Zama's relayer refuses. The contract source is verified.

---

## 2:45 – 2:58 · Camera · Close

**Shot:** You, straight to camera.

**Say:**

> That's Cipher Pool. Deposits, balances, odds and winnings encrypted end to end with Zama's FHEVM on Zama's official cUSDT. Prizes and draws public, so anyone can verify. Swap the testnet interest mock for a real yield adapter and it's ready for mainnet. Links below. Thanks.

---

## Links for the description

- Live app: https://cipher-pool-beta.vercel.app
- Source: https://github.com/DannyTrillion/cipher-pool
- Verified pool contract: https://repo.sourcify.dev/11155111/0x2E91CbcD154cffA4ac31f5BfDF186E536A9aDeF5
- Pool on Etherscan: https://sepolia.etherscan.io/address/0x2E91CbcD154cffA4ac31f5BfDF186E536A9aDeF5
