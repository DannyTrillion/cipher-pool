"use client";

import Link from "next/link";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { CipherSphere } from "@/components/fx/CipherSphere";
import { StatConsole } from "@/components/pool/StatConsole";
import { Annotation } from "@/components/fx/Annotation";
import { GameCard } from "@/components/pool/HeroTiles";

export function Hero() {
  const { state } = usePoolState();
  const { user } = useUserState(state?.epoch);
  const drawing = !!state && state.phase !== Phase.Open;
  const savers = Number(state?.participantCount ?? 0n);

  return (
    <section className="relative" aria-label="Cipher Pool">
      {/* headline block — centred, Syne, yellow "Win" */}
      <div className="mx-auto max-w-3xl pt-10 text-center md:pt-16">
        <h1 className="display text-[1.9rem] leading-[1.0] xs:text-[2.1rem] sm:text-5xl md:text-[3.5rem]">
          Save privately.
          <br />
          <span className="text-accent">Win</span> verifiably.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
          Shield a test ERC-20 into confidential cUSD, save it, keep every cent, and win the pool&apos;s yield through tiered draws. Your balance,
          your odds and your winnings are ciphertext on-chain — even to the contract — and every draw is verifiable by anyone.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a href="#play" className="btn-primary shine px-7 py-3 text-[15px]">Play</a>
          <a href="#deposit" className="btn-glass px-7 py-3 text-[15px]">Deposit</a>
        </div>
        <Link href="/how-it-works" className="mt-4 inline-block text-xs text-ink-faint underline-offset-4 hover:text-ink hover:underline">How the blind draw works →</Link>
      </div>

      {/* preview row — the world on the left, one fused game card on the right */}
      <div className="mt-24 grid gap-20 md:mt-32 md:grid-cols-[0.95fr_1.05fr] md:gap-12 lg:gap-16">
        <div className="relative">
          <Annotation text="Everyone's savings, encrypted" className="absolute -top-14 left-1/2 z-10 w-max -translate-x-1/2 text-accent" tilt={-5} />
          {/* borderless: the sphere may spill outward (left and vertically), never into the card */}
          <div className="relative aspect-square md:absolute md:-left-24 md:right-0 md:-inset-y-8 md:aspect-auto">
            <CipherSphere className="absolute inset-0 h-full w-full" points={120 + savers * 24} orbs={state?.winnerSlots ?? 5} drawing={drawing} you={!!user?.poolBalance} />
          </div>
          <div className="hidden md:block md:min-h-[380px]" />
        </div>
        <div className="relative">
          <Annotation text="Your corner of the pool" className="absolute -top-14 left-1/2 z-10 w-max -translate-x-1/2 text-accent" tilt={4} />
          <GameCard />
        </div>
      </div>

      <StatConsole />
    </section>
  );
}

