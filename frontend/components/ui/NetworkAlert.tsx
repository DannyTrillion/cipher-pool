"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { sfx } from "@/lib/sound";

/** Amber bar shown right above an action when the wallet is on the wrong network. */
export function NetworkAlert({ className = "" }: { className?: string }) {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const wrong = isConnected && chainId !== sepolia.id;
  return (
    <AnimatePresence>
      {wrong && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-2.5 text-sm ${className}`} role="alert">
          <span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-warn" />Your wallet is on the wrong network. This works on Sepolia.</span>
          <button className="btn-primary btn-sm" disabled={isPending} onClick={() => { sfx.click(); switchChain({ chainId: sepolia.id }); }}>{isPending ? "Switching…" : "Switch to Sepolia"}</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
