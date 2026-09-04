"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { usePoolState } from "@/lib/hooks/usePoolData";
import { useWriteAndWait } from "@/lib/hooks/useWriteAndWait";
import { useActionFlow } from "@/lib/useActionFlow";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { POOL, YIELD, CHAIN_ID } from "@/lib/contracts";
import { sameAddress } from "@/lib/format";

/** Owner-only controls (hidden for everyone else). */
export function AdminPanel() {
  const { address } = useAccount();
  const { state, refetch } = usePoolState();
  const write = useWriteAndWait();
  const flow = useActionFlow();
  const [period, setPeriod] = useState("");
  const [drip, setDrip] = useState("");
  const [tiers, setTiers] = useState("");
  if (!state || !address || !sameAddress(address, state.owner)) return null;

  return (
    <section className="card p-6">
      <div className="label">Owner controls</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="flex gap-2">
          <input className="input !text-sm" placeholder={`Draw period (s) · now ${state.drawPeriod}`} value={period} onChange={(e) => setPeriod(e.target.value.replace(/\D/g, ""))} />
          <button className="btn-secondary" disabled={!period} onClick={() => flow.run(async (s) => { s("Confirm…"); await write({ ...POOL, chainId: CHAIN_ID, functionName: "setDrawPeriod", args: [BigInt(period)] }); await refetch(); }, { successMessage: "Draw period updated." })}>Set</button>
        </div>
        <div className="flex gap-2">
          <input className="input !text-sm" placeholder={`Prize drip · tUSD units/sec · now ${state.dripPerSecond}`} value={drip} onChange={(e) => setDrip(e.target.value.replace(/\D/g, ""))} />
          <button className="btn-secondary" disabled={!drip} onClick={() => flow.run(async (s) => { s("Confirm…"); await write({ ...YIELD, chainId: CHAIN_ID, functionName: "setRate", args: [BigInt(drip)] }); await refetch(); }, { successMessage: "Prize drip updated." })}>Set</button>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input className="input !text-sm" placeholder={`Tiers as share%:winners, e.g. 40:1,40:2,20:2 · now ${state.tiers.map((t) => `${t.shareBps / 100}:${t.winners}`).join(",")}`} value={tiers} onChange={(e) => setTiers(e.target.value)} />
        <button
          className="btn-secondary"
          disabled={!tiers || state.phase !== 0}
          onClick={() =>
            flow.run(
              async (s) => {
                const parts = tiers.split(",").map((p) => p.trim().split(":"));
                const shares = parts.map((p) => BigInt(Math.round(Number(p[0]) * 100)));
                const winners = parts.map((p) => BigInt(p[1]));
                s("Confirm…");
                await write({ ...POOL, chainId: CHAIN_ID, functionName: "setTiers", args: [shares, winners] });
                await refetch();
              },
              { successMessage: "Tiers updated for the next draw." },
            )
          }
        >
          Set
        </button>
      </div>
      <FlowStatus state={flow.state} className="mt-3" />
    </section>
  );
}
