"use client";

import { useState } from "react";
import type { FlowState } from "@/lib/useActionFlow";
import { cn } from "@/lib/cn";

/** Idle → pending (live step) → success | error (+ raw details) */
export function FlowStatus({ state, className }: { state: FlowState; className?: string }) {
  const [open, setOpen] = useState(false);
  if (state.status === "idle") return null;
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl border px-3 py-2 text-sm",
        state.status === "pending" && "border-accent/30 bg-accent-faint text-ink",
        state.status === "success" && "border-ok/30 bg-ok/10 text-ink",
        state.status === "error" && "border-danger/30 bg-danger/10 text-ink",
        className,
      )}
    >
      {state.status === "pending" && (
        <span className="flex items-center gap-2">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulseRing rounded-full bg-accent" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent" />
          </span>
          {state.step}
        </span>
      )}
      {state.status === "success" && <span>✓ {state.message}</span>}
      {state.status === "error" && (
        <div>
          <div>⚠ {state.message}</div>
          {state.raw && (
            <button className="mt-1 text-xs text-ink-muted underline" onClick={() => setOpen((o) => !o)}>
              {open ? "Hide details" : "Show details"}
            </button>
          )}
          {open && <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all text-xs text-ink-faint">{state.raw}</pre>}
        </div>
      )}
    </div>
  );
}
