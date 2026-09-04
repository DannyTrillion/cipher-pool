"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/format";
import { clearDecryptSessions } from "@/lib/fhevm/useDecryptSession";
import { useEffect } from "react";

const NAV = [
  { href: "/", label: "Pool" },
  { href: "/draws", label: "Draws" },
  { href: "/how-it-works", label: "How it works" },
];

export function Header() {
  const path = usePathname();
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const wrongChain = isConnected && chainId !== sepolia.id;

  useEffect(() => {
    clearDecryptSessions();
  }, [address]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-black">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
                <circle cx="12" cy="12" r="8" />
                <rect x="9" y="11" width="6" height="5" rx="1.2" fill="currentColor" stroke="none" />
                <path d="M10 11V9.5a2 2 0 0 1 4 0V11" />
              </svg>
            </span>
            <span className="text-base font-semibold tracking-tight">Cipher Pool</span>
            <span className="pill hidden sm:inline-flex">Sepolia</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm transition",
                  path === n.href ? "bg-raised text-ink" : "text-ink-muted hover:text-ink",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {wrongChain && (
            <button className="btn-secondary border-warn/40 text-warn" onClick={() => switchChain({ chainId: sepolia.id })}>
              Switch to Sepolia
            </button>
          )}
          {isConnected ? (
            <button className="btn-secondary font-mono" onClick={() => disconnect()} title="Disconnect">
              {truncateAddress(address)}
            </button>
          ) : (
            <button
              className="btn-primary"
              disabled={isPending}
              onClick={() => connect({ connector: connectors[0] })}
            >
              {isPending ? "Connecting…" : "Connect wallet"}
            </button>
          )}
        </div>
      </div>
      <nav className="flex items-center gap-1 overflow-x-auto px-3 pb-2 md:hidden">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={cn("rounded-lg px-3 py-1.5 text-sm", path === n.href ? "bg-raised text-ink" : "text-ink-muted")}>
            {n.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
