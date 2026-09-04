/** Cipher-pattern identicon: a 5×5 mirrored grid derived from the address, in the brand palette. */
export function Identicon({ address, size = 20 }: { address: string; size?: number }) {
  const hex = address.replace(/^0x/, "").toLowerCase().padEnd(40, "0");
  const colors = ["#FFD600", "#8B9CFF", "#5EEAD4"];
  const c = colors[parseInt(hex[0], 16) % colors.length];
  const cells: boolean[][] = Array.from({ length: 5 }, (_, r) => Array.from({ length: 3 }, (_, col) => parseInt(hex[(r * 3 + col + 1) % 40], 16) % 2 === 0));
  const cell = size / 5;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rounded-[4px]" aria-hidden="true">
      <rect width={size} height={size} fill="rgba(255,255,255,0.06)" />
      {cells.map((row, r) =>
        row.map((on, col) => {
          if (!on) return null;
          const cols = [col, 4 - col];
          return cols.map((cc) => <rect key={`${r}-${cc}`} x={cc * cell} y={r * cell} width={cell} height={cell} fill={c} />);
        }),
      )}
    </svg>
  );
}
