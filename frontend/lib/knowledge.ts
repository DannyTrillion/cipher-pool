/**
 * Cipher's knowledge bank. Plain-language answers only. The chat widget matches a
 * question against `q` and `keys`, and never answers outside this bank.
 */
export interface Entry { id: string; q: string; keys: string[]; a: string; follow?: string[] }

export const OPENING = `Hi, I'm Cipher. Quick version of what this is:

Think of a piggy bank shared by a group. Everyone puts money in and keeps it. The bank earns interest on the whole pile, and instead of splitting that interest evenly, the group holds a draw every 10 minutes and gives it to a few winners. Nobody ever loses what they put in.

The twist here is that your money is scrambled on the blockchain. Nobody can see how much you saved, not even the pool. Ask me anything.`;

export const SUGGESTED = ["What is this?", "Can I lose money?", "How do I start?", "How are winners picked?", "What can other people see?", "What is tUSD and cUSD?"];

export const BANK: Entry[] = [
  { id: "what", q: "What is this?", keys: ["what", "this", "about", "pool", "cipher", "explain", "site", "app"], a: "A shared savings pool. Everyone puts money in and keeps it. The interest the pool earns is given out as prizes in a draw every 10 minutes. Your money is scrambled on the blockchain, so nobody can see how much you saved.", follow: ["Can I lose money?", "How do I start?"] },
  { id: "lose", q: "Can I lose money?", keys: ["lose", "risk", "safe", "loss", "principal", "danger"], a: "No. What you put in stays yours and you can take it out whenever the pool is open. Only the interest is used for prizes. On this test network the money is play money anyway.", follow: ["Take my money out", "What is the test network?"] },
  { id: "start", q: "How do I start?", keys: ["start", "begin", "how", "first", "steps", "new", "guide"], a: "Connect a wallet, get free test tUSD from the faucet, wrap it into private cUSD, then put some in the pool. The Play section has a New here mode that walks you through each step.", follow: ["What is a wallet?", "What is tUSD and cUSD?"] },
  { id: "winners", q: "How are winners picked?", keys: ["winner", "winners", "picked", "chosen", "draw", "random", "lottery", "raffle", "select"], a: "Every 10 minutes the pool draws random numbers, one per prize. It goes through everyone's scrambled balances and picks winners without unscrambling anything. The more you saved, the better your odds. Nobody, not even the pool, learns who won.", follow: ["What are my odds?", "How do I know it was fair?"] },
  { id: "see", q: "What can other people see?", keys: ["see", "private", "privacy", "public", "hidden", "visible", "know", "others", "secret"], a: "They can see that your address is in the pool, the prize amounts, and the draw numbers. They cannot see how much you saved, your odds, whether you won, or how much you have won. Even the pool's total is hidden.", follow: ["How do I know it was fair?", "What is scrambled?"] },
  { id: "tokens", q: "What is tUSD and cUSD?", keys: ["tusd", "cusd", "token", "tokens", "wrap", "wrapping", "shield", "dollar", "money"], a: "tUSD is free test money, a plain token anyone can see. cUSD is the same money wrapped so the amounts are scrambled. You wrap tUSD into cUSD one for one, then put cUSD into the pool. You can unwrap later.", follow: ["How do I get test money?", "How do I start?"] },
  { id: "faucet", q: "How do I get test money?", keys: ["faucet", "free", "test", "get", "mint", "money", "1000", "tusd"], a: "Press Need test tUSD in the Play section, or step 2 of New here mode. You get 1,000 tUSD, once per hour per wallet. It has no real value.", follow: ["What is tUSD and cUSD?"] },
  { id: "wallet", q: "What is a wallet?", keys: ["wallet", "metamask", "connect", "login", "account", "sign"], a: "A wallet is a small browser app, like MetaMask, that holds your keys. Here it is your login and the only thing that can read your own numbers. Press Connect in the top right. If you do not have one, the button links to MetaMask.", follow: ["How do I start?"] },
  { id: "odds", q: "What are my odds?", keys: ["odds", "chance", "chances", "probability", "likely", "win"], a: "Your chance at each prize equals your share of everyone's savings. Save twice as much, double your odds. Your exact odds stay private because the pool's total is hidden, so the site shows a rough guess that assumes everyone saved the same.", follow: ["How are winners picked?"] },
  { id: "fair", q: "How do I know it was fair?", keys: ["fair", "cheat", "trust", "verify", "check", "proof", "rigged", "honest"], a: "Every draw publishes its random numbers and its prize. The way winners are picked is fixed in the contract and anyone can read it. Open Check this draw on any prize card to see the numbers. Nobody, not even the people who built this, can change a result.", follow: ["How are winners picked?"] },
  { id: "won", q: "How do I know if I won?", keys: ["won", "did i win", "result", "results", "check", "reveal", "prize"], a: "After a draw, press Did I win? in Your results. Your wallet unscrambles your own result. Nobody else can see it. If you won, press Collect prize to move it to your wallet.", follow: ["How do I collect a prize?"] },
  { id: "collect", q: "How do I collect a prize?", keys: ["collect", "claim", "prize", "withdraw prize", "get prize", "payout"], a: "Press Collect prize. It moves your prize to your wallet as cUSD. Anyone can press it, even with nothing to collect, so pressing it never gives away who won.", follow: ["How do I know if I won?"] },
  { id: "withdraw", q: "Take my money out", keys: ["withdraw", "take out", "cash out", "exit", "leave", "remove", "get my money"], a: "Use the Withdraw tab in the Play section, any time the pool is open. Your money comes back to your wallet as cUSD. If a draw is running, wait a minute or two until it finishes.", follow: ["Can I lose money?"] },
  { id: "draw", q: "When is the next draw?", keys: ["when", "next", "draw", "time", "countdown", "schedule", "often", "minutes"], a: "Every 10 minutes on this test network. The big yellow button shows the countdown. When it reaches zero anyone can hold the button to run the draw.", follow: ["Who runs the draw?"] },
  { id: "button", q: "Who runs the draw?", keys: ["button", "run", "trigger", "press", "hold", "start draw", "keeper", "who"], a: "Anyone. When the countdown ends, hold the big yellow button for a second. It picks the winners in a few steps. If someone else already started it, you can keep it going.", follow: ["When is the next draw?"] },
  { id: "prize", q: "Where does the prize come from?", keys: ["prize", "interest", "yield", "where", "come from", "funded", "money from", "apy"], a: "From interest on the pool's money. On this test network the interest is simulated as a steady drip, about 9 cUSD an hour, and anyone can also add to the prize. In a real deployment it would come from lending the pool's money out.", follow: ["How is the prize split?"] },
  { id: "split", q: "How is the prize split?", keys: ["split", "tiers", "how many", "winners", "share", "top prize", "five", "5"], a: "Five prizes per draw. One top prize worth 40% of the pot, two worth 20% each, and two worth 10% each. One person can win more than one.", follow: ["What are my odds?"] },
  { id: "scrambled", q: "What is scrambled?", keys: ["scrambled", "encrypted", "encryption", "fhe", "zama", "ciphertext", "how private", "technology"], a: "Your numbers are locked with maths so they look like noise to everyone but you. The clever part is that the pool can still add them up and compare them while they are locked. That technology is from Zama.", follow: ["What can other people see?"] },
  { id: "testnet", q: "What is the test network?", keys: ["test network", "testnet", "sepolia", "real money", "real", "fake", "play money"], a: "Sepolia is a practice version of Ethereum. Everything here is play money with no real value. It works exactly like the real thing so you can try it safely.", follow: ["How do I get test money?"] },
  { id: "fees", q: "Are there fees?", keys: ["fee", "fees", "cost", "gas", "charge", "price", "pay"], a: "The pool takes no fee. Each action costs a small amount of Sepolia test ETH for the network, which is also free from public faucets.", follow: ["What is the test network?"] },
  { id: "eligible", q: "Why am I not in this draw?", keys: ["eligible", "not in", "next draw", "after next", "wait", "count", "round"], a: "Money has to sit in the pool for one full round before it counts. That stops people jumping in just before a draw. Your money is in the draw after next, and every one after that.", follow: ["When is the next draw?"] },
  { id: "announce", q: "What does Announce my win do?", keys: ["announce", "publish", "show the world", "proof", "brag", "public win"], a: "It makes your prize amount for that draw public so anyone can see you won. It is optional. Nobody else can do it for you.", follow: ["What can other people see?"] },
  { id: "unlock", q: "Why do I have to sign to see my numbers?", keys: ["sign", "signature", "show my numbers", "unlock", "see my", "decrypt", "why sign"], a: "Your numbers are scrambled on the blockchain. One signature proves to the network that you are the owner, so it unscrambles them for you only. You sign once per session.", follow: ["What is scrambled?"] },
  { id: "add", q: "What is Add to prize?", keys: ["add to prize", "sponsor", "donate", "top up", "give"], a: "It lets anyone put money straight into the next prize. It is a gift to the pool and cannot be taken back.", follow: ["Where does the prize come from?"] },
  { id: "ledger", q: "What is the list of accounts at the bottom?", keys: ["list", "ledger", "accounts", "patterns", "bars", "try to read"], a: "Those are the real accounts in the pool. Each pattern is drawn from a scrambled balance. Press one and try to read it. The network refuses, because only the owner has the key.", follow: ["What can other people see?"] },
  { id: "stuck", q: "Something is not working", keys: ["error", "stuck", "failed", "not working", "problem", "wrong network", "broken", "help"], a: "Check three things: your wallet is on Sepolia, you have some Sepolia test ETH for network fees, and you confirmed the wallet pop-up. If a draw is running, deposits and withdrawals pause until it ends. Error messages on screen say what happened in plain words.", follow: ["What is the test network?"] },
  { id: "who", q: "Who built this?", keys: ["who built", "built", "made", "team", "zama", "bounty", "season"], a: "It was built for the Zama Developer Program, Season 4, as a private version of PoolTogether. The code is open source and the contracts are on Sepolia. See the footer for addresses.", follow: ["What is scrambled?"] },
];

const STOP = new Set(["the", "a", "an", "is", "it", "i", "my", "me", "do", "does", "can", "to", "of", "in", "on", "and", "or", "you", "your", "this", "that", "what", "how", "are", "be", "for", "with", "at", "if", "so"]);

function tokens(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t));
}

/** Score entries by keyword and question-word overlap; return the best above a threshold. */
export function answer(question: string): { entry: Entry | null; alternatives: Entry[] } {
  const q = question.toLowerCase();
  const qt = tokens(question);
  const scored = BANK.map((e) => {
    let s = 0;
    for (const k of e.keys) if (q.includes(k)) s += k.includes(" ") ? 3 : 2;
    for (const t of qt) if (tokens(e.q).includes(t)) s += 1.5;
    if (q.trim() === e.q.toLowerCase()) s += 10;
    return { e, s };
  }).sort((a, b) => b.s - a.s);
  const best = scored[0];
  return { entry: best && best.s >= 2 ? best.e : null, alternatives: scored.slice(0, 3).filter((x) => x.s > 0).map((x) => x.e) };
}
