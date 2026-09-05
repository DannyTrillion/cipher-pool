"use client";

import { useCallback } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { POOL, TOKEN, YIELD, TUSD, CHAIN_ID } from "@/lib/contracts";
import { ZERO_HANDLE } from "@/lib/abis";

export const Phase = { Open: 0, Selecting: 1, Awarding: 2 } as const;
export type PhaseValue = (typeof Phase)[keyof typeof Phase];

const REFRESH = 8_000;

export interface PoolState {
  phase: PhaseValue;
  epoch: bigint;
  epochStart: bigint;
  drawPeriod: bigint;
  drawCursor: bigint;
  participantCount: bigint;
  nextDrawAt: bigint;
  isDrawDue: boolean;
  prizeReserveHandle: `0x${string}`;
  dripPerSecond: bigint;
  owner: `0x${string}`;
  tiers: Tier[];
  winnerSlots: number;
}

export interface Tier {
  shareBps: number;
  winners: number;
}

/** Public pool state — polled. */
export function usePoolState() {
  const q = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...POOL, chainId: CHAIN_ID, functionName: "phase" },
      { ...POOL, chainId: CHAIN_ID, functionName: "epoch" },
      { ...POOL, chainId: CHAIN_ID, functionName: "epochStart" },
      { ...POOL, chainId: CHAIN_ID, functionName: "drawPeriod" },
      { ...POOL, chainId: CHAIN_ID, functionName: "drawCursor" },
      { ...POOL, chainId: CHAIN_ID, functionName: "participantCount" },
      { ...POOL, chainId: CHAIN_ID, functionName: "nextDrawAt" },
      { ...POOL, chainId: CHAIN_ID, functionName: "isDrawDue" },
      { ...POOL, chainId: CHAIN_ID, functionName: "prizeReserve" },
      { ...YIELD, chainId: CHAIN_ID, functionName: "ratePerSecond" },
      { ...POOL, chainId: CHAIN_ID, functionName: "owner" },
      { ...POOL, chainId: CHAIN_ID, functionName: "getTiers" },
    ],
    query: { refetchInterval: REFRESH },
  });
  const d = q.data as unknown[] | undefined;
  const state: PoolState | undefined = d
    ? {
        phase: Number(d[0]) as PhaseValue,
        epoch: d[1] as bigint,
        epochStart: d[2] as bigint,
        drawPeriod: d[3] as bigint,
        drawCursor: d[4] as bigint,
        participantCount: d[5] as bigint,
        nextDrawAt: d[6] as bigint,
        isDrawDue: d[7] as boolean,
        prizeReserveHandle: d[8] as `0x${string}`,
        dripPerSecond: d[9] as bigint,
        owner: d[10] as `0x${string}`,
        tiers: (d[11] as { shareBps: number; winners: number }[]).map((t) => ({ shareBps: Number(t.shareBps), winners: Number(t.winners) })),
        winnerSlots: (d[11] as { winners: number }[]).reduce((a, t) => a + Number(t.winners), 0),
      }
    : undefined;
  return { state, refetch: q.refetch, isLoading: q.isLoading, error: q.error };
}

export interface DrawRecord {
  epoch: bigint;
  startedAt: bigint;
  completedAt: bigint;
  participants: number;
  winnerSlots: number;
  prize: `0x${string}`;
  tiers: Tier[];
}

type RawDraw = { startedAt: bigint; completedAt: bigint; participants: number; winnerSlots: number; prize: `0x${string}`; tiers: { shareBps: number; winners: number }[] };
const toDraw = (epoch: bigint, r: RawDraw): DrawRecord => ({
  epoch,
  startedAt: r.startedAt,
  completedAt: r.completedAt,
  participants: Number(r.participants),
  winnerSlots: Number(r.winnerSlots),
  prize: r.prize,
  tiers: r.tiers.map((t) => ({ shareBps: Number(t.shareBps), winners: Number(t.winners) })),
});

/** Per-slot FHE seeds of a draw (public once started). */
export function useDrawSeeds(epoch: bigint | undefined) {
  const q = useReadContract({
    ...POOL,
    chainId: CHAIN_ID,
    functionName: "getDrawSeeds",
    args: [epoch ?? 0n],
    query: { enabled: epoch !== undefined && epoch > 0n, refetchInterval: REFRESH },
  });
  return { seeds: (q.data as `0x${string}`[] | undefined) ?? [] };
}

export function useDraw(epoch: bigint | undefined) {
  const q = useReadContract({
    ...POOL,
    chainId: CHAIN_ID,
    functionName: "getDraw",
    args: [epoch ?? 0n],
    query: { enabled: epoch !== undefined && epoch > 0n, refetchInterval: REFRESH },
  });
  const r = q.data as RawDraw | undefined;
  const draw: DrawRecord | undefined = r && epoch ? toDraw(epoch, r) : undefined;
  return { draw, refetch: q.refetch };
}

