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
  // Cipher Pool custom errors (viem surfaces the error name in the message).
  if (lower.includes("poolnotopen")) return "A draw is in progress — deposits and withdrawals resume as soon as it completes.";
  if (lower.includes("drawnotdue")) return "The draw isn't due yet. Wait for the countdown to reach zero.";
  if (lower.includes("noparticipants")) return "Nobody has deposited yet, so there is nothing to draw.";
  if (lower.includes("drawnotinprogress")) return "There is no draw in progress right now.";
  if (lower.includes("nothingdeposited")) return "You haven't deposited into the pool yet.";
  if (lower.includes("nothingtoreveal")) return "You weren't part of that draw, so there is nothing to publish.";
  if (lower.includes("faucetcooldown")) return "The faucet is on cooldown for this address — try again in a while.";
  if (lower.includes("invalidtiers")) return "That tier configuration is invalid (shares over 100%, too many winners, or an empty tier).";
  if (lower.includes("erc7984unauthorizedspender")) return "The pool isn't approved to move your cUSD yet. Approve it and retry.";
  if (lower.includes("erc7984zerobalance")) return "That account holds no cUSD yet — use the faucet first.";
  if (lower.includes("ownableunauthorizedaccount")) return "Only the pool owner can do that.";
  if (lower.includes("connector not found") || lower.includes("no injected provider") || lower.includes("provider not found"))
    return "No wallet detected. Install MetaMask (or another EIP-1193 wallet) and reload.";
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
