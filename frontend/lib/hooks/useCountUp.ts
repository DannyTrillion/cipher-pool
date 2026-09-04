"use client";

import { useEffect, useRef, useState } from "react";

/** Eases a bigint from its previous value to the new one over `ms`. Returns the animated value. */
export function useCountUp(target: bigint | undefined, ms = 900): bigint | undefined {
  const [value, setValue] = useState<bigint | undefined>(target);
  const fromRef = useRef<bigint | undefined>(target);
  useEffect(() => {
    if (target === undefined) return;
    const from = fromRef.current ?? target;
    if (from === target) { setValue(target); return; }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { fromRef.current = target; setValue(target); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      const delta = target - from;
      const cur = from + BigInt(Math.round(Number(delta) * eased));
      setValue(cur);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
