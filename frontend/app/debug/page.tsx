"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { encodeFunctionData, decodeFunctionResult, formatUnits, type Abi } from "viem";
import { POOL, TUSD, TOKEN } from "@/lib/contracts";

/**
 * Network check. Reads the connected wallet's balances through every RPC the
 * app can use, side by side, so a stale or blocked endpoint shows up at once.
 */
const RPCS = [
  ["tenderly", "https://sepolia.gateway.tenderly.co"],
  ["publicnode", "https://ethereum-sepolia-rpc.publicnode.com"],
] as const;

type Row = { name: string; chain?: string; block?: string; usdt?: string; savings?: string; savers?: string; cusdt?: string; error?: string; ms?: number };

async function via(send: (method: string, params: unknown[]) => Promise<unknown>, name: string, user: `0x${string}`): Promise<Row> {
  const t0 = performance.now();
  try {
    const chain = String(await send("eth_chainId", []));
    const block = parseInt(String(await send("eth_blockNumber", [])), 16).toString();
    const call = async (to: `0x${string}`, abi: Abi, functionName: string, args: unknown[]) => {
      const data = encodeFunctionData({ abi, functionName, args });
      const out = (await send("eth_call", [{ to, data }, "latest"])) as `0x${string}`;
      if (!out || out === "0x") throw new Error(`${functionName} returned no data (contract not found on this node)`);
      return decodeFunctionResult({ abi, functionName, data: out });
    };
    const usdt = (await call(TUSD.address, TUSD.abi as Abi, "balanceOf", [user])) as bigint;
    const savers = (await call(POOL.address, POOL.abi as Abi, "participantCount", [])) as bigint;
    const savings = (await call(POOL.address, POOL.abi as Abi, "balanceOf", [user])) as `0x${string}`;
    const cusdt = (await call(TOKEN.address, TOKEN.abi as Abi, "confidentialBalanceOf", [user])) as `0x${string}`;
    return { name, chain, block, usdt: formatUnits(usdt, 6), savers: savers.toString(), savings: /^0x0+$/.test(savings) ? "none" : savings.slice(0, 10) + "…", cusdt: /^0x0+$/.test(cusdt) ? "none" : cusdt.slice(0, 10) + "…", ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { name, error: (e as Error).message.slice(0, 160), ms: Math.round(performance.now() - t0) };
  }
}

export default function DebugPage() {
  const { address, isConnected } = useAccount();
  const [rows, setRows] = useState<Row[]>([]);
  const [ran, setRan] = useState<string>("");

  const run = async () => {
    if (!address) return;
    setRows([]);
    const out: Row[] = [];
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (eth) out.push(await via((method, params) => eth.request({ method, params }), "your wallet's node (Rabby)", address));
    for (const [name, url] of RPCS) {
      let id = 1;
      out.push(await via(async (method, params) => {
        const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: id++, method, params }) });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (j.error) throw new Error(j.error.message);
        return j.result;
      }, name, address));
    }
    setRows(out);
    setRan(new Date().toLocaleTimeString());
  };
  useEffect(() => { void run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [address]);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="display text-3xl">Network check</h1>
      <p className="mt-2 text-sm text-ink-muted">Reads your balances through each endpoint the app can use. If one row disagrees with the others, that endpoint is stale or blocked on your connection.</p>
      <div className="mt-4 font-mono text-xs text-ink-muted">Wallet: {isConnected ? address : "not connected"} · Pool: {POOL.address} · {ran && `checked ${ran}`}</div>
      {!isConnected && <p className="mt-4 text-sm text-warn">Connect your wallet first, then this page runs by itself.</p>}
      <div className="mt-4 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-left text-xs">
          <thead className="bg-black/30 font-mono uppercase tracking-wider text-ink-faint"><tr><th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Chain</th><th className="px-3 py-2">Block</th><th className="px-3 py-2">Your USDT</th><th className="px-3 py-2">Savers in pool</th><th className="px-3 py-2">Your pool handle</th><th className="px-3 py-2">Your cUSDT handle</th><th className="px-3 py-2">ms</th></tr></thead>
          <tbody className="divide-y divide-line font-mono">
            {rows.map((r) => (
              <tr key={r.name} className={r.error ? "text-warn" : ""}>
                <td className="px-3 py-2">{r.name}</td>
                {r.error ? <td className="px-3 py-2" colSpan={6}>{r.error}</td> : <><td className="px-3 py-2">{r.chain}</td><td className="px-3 py-2">{r.block}</td><td className="px-3 py-2">{r.usdt}</td><td className="px-3 py-2">{r.savers}</td><td className="px-3 py-2">{r.savings}</td><td className="px-3 py-2">{r.cusdt}</td></>}
                <td className="px-3 py-2">{r.ms}</td>
              </tr>
            ))}
            {isConnected && rows.length === 0 && <tr><td className="px-3 py-3 text-ink-faint" colSpan={8}>Checking…</td></tr>}
          </tbody>
        </table>
      </div>
      <button className="btn-glass btn-sm mt-4" onClick={() => void run()}>Run again</button>
    </div>
  );
}
