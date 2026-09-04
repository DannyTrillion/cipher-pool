"use client";

import { useId } from "react";

/**
 * Cipher Pool brand mark — a trophy whose cup is a padlock (win + encrypted),
 * in the spirit of PoolTogether's trophy + lowercase wordmark.
 */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  // Unique gradient ids per instance: the header mounts two marks (mobile/desktop)
  // and a gradient defined inside a display:none SVG cannot be referenced.
  const uid = useId().replace(/:/g, "");
  const cup = `lg-cup-${uid}`;
  const base = `lg-base-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={cup} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE14D" />
          <stop offset="100%" stopColor="#F5B800" />
        </linearGradient>
        <linearGradient id={base} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8B9CFF" />
          <stop offset="100%" stopColor="#5EEAD4" />
        </linearGradient>
      </defs>
      {/* handles */}
      <path d="M14 18 H8 a4 4 0 0 0 -4 4 v3 a10 10 0 0 0 10 10 h2" fill="none" stroke="#F5B800" strokeWidth="4" strokeLinecap="round" />
      <path d="M50 18 H56 a4 4 0 0 1 4 4 v3 a10 10 0 0 1 -10 10 h-2" fill="none" stroke="#F5B800" strokeWidth="4" strokeLinecap="round" />
      {/* cup */}
      <path d="M14 10 h36 v18 a18 18 0 0 1 -36 0 z" fill={`url(#${cup})`} />
      {/* shackle cut-out + keyhole: the cup is a padlock */}
      <path d="M24 22 v-4 a8 8 0 0 1 16 0 v4" fill="none" stroke="#0b0c0f" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="32" cy="29" r="4" fill="#0b0c0f" />
      <rect x="30" y="30" width="4" height="7" rx="1.5" fill="#0b0c0f" />
      {/* stem + base */}
      <rect x="28" y="44" width="8" height="7" rx="2" fill="#F5B800" />
      <rect x="18" y="51" width="28" height="7" rx="3.5" fill={`url(#${base})`} />
      {/* sparkle */}
      <path d="M52 6 l1.6 3.4 3.4 1.6 -3.4 1.6 -1.6 3.4 -1.6 -3.4 -3.4 -1.6 3.4 -1.6 z" fill="#5EEAD4" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`display inline-flex items-baseline leading-none ${className}`} style={{ letterSpacing: "-0.04em" }}>
      <span>cipher</span>
      <span className="ml-[0.18em] text-accent">pool</span>
    </span>
  );
}

export function Logo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <Wordmark className="text-[20px]" />
    </span>
  );
}
