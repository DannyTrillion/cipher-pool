"use client";

import { motion } from "framer-motion";
import { useAccount } from "wagmi";
import { usePoolState, useUserState } from "@/lib/hooks/usePoolData";
import { useReveal } from "@/lib/hooks/useReveal";
import { cn } from "@/lib/cn";

/** Progression strip: the story arc of a saver, unlocked from on-chain state. */
export function Badges() {
  const { isConnected } = useAccount();
  const { state } = usePoolState();
  const { user } = useUserState(state?.epoch);
  const { get } = useReveal();
  if (!isConnected || !user) return null;
  const winnings = get(user.winnings);
  const steps = [
    { k: "wallet", t: "Funded", d: "Took test cUSD", on: !!user.walletBalance || !!user.poolBalance },
    { k: "deposit", t: "Saver", d: "Deposited privately", on: !!user.poolBalance },
    { k: "eligible", t: "In the draw", d: "Held a full epoch", on: !!user.poolBalance && !!state && user.lastTouchedEpoch !== state.epoch + 1n },
    { k: "win", t: "Winner", d: "Won a prize", on: winnings !== undefined && winnings > 0n },
  ];
  return (
    <div className="flex flex-wrap gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <motion.div
          key={s.k}
          initial={false}
          animate={{ scale: s.on ? 1 : 0.97, opacity: s.on ? 1 : 0.55 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.04 }}
          className={cn("pill gap-2 py-1.5", s.on && "border-accent/40 bg-accent-faint text-ink")}
          title={s.d}
        >
          <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold", s.on ? "bg-accent text-black" : "bg-white/10 text-ink-faint")}>{s.on ? "✓" : i + 1}</span>
          {s.t}
        </motion.div>
      ))}
    </div>
  );
}
