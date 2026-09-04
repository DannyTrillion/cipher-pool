"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import type { AbiEvent } from "viem";
import { POOL, CHAIN_ID } from "@/lib/contracts";

export interface ActivityRow { id: string; kind: "deposit" | "withdraw" | "sponsor" | "drawStart" | "drawDone" | "harvest"; who?: `0x${string}`; epoch?: bigint; block: bigint; ts?: number }

const LOOKBACK = 9_000n; // ~30h of Sepolia blocks; public RPCs cap log ranges around 10k

/** Live pool activity from contract events. Amounts are ciphertext and never shown. */
export function useActivity(limit = 12) {
  const client = usePublicClient({ chainId: CHAIN_ID });
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!client) return;
    let stop = false;
    const events = (POOL.abi as readonly unknown[]).filter((e) => (e as { type: string }).type === "event") as AbiEvent[];
    const load = async () => {
      try {
        const latest = await client.getBlockNumber();
        const logs = await client.getLogs({ address: POOL.address, events, fromBlock: latest > LOOKBACK ? latest - LOOKBACK : 0n, toBlock: latest });
        const mapped: ActivityRow[] = [];
        for (const l of logs) {
          const name = (l as { eventName?: string }).eventName;
          const args = (l as { args?: Record<string, unknown> }).args ?? {};
          const base = { id: `${l.transactionHash}-${l.logIndex}`, block: l.blockNumber ?? 0n };
          if (name === "Deposited") mapped.push({ ...base, kind: "deposit", who: args.user as `0x${string}` });
          else if (name === "Withdrawn") mapped.push({ ...base, kind: "withdraw", who: args.user as `0x${string}` });
          else if (name === "PrizeDonated") mapped.push({ ...base, kind: "sponsor", who: args.from as `0x${string}` });
          else if (name === "DrawStarted") mapped.push({ ...base, kind: "drawStart", epoch: args.epoch as bigint });
          else if (name === "DrawCompleted") mapped.push({ ...base, kind: "drawDone", epoch: args.epoch as bigint });
        }
        const recent = mapped.sort((a, b) => (a.block < b.block ? 1 : -1)).slice(0, limit);
        // timestamps for the visible rows only
        const blocks = Array.from(new Set(recent.map((r) => r.block)));
        const times = new Map<bigint, number>();
        await Promise.all(blocks.slice(0, 10).map(async (b) => { try { const blk = await client.getBlock({ blockNumber: b }); times.set(b, Number(blk.timestamp)); } catch {} }));
        if (!stop) { setRows(recent.map((r) => ({ ...r, ts: times.get(r.block) }))); setLoading(false); }
      } catch { if (!stop) setLoading(false); }
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => { stop = true; clearInterval(id); };
  }, [client, limit]);
  return { rows, loading };
}
