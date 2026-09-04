"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * A live 3D point-cloud of ciphertext: every point is an encrypted deposit on
 * the surface of a sphere, faint constellation lines between near neighbours,
 * and prize orbs orbiting on a tilted ring — one per winner slot. Rotates
 * slowly, tilts toward the cursor, and spins up while a draw is running.
 * Plain 2D canvas with a perspective projection; no WebGL, no library.
 */
export function CipherSphere({
  points = 160,
  orbs = 5,
  drawing = false,
  className = "",
}: {
  points?: number;
  orbs?: number;
  drawing?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const state = useRef({ points, orbs, drawing, mx: 0, my: 0, tx: 0, ty: 0, speed: 1 });
  state.current.points = points;
  state.current.orbs = orbs;
  state.current.drawing = drawing;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width;
      h = r.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const onMove = (e: MouseEvent) => {
      state.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      state.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    // Fibonacci sphere with exactly N points spread over the whole surface
    // (regenerated when N changes — the sequence runs pole to pole, so taking a
    // prefix of a larger set would only give a cap).
    const MAX = 420;
    const golden = Math.PI * (3 - Math.sqrt(5));
    let base: [number, number, number][] = [];
    let baseN = -1;
    const rebuild = (n: number) => {
      base = [];
      for (let i = 0; i < n; i++) {
        const y = 1 - (i / Math.max(1, n - 1)) * 2;
        const r = Math.sqrt(Math.max(0, 1 - y * y));
        const t = golden * i;
        base.push([Math.cos(t) * r, y, Math.sin(t) * r]);
      }
      baseN = n;
    };
    const seeds = Array.from({ length: MAX }, (_, i) => ((i * 7919) % 100) / 100);

    let t0 = performance.now();
    let angle = 0;
    let rx = 0;
    let ry = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const s = state.current;
      const targetSpeed = s.drawing ? 3.2 : 1;
      s.speed += (targetSpeed - s.speed) * 0.04;
      angle += dt * 0.22 * s.speed;
      s.mx += (s.tx - s.mx) * 0.05;
      s.my += (s.ty - s.my) * 0.05;
      rx = s.my * 0.45 + 0.35;
      ry = s.mx * 0.5;

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.34;
      const f = R * 3.2;

      // core glow
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      g.addColorStop(0, s.drawing ? "rgba(255,214,0,0.16)" : "rgba(139,156,255,0.12)");
      g.addColorStop(0.55, "rgba(139,156,255,0.04)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const n = Math.min(MAX, Math.max(60, Math.floor(s.points)));
      if (n !== baseN) rebuild(n);
      const cosA = Math.cos(angle + ry), sinA = Math.sin(angle + ry);
      const cosX = Math.cos(rx), sinX = Math.sin(rx);
      const proj: { x: number; y: number; z: number; sc: number; i: number }[] = [];
      for (let i = 0; i < n; i++) {
        const [x0, y0, z0] = base[i];
        // rotate Y then X
        const x1 = x0 * cosA - z0 * sinA;
        const z1 = x0 * sinA + z0 * cosA;
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = y0 * sinX + z1 * cosX;
        const sc = f / (f + z2 * R);
        proj.push({ x: cx + x1 * R * sc, y: cy + y2 * R * sc, z: z2, sc, i });
      }
      proj.sort((a, b) => a.z - b.z);

      // constellation lines (front hemisphere only)
      ctx.lineWidth = 1;
      const maxD = R * 0.42;
      for (let a = 0; a < proj.length; a++) {
        const p = proj[a];
        if (p.z < -0.1) continue;
        for (let b = a + 1; b < proj.length; b++) {
          const q = proj[b];
          if (q.z < -0.1) continue;
          const dx = p.x - q.x, dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > maxD * maxD) continue;
          const al = (1 - Math.sqrt(d2) / maxD) * 0.16 * ((p.z + q.z) / 2 + 0.6);
          ctx.strokeStyle = `rgba(139,156,255,${al.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      // points
      for (const p of proj) {
        const depth = (p.z + 1) / 2; // 0 back → 1 front
        const gold = seeds[p.i] < 0.14;
        const size = (gold ? 2.4 : 1.6) * p.sc * (0.6 + depth * 0.8);
        const alpha = 0.18 + depth * 0.82;
        ctx.fillStyle = gold ? `rgba(255,214,0,${alpha})` : `rgba(160,176,255,${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
        if (gold && depth > 0.7) {
          ctx.fillStyle = `rgba(255,214,0,${(depth - 0.7) * 0.5})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // equator ring + prize orbs
      const ringR = R * 1.28;
      const tilt = 1.1 + s.my * 0.2;
      const ringSpeed = angle * (s.drawing ? 2.2 : 1.4);
      ctx.strokeStyle = s.drawing ? "rgba(255,214,0,0.35)" : "rgba(94,234,212,0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        const x = Math.cos(a) * ringR;
        const zz = Math.sin(a) * ringR;
        const y = zz * Math.cos(tilt) * 0.0 + Math.sin(a) * ringR * Math.sin(tilt) * 0.28;
        const sc = f / (f + Math.sin(a) * ringR * Math.cos(tilt) * 0.5);
        const px = cx + x * sc, py = cy + y * sc;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const m = Math.max(1, Math.min(8, s.orbs));
      for (let k = 0; k < m; k++) {
        const a = ringSpeed + (k / m) * Math.PI * 2;
        const x = Math.cos(a) * ringR;
        const y = Math.sin(a) * ringR * Math.sin(tilt) * 0.28;
        const zdepth = Math.sin(a);
        const sc = f / (f + zdepth * ringR * Math.cos(tilt) * 0.5);
        const px = cx + x * sc, py = cy + y * sc;
        const front = zdepth > 0;
        const size = (k === 0 ? 5 : 3.6) * sc;
        ctx.shadowBlur = front ? 18 : 6;
        ctx.shadowColor = k === 0 ? "rgba(255,214,0,0.9)" : "rgba(94,234,212,0.9)";
        ctx.fillStyle = k === 0 ? `rgba(255,214,0,${front ? 1 : 0.5})` : `rgba(94,234,212,${front ? 0.95 : 0.45})`;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    if (reduced) {
      // one static frame
      frame(performance.now());
      cancelAnimationFrame(raf);
    } else {
      raf = requestAnimationFrame(frame);
    }
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
