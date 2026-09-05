"use client";

import { useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import Link from "next/link";
import { usePoolState, useSaversLedger, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { usePoolActions } from "@/lib/hooks/usePoolActions";
import { useActionFlow } from "@/lib/useActionFlow";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { DrawButton, type DrawButtonState } from "@/components/pool/DrawButton";
import { FlowStatus } from "@/components/ui/FlowStatus";
import { useNow, formatDuration } from "@/components/ui/Countdown";
import { formatAmount, sameAddress } from "@/lib/format";
import { DECIMALS, SYMBOL, DRIP_PER_HOUR } from "@/lib/contracts";
import { onScene } from "@/lib/scene";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

const PALETTE = ["#FFD600", "#8B9CFF", "#5EEAD4", "#F472B6", "#A78BFA", "#FB923C"];

/** The glass drum: one ball per saver, tumbling during a draw; prize balls appear on the rim and drop down the chute on completion. */
function Drum({ savers, you, drawing, slots }: { savers: string[]; you?: string; drawing: boolean; slots: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const st = useRef({ drawing, savers, you, slots, spin: 0, drop: -1, flash: 0 });
  st.current.drawing = drawing; st.current.savers = savers; st.current.you = you; st.current.slots = slots;

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let raf = 0, w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => { const r = canvas.getBoundingClientRect(); w = r.width; h = r.height; canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0.05 }); io.observe(canvas);
    const off = onScene((e) => {
      const s = st.current;
      if (e.type === "drawDone") { s.drop = performance.now(); s.flash = 1; }
      if (e.type === "deposit") s.flash = 0.6;
    });
    let t0 = performance.now();
    const hashColor = (a: string) => PALETTE[parseInt(a.slice(2, 4), 16) % PALETTE.length];

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !visible) return;
      const dt = Math.min(0.05, (now - t0) / 1000); t0 = now;
      const s = st.current;
      const target = s.drawing ? 4.5 : 0.35;
      s.spin += (target - s.spin) * 0.05;
      s.flash = Math.max(0, s.flash - dt * 1.2);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.36;

      // glass drum
      const g = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.4, R * 0.1, cx, cy, R * 1.2);
      g.addColorStop(0, `rgba(139,156,255,${0.16 + s.flash * 0.25})`); g.addColorStop(1, "rgba(139,156,255,0.03)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = s.drawing ? "rgba(255,214,0,0.7)" : "rgba(139,156,255,0.45)"; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.08)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R * 0.93, 0, Math.PI * 2); ctx.stroke();
      // rim ticks rotate with the spin
      const rot = now / 1000 * s.spin;
      for (let i = 0; i < 24; i++) { const a = rot * 0.4 + (i / 24) * Math.PI * 2; ctx.strokeStyle = "rgba(255,255,255,0.10)"; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R * 0.93, cy + Math.sin(a) * R * 0.93); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke(); }

      // saver balls: resting pile at the bottom, tumbling ring while drawing
      const n = Math.max(1, s.savers.length);
      const br = Math.max(7, Math.min(16, R / (2 + Math.sqrt(n))));
      s.savers.forEach((addr, i) => {
        let x: number, y: number;
        if (s.drawing) {
          const a = rot + (i / n) * Math.PI * 2; const rr = R * 0.62 + Math.sin(now / 300 + i) * R * 0.12;
          x = cx + Math.cos(a) * rr; y = cy + Math.sin(a) * rr;
        } else {
          const perRow = Math.max(3, Math.floor((R * 1.4) / (br * 2.2)));
          const row = Math.floor(i / perRow), col = i % perRow; const inRow = Math.min(perRow, n - row * perRow);
          x = cx + (col - (inRow - 1) / 2) * br * 2.2 + (row % 2 ? br * 0.6 : 0);
          y = cy + R * 0.72 - row * br * 1.9 - br + Math.sin(now / 900 + i) * 1.5;
        }
        const mine = s.you && sameAddress(addr, s.you);
        ctx.shadowBlur = mine ? 16 : 6; ctx.shadowColor = mine ? "rgba(255,214,0,0.9)" : "rgba(0,0,0,0.5)";
        ctx.fillStyle = mine ? "#FFD600" : hashColor(addr); ctx.beginPath(); ctx.arc(x, y, br, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(x - br * 0.3, y - br * 0.3, br * 0.32, 0, Math.PI * 2); ctx.fill();
        if (mine) { ctx.fillStyle = "#0b0c0f"; ctx.font = `700 ${Math.max(8, br * 0.9)}px ui-monospace, monospace`; ctx.textAlign = "center"; ctx.fillText("you", x, y + br * 0.35); }
      });

      // prize balls: on the rim while drawing; dropping down the chute after drawDone
      const k = Math.max(1, Math.min(8, s.slots));
      const dropping = s.drop > 0 && now - s.drop < 1500;
      if (s.drawing || dropping) {
        for (let i = 0; i < k; i++) {
          let x: number, y: number, size = i === 0 ? 9 : 7;
          if (dropping) {
            const t = Math.min(1, (now - s.drop - i * 90) / 900); if (t < 0) continue;
            const e = t * t; // gravity
            x = cx + (i - (k - 1) / 2) * 6 * (1 - t) ; y = cy + R * 0.7 + e * (h - cy - R * 0.7 + 30);
          } else { const a = -rot * 1.6 + (i / k) * Math.PI * 2; x = cx + Math.cos(a) * R * 0.86; y = cy + Math.sin(a) * R * 0.86; }
          ctx.shadowBlur = 18; ctx.shadowColor = i === 0 ? "rgba(255,214,0,0.9)" : "rgba(94,234,212,0.9)";
          ctx.fillStyle = i === 0 ? "#FFD600" : "#5EEAD4"; ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
      }
      // chute
      ctx.strokeStyle = dropping ? "rgba(94,234,212,0.6)" : "rgba(255,255,255,0.12)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - 18, cy + R); ctx.lineTo(cx - 18, h); ctx.moveTo(cx + 18, cy + R); ctx.lineTo(cx + 18, h); ctx.stroke();
    };
    if (reduced) { frame(performance.now()); cancelAnimationFrame(raf); } else raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); off(); };
  }, [reduced]);
  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />;
}

