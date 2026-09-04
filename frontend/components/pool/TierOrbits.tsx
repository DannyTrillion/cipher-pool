import type { Tier } from "@/lib/hooks/usePoolData";

/** Concentric orbit diagram of the prize tiers: grand in the centre, outer tiers on rings. */
export function TierOrbits({ tiers, size = 132 }: { tiers: Tier[]; size?: number }) {
  const c = size / 2;
  const colors = ["#FFD600", "#8B9CFF", "#5EEAD4", "#F472B6"];
  const rings = tiers.map((_, i) => (i === 0 ? 0 : (size / 2 - 8) * (i / Math.max(1, tiers.length - 1))));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Prize tiers">
      {rings.map((r, i) => r > 0 && <circle key={i} cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 4" />)}
      {tiers.map((t, i) => {
        const r = rings[i];
        const col = colors[i % colors.length];
        return Array.from({ length: t.winners }, (_, k) => {
          const a = (k / t.winners) * Math.PI * 2 - Math.PI / 2 + i * 0.6;
          const x = c + Math.cos(a) * r;
          const y = c + Math.sin(a) * r;
          const dot = i === 0 ? 7 : 4.5;
          return (
            <g key={`${i}-${k}`}>
              <circle cx={x} cy={y} r={dot * 2.2} fill={col} opacity="0.12" />
              <circle cx={x} cy={y} r={dot} fill={col} />
            </g>
          );
        });
      })}
    </svg>
  );
}
