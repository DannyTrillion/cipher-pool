"use client";

import { useCallback, useState } from "react";
import { humanizeError, rawError } from "@/lib/format";

export type FlowStatus = "idle" | "pending" | "success" | "error";

export interface FlowState {
  status: FlowStatus;
  /** Plain-words description of what's happening right now (pending). */
  step: string | null;
  /** Human-readable success or error headline. */
  message: string | null;
  /** Raw error text for the collapsible. */
  raw: string | null;
}

const IDLE: FlowState = { status: "idle", step: null, message: null, raw: null };

/**
 * Drives the four explicit visual states required by DESIGN.md:
 * idle → pending (with live step text) → success | error (+ raw details).
 *
 * `run` receives a `setStep` callback so a flow can narrate its stages in
 * plain words ("Waiting for signature…" → "Encrypting input…" → "Confirming…").
 */
export function useActionFlow() {
  const [state, setState] = useState<FlowState>(IDLE);

  const reset = useCallback(() => setState(IDLE), []);

  const run = useCallback(
    async <T,>(
      fn: (setStep: (s: string) => void) => Promise<T>,
      opts?: { successMessage?: string },
    ): Promise<T | undefined> => {
      setState({ status: "pending", step: "Starting…", message: null, raw: null });
      const setStep = (s: string) =>
        setState((prev) => (prev.status === "pending" ? { ...prev, step: s } : prev));
      try {
        const result = await fn(setStep);
        setState({
          status: "success",
          step: null,
          message: opts?.successMessage ?? "Done",
          raw: null,
        });
        return result;
      } catch (err) {
        // Full error + stack to the console for diagnosis (the UI shows a
        // humanized message + the raw string in a collapsible).
        console.error("[action-flow] failed:", err);
        setState({
          status: "error",
          step: null,
          message: humanizeError(err),
          raw: rawError(err),
        });
        return undefined;
      }
    },
    [],
  );

  return { state, run, reset, setState };
}
