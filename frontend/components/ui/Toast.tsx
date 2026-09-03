"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Kind = "info" | "success" | "error";
interface Toast {
  id: number;
  kind: Kind;
  title: string;
  body?: string;
  href?: string;
}

interface Ctx {
  push: (t: Omit<Toast, "id">) => void;
}

const ToastCtx = createContext<Ctx>({ push: () => {} });
let seq = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = seq++;
      setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
      setTimeout(() => dismiss(id), t.kind === "error" ? 9000 : 5500);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ push }), [push]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto card animate-floatIn border-l-4 p-3 text-sm",
              t.kind === "success" && "border-l-ok",
              t.kind === "error" && "border-l-danger",
              t.kind === "info" && "border-l-accent",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{t.title}</div>
                {t.body && <div className="mt-0.5 break-words text-ink-muted">{t.body}</div>}
                {t.href && (
                  <a className="mt-1 inline-block text-xs text-cipher underline" href={t.href} target="_blank" rel="noreferrer">
                    View on Etherscan
                  </a>
                )}
              </div>
              <button aria-label="Dismiss" className="text-ink-faint hover:text-ink" onClick={() => dismiss(t.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
