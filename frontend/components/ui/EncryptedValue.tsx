"use client";

import { cn } from "@/lib/cn";
import { formatAmount } from "@/lib/format";
import { DecryptText } from "@/components/fx/DecryptText";

/**
 * Renders an encrypted amount.
 *  - not revealed yet: blurred asterisks, so it reads as "hidden", never as "loading"
 *  - `value === null`: the account has no encrypted balance at all (never deposited), which is exactly 0
 *  - revealed: the exact figure, full precision, with a short unscramble
 */
export function EncryptedValue({
  value,
  revealed,
  decimals = 6,
  symbol = "cUSDT",
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
  const unit = <span className="text-[0.55em] text-ink-muted">{symbol}</span>;
  if (value === null) {
    return (
      <span className={cn("font-mono tabular", sizes[size], className)}>
        0 {unit}
      </span>
    );
  }
  if (!revealed || value === undefined) {
    return (
      <span className={cn("inline-flex items-baseline gap-[0.4em]", sizes[size], className)} aria-label="Hidden until you reveal it" title="Hidden. Only your wallet can read this.">
        <span className="masked" aria-hidden="true">{size === "xl" ? "********" : "******"}</span>
        {unit}
      </span>
    );
  }
  return (
    <span className={cn("font-mono tabular", sizes[size], className)}>
      <DecryptText text={formatAmount(value, decimals)} duration={650} /> {unit}
    </span>
  );
}
