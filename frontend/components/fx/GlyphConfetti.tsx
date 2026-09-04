"use client";

import { useEffect, useRef } from "react";
import { onScene } from "@/lib/scene";

/** Ciphertext confetti: hex glyphs burst from the centre on a win. */
export function GlyphConfetti() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const GLYPHS = "0123456789abcdef";
    const COLORS = ["#FFD600", "#5EEAD4", "#8B9CFF", "#ffffff"];
    let parts: { x: number; y: number; vx: number; vy: number; g: string; c: string; r: number; vr: number; life: number }[] = [];
    let raf = 0; let running = false;
    const size = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    size(); addEventListener("resize", size);
    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = "bold 14px ui-monospace, monospace";
      parts = parts.filter((p) => p.life > 0);
      for (const p of parts) {
        p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 1;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.globalAlpha = Math.min(1, p.life / 40); ctx.fillStyle = p.c; ctx.fillText(p.g, 0, 0); ctx.restore();
      }
      if (parts.length) raf = requestAnimationFrame(loop); else running = false;
    };
    const burst = (x: number, y: number, n: number) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = 6 + Math.random() * 9;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, g: GLYPHS[Math.floor(Math.random() * 16)], c: COLORS[Math.floor(Math.random() * COLORS.length)], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 90 + Math.random() * 40 });
      }
      if (!running) { running = true; raf = requestAnimationFrame(loop); }
    };
    const off = onScene((e) => {
      if (e.type === "win") { burst(innerWidth / 2, innerHeight * 0.4, 160); setTimeout(() => burst(innerWidth * 0.3, innerHeight * 0.5, 80), 250); setTimeout(() => burst(innerWidth * 0.7, innerHeight * 0.5, 80), 450); }
    });
    return () => { off(); cancelAnimationFrame(raf); removeEventListener("resize", size); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[54]" />;
}