export function useDraws(count: bigint | undefined) {
  const n = Number(count ?? 0n);
  const epochs = Array.from({ length: n }, (_, i) => BigInt(n - i)); // newest first
  const q = useReadContracts({
    allowFailure: false,
    contracts: epochs.map((e) => ({ ...POOL, chainId: CHAIN_ID, functionName: "getDraw", args: [e] })),
    query: { enabled: n > 0, refetchInterval: REFRESH },
  });
  const draws: DrawRecord[] = ((q.data as unknown[] | undefined) ?? []).map((r, i) => toDraw(epochs[i], r as RawDraw));
  return { draws, isLoading: q.isLoading };
}

/** Per-user encrypted handles + plaintext flags. */
export function useUserState(epoch: bigint | undefined) {
  const { address } = useAccount();
  const user = address ?? "0x0000000000000000000000000000000000000000";
  const q = useReadContracts({
    allowFailure: false,
    contracts: [
      { ...POOL, chainId: CHAIN_ID, functionName: "balanceOf", args: [user] },
      { ...POOL, chainId: CHAIN_ID, functionName: "winningsOf", args: [user] },
      { ...POOL, chainId: CHAIN_ID, functionName: "wonInDraw", args: [epoch ?? 0n, user] },
      { ...POOL, chainId: CHAIN_ID, functionName: "isParticipant", args: [user] },
      { ...POOL, chainId: CHAIN_ID, functionName: "lastTouchedEpoch", args: [user] },
      { ...TOKEN, chainId: CHAIN_ID, functionName: "confidentialBalanceOf", args: [user] },
      { ...TOKEN, chainId: CHAIN_ID, functionName: "isOperator", args: [user, POOL.address] },
      { ...TUSD, chainId: CHAIN_ID, functionName: "balanceOf", args: [user] },
      { ...TUSD, chainId: CHAIN_ID, functionName: "allowance", args: [user, TOKEN.address] },
      { ...POOL, chainId: CHAIN_ID, functionName: "claimableOf", args: [user] },
    ],
    query: { enabled: !!address, refetchInterval: REFRESH },
  });
  const norm = (h: unknown) => (h === ZERO_HANDLE ? null : (h as `0x${string}`));
  const parse = (d: unknown[] | undefined) =>
    d
      ? {
          poolBalance: norm(d[0]),
          winnings: norm(d[1]),
          wonInDraw: norm(d[2]),
          isParticipant: d[3] as boolean,
          lastTouchedEpoch: d[4] as bigint,
          walletBalance: norm(d[5]),
          isOperator: d[6] as boolean,
          faucetCooldown: 0n,
          tusdBalance: d[8] as bigint,
          tusdAllowance: d[9] as bigint,
          claimable: norm(d[10]),
        }
      : undefined;
  const refetchQ = q.refetch;
  const refetch = useCallback(async () => parse((await refetchQ()).data as unknown[] | undefined), [refetchQ]);
  /**
   * Re-read until the chain reflects a change we just made. Public RPCs sit
   * behind load balancers, so the node that confirmed the receipt is not
   * always the node that answers the next read; a few polls close that gap.
   */
  const waitFor = useCallback(async (ready: (u: UserState) => boolean, tries = 12, everyMs = 1500) => {
    for (let i = 0; i < tries; i++) {
      const u = await refetch();
      if (u && ready(u)) return true;
      await new Promise((r) => setTimeout(r, everyMs));
    }
    return false;
  }, [refetch]);
  return { user: parse(q.data as unknown[] | undefined), refetch, waitFor };
}

export type UserState = NonNullable<ReturnType<typeof useUserState>["user"]>;

/** The connected user's encrypted prize credit for each of the given epochs (null = not in that draw). */
export function useUserDrawCredits(epochs: bigint[]) {
  const { address } = useAccount();
  const user = address ?? "0x0000000000000000000000000000000000000000";
  const q = useReadContracts({
    allowFailure: false,
    contracts: epochs.map((e) => ({ ...POOL, chainId: CHAIN_ID, functionName: "wonInDraw", args: [e, user] })),
    query: { enabled: !!address && epochs.length > 0, refetchInterval: REFRESH },
  });
  const credits = ((q.data as unknown[] | undefined) ?? []).map((h) => (h === ZERO_HANDLE ? null : (h as `0x${string}`)));
  return { credits, isLoading: q.isLoading };
}

/** The public saver list with each saver's encrypted balance handle (what everyone can see). */
export function useSaversLedger(count: bigint | undefined, max = 24) {
  const n = Math.min(max, Number(count ?? 0n));
  const idx = Array.from({ length: n }, (_, i) => BigInt(i));
  const addrQ = useReadContracts({
    allowFailure: false,
    contracts: idx.map((i) => ({ ...POOL, chainId: CHAIN_ID, functionName: "participantAt", args: [i] })),
    query: { enabled: n > 0, refetchInterval: REFRESH },
  });
  const addrs = ((addrQ.data as `0x${string}`[] | undefined) ?? []);
  const balQ = useReadContracts({
    allowFailure: false,
    contracts: addrs.map((a) => ({ ...POOL, chainId: CHAIN_ID, functionName: "balanceOf", args: [a] })),
    query: { enabled: addrs.length > 0, refetchInterval: REFRESH },
  });
  const handles = ((balQ.data as `0x${string}`[] | undefined) ?? []);
  return { rows: addrs.map((a, i) => ({ address: a, handle: handles[i] })), total: Number(count ?? 0n) };
}
