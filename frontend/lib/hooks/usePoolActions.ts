"use client";

import { useCallback } from "react";
import { useAccount, useConfig } from "wagmi";
import { readContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { decodeEventLog } from "viem";
import { publicDecryptWithProof } from "@/lib/fhevm/instance";
import { parseUnits } from "viem";
import { POOL, TOKEN, TUSD, CHAIN_ID, DECIMALS, etherscanTx } from "@/lib/contracts";
import { encryptUint64 } from "@/lib/fhevm/instance";
import { useWriteAndWait } from "@/lib/hooks/useWriteAndWait";
import { useToast } from "@/components/ui/Toast";
import { fire } from "@/lib/scene";
import { sfx } from "@/lib/sound";

const OPERATOR_TTL = 365 * 24 * 3600;
/** Participants processed per advanceDraw() tx — bounded to stay well under the FHE HCU budget. */
export const DRAW_BATCH = 5;

type Step = (s: string) => void;

export function usePoolActions() {
  const { address } = useAccount();
  const write = useWriteAndWait();
  const config = useConfig();
  const toast = useToast();

  const need = () => {
    if (!address) throw new Error("Connect your wallet first.");
    sfx.click();
    return address;
  };

  const txToast = (title: string, hash: string) => toast.push({ kind: "success", title, href: etherscanTx(hash) });

  const faucet = useCallback(
    async (setStep: Step) => {
      need();
      setStep("Confirm the faucet transaction in your wallet…");
      const hash = await write({ ...TUSD, chainId: CHAIN_ID, functionName: "faucet", onSent: () => setStep("Minting 1,000 tUSDC…") });
      fire({ type: "faucet", amount: 1_000_000_000n });
      txToast("Faucet claimed: 1,000 tUSDC", hash);
      return hash;
    },
    [address, write],
  );

  /** tUSDC → cUSDC: ERC-20 approval (if needed) then wrap. The wrapped amount becomes an encrypted balance. */
  const shield = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      const allowance = (await readContract(config, { ...TUSD, chainId: CHAIN_ID, functionName: "allowance", args: [user, TOKEN.address] })) as bigint;
      if (allowance < value) {
        setStep("Approve the wrapper to take your tUSDC…");
        const h = await write({ ...TUSD, chainId: CHAIN_ID, functionName: "approve", args: [TOKEN.address, value], onSent: () => setStep("Confirming approval…") });
        txToast("tUSDC approved", h);
      }
      setStep("Confirm the wrap in your wallet…");
      const hash = await write({ ...TOKEN, chainId: CHAIN_ID, functionName: "wrap", args: [user, value], onSent: () => setStep("Wrapping into cUSDC on Zama FHEVM, your balance becomes encrypted…") });
      fire({ type: "shield", amount: value });
      txToast(`Shielded ${amount} tUSDC into cUSDC`, hash);
      return hash;
    },
    [address, write, config],
  );

  /** Claim everything won so far to the wallet (confidential transfer). Safe for anyone. */
  const claim = useCallback(
    async (setStep: Step) => {
      need();
      setStep("Confirm the claim in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "claimPrize", onSent: () => setStep("Sending your prize by confidential transfer on Zama FHEVM…") });
      fire({ type: "claim" });
      txToast("Prize claimed to your wallet", hash);
      return hash;
    },
    [address, write],
  );

  const ensureOperator = useCallback(
    async (setStep: Step) => {
      const user = need();
      const ok = (await readContract(config, { ...TOKEN, chainId: CHAIN_ID, functionName: "isOperator", args: [user, POOL.address] })) as boolean;
      if (ok) return;
      setStep("One-time approval: allow the pool to move your cUSDC…");
      const until = BigInt(Math.floor(Date.now() / 1000) + OPERATOR_TTL);
      const hash = await write({ ...TOKEN, chainId: CHAIN_ID, functionName: "setOperator", args: [POOL.address, until], onSent: () => setStep("Confirming approval…") });
      txToast("Pool approved as operator", hash);
    },
    [address, write, config],
  );

  const deposit = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      await ensureOperator(setStep);
      setStep("Encrypting your amount with Zama's FHE key…");
      const { handle, inputProof } = await encryptUint64(POOL.address, user, value);
      setStep("Confirm the deposit in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "deposit", args: [handle, inputProof], onSent: () => setStep("Sending your encrypted deposit to the pool on Zama FHEVM…") });
      fire({ type: "deposit", amount: value });
      txToast(`Deposited ${amount} cUSDC`, hash);
      return hash;
    },
    [address, write, ensureOperator],
  );

  const withdraw = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      setStep("Encrypting your amount with Zama's FHE key…");
      const { handle, inputProof } = await encryptUint64(POOL.address, user, value);
      setStep("Confirm the withdrawal in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "withdraw", args: [handle, inputProof], onSent: () => setStep("Withdrawing through Zama FHEVM, amount stays encrypted…") });
      fire({ type: "withdraw", amount: value });
      txToast(`Withdrew ${amount} cUSDC`, hash);
      return hash;
    },
    [address, write],
  );

  const donate = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      await ensureOperator(setStep);
      setStep("Encrypting your amount with Zama's FHE key…");
      const { handle, inputProof } = await encryptUint64(POOL.address, user, value);
      setStep("Confirm the sponsorship in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "donatePrize", args: [handle, inputProof], onSent: () => setStep("Adding your encrypted amount to the prize on Zama FHEVM…") });
      fire({ type: "sponsor", amount: value });
      txToast(`Sponsored ${amount} cUSDC to the prize`, hash);
      return hash;
    },
    [address, write, ensureOperator],
  );

  const harvest = useCallback(
    async (setStep: Step) => {
      need();
      setStep("Confirm in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "harvest", onSent: () => setStep("Harvesting yield into the prize…") });
      txToast("Yield harvested", hash);
    },
    [address, write],
  );

  /** Start (if due) and run the draw to completion, batch by batch. */
  const runDraw = useCallback(
    async (setStep: Step, onProgress?: () => void) => {
      need();
      const phase = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "phase" }));
      if (phase === 0) {
        setStep("Confirm: start the draw (harvest yield + draw the encrypted seed)…");
        const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "startDraw", onSent: () => setStep("Zama's coprocessor is drawing the encrypted random seeds…") });
        fire({ type: "drawStart" });
        txToast("Draw started", hash);
        onProgress?.();
      }
      // Advance until the pool is open again.
      for (let i = 0; i < 200; i++) {
        const p = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "phase" }));
        if (p === 0) break;
        const cursor = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "drawCursor" }));
        const n = Number(await readContract(config, { ...POOL, chainId: CHAIN_ID, functionName: "participantCount" }));
        const label = p === 1 ? "Selecting the winner over encrypted balances" : "Crediting the prize to the encrypted winner";
        setStep(`${label} — ${cursor}/${n}. Confirm the next batch…`);
        await write({ ...POOL, chainId: CHAIN_ID, functionName: "advanceDraw", args: [BigInt(DRAW_BATCH)], onSent: () => setStep(`${label} — processing ${cursor}→${Math.min(cursor + DRAW_BATCH, n)} of ${n}…`) });
        fire({ type: "drawSweep", pass: p === 1 ? 1 : 2, cursor: Math.min(cursor + DRAW_BATCH, n), total: n });
        onProgress?.();
      }
      fire({ type: "drawDone" });
      toast.push({ kind: "success", title: "Draw complete", body: "Prizes have been credited to the winners' encrypted balances." });
    },
    [address, write, config],
  );

  const revealWin = useCallback(
    async (epoch: bigint, setStep: Step) => {
      need();
      setStep("Confirm in your wallet…");
      const hash = await write({ ...POOL, chainId: CHAIN_ID, functionName: "revealWin", args: [epoch], onSent: () => setStep("Publishing your proof of win through Zama FHEVM…") });
      txToast("Proof of win published", hash);
    },
    [address, write],
  );

  /** Unwrap cUSDC back to tUSDC: burn (encrypted) → relayer public decrypt of the burned amount → finalize with the proof. */
  const unwrap = useCallback(
    async (amount: string, setStep: Step) => {
      const user = need();
      const value = parseUnits(amount, DECIMALS);
      if (value <= 0n) throw new Error("Enter an amount greater than zero.");
      setStep("Encrypting your amount with Zama's FHE key…");
      const { handle, inputProof } = await encryptUint64(TOKEN.address, user, value);
      setStep("Confirm step 1 of 2 in your wallet: unwrap…");
      const hash = await writeContract(config, { ...TOKEN, chainId: CHAIN_ID, functionName: "unwrap", args: [user, user, handle, inputProof] });
      setStep("Unwrapping…");
      const receipt = await waitForTransactionReceipt(config, { hash, chainId: CHAIN_ID });
      if (receipt.status === "reverted") throw new Error("The unwrap transaction failed on-chain.");
      let requestId: `0x${string}` | undefined;
      for (const log of receipt.logs) {
        try {
          const ev = decodeEventLog({ abi: TOKEN.abi, data: log.data, topics: log.topics });
          if (ev.eventName === "UnwrapRequested") { requestId = (ev.args as unknown as { unwrapRequestId: `0x${string}` }).unwrapRequestId; break; }
        } catch { /* not ours */ }
      }
      if (!requestId) throw new Error("Could not find the unwrap request in the receipt.");
      setStep("Zama's relayer is decrypting the unwrap amount (up to a minute)…");
      let clear: { value: bigint; proof: `0x${string}` } | undefined;
      for (let i = 0; i < 15 && !clear; i++) {
        try { clear = await publicDecryptWithProof(requestId); } catch { await new Promise((r) => setTimeout(r, 6000)); }
      }
      if (!clear) throw new Error("The network has not confirmed the amount yet. Try again in a minute.");
      setStep("Confirm step 2 of 2 in your wallet: receive your tUSDC…");
      const hash2 = await write({ ...TOKEN, chainId: CHAIN_ID, functionName: "finalizeUnwrap", args: [requestId, clear.value, clear.proof], onSent: () => setStep("Sending your tUSDC…") });
      fire({ type: "withdraw", amount: value });
      txToast(`Unwrapped ${amount} cUSDC to tUSDC`, hash2);
      return hash2;
    },
    [address, write, config],
  );

  return { faucet, shield, claim, deposit, withdraw, donate, harvest, runDraw, revealWin, unwrap, ensureOperator };
}
