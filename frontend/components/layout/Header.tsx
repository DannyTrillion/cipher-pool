"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { cn } from "@/lib/cn";
import { truncateAddress } from "@/lib/format";
import { clearDecryptSessions } from "@/lib/fhevm/useDecryptSession";
import { Logo } from "@/components/brand/Logo";
import { Identicon } from "@/components/layout/Identicon";
import { usePoolState, Phase } from "@/lib/hooks/usePoolData";
import { initSoundPref, setSound, sfx } from "@/lib/sound";
import { onScene } from "@/lib/scene";
import { etherscanAddr } from "@/lib/contracts";
import { useNow } from "@/components/ui/Countdown";

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
  const { state } = usePoolState();
  const now = useNow();
  const wrongChain = isConnected && chainId !== sepolia.id;
  const drawLive = !!state && state.phase !== Phase.Open;
  const drawReady = !!state && state.phase === Phase.Open && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;

  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [sound, setSoundOn] = useState(false);
  const [hasInjected, setHasInjected] = useState(true);
  const [pending, setPending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { clearDecryptSessions(); }, [address]);
  useEffect(() => {
    setHasInjected(!!(window as unknown as { ethereum?: unknown }).ethereum);
    setSoundOn(initSoundPref());
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    // pulse the chip while a chain action is in flight: fired by actions on send, cleared on any scene event
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = onScene(() => { setPending(false); if (t) clearTimeout(t); });
    return () => { off(); if (t) clearTimeout(t); };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menu]);
  useEffect(() => { setSheet(false); setMenu(false); }, [path]);

  const copy = async () => { if (address) { await navigator.clipboard.writeText(address); sfx.click(); } };

  const NavLinks = ({ vertical = false }: { vertical?: boolean }) => (
    <nav className={cn("flex", vertical ? "flex-col gap-1" : "items-center gap-1")} aria-label="Primary">
      {NAV.map((n) => {
        const active = path === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cn("relative rounded-lg px-3 py-2 text-[14px] transition", active ? "text-ink" : "text-ink-muted hover:text-ink", vertical && "text-lg py-3")}
          >
            <span className="relative">
              {n.label}
              {n.href === "/" && (drawLive || drawReady) && (
                <span className={cn("absolute -right-2.5 top-0 h-1.5 w-1.5 rounded-full", drawLive ? "bg-mint animate-pulse" : "bg-accent")} title={drawLive ? "Draw in progress" : "Draw ready"} />
              )}
            </span>
            {active && !vertical && (
              <motion.span layoutId="nav-underline" className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
            )}
          </Link>
        );
      })}
    </nav>
  );

  const WalletControl = () => {
    if (!isConnected) {
      return hasInjected && connectors.length > 0 ? (
        <button className="btn-primary whitespace-nowrap px-4 text-[13px] sm:text-sm" disabled={isPending} onClick={() => { sfx.click(); connect({ connector: connectors[0] }); }}>
          {isPending ? "Connecting…" : "Connect"}
        </button>
      ) : (
        <a className="btn-primary whitespace-nowrap px-4 text-[13px] sm:text-sm" href="https://metamask.io/download/" target="_blank" rel="noreferrer">Get a wallet</a>
      );
    }
    return (
      <div className="relative" ref={menuRef}>
        <button
          className={cn("btn-glass relative gap-2 py-1.5 pl-1.5 pr-3 font-mono text-[13px]", pending && "ring-2 ring-accent/50")}
          data-anchor="wallet"
          onClick={() => { sfx.click(); setMenu((m) => !m); }}
          aria-haspopup="menu"
          aria-expanded={menu}
        >
          <Identicon address={address!} size={22} />
          {truncateAddress(address)}
          {pending && <span className="absolute -inset-1 -z-10 animate-pulseRing rounded-full border border-accent/60" />}
        </button>
        <AnimatePresence>
          {menu && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.16 }}
              className="glass absolute right-0 mt-2 w-60 overflow-hidden p-1.5 text-sm"
            >
              <div className="px-2.5 py-2">
                <div className="label">Wallet</div>
                <div className="mt-1 flex items-center gap-2 font-mono text-xs">
                  <span className={cn("h-1.5 w-1.5 rounded-full", wrongChain ? "bg-warn" : "bg-ok")} />
                  {wrongChain ? "Wrong network" : "Sepolia"}
                </div>
              </div>
              {wrongChain && (
                <button className="menu-item text-warn" role="menuitem" onClick={() => switchChain({ chainId: sepolia.id })}>Switch to Sepolia</button>
              )}
              <button className="menu-item" role="menuitem" onClick={copy}>Copy address</button>
              <a className="menu-item" role="menuitem" href={etherscanAddr(address!)} target="_blank" rel="noreferrer">View on Etherscan ↗</a>
              <button className="menu-item flex items-center justify-between" role="menuitemcheckbox" aria-checked={sound} onClick={() => { const v = !sound; setSoundOn(v); setSound(v); if (v) sfx.click(); }}>
                <span>Sound</span>
                <span className={cn("relative h-4 w-7 rounded-full transition", sound ? "bg-accent" : "bg-white/15")}>
                  <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-black transition", sound ? "left-3.5" : "left-0.5")} />
                </span>
              </button>
              <div className="my-1 border-t border-line" />
              <button className="menu-item text-danger" role="menuitem" onClick={() => { setMenu(false); disconnect(); }}>Disconnect</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-40 transition-all duration-300",
          scrolled ? "border-b border-line/70 bg-canvas/55 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
        )}
      >
        <div className={cn("mx-auto grid w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 transition-all duration-300 sm:px-6", scrolled ? "h-14" : "h-16")}>
          <div className="flex items-center gap-3">
            <Link href="/" className="group flex items-center" aria-label="Cipher Pool home">
              <Logo size={scrolled ? 30 : 34} className="transition-all" />
            </Link>
            {isConnected && (
              <button
                className={cn("hidden items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[11px] md:inline-flex", wrongChain ? "text-warn hover:bg-warn/10" : "text-ink-faint")}
                onClick={() => wrongChain && switchChain({ chainId: sepolia.id })}
                title={wrongChain ? "Switch to Sepolia" : "Connected to Sepolia"}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", wrongChain ? "bg-warn animate-pulse" : "bg-ok")} />
                {wrongChain ? "wrong network" : "sepolia"}
              </button>
            )}
          </div>

          <div className="hidden md:block"><NavLinks /></div>
          <div className="md:hidden" />

          <div className="flex items-center justify-end gap-2">
            <WalletControl />
            <button className="btn-ghost h-9 w-9 !p-0 md:hidden" aria-label="Menu" aria-expanded={sheet} onClick={() => { sfx.click(); setSheet(true); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {sheet && (
          <motion.div className="fixed inset-0 z-50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSheet(false)} />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="glass absolute inset-y-0 right-0 flex w-[82%] max-w-sm flex-col rounded-none border-l p-5"
              role="dialog"
              aria-label="Menu"
            >
              <div className="flex items-center justify-between">
                <Logo size={30} />
                <button className="btn-ghost h-9 w-9 !p-0" aria-label="Close" onClick={() => setSheet(false)}>✕</button>
              </div>
              <div className="mt-8"><NavLinks vertical /></div>
              <div className="mt-auto space-y-3 border-t border-line pt-4 text-sm">
                {isConnected && (
                  <div className="flex items-center gap-2 font-mono text-xs text-ink-muted">
                    <span className={cn("h-1.5 w-1.5 rounded-full", wrongChain ? "bg-warn" : "bg-ok")} />
                    {wrongChain ? "Wrong network" : "Sepolia"} · {truncateAddress(address)}
                  </div>
                )}
                <button className="flex w-full items-center justify-between text-ink-muted" onClick={() => { const v = !sound; setSoundOn(v); setSound(v); if (v) sfx.click(); }}>
                  <span>Sound</span><span className="font-mono text-xs">{sound ? "on" : "off"}</span>
                </button>
                {isConnected && <button className="text-danger" onClick={() => { setSheet(false); disconnect(); }}>Disconnect</button>}
              </div>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
