"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/format";
import { clearDecryptSessions } from "@/lib/fhevm/useDecryptSession";
import { Logo } from "@/components/brand/Logo";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { useEffect, useState } from "react";

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

  // Detect an injected provider after mount (SSR has no window).
  const [hasInjected, setHasInjected] = useState(true);
  useEffect(() => {
    setHasInjected(typeof window !== "undefined" && !!(window as unknown as { ethereum?: unknown }).ethereum);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line/60 bg-canvas/40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="Cipher Pool home">
            <Logo size={34} />
            <span className="pill hidden md:inline-flex">Sepolia</span>
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
          <SoundToggle />
          {wrongChain && (
            <button className="btn-secondary border-warn/40 text-warn" onClick={() => switchChain({ chainId: sepolia.id })}>
              Switch to Sepolia
            </button>
          )}
          {isConnected ? (
            <button className="btn-secondary font-mono" onClick={() => disconnect()} title="Disconnect" data-anchor="wallet">
              <span className="inline-block h-2 w-2 rounded-full bg-accent shadow-[0_0_10px_rgb(255_214_0/0.9)]" />
              {truncateAddress(address)}
            </button>
          ) : connectors.length === 0 || !hasInjected ? (
            <a className="btn-primary whitespace-nowrap px-3 text-[13px] sm:px-4 sm:text-sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer" title="No wallet detected">
              <span className="sm:hidden">Get a wallet</span><span className="hidden sm:inline">Install a wallet</span>
            </a>
          ) : (
            <button
              className="btn-primary whitespace-nowrap px-3 text-[13px] sm:px-4 sm:text-sm"
              disabled={isPending}
              onClick={() => connect({ connector: connectors[0] })}
            >
              {isPending ? "Connecting…" : <><span className="sm:hidden">Connect</span><span className="hidden sm:inline">Connect wallet</span></>}
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
