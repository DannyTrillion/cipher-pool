"use client";

import { useCallback } from "react";
import { useAccount } from "wagmi";
import type { Address } from "viem";
import { getFhevmInstance, isDecryptSupported } from "./instance";
import { ZERO_HANDLE } from "@/lib/abis";

/** JSON replacer — eth_signTypedData_v4 can't carry bigints; stringify them. */
const bigintReplacer = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

type Eip712Domain = Record<string, unknown>;

/** Build the EIP712Domain type list from whichever domain fields are present. */
function domainTypeFields(domain: Eip712Domain) {
  const fields: { name: string; type: string }[] = [];
  if (domain.name !== undefined) fields.push({ name: "name", type: "string" });
  if (domain.version !== undefined) fields.push({ name: "version", type: "string" });
  if (domain.chainId !== undefined) fields.push({ name: "chainId", type: "uint256" });
  if (domain.verifyingContract !== undefined)
    fields.push({ name: "verifyingContract", type: "address" });
  if (domain.salt !== undefined) fields.push({ name: "salt", type: "bytes32" });
  return fields;
}


/**
 * A cached user-decrypt session. The EIP-712 signature authorizes the relayer
 * to decrypt any handle owned by `user` on the listed `contracts`, for a bounded
 * window. We cache it module-wide so the user signs ONCE per session, then every
 * subsequent token decrypts without another wallet prompt.
 */
interface DecryptSession {
  user: Address;
  chainId: number;
  keypair: { publicKey: string; privateKey: string };
  signature: string;
  contracts: string[];
  startTs: number;
  durationDays: number;
}

const DURATION_DAYS = 10;
const sessions = new Map<string, DecryptSession>();

function key(chainId: number, user: string) {
  return `${chainId}:${user.toLowerCase()}`;
}

function isExpired(s: DecryptSession): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= s.startTs + s.durationDays * 86_400;
}

function covers(s: DecryptSession, contracts: string[]): boolean {
  const have = new Set(s.contracts.map((c) => c.toLowerCase()));
  return contracts.every((c) => have.has(c.toLowerCase()));
}

/** Clear all cached sessions (e.g. on disconnect / account change). */
export function clearDecryptSessions() {
  sessions.clear();
  notify();
}

// --- lightweight subscription so the header chip can reflect session state ---
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
export function subscribeDecryptSessions(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export interface SessionInfo {
  active: boolean;
  /** Whole days remaining in the session window. */
  daysLeft: number;
}

export function getSessionInfo(chainId?: number, user?: string): SessionInfo {
  if (chainId == null || !user) return { active: false, daysLeft: 0 };
  const s = sessions.get(key(chainId, user));
  if (!s || isExpired(s)) return { active: false, daysLeft: 0 };
  const now = Math.floor(Date.now() / 1000);
  const secsLeft = s.startTs + s.durationDays * 86_400 - now;
  return { active: true, daysLeft: Math.max(0, Math.ceil(secsLeft / 86_400)) };
}

export interface DecryptOptions {
  /** Narrate progress for the staged UI. */
  onStep?: (s: string) => void;
}

export function useDecryptSession() {
  const { address, chainId, connector } = useAccount();

  /**
   * Establish (or reuse) the session, signing only when necessary. `contracts`
   * should be the full set of wrapper addresses the user might decrypt this
   * session so one signature covers them all.
   */
  const ensureSession = useCallback(
    async (contracts: string[], onStep?: (s: string) => void): Promise<DecryptSession> => {
      if (!address || chainId == null) throw new Error("Connect your wallet to decrypt.");
      if (!isDecryptSupported(chainId))
        throw new Error("Decryption is available on Sepolia.");

      const k = key(chainId, address);
      const existing = sessions.get(k);
      if (existing && !isExpired(existing) && covers(existing, contracts)) {
        return existing;
      }

      onStep?.("Preparing your Zama decryption keys…");
      const instance = await getFhevmInstance();
      const keypair = instance.generateKeypair();

      // Union of any previously-authorized contracts + the new ones, so we never
      // shrink scope and re-prompt unnecessarily.
      const union = Array.from(
        new Set([...(existing?.contracts ?? []), ...contracts].map((c) => c as Address)),
      );
      const startTs = Math.floor(Date.now() / 1000);

      const eip712 = instance.createEIP712(keypair.publicKey, union, startTs, DURATION_DAYS);

      onStep?.("Waiting for your signature (EIP-712)…");
      // Sign through the raw EIP-1193 provider (like ethers' signTypedData).
      // The relayer's UserDecrypt EIP-712 domain uses the GATEWAY chainId, not
      // Sepolia, so wagmi/viem's signTypedData (which enforces domain.chainId ==
      // connected chain) rejects it. The raw eth_signTypedData_v4 call does not.
      const provider = (await connector?.getProvider().catch(() => undefined)) as
        | { request: (a: { method: string; params: unknown[] }) => Promise<string> }
        | undefined;
      const eth = provider ?? (window as unknown as { ethereum?: typeof provider }).ethereum;
      if (!eth?.request) throw new Error("Wallet provider unavailable for signing.");

      const sdkTypes = eip712.types as Record<string, unknown>;
      const typedData = {
        domain: eip712.domain,
        types: {
          ...sdkTypes,
          // eth_signTypedData_v4 requires EIP712Domain; use the SDK's if present.
          EIP712Domain: sdkTypes.EIP712Domain ?? domainTypeFields(eip712.domain as Eip712Domain),
        },
        primaryType: "UserDecryptRequestVerification",
        message: eip712.message,
      };
      const signature = await eth.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(typedData, bigintReplacer)],
      });

      const session: DecryptSession = {
        user: address,
        chainId,
        keypair,
        signature: signature.replace(/^0x/, ""),
        contracts: union,
        startTs,
        durationDays: DURATION_DAYS,
      };
      sessions.set(k, session);
      notify();
      return session;
    },
    [address, chainId, connector],
  );

  /**
   * Decrypt a single confidential balance handle for `contractAddress`.
   * Returns null for the zero handle (uninitialized — "no balance yet"), so the
   * relayer is never asked to decrypt something it would reject.
   */
  const decryptHandle = useCallback(
    async (
      contractAddress: Address,
      handle: string,
      allContracts: string[],
      opts?: DecryptOptions,
    ): Promise<bigint | null> => {
      if (!handle || handle === ZERO_HANDLE) return null;
      if (!address) throw new Error("Connect your wallet to decrypt.");
      if (!isDecryptSupported(chainId))
        throw new Error("Decryption is available on Sepolia.");

      const session = await ensureSession(
        allContracts.length ? allContracts : [contractAddress],
        opts?.onStep,
      );

      opts?.onStep?.("Zama's relayer is decrypting for you…");
      const instance = await getFhevmInstance();
      const result = await instance.userDecrypt(
        [{ handle, contractAddress }],
        session.keypair.privateKey,
        session.keypair.publicKey,
        session.signature,
        session.contracts,
        address,
        session.startTs,
        session.durationDays,
      );
      const value = result[handle as `0x${string}`];
      return typeof value === "bigint" ? value : BigInt(value as string | number);
    },
    [address, chainId, ensureSession],
  );

  const hasSession = useCallback((): boolean => {
    if (!address || chainId == null) return false;
    const s = sessions.get(key(chainId, address));
    return !!s && !isExpired(s);
  }, [address, chainId]);

  return { decryptHandle, ensureSession, hasSession };
}
