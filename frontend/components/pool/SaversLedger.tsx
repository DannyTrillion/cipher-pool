"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { usePoolState, useSaversLedger, useUserState } from "@/lib/hooks/usePoolData";
import { useReveal } from "@/lib/hooks/useReveal";
import { publicDecrypt } from "@/lib/fhevm/instance";
import { truncateAddress, sameAddress, formatAmount } from "@/lib/format";
import { etherscanAddr, POOL, DECIMALS, SYMBOL } from "@/lib/contracts";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";

/** Deterministic bar pattern from a ciphertext handle — fetchable by anyone, readable by nobody. */
function Cipherbar({ handle, hot }: { handle?: string; hot?: boolean }) {
  const hex = (handle ?? "").replace(/^0x/, "").slice(0, 48) || "0".repeat(48);
  return (
    <div className="flex h-5 items-end gap-[2px]" aria-label="Encrypted balance">
      {Array.from({ length: 24 }, (_, i) => {
        const v = parseInt(hex.slice(i * 2, i * 2 + 2) || "0", 16);
        const h = 4 + (v / 255) * 16;
        const c = v % 3 === 0 ? "bg-cipher" : v % 3 === 1 ? "bg-cipher/60" : "bg-mint/70";
        return <motion.span key={i} className={cn("w-[3px] rounded-sm", hot ? "bg-accent" : c)} initial={false} animate={{ height: h }} transition={{ type: "spring", stiffness: 260, damping: 20, delay: i * 0.01 }} />;
      })}
    </div>
  );
}

export function SaversLedger() {
  const { address, isConnected } = useAccount();
  const { state } = usePoolState();
  const { user } = useUserState(state?.epoch);
  const { rows, total } = useSaversLedger(state?.participantCount);
  const { reveal, get, busy } = useReveal();
  const [open, setOpen] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<{ status: "idle" | "trying" | "refused"; message?: string }>({ status: "idle" });
  const prev = useRef<Record<string, string | undefined>>({});
  const [hot, setHot] = useState<Record<string, number>>({});

  // detect handle changes → brief highlight ("changed just now")
  useEffect(() => {
    const now = Date.now();
    const next: Record<string, number> = {};
    for (const r of rows) {
      const before = prev.current[r.address];
      if (before && r.handle && before !== r.handle) next[r.address] = now;
      prev.current[r.address] = r.handle;
    }
    if (Object.keys(next).length) setHot((h) => ({ ...h, ...next }));
  }, [rows]);
  useEffect(() => {
    const id = setInterval(() => setHot((h) => Object.fromEntries(Object.entries(h).filter(([, t]) => Date.now() - t < 20_000))), 2000);
    return () => clearInterval(id);
  }, []);

  const tryRead = async (handle?: string) => {
    if (!handle) return;
    sfx.click();
    setAttempt({ status: "trying" });
    try {
      await publicDecrypt([handle]);
      setAttempt({ status: "refused", message: "Nothing readable came back." });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setAttempt({ status: "refused", message: raw.toLowerCase().includes("not allowed") || raw.toLowerCase().includes("not authorized") ? "Only the saver's wallet has the key." : `Refused: ${raw.slice(0, 120)}` });
      sfx.lock();
    }
  };

  if (!state || total === 0) return null;
  const myHandle = user?.poolBalance ?? null;
  const mine = get(myHandle);

  return (
    <section className="card defer-render p-6 sm:p-7">
      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-end">
        <div>
          <h2 className="display text-2xl sm:text-3xl">Everyone is listed. Nothing is readable.</h2>
          <p className="mt-2 max-w-xl text-sm text-ink-muted">
            These are the real accounts in the pool right now. Each pattern is drawn from the scrambled balance stored on the blockchain. Anyone can fetch it. Only its owner can read it, not even the pool.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-black/25 px-4 py-3">
          <div className="label">Total saved in the pool</div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="cipher-mask inline-block h-9 w-40 sm:h-10 sm:w-52" aria-label="Encrypted total" />
            <span className="font-mono text-sm text-ink-muted">{SYMBOL}</span>
          </div>
          <div className="mt-1.5 text-xs text-ink-faint">Even the total is secret. Prizes are public. Savings are not.</div>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-line">
        {rows.map((r, i) => {
          const you = sameAddress(r.address, address);
          const isHot = !!hot[r.address];
          const isOpen = open === r.address;
          return (
            <li key={r.address}>
              <motion.button
                initial={{ opacity: 0, x: -6 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.03 }}
                className={cn("flex w-full items-center justify-between gap-4 py-2.5 text-left transition hover:bg-white/[0.03]", isOpen && "bg-white/[0.03]")}
                onClick={() => { setOpen(isOpen ? null : r.address); setAttempt({ status: "idle" }); sfx.click(); }}
                aria-expanded={isOpen}
              >
                <span className={cn("flex items-center gap-2 font-mono text-sm", you ? "text-accent" : "text-ink-muted")}>
                  {truncateAddress(r.address)}
                  {you && <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-black">you</span>}
                  {isHot && <span className="rounded-full border border-accent/40 px-1.5 py-0.5 text-[10px] text-accent">changed just now</span>}
                </span>
                <span className="flex items-center gap-3">
                  {you && mine !== undefined ? (
                    <span className="font-mono text-sm text-accent">{formatAmount(mine, DECIMALS)} {SYMBOL}</span>
                  ) : (
                    <Cipherbar handle={r.handle} hot={isHot} />
                  )}
                  <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">{you && mine !== undefined ? "shown" : "hidden"}</span>
                </span>
              </motion.button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="mb-3 rounded-xl border border-line bg-black/25 p-4">
                      <div className="label">The scrambled balance, as stored</div>
                      <div className="mt-1 break-all font-mono text-xs text-ink-muted">{r.handle ?? "—"}</div>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {you && isConnected ? (
                          <button className="btn-primary btn-sm" disabled={!!busy} onClick={() => reveal(POOL.address, myHandle, "ledger-me")}>{busy ? "Loading…" : mine !== undefined ? "Shown. Only you could do that." : "Show mine"}</button>
                        ) : (
                          <button className="btn-secondary btn-sm" disabled={attempt.status === "trying"} onClick={() => tryRead(r.handle)}>{attempt.status === "trying" ? "Trying…" : "Try to read it"}</button>
                        )}
                        <a className="text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline" href={etherscanAddr(r.address)} target="_blank" rel="noreferrer">Saver on Etherscan ↗</a>
                      </div>
                      <AnimatePresence>
                        {attempt.status === "refused" && (
                          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm">
                            <span>🔒</span>
                            <span><span className="font-semibold">Refused.</span> {attempt.message} This was a real request to the network.</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
        {total > rows.length && <li className="py-2 text-xs text-ink-faint">+ {total - rows.length} more</li>}
      </ul>
    </section>
  );
}
