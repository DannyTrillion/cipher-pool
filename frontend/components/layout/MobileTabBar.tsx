"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { usePoolState, Phase } from "@/lib/hooks/usePoolData";
import { useNow } from "@/components/ui/Countdown";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sound";

const TABS = [
  { href: "/", label: "Pool", icon: (a: boolean) => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2} strokeLinecap="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" fill={a ? "currentColor" : "none"} /></svg> },
  { href: "/draws", label: "Prizes", icon: (a: boolean) => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2} strokeLinecap="round"><path d="M8 21h8M12 17v4M5 4h14v4a7 7 0 0 1-14 0z" /><path d="M5 6H3v2a3 3 0 0 0 3 3M19 6h2v2a3 3 0 0 1-3 3" /></svg> },
  { href: "/wallet", label: "Wallet", icon: (a: boolean) => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2} strokeLinecap="round"><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M16 12h.01M3 10h18" /></svg> },
  { href: "/how-it-works", label: "Help", icon: (a: boolean) => <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></svg> },
];

/** Phone-only bottom navigation. Sits above the safe area; the Pool tab carries the live draw dot. */
export function MobileTabBar() {
  const path = usePathname();
  const { state } = usePoolState();
  const now = useNow();
  const live = !!state && state.phase !== Phase.Open;
  const ready = !!state && state.phase === Phase.Open && Number(state.nextDrawAt) <= now && Number(state.participantCount) > 0;
  return (
    <nav className="mobile-tabbar fixed inset-x-0 bottom-0 z-40 md:hidden" aria-label="Primary">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const active = path === t.href;
          return (
            <Link key={t.href} href={t.href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition", active ? "text-accent" : "text-ink-muted")} onClick={() => sfx.click()} aria-current={active ? "page" : undefined}>
              {active && <motion.span layoutId="tab-glow" className="absolute -top-px h-[2px] w-8 rounded-full bg-accent" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span className="relative">
                {t.icon(active)}
                {t.href === "/" && (live || ready) && <span className={cn("absolute -right-1.5 -top-1 h-2 w-2 rounded-full ring-2 ring-[rgb(var(--base))]", live ? "bg-mint animate-pulse" : "bg-accent")} />}
              </span>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
