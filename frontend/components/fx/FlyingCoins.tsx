"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onScene, anchorRect, getSphereCenter, touch } from "@/lib/scene";
import { sfx } from "@/lib/sound";

interface Coin { id: number; from: { x: number; y: number }; to: { x: number; y: number }; kind: "coin" | "cipher" | "prize"; delay: number }
let seq = 1;

/** DOM-level coins that fly between the wallet chip, the action buttons and the sphere. */
export function FlyingCoins() {
  const [coins, setCoins] = useState<Coin[]>([]);
  useEffect(() => {
    const t = () => touch();
    window.addEventListener("pointermove", t, { passive: true });
    window.addEventListener("keydown", t);
    window.addEventListener("scroll", t, { passive: true });
    return () => { window.removeEventListener("pointermove", t); window.removeEventListener("keydown", t); window.removeEventListener("scroll", t); };
  }, []);
  useEffect(() => {
    const center = (r: DOMRect | null) => (r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null);
    const spawn = (from: { x: number; y: number } | null, to: { x: number; y: number } | null, kind: Coin["kind"], n: number) => {
      if (!from || !to) return;
      const batch: Coin[] = Array.from({ length: n }, (_, i) => ({ id: seq++, from, to, kind, delay: i * 0.07 }));
      setCoins((c) => [...c, ...batch]);
      setTimeout(() => setCoins((c) => c.filter((x) => !batch.some((b) => b.id === x.id))), 1400 + n * 70);
    };
    return onScene((e) => {
      const wallet = center(anchorRect("wallet"));
      const sphere = getSphereCenter();
      switch (e.type) {
        case "faucet": sfx.coin(); spawn(center(anchorRect("faucet")), wallet, "coin", 6); break;
        case "deposit": sfx.whoosh(); spawn(wallet ?? center(anchorRect("deposit")), sphere, "coin", 5); setTimeout(sfx.lock, 700); break;
        case "sponsor": sfx.whoosh(); spawn(wallet ?? center(anchorRect("deposit")), sphere, "prize", 4); break;
        case "withdraw": sfx.whoosh(); spawn(sphere, wallet, "cipher", 5); setTimeout(sfx.coin, 800); break;
        case "win": sfx.win(); spawn(sphere, center(anchorRect("position-balance")) ?? wallet, "prize", 8); break;
      }
    });
  }, []);
  return (
    <div className="pointer-events-none fixed inset-0 z-[55]" aria-hidden="true">
      <AnimatePresence>
        {coins.map((c) => (
          <motion.div
            key={c.id}
            initial={{ x: c.from.x - 8, y: c.from.y - 8, scale: 0.6, opacity: 0 }}
            animate={{
              x: [c.from.x - 8, (c.from.x + c.to.x) / 2 + (Math.random() * 120 - 60), c.to.x - 8],
              y: [c.from.y - 8, Math.min(c.from.y, c.to.y) - 80 - Math.random() * 60, c.to.y - 8],
              scale: [0.6, 1.1, 0.4],
              opacity: [0, 1, 0],
            }}
            transition={{ duration: 1.05, delay: c.delay, ease: [0.2, 0.7, 0.2, 1] }}
            className={`absolute h-4 w-4 rounded-full ${c.kind === "coin" ? "bg-accent shadow-[0_0_16px_rgb(255_214_0/0.9)]" : c.kind === "prize" ? "bg-[#5EEAD4] shadow-[0_0_16px_rgb(94_234_212/0.9)]" : "bg-cipher shadow-[0_0_14px_rgb(139_156_255/0.9)]"}`}
          >
            {c.kind === "cipher" && <span className="absolute inset-0 grid place-items-center font-mono text-[8px] font-bold text-black">••</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
