"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/** Very faint drifting hex ciphertext columns behind the whole app. Cheap: ~12 fps, pauses when hidden. */
export function CipherRain() {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const HEX = "0123456789abcdef";
    let raf = 0;
    let last = 0;
    let cols: { x: number; y: number; speed: number; len: number; chars: string[] }[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(8, Math.floor(window.innerWidth / 90));
      cols = Array.from({ length: n }, (_, i) => ({
        x: (i + 0.5) * (window.innerWidth / n) + (Math.random() * 30 - 15),
        y: Math.random() * window.innerHeight,
        speed: 12 + Math.random() * 18,
        len: 6 + Math.floor(Math.random() * 10),
        chars: Array.from({ length: 16 }, () => HEX[Math.floor(Math.random() * 16)]),
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden) return;
      if (now - last < 80) return; // ~12 fps is plenty for a background
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      for (const c of cols) {
        c.y += c.speed * dt;
        if (c.y - c.len * 14 > window.innerHeight) {
          c.y = -Math.random() * 200;
          c.x = Math.random() * window.innerWidth;
        }
        if (Math.random() < 0.15) c.chars[Math.floor(Math.random() * c.chars.length)] = HEX[Math.floor(Math.random() * 16)];
        for (let i = 0; i < c.len; i++) {
          const a = (1 - i / c.len) * 0.16;
          ctx.fillStyle = i === 0 ? `rgba(255,214,0,${a + 0.12})` : `rgba(125,165,255,${a})`;
          ctx.fillText(c.chars[i % c.chars.length], c.x, c.y - i * 14);
        }
      }
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  if (reduced) return null;
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10" />;
}
