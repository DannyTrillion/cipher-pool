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
  const [apy, setApy] = useState("");
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
          <input className="input !text-sm" placeholder={`APY bps · now ${state.apyBps}`} value={apy} onChange={(e) => setApy(e.target.value.replace(/\D/g, ""))} />
          <button className="btn-secondary" disabled={!apy} onClick={() => flow.run(async (s) => { s("Confirm…"); await write({ ...YIELD, chainId: CHAIN_ID, functionName: "setApy", args: [BigInt(apy)] }); await refetch(); }, { successMessage: "APY updated." })}>Set</button>
        </div>
      </div>
      <FlowStatus state={flow.state} className="mt-3" />
    </section>
  );
}
