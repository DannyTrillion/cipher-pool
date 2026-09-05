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
const pubSubs = new Set<() => void>();
const notify = () => pubSubs.forEach((f) => f());

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
    // Never auto-retry a handle that already failed (the relayer may still be
    // processing it); callers use `retry` on a timer or a user action instead.
    const want = handles.filter((h): h is string => !!h && !(h in pubCache) && !pubPending[h] && !(h in pubErrors));
    if (want.length === 0) return;
    want.forEach((h) => { pubPending[h] = true; });
    notify();
    try {
      const res = await publicDecrypt(want);
      Object.assign(pubCache, res);
      want.forEach((h) => { delete pubErrors[h]; });
    } catch (e) {
      const msg = humanizeError(e);
      want.forEach((h) => { pubErrors[h] = msg; });
    } finally {
      want.forEach((h) => { delete pubPending[h]; });
      notify();
    }
  }, []);

  /** Clear a failed handle so the next `reveal` tries it again. */
  const retry = useCallback((handle: string) => {
    delete pubErrors[handle];
    notify();
  }, []);

  return { reveal, retry, ...snap };
}
