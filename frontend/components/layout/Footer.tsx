"use client";

import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { deployment, etherscanAddr } from "@/lib/contracts";
import { truncateAddress } from "@/lib/format";

const GITHUB = process.env.NEXT_PUBLIC_GITHUB_URL;

function AddressRow({ label, address }: { label: string; address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-ink-muted">{label}</span>
      <span className="flex items-center gap-2 font-mono text-xs">
        <a className="text-ink-muted hover:text-ink" href={etherscanAddr(address)} target="_blank" rel="noreferrer">{truncateAddress(address, 8, 6)}</a>
        <button
          className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-faint hover:text-ink"
          onClick={async () => { await navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          aria-label={`Copy ${label} address`}
        >
          {copied ? "copied" : "copy"}
        </button>
      </span>
    </li>
  );
}

export function Footer() {
  const c = deployment.contracts;
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_0.8fr_1.2fr]">
        <div>
          <Logo size={30} />
          <p className="mt-3 max-w-xs text-sm text-ink-muted">A no-loss prize pool where nobody can see what you hold. Deposit, keep your principal, win the yield — all encrypted with Zama&apos;s FHEVM.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-xs text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Built on Zama FHEVM · Developer Program Season 4
          </div>
        </div>
        <div>
          <div className="label">Explore</div>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link className="text-ink-muted hover:text-ink" href="/">Pool</Link></li>
            <li><Link className="text-ink-muted hover:text-ink" href="/draws">Draws</Link></li>
            <li><Link className="text-ink-muted hover:text-ink" href="/how-it-works">How it works</Link></li>
            {GITHUB && <li><a className="text-ink-muted hover:text-ink" href={GITHUB} target="_blank" rel="noreferrer">Source on GitHub ↗</a></li>}
            <li><a className="text-ink-muted hover:text-ink" href="https://docs.zama.org/protocol" target="_blank" rel="noreferrer">Zama Protocol docs ↗</a></li>
          </ul>
        </div>
        <div>
          <div className="label">Contracts · Sepolia</div>
          <ul className="mt-3 divide-y divide-line text-sm">
            <AddressRow label="Prize pool" address={c.ConfidentialPrizePool.address} />
            <AddressRow label="cUSD (ERC-7984)" address={c.ConfidentialUSD.address} />
            <AddressRow label="Yield source (mock)" address={c.MockYieldSource.address} />
          </ul>
          <p className="mt-3 text-xs text-ink-faint">Testnet only. Tokens have no value. Prizes are paid in test cUSD.</p>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>Deposits, balances, odds and winnings are ciphertext on-chain. Prizes and draw seeds are public so anyone can verify a draw.</span>
          <span>MIT licensed</span>
        </div>
      </div>
    </footer>
  );
}
