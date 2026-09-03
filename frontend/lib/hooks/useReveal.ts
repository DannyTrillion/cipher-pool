"use client";

import { useCallback, useState } from "react";
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

/** Public reveal for handles made publicly decryptable on-chain (prize, seed). */
export function usePublicReveal() {
  const [values, setValues] = useState<Record<string, bigint>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reveal = useCallback(async (handles: (string | null | undefined)[]) => {
    // Never auto-retry a handle that already failed (the relayer may still be
    // processing it); callers use `retry` on a timer or a user action instead.
    const want = handles.filter((h): h is string => !!h && !(h in values) && !pending[h] && !(h in errors));
    if (want.length === 0) return;
    setPending((p) => ({ ...p, ...Object.fromEntries(want.map((h) => [h, true])) }));
    try {
      const res = await publicDecrypt(want);
      setValues((v) => ({ ...v, ...res }));
      setErrors((e) => { const n = { ...e }; want.forEach((h) => delete n[h]); return n; });
    } catch (e) {
      setErrors((prev) => ({ ...prev, ...Object.fromEntries(want.map((h) => [h, humanizeError(e)])) }));
    } finally {
      setPending((p) => { const n = { ...p }; want.forEach((h) => delete n[h]); return n; });
    }
  }, [values, pending, errors]);

  /** Clear a failed handle so the next `reveal` tries it again. */
  const retry = useCallback((handle: string) => {
    setErrors((e) => { const n = { ...e }; delete n[handle]; return n; });
  }, []);

  return { reveal, retry, values, pending, errors };
}
