"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDecryptSession } from "@/lib/fhevm/useDecryptSession";
import { publicDecrypt } from "@/lib/fhevm/instance";
import { POOL, TOKEN } from "@/lib/contracts";
import { useToast } from "@/components/ui/Toast";
import { humanizeError } from "@/lib/format";

/**
 * User-side reveal: decrypts handles the user is allowed to read (one EIP-712
 * signature per session covers both the pool and the token). Results are kept
 * per-handle so a re-render after polling doesn't hide a value already revealed.
 */
export function useReveal() {
  const { decryptHandle, hasSession } = useDecryptSession();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, bigint>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const reveal = useCallback(
    async (contract: `0x${string}`, handle: string | null, key: string) => {
      if (!handle) return null;
      setBusy(key);
      try {
        const v = await decryptHandle(contract, handle, [POOL.address, TOKEN.address]);
        if (v !== null) setValues((prev) => ({ ...prev, [handle]: v }));
        return v;
      } catch (e) {
        toast.push({ kind: "error", title: "Could not reveal", body: humanizeError(e) });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [decryptHandle, toast],
  );

  const get = useCallback((handle: string | null | undefined) => (handle ? values[handle] : undefined), [values]);
  return { reveal, get, busy, hasSession };
}

/**
 * Public reveal for handles made publicly decryptable on-chain (prize, seed).
 * One module-level cache serves every component, so the prize reads the same
 * everywhere and the relayer is asked once per handle, not once per card.
 */
const pubCache: Record<string, bigint> = {};
const pubPending: Record<string, boolean> = {};
const pubErrors: Record<string, string> = {};
const pubAttempts: Record<string, number> = {};
const pubSubs = new Set<() => void>();
const notify = () => pubSubs.forEach((f) => f());
const RETRY_MS = 8_000;
const MAX_ATTEMPTS = 6;

/** Ask the relayer for a batch; if the batch fails, fall back to one handle at a time so one bad handle never hides the rest. */
async function fetchPublic(handles: string[]) {
  handles.forEach((h) => { pubPending[h] = true; pubAttempts[h] = (pubAttempts[h] ?? 0) + 1; });
  notify();
  const failed: string[] = [];
  let msg = "";
  try {
    Object.assign(pubCache, await publicDecrypt(handles));
  } catch (e) {
    msg = humanizeError(e);
    if (handles.length > 1) {
      for (const h of handles) {
        try { Object.assign(pubCache, await publicDecrypt([h])); } catch (e2) { msg = humanizeError(e2); failed.push(h); }
      }
    } else failed.push(...handles);
  }
  handles.forEach((h) => { delete pubPending[h]; if (h in pubCache) delete pubErrors[h]; });
  failed.forEach((h) => { pubErrors[h] = msg; });
  notify();
  // The relayer can lag a fresh handle by a few seconds: keep trying quietly, then give up and leave it to `retry`.
  const again = failed.filter((h) => (pubAttempts[h] ?? 0) < MAX_ATTEMPTS);
  if (again.length) setTimeout(() => { again.forEach((h) => delete pubErrors[h]); void fetchPublic(again); }, RETRY_MS);
}

export function usePublicReveal() {
  const [version, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    pubSubs.add(f);
    return () => { pubSubs.delete(f); };
  }, []);
  // Fresh snapshots per change, stable between changes, so effects keyed on them behave.
  const snap = useMemo(() => ({ values: { ...pubCache }, pending: { ...pubPending }, errors: { ...pubErrors } }), [version]);

  const reveal = useCallback(async (handles: (string | null | undefined)[]) => {
    const want = handles.filter((h): h is string => !!h && !(h in pubCache) && !pubPending[h] && !(h in pubErrors));
    if (want.length === 0) return;
    await fetchPublic(want);
  }, []);

  /** Clear a failed handle so the next `reveal` tries it again. */
  const retry = useCallback((handle: string) => {
    delete pubErrors[handle];
    pubAttempts[handle] = 0;
    notify();
  }, []);

  return { reveal, retry, ...snap };
}
