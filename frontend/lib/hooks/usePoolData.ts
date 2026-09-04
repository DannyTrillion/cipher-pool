"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { POOL, TOKEN, YIELD, CHAIN_ID } from "@/lib/contracts";
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
  apyBps: bigint;
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
      { ...YIELD, chainId: CHAIN_ID, functionName: "apyBps" },
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
        apyBps: d[9] as bigint,
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
      { ...TOKEN, chainId: CHAIN_ID, functionName: "faucetCooldownRemaining", args: [user] },
    ],
    query: { enabled: !!address, refetchInterval: REFRESH },
  });
  const d = q.data as unknown[] | undefined;
  const norm = (h: unknown) => (h === ZERO_HANDLE ? null : (h as `0x${string}`));
  return {
    user: d
      ? {
          poolBalance: norm(d[0]),
          winnings: norm(d[1]),
          wonInDraw: norm(d[2]),
          isParticipant: d[3] as boolean,
          lastTouchedEpoch: d[4] as bigint,
          walletBalance: norm(d[5]),
          isOperator: d[6] as boolean,
          faucetCooldown: d[7] as bigint,
        }
      : undefined,
    refetch: q.refetch,
  };
}
