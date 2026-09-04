"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";
import { onScene, registerSphereCenter, idleMs } from "@/lib/scene";
import { sfx } from "@/lib/sound";

/**
 * The stage. A live 3D point-cloud of ciphertext: every point is an encrypted
 * deposit; prize orbs orbit on a tilted ring, one per winner slot. Reacts to the
 * scene bus: deposits land as new points through a lock flash, withdrawals lift
 * a point out, the draw spins the world up and sweeps beams, a win bursts.
 * Plain 2D canvas with a perspective projection; no WebGL, no library.
 */
export function CipherSphere({
  points = 160,
  orbs = 5,
  drawing = false,
  you = false,
  className = "",
}: {
  points?: number;
  orbs?: number;
  drawing?: boolean;
  you?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const state = useRef({
    points, orbs, drawing, you,
    mx: 0, my: 0, tx: 0, ty: 0,
    speed: 1, zoom: 1, targetZoom: 1,
    flash: 0, lockUntil: 0, burst: 0, sweep: 0, sweepPass: 0 as 0 | 1 | 2,
    landing: [] as { t: number; dir: 1 | -1 }[],
    extraPoints: 0,
  });
  state.current.points = points;
  state.current.orbs = orbs;
  state.current.drawing = drawing;
  state.current.you = you;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0, w = 0, h = 0, dpr = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    registerSphereCenter(() => {
      const r = canvas.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });

    const onMove = (e: MouseEvent) => {
      state.current.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      state.current.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    let scrollY = 0;
    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener("scroll", onScroll, { passive: true });

    const off = onScene((e) => {
      const s = state.current;
      const now = performance.now();
      switch (e.type) {
        case "deposit": s.landing.push({ t: now + 1000, dir: 1 }); s.lockUntil = now + 1700; s.flash = 1; break;
        case "sponsor": s.flash = 0.8; s.burst = 0.4; break;
        case "withdraw": s.landing.push({ t: now, dir: -1 }); s.lockUntil = now + 900; break;
        case "drawStart": s.targetZoom = 1.18; s.sweep = 1; s.sweepPass = 1; sfx.sweep(); break;
        case "drawSweep": s.sweep = 1; s.sweepPass = e.pass; sfx.sweep(); break;
        case "drawDone": s.targetZoom = 1; s.burst = 1; s.flash = 1; s.sweep = 0; sfx.chime(); break;
        case "win": s.burst = 1.6; s.flash = 1; break;
        case "reveal": s.flash = 0.5; break;
      }
    });

    // Fibonacci sphere with exactly N points (sequence runs pole to pole).
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
    const YOU_INDEX = 37;

    let t0 = performance.now();
    let angle = 0, rx = 0, ry = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden) return;
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const s = state.current;
      const idle = idleMs() > 60_000; // attract mode
      const targetSpeed = s.drawing ? 3.2 : idle ? 1.6 : 1;
      s.speed += (targetSpeed - s.speed) * 0.04;
      angle += dt * 0.22 * s.speed;
      s.mx += (s.tx - s.mx) * 0.05;
      s.my += (s.ty - s.my) * 0.05;
      rx = s.my * 0.45 + 0.35 + (idle ? Math.sin(now / 4000) * 0.15 : 0);
      ry = s.mx * 0.5;
      s.zoom += (s.targetZoom * (idle ? 1 + Math.sin(now / 3000) * 0.04 : 1) - s.zoom) * 0.04;
      s.flash = Math.max(0, s.flash - dt * 1.6);
      s.burst = Math.max(0, s.burst - dt * 0.9);
      s.landing = s.landing.filter((l) => now - l.t < 1400);

      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2 - Math.min(120, scrollY * 0.12); // scroll parallax
      const R = Math.min(w, h) * 0.37 * s.zoom;
      const f = R * 3.2;

      // core glow (+ flash)
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5);
      const fl = s.flash;
      g.addColorStop(0, s.drawing ? `rgba(255,214,0,${0.16 + fl * 0.3})` : `rgba(139,156,255,${0.12 + fl * 0.35})`);
      g.addColorStop(0.55, `rgba(139,156,255,${0.04 + fl * 0.08})`);
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
        const x1 = x0 * cosA - z0 * sinA;
        const z1 = x0 * sinA + z0 * cosA;
        const y2 = y0 * cosX - z1 * sinX;
        const z2 = y0 * sinX + z1 * cosX;
        const sc = f / (f + z2 * R);
        proj.push({ x: cx + x1 * R * sc, y: cy + y2 * R * sc, z: z2, sc, i });
      }
      proj.sort((a, b) => a.z - b.z);

      // constellation lines
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
          const al = (1 - Math.sqrt(d2) / maxD) * 0.24 * ((p.z + q.z) / 2 + 0.6);
          ctx.strokeStyle = `rgba(139,156,255,${al.toFixed(3)})`;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
      }

      // sweep beams while drawing: one rotating arc per orb, pass 1 blue, pass 2 mint
      if (s.drawing || s.sweep > 0) {
        const m = Math.max(1, Math.min(8, s.orbs));
        for (let k = 0; k < m; k++) {
          const a0 = angle * 2.4 + (k / m) * Math.PI * 2;
          ctx.strokeStyle = s.sweepPass === 2 ? "rgba(94,234,212,0.35)" : "rgba(139,156,255,0.35)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, R * 1.02, a0, a0 + 0.5);
          ctx.stroke();
        }
      }

      // points
      for (const p of proj) {
        const depth = (p.z + 1) / 2;
        const gold = seeds[p.i] < 0.14;
        const isYou = s.you && p.i === YOU_INDEX;
        const size = (isYou ? 4.2 : gold ? 2.8 : 1.9) * p.sc * (0.6 + depth * 0.8);
        const alpha = 0.18 + depth * 0.82;
        ctx.fillStyle = isYou ? `rgba(255,214,0,${alpha})` : gold ? `rgba(255,214,0,${alpha})` : `rgba(160,176,255,${alpha * 0.9})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill();
        if ((gold || isYou) && depth > 0.6) {
          ctx.fillStyle = `rgba(255,214,0,${(depth - 0.6) * (isYou ? 0.6 : 0.4)})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, size * (isYou ? 3.5 + Math.sin(now / 250) * 0.8 : 3), 0, Math.PI * 2); ctx.fill();
        }
        if (isYou && depth > 0.3) {
          ctx.fillStyle = `rgba(255,214,0,${0.6 + depth * 0.4})`;
          ctx.font = "600 10px ui-monospace, monospace";
          ctx.fillText("you", p.x + 8, p.y - 8);
        }
      }

      // landing / lifting coins along a line into the core
      for (const l of s.landing) {
        const t = Math.max(0, Math.min(1, (now - l.t) / 1200));
        const e = 1 - Math.pow(1 - t, 3);
        const from = l.dir === 1 ? R * 1.9 : 0, to = l.dir === 1 ? 0 : R * 1.9;
        const d = from + (to - from) * e;
        const px = cx + Math.cos(-0.7) * d, py = cy + Math.sin(-0.7) * d;
        ctx.shadowBlur = 20; ctx.shadowColor = "rgba(255,214,0,0.9)";
        ctx.fillStyle = l.dir === 1 ? `rgba(255,214,0,${1 - t * 0.6})` : `rgba(139,156,255,${1 - t * 0.3})`;
        ctx.beginPath(); ctx.arc(px, py, 6 - t * 2, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }

      // lock at the core while encrypting
      if (now < s.lockUntil) {
        const k = Math.min(1, (s.lockUntil - now) / 400);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.globalAlpha = k;
        ctx.strokeStyle = "#FFD600"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#FFD600";
        ctx.fillRect(-7, -3, 14, 11);
        ctx.beginPath(); ctx.arc(0, -3, 5, Math.PI, 0); ctx.stroke();
        ctx.restore();
      }

      // burst ring (draw done / win)
      if (s.burst > 0) {
        const k = 1 - s.burst / 1.6;
        ctx.strokeStyle = `rgba(94,234,212,${(1 - k) * 0.8})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, R * (0.3 + k * 1.6), 0, Math.PI * 2); ctx.stroke();
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
        const y = Math.sin(a) * ringR * Math.sin(tilt) * 0.28;
        const sc = f / (f + Math.sin(a) * ringR * Math.cos(tilt) * 0.5);
        const px = cx + x * sc, py = cy + y * sc;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const m = Math.max(1, Math.min(8, s.orbs));
      for (let k = 0; k < m; k++) {
        const a = ringSpeed + (k / m) * Math.PI * 2;
        const dropped = s.burst > 0.8 ? (s.burst - 0.8) / 0.8 : 0; // orbs dive into the core on drawDone
        const rr = ringR * (1 - dropped);
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr * Math.sin(tilt) * 0.28;
        const zdepth = Math.sin(a);
        const sc = f / (f + zdepth * rr * Math.cos(tilt) * 0.5);
        const px = cx + x * sc, py = cy + y * sc;
        const front = zdepth > 0;
        const size = (k === 0 ? 5 : 3.6) * sc;
        ctx.shadowBlur = front ? 18 : 6;
        ctx.shadowColor = k === 0 ? "rgba(255,214,0,0.9)" : "rgba(94,234,212,0.9)";
        ctx.fillStyle = k === 0 ? `rgba(255,214,0,${front ? 1 : 0.5})` : `rgba(94,234,212,${front ? 0.95 : 0.45})`;
        ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    if (reduced) { frame(performance.now()); cancelAnimationFrame(raf); }
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      off();
      registerSphereCenter(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, [reduced]);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
