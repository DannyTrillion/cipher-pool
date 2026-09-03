import { formatUnits } from "viem";

/** Truncate an address middle: 0x1234…AB12. Always mono, always this shape. */
export function truncateAddress(address?: string, lead = 6, tail = 4): string {
  if (!address) return "";
  if (address.length <= lead + tail) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

/**
 * Format a token amount with grouped, tabular-friendly digits. Never hardcodes
 * decimals — the caller passes the token's actual decimals (registry includes
 * tokens with unusual decimals).
 */
export function formatAmount(
  value: bigint,
  decimals: number,
  opts: { maxFractionDigits?: number } = {},
): string {
  const raw = formatUnits(value, decimals);
  const [whole, fraction = ""] = raw.split(".");
  const groupedWhole = Number(whole).toLocaleString("en-US");
  const maxFrac = opts.maxFractionDigits ?? Math.min(decimals, 6);
  if (maxFrac === 0 || fraction === "") return groupedWhole;
  const trimmed = fraction.slice(0, maxFrac).replace(/0+$/, "");
  return trimmed ? `${groupedWhole}.${trimmed}` : groupedWhole;
}

/** Compact label for big counts (e.g. registry size). */
export function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Lowercase-safe address comparison. */
export function sameAddress(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

/**
 * Turn an arbitrary thrown value into a short, human-readable line.
 * The raw error is surfaced separately in a collapsible (see DESIGN.md).
 */
export function humanizeError(err: unknown): string {
  const raw = rawError(err);
  const lower = raw.toLowerCase();

  if (lower.includes("user rejected") || lower.includes("user denied") || lower.includes("rejected the request"))
    return "You rejected the request in your wallet.";
  if (lower.includes("handle is not initialized"))
    return "This balance was never initialized — there's nothing to reveal yet.";
  if (lower.includes("is not authorized to user decrypt"))
    return "Your wallet isn't authorized to reveal this value.";
  if (lower.includes("insufficient funds"))
    return "Insufficient ETH to cover gas for this transaction.";
  if (lower.includes("chainid should be same as current chainid"))
    return "Make sure your wallet is on the same network you're viewing, then try again.";
  if (lower.includes("chain mismatch") || lower.includes("does not match the target chain"))
    return "Your wallet is on the wrong network. Switch networks and try again.";
  if (lower.includes("transfer amount exceeds balance") || lower.includes("erc20: insufficient"))
    return "You don't have enough of the underlying token.";
  if (lower.includes("nonce"))
    return "Transaction nonce error — reset your wallet's activity or try again.";
  if (lower.includes("relayer") || lower.includes("gateway"))
    return "The reveal service returned an error. Please retry in a moment.";
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "The request timed out. Check your connection and retry.";

  // Fall back to the contract revert reason if we can find one.
  const revert = raw.match(/reverted with reason string ['"]([^'"]+)['"]/i)?.[1];
  if (revert) return revert;
  return "Something went wrong. See details below.";
}

/** Best-effort extraction of a raw error string for the collapsible. */
export function rawError(err: unknown): string {
  if (err == null) return "Unknown error";
  if (typeof err === "string") return err;
  if (err instanceof Error) {
    // viem errors carry a rich `.message` with shortMessage + details.
    const anyErr = err as { shortMessage?: string; details?: string; message: string };
    return anyErr.details
      ? `${anyErr.shortMessage ?? anyErr.message}\n${anyErr.details}`
      : anyErr.shortMessage ?? anyErr.message;
  }
  try {
    return JSON.stringify(err, null, 2);
  } catch {
    return String(err);
  }
}