/** The draw chamber: stakes on the left, the drum and the big button in the middle, this-draw facts on the right. */
export function DrawChamber() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { state, refetch } = usePoolState();
  const { rows } = useSaversLedger(state?.participantCount, 40);
  const { reveal, retry, values, errors } = usePublicReveal();
  const actions = usePoolActions();
  const flow = useActionFlow();
  const now = useNow();
  const h = state?.prizeReserveHandle;
  useEffect(() => { if (h) void reveal([h]); }, [h, reveal]);
  useEffect(() => { if (!h || !errors[h]) return; const id = setTimeout(() => retry(h), 12_000); return () => clearTimeout(id); }, [h, errors, retry]);
  const prize = useCountUp(h ? values[h] : undefined);
  const drawing = !!state && state.phase !== Phase.Open;
  const due = !!state && !drawing && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;
  const btn: DrawButtonState = flow.state.status === "pending" && !drawing ? "busy" : drawing ? "live" : due ? "armed" : "countdown";
  const n = Number(state?.participantCount ?? 0n), cursor = Number(state?.drawCursor ?? 0n);
  const progress = state ? (state.phase === Phase.Selecting ? (cursor / Math.max(1, n)) * 0.5 : state.phase === Phase.Awarding ? 0.5 + (cursor / Math.max(1, n)) * 0.5 : 0) : 0;
  const run = () => flow.run(async (s) => { await actions.runDraw(s, () => void refetch()); await refetch(); }, { successMessage: "Draw complete. Check your results below." });

  return (
    <section id="console" className="glass relative scroll-mt-24 overflow-hidden p-5 sm:p-7" aria-label="Draw chamber">
      <div className="grid items-center gap-8 md:grid-cols-[1fr_1.15fr_1fr] md:gap-8">
        <div className="order-2 md:order-1">
          <div className="label">Prize this round</div>
          <div className="mt-2 flex items-baseline gap-3">
            {prize !== undefined ? <span className="display prize-glow text-5xl tabular">{formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })}</span> : <span className="cipher-mask inline-block h-12 w-40" />}
            <span className="font-mono text-lg text-ink-muted">{SYMBOL}</span>
          </div>
          <div className="mt-2 text-sm text-ink-muted">Split between <span className="text-ink">{state?.winnerSlots ?? 5} winners</span> every {state ? formatDuration(Number(state.drawPeriod)).replace(/^00:/, "") : "…"}. Grows about {formatAmount(state ? state.dripPerSecond * 3600n : DRIP_PER_HOUR, DECIMALS, { maxFractionDigits: 0 })} {SYMBOL} an hour from interest (simulated on testnet).</div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-faint">
            <span>{due ? "The draw is ready. Anyone can run it." : drawing ? "Draw in progress. Anyone can keep it going." : "You can put money in or take it out until the draw starts."}</span>
            <Link href="/draws" className="text-accent hover:underline">See all prizes →</Link>
          </div>
        </div>

        <div className="order-1 flex flex-col items-center md:order-2">
          <div className="relative h-[240px] w-full max-w-[360px] sm:h-[280px]">
            <Drum savers={rows.map((r) => r.address)} you={address} drawing={drawing} slots={state?.winnerSlots ?? 5} />
          </div>
          <div className="-mt-2">
            {state ? (
              <DrawButton state={btn} start={Number(state.epochStart)} end={Number(state.nextDrawAt)} connected={isConnected} progress={progress} progressLabel={state.phase === Phase.Selecting ? "picking winners" : state.phase === Phase.Awarding ? "paying prizes" : undefined} onRun={run} onConnect={() => connectors[0] && connect({ connector: connectors[0] })} size={150} />
            ) : <div className="h-[150px] w-[150px] rounded-full bg-white/5" />}
          </div>
          {drawing && isConnected && flow.state.status !== "pending" && <button className="btn-mint btn-sm mt-4" onClick={run}>Keep the draw going</button>}
        </div>

        <div className="order-3 w-full md:justify-self-end">
          <div className="label">This draw</div>
          <dl className="mt-2 divide-y divide-line text-sm">
            <div className="flex items-center justify-between py-2.5"><dt className="text-ink-muted">Savers taking part</dt><dd className="display text-xl tabular">{state ? n : "…"}</dd></div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-ink-muted">Prizes handed out</dt><dd className="display text-xl tabular">{state?.winnerSlots ?? "…"}</dd></div>
            <div className="py-2.5">
              <dt className="text-ink-muted">How the prize is split</dt>
              {state && (
                <dd className="mt-2">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                    {state.tiers.flatMap((t, i) => Array.from({ length: t.winners }, (_, k) => <span key={`${i}-${k}`} className="h-full border-r border-[rgb(var(--base))] last:border-0" style={{ width: `${t.shareBps / 100 / t.winners}%`, background: PALETTE[i % 4] }} />))}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-faint">
                    {state.tiers.map((t, i) => <span key={i} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: PALETTE[i % 4] }} />{i === 0 ? "Top prize" : i === 1 ? "Runners-up" : "Small prizes"}: {t.winners} × {(t.shareBps / 100 / t.winners).toFixed(0)}%</span>)}
                  </div>
                </dd>
              )}
            </div>
            <div className="flex items-center justify-between py-2.5"><dt className="text-ink-muted">Draw number</dt><dd className="font-mono text-sm">#{state ? (state.epoch + 1n).toString() : "…"}</dd></div>
          </dl>
        </div>
      </div>
      <FlowStatus state={flow.state} className="mt-4" />
    </section>
  );
}
