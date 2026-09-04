"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

const GLYPHS = "0123456789abcdef#%&@$";
export type ReelFace = "top" | "runner" | "small" | "none";
const FACE: Record<ReelFace, { g: string; c: string; l: string }> = {
  top: { g: "★", c: "text-accent", l: "Top prize" },
  runner: { g: "◆", c: "text-cipher", l: "Runner-up" },
  small: { g: "●", c: "text-mint", l: "Small prize" },
  none: { g: "–", c: "text-ink-faint", l: "" },
};

/**
 * Three reels. While `spinning`, they cycle ciphertext glyphs. When `faces` is
 * provided they land one after another with a spring and a small overshoot.
 */
export function ReelReveal({ spinning, faces, size = 64 }: { spinning: boolean; faces?: ReelFace[]; size?: number }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!spinning) return;
    const id = setInterval(() => setTick((t) => t + 1), 70);
    return () => clearInterval(id);
  }, [spinning]);
  const landed = !!faces && !spinning;
  return (
    <div className="flex items-center gap-2" role="img" aria-label={landed ? faces!.map((f) => FACE[f].l || "no prize").join(", ") : "spinning"}>
      {[0, 1, 2].map((i) => {
        const face = faces?.[i] ?? "none";
        const glyph = landed ? FACE[face].g : spinning ? GLYPHS[(tick * (i + 3)) % GLYPHS.length] : "?";
        return (
          <motion.div
            key={i}
            initial={false}
            animate={landed ? { scale: [1.15, 1], rotate: [8, 0] } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 16, delay: landed ? i * 0.22 : 0 }}
            className={cn(
              "grid place-items-center rounded-2xl border bg-black/40 font-mono shadow-[inset_0_2px_10px_rgba(0,0,0,0.6)]",
              landed && face !== "none" ? "border-accent/40 shadow-[0_0_24px_rgb(255_214_0/0.25),inset_0_2px_10px_rgba(0,0,0,0.6)]" : "border-line",
              landed ? FACE[face].c : "text-cipher",
            )}
            style={{ width: size, height: size, fontSize: size * 0.5 }}
          >
            <motion.span key={landed ? `l${i}` : `s${glyph}${i}`} initial={spinning ? { y: -8, opacity: 0.4 } : false} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.06 }}>{glyph}</motion.span>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Decompose a credit into tier faces (largest first) for the three reels. */
export function facesFor(credit: bigint, slots: bigint[], tiers: { winners: number }[]): ReelFace[] {
  if (credit === 0n) return ["none", "none", "none"];
  const kinds: ReelFace[] = [];
  const tierOf: ReelFace[] = [];
  tiers.forEach((t, i) => { for (let k = 0; k < t.winners; k++) tierOf.push(i === 0 ? "top" : i === 1 ? "runner" : "small"); });
  let rem = credit;
  const order = slots.map((a, i) => ({ a, i })).sort((x, y) => (x.a < y.a ? 1 : -1));
  for (const { a, i } of order) { if (a > 0n && rem >= a) { rem -= a; kinds.push(tierOf[i] ?? "small"); } }
  while (kinds.length < 3) kinds.push("none");
  return kinds.slice(0, 3);
}
