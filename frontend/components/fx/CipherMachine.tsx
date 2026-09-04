"use client";

import { useMemo } from "react";
import { useReducedMotion } from "@/lib/hooks/useReducedMotion";

/**
 * The Cipher Pool "machine": an animated SVG scene in the spirit of PoolTogether's
 * illustrated pipes. Cleartext coins enter from the left, pass through the lock
 * (encryption) and continue as masked ciphertext into the vault. From the vault,
 * prize orbs travel to winners on the right. Pure SMIL — no JS per frame.
 */

const COIN = "#FFD600"; // Zama yellow — cleartext
const CIPHER = "#7DA5FF"; // cipher blue — encrypted
const MINT = "#5EEAD4"; // mint — prize
const PIPE = "rgba(255,255,255,0.06)";
const PIPE_EDGE = "rgba(125,165,255,0.22)";

// Inlet pipes: left edge → lock node at (600, 320)
const INLETS = [
  "M -40 120 H 240 Q 320 120 340 190 T 440 260 Q 500 300 600 320",
  "M -40 250 H 200 Q 300 250 380 300 Q 470 330 600 320",
  "M -40 400 H 260 Q 340 400 380 360 Q 470 310 600 320",
  "M -40 520 H 160 Q 260 520 320 470 Q 440 340 600 320",
];
// Trunk: lock → vault entrance at (1040, 320)
const TRUNK = "M 600 320 H 760 Q 840 320 880 300 Q 940 270 1040 320";
// Outlets: vault (1300, 320) → winners
const OUTLETS = [
  "M 1300 300 Q 1380 300 1420 240 Q 1460 170 1560 150 H 1660",
  "M 1300 330 Q 1400 330 1440 380 Q 1480 450 1560 470 H 1660",
];

