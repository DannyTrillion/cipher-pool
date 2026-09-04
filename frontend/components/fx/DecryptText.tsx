"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const GLYPHS = "0123456789abcdef#%&@$<>{}[]";

/**
 * Scramble-to-plaintext text: characters cycle through hex-ish glyphs and
 * resolve left to right. Re-runs whenever `text` changes. This is the
 * signature "decrypt" moment used for the hero and every revealed value.
 */
export function DecryptText({
  text,
  className,
  duration = 900,
  delay = 0,
  as: Tag = "span",
}: {
  text: string;
  className?: string;
  duration?: number;
  delay?: number;
  as?: "span" | "div" | "h1";
}) {
  const [out, setOut] = useState(text);
  const raf = useRef(0);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setOut(text); return; }
    const start = performance.now() + delay;
    const len = text.length;
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const resolved = Math.floor(t * len);
      let s = "";
      for (let i = 0; i < len; i++) {
        const ch = text[i];
        if (ch === " " || ch === "." || ch === "," || i < resolved) s += ch;
        else s += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      }
      setOut(s);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setOut(text);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [text, duration, delay]);
  return <Tag className={cn(className)} aria-label={text}>{out}</Tag>;
}
