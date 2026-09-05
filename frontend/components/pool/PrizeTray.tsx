"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onScene } from "@/lib/scene";

/** The tray under the chute: prize balls land in their slots when a draw completes. */
export function PrizeTray({ slots, live }: { slots: number; live: boolean }) {
  const [landed, setLanded] = useState(false);
  useEffect(() => onScene((e) => { if (e.type === "drawDone") { setLanded(false); setTimeout(() => setLanded(true), 1100); } if (e.type === "drawStart") setLanded(false); }), []);
  const k = Math.max(1, Math.min(8, slots));
  return (
    <div className="relative mx-auto -mt-2 flex h-14 w-full max-w-[360px] shrink-0 items-end justify-center gap-2" aria-hidden="true">
      <div className="absolute inset-x-6 bottom-0 h-3 rounded-b-xl border border-t-0 border-line bg-black/30" />
      {Array.from({ length: k }, (_, i) => (
        <div key={i} className="relative h-10 w-9 rounded-t-lg border border-b-0 border-line bg-black/25">
          <AnimatePresence>
            {(landed || (!live && !landed)) && (
              <motion.span
                key={landed ? "l" : "idle"}
                initial={landed ? { y: -60, opacity: 0 } : false}
                animate={{ y: 0, opacity: landed ? 1 : 0.25 }}
                transition={{ type: "spring", stiffness: 420, damping: 18, delay: i * 0.08 }}
                className={`absolute bottom-1 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full ${i === 0 ? "bg-accent shadow-[0_0_14px_rgb(255_214_0/0.8)]" : "bg-mint shadow-[0_0_12px_rgb(94_234_212/0.7)]"}`}
              />
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
