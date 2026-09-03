"use client";

import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";

/**
 * Renders an encrypted amount: a shimmering cipher strip until revealed, then
 * the cleartext with a short reveal animation. `value === null` means "no
 * handle yet" (never deposited) and renders as a dash.
 */
export function EncryptedValue({
  value,
  revealed,
  decimals = 6,
  symbol = "cUSD",
  size = "md",
  className,
}: {
  value: bigint | null | undefined;
  revealed: boolean;
  decimals?: number;
  symbol?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const sizes = { sm: "text-sm", md: "text-lg", lg: "text-3xl", xl: "text-5xl" };
  if (value === null) {
    return (
      <span className={cn("font-mono text-ink-faint", sizes[size], className)}>
        — <span className="text-xs">{symbol}</span>
      </span>
    );
  }
  if (!revealed || value === undefined) {
    return (
      <span className={cn("cipher-mask inline-block font-mono", sizes[size], className)} aria-label="Encrypted value">
        {"••••••••".slice(0, size === "xl" ? 8 : 7)}
      </span>
    );
  }
  return (
    <span className={cn("animate-reveal font-mono tabular", sizes[size], className)}>
      {formatAmount(value, decimals)} <span className="text-[0.55em] text-ink-muted">{symbol}</span>
    </span>
  );
}
