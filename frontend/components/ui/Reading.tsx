import { cn } from "@/lib/cn";

/**
 * A public figure that has not been read from Zama's relayer yet: a soft,
 * blurred dash. Different on purpose from the asterisks used for secret
 * values, so a public prize never looks like a hidden one.
 */
export function Reading({ className, width = 3 }: { className?: string; width?: number }) {
  return (
    <span className={cn("reading", className)} title="Reading the public figure from Zama's relayer" aria-label="Reading">
      {"–".repeat(Math.max(1, width))}
    </span>
  );
}
