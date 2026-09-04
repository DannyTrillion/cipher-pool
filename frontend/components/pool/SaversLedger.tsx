"use client";

import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { usePoolState, useSaversLedger } from "@/lib/hooks/usePoolData";
import { truncateAddress, sameAddress } from "@/lib/format";
import { etherscanAddr } from "@/lib/contracts";

/** Turns a ciphertext handle into a deterministic bar pattern — readable by nobody, fetchable by anyone. */
function Cipherbar({ handle }: { handle?: string }) {
  const hex = (handle ?? "").replace(/^0x/, "").slice(0, 48) || "0".repeat(48);
  return (
    <div className="flex h-5 items-end gap-[2px]" aria-label="Encrypted balance">
      {Array.from({ length: 24 }, (_, i) => {
        const v = parseInt(hex.slice(i * 2, i * 2 + 2) || "0", 16);
        const h = 4 + (v / 255) * 16;
        const c = v % 3 === 0 ? "bg-cipher" : v % 3 === 1 ? "bg-cipher/60" : "bg-[#5EEAD4]/70";
        return <span key={i} className={`w-[3px] rounded-sm ${c}`} style={{ height: h }} />;
      })}
    </div>
  );
}

export function SaversLedger() {
  const { address } = useAccount();
  const { state } = usePoolState();
  const { rows, total } = useSaversLedger(state?.participantCount);
  if (!state || total === 0) return null;
  return (
    <section className="card p-6 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="display text-2xl sm:text-3xl">Everyone is listed. Nothing is readable.</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            These are the live positions on Sepolia right now. Each pattern is drawn from the actual ciphertext handle a saver&apos;s balance is stored as —
            public, fetchable by anyone, decryptable by nobody but its owner. Not even the contract can read them.
          </p>
        </div>
        <span className="pill">{total} saver{total === 1 ? "" : "s"}</span>
      </div>
      <ul className="mt-5 divide-y divide-line">
        {rows.map((r, i) => {
          const you = sameAddress(r.address, address);
          return (
            <motion.li
              key={r.address}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <a href={etherscanAddr(r.address)} target="_blank" rel="noreferrer" className={`font-mono text-sm ${you ? "text-accent" : "text-ink-muted hover:text-ink"}`}>
                {truncateAddress(r.address)} {you && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-black">you</span>}
              </a>
              <div className="flex items-center gap-3">
                <Cipherbar handle={r.handle} />
                <span className="font-mono text-[11px] uppercase tracking-wider text-ink-faint">encrypted</span>
              </div>
            </motion.li>
          );
        })}
        {total > rows.length && <li className="py-2 text-xs text-ink-faint">+ {total - rows.length} more</li>}
      </ul>
    </section>
  );
}
