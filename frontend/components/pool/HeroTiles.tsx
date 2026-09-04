"use client";

import { useAccount } from "wagmi";
import { usePoolState, useUserState, useDraw, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal, useReveal } from "@/lib/hooks/useReveal";
import { EncryptedValue } from "@/components/ui/EncryptedValue";
import { formatAmount, truncateAddress } from "@/lib/format";
import { DECIMALS, POOL, SYMBOL } from "@/lib/contracts";
import { useEffect } from "react";
import { formatDuration, useNow } from "@/components/ui/Countdown";

/** Middle preview tile: the position as its owner (or as everyone else) sees it. */
export function PositionTile() {
  const { address, isConnected } = useAccount();
  const { state } = usePoolState();
  const { user } = useUserState(state?.epoch);
  const { reveal, get, busy } = useReveal();
  const poolBal = get(user?.poolBalance);
  const winnings = get(user?.winnings);
  return (
    <div className="tile flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-accent text-[10px] font-bold text-black">C</span>
          <span className="font-medium">{isConnected ? truncateAddress(address) : "you"}</span>
        </div>
        <span className="pill py-0.5 text-[10px]">{isConnected ? "connected" : "preview"}</span>
      </div>
      <div className="flex-1 space-y-3 px-4 py-4">
        <div>
          <div className="label">In the pool</div>
          <div className="mt-1"><EncryptedValue value={isConnected ? (user?.poolBalance ? poolBal : null) : undefined} revealed={poolBal !== undefined} size="md" /></div>
        </div>
        <div>
          <div className="label">Lifetime winnings</div>
          <div className="mt-1"><EncryptedValue value={isConnected ? (user?.winnings ? winnings : null) : undefined} revealed={winnings !== undefined} size="md" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-lg border border-line p-2.5">
            <div className="text-[10px] text-ink-faint">Odds per slot</div>
            <div className="mt-0.5 font-mono text-xs">your share · private</div>
          </div>
          <div className="rounded-lg border border-line p-2.5">
            <div className="text-[10px] text-ink-faint">Principal</div>
            <div className="mt-0.5 font-mono text-xs text-ok">never at risk</div>
          </div>
        </div>
      </div>
      <div className="border-t border-line px-4 py-2.5 text-[11px] text-ink-faint">
        {isConnected && user?.poolBalance ? (
          <button className="text-accent hover:underline" disabled={!!busy} onClick={() => { void reveal(POOL.address, user.poolBalance, "tile-pool"); void reveal(POOL.address, user.winnings, "tile-win"); }}>
            {busy ? "Decrypting…" : "Reveal with one signature"}
          </button>
        ) : (
          "Only the owner can decrypt these. Not even the contract."
        )}
      </div>
    </div>
  );
}

/** Right preview tile: the draw, live. */
export function DrawTile() {
  const { state } = usePoolState();
  const { draw } = useDraw(state?.epoch);
  const pub = usePublicReveal();
  const now = useNow();
  useEffect(() => { if (draw?.completedAt && draw.completedAt > 0n) void pub.reveal([draw.prize]); }, [draw?.prize, draw?.completedAt, pub.reveal]);
  const prize = draw ? pub.values[draw.prize] : undefined;
  const drawing = !!state && state.phase !== Phase.Open;
  const due = !!state && !drawing && Number(state.nextDrawAt) <= now;
  return (
    <div className="tile flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="grid h-5 w-5 place-items-center rounded-full border border-mint/60 text-[10px] text-mint">◎</span>
          <span className="font-medium">Blind draw</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span className={`h-1.5 w-1.5 rounded-full ${drawing ? "bg-mint animate-pulse" : due ? "bg-accent" : "bg-ok"}`} />
          {drawing ? "live" : due ? "ready" : "open"}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-center px-4 py-4">
        {drawing ? (
          <>
            <div className="label">Now</div>
            <div className="mt-1 text-sm">{state?.phase === Phase.Selecting ? "Selecting winners over ciphertext" : "Crediting prizes to encrypted balances"}</div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="progress-stripes h-full rounded-full bg-mint" style={{ width: `${((state?.phase === Phase.Selecting ? 0 : 50) + (Number(state?.drawCursor ?? 0n) / Math.max(1, Number(state?.participantCount ?? 1n))) * 50)}%` }} /></div>
          </>
        ) : (
          <>
            <div className="label">Next draw</div>
            <div className="mt-1 font-mono text-2xl tabular">{state ? (due ? "ready" : formatDuration(Number(state.nextDrawAt) - now)) : "…"}</div>
            <div className="mt-3 text-xs text-ink-faint">{state?.winnerSlots ?? 5} winner slots · one FHE seed each · nobody learns who won</div>
          </>
        )}
        {draw && draw.completedAt > 0n && (
          <div className="mt-4 rounded-lg border border-line p-2.5">
            <div className="text-[10px] text-ink-faint">Last draw #{draw.epoch.toString()}</div>
            <div className="mt-0.5 font-mono text-sm">{prize !== undefined ? `${formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} ${SYMBOL}` : <span className="cipher-mask">•••••</span>} <span className="text-ink-faint">· {draw.participants} savers · {draw.winnerSlots} winners</span></div>
          </div>
        )}
      </div>
      <div className="border-t border-line px-4 py-2.5 text-[11px] text-ink-faint">Seeds and prize published for verification.</div>
    </div>
  );
}
