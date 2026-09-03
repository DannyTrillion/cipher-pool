import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Stat({ label, children, hint, className }: { label: string; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="label">{label}</div>
      <div className="text-ink">{children}</div>
      {hint && <div className="text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}