function seeded(n: number) {
  let s = n * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function CipherMachine({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();

  // Vault contents: a bed of masked deposits with a few prize orbs, deterministic.
  const beads = useMemo(() => {
    const rnd = seeded(7);
    const out: { cx: number; cy: number; c: string; d: number }[] = [];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 18; col++) {
        const cx = 1062 + col * 13 + (row % 2 ? 6 : 0);
        const cy = 452 - row * 12;
        const r = rnd();
        out.push({ cx, cy, c: r < 0.12 ? MINT : r < 0.22 ? COIN : CIPHER, d: rnd() * 2 });
      }
    }
    return out;
  }, []);

  return (
    <svg
      className={className}
      viewBox="0 0 1600 640"
      preserveAspectRatio="xMinYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <filter id="cm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="cm-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <radialGradient id="cm-vault" cx="50%" cy="60%" r="70%">
          <stop offset="0%" stopColor="rgba(125,165,255,0.14)" />
          <stop offset="100%" stopColor="rgba(125,165,255,0.02)" />
        </radialGradient>
        <linearGradient id="cm-lock" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD600" />
          <stop offset="100%" stopColor="#F59E0B" />
        </linearGradient>
        {INLETS.map((d, i) => <path key={i} id={`cm-in-${i}`} d={d} />)}
        <path id="cm-trunk" d={TRUNK} />
        {OUTLETS.map((d, i) => <path key={i} id={`cm-out-${i}`} d={d} />)}
      </defs>

      {/* faint circuit grid */}
      <g stroke="rgba(255,255,255,0.035)" strokeWidth="1">
        {Array.from({ length: 17 }, (_, i) => <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="640" />)}
        {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1="0" y1={i * 100} x2="1600" y2={i * 100} />)}
      </g>

      {/* pipes */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {[...INLETS, TRUNK, ...OUTLETS].map((d, i) => (
          <g key={i}>
            <path d={d} stroke={PIPE} strokeWidth="16" />
            <path d={d} stroke={PIPE_EDGE} strokeWidth="1.5" strokeDasharray="6 10" opacity="0.7">
              {!reduced && <animate attributeName="stroke-dashoffset" from="0" to="-64" dur="3s" repeatCount="indefinite" />}
            </path>
          </g>
        ))}
      </g>

      {/* lock node — encryption */}
      <g transform="translate(600 320)">
        <circle r="46" fill="rgba(255,214,0,0.10)" filter="url(#cm-soft)" />
        <circle r="30" fill="#0f1014" stroke="url(#cm-lock)" strokeWidth="2.5" />
        {!reduced && (
          <circle r="30" fill="none" stroke={COIN} strokeWidth="1.5" opacity="0.5">
            <animate attributeName="r" values="30;50" dur="2.4s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.5;0" dur="2.4s" repeatCount="indefinite" />
          </circle>
        )}
        <rect x="-9" y="-4" width="18" height="14" rx="3" fill={COIN} />
        <path d="M -6 -4 V -8 a 6 6 0 0 1 12 0 V -4" fill="none" stroke={COIN} strokeWidth="3" />
        <text y="52" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.45)" fontFamily="ui-monospace, monospace" letterSpacing="2">FHE ENCRYPT</text>
      </g>

      {/* vault */}
      <g>
        <rect x="1040" y="220" width="260" height="250" rx="26" fill="url(#cm-vault)" stroke="rgba(125,165,255,0.35)" strokeWidth="1.5" />
        <rect x="1052" y="232" width="236" height="226" rx="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 6" />
        <text x="1170" y="256" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.5)" fontFamily="ui-monospace, monospace" letterSpacing="2">ENCRYPTED POOL</text>
        <g>
          {beads.map((b, i) => (
            <circle key={i} cx={b.cx} cy={b.cy} r="4.6" fill={b.c} opacity={b.c === CIPHER ? 0.55 : 0.9}>
              {!reduced && <animate attributeName="cy" values={`${b.cy};${b.cy - 2};${b.cy}`} dur={`${2.6 + b.d}s`} repeatCount="indefinite" />}
            </circle>
          ))}
        </g>
        {/* draw spinner */}
        <g transform="translate(1170 300)">
          <circle r="22" fill="none" stroke={MINT} strokeWidth="1.5" strokeDasharray="30 12" opacity="0.8">
            {!reduced && <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="8s" repeatCount="indefinite" />}
          </circle>
          <circle r="5" fill={MINT} filter="url(#cm-glow)" />
        </g>
      </g>

      {/* winners */}
      {[[1560, 150], [1560, 470]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="22" fill="#0f1014" stroke={MINT} strokeWidth="1.5" />
          <path d="M -7 -6 h 14 v 4 a 7 7 0 0 1 -14 0 z M -2 4 h 4 v 5 h -4 z M -6 9 h 12" fill={MINT} stroke={MINT} strokeWidth="1" />
          {!reduced && (
            <circle r="22" fill="none" stroke={MINT} strokeWidth="1" opacity="0.5">
              <animate attributeName="r" values="22;40" dur="3s" begin={`${i * 1.5}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0" dur="3s" begin={`${i * 1.5}s`} repeatCount="indefinite" />
            </circle>
          )}
        </g>
      ))}

      {/* moving coins: cleartext on inlets → masked on trunk */}
      {!reduced &&
        INLETS.map((_, i) =>
          [0, 1, 2].map((k) => {
            const dur = 5 + i * 0.7;
            const begin = -(k * dur) / 3 - i * 0.9;
            return (
              <g key={`${i}-${k}`}>
                <circle r="6" fill={COIN} filter="url(#cm-glow)">
                  <animateMotion dur={`${dur}s`} begin={`${begin}s`} repeatCount="indefinite" rotate="auto">
                    <mpath href={`#cm-in-${i}`} />
                  </animateMotion>
                </circle>
              </g>
            );
          }),
        )}
      {!reduced &&
        [0, 1, 2, 3, 4].map((k) => (
          <g key={`t${k}`}>
            <circle r="6" fill={CIPHER} opacity="0.85">
              <animateMotion dur="3.2s" begin={`${-k * 0.64}s`} repeatCount="indefinite">
                <mpath href="#cm-trunk" />
              </animateMotion>
            </circle>
            <text fontSize="7" fill="#0b0c0f" textAnchor="middle" dy="2.5" fontFamily="ui-monospace, monospace" fontWeight="700">
              <animateMotion dur="3.2s" begin={`${-k * 0.64}s`} repeatCount="indefinite">
                <mpath href="#cm-trunk" />
              </animateMotion>
              ••
            </text>
          </g>
        ))}
      {!reduced &&
        OUTLETS.map((_, i) => (
          <circle key={`o${i}`} r="7" fill={MINT} filter="url(#cm-glow)">
            <animateMotion dur="6s" begin={`${-i * 3}s`} repeatCount="indefinite">
              <mpath href={`#cm-out-${i}`} />
            </animateMotion>
            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.08;0.9;1" dur="6s" begin={`${-i * 3}s`} repeatCount="indefinite" />
          </circle>
        ))}
    </svg>
  );
}
