"use client";

import Link from "next/link";
import { openExplainer } from "@/components/guide/Explainer";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { CipherSphere } from "@/components/fx/CipherSphere";
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
      <div className="mx-auto max-w-3xl pt-2 text-center sm:pt-8 md:pt-16">
        <h1 className="display text-[2rem] leading-[1.02] xs:text-[2.25rem] sm:text-5xl md:text-[3.5rem]">
          Save privately.
          <br />
          <span className="text-accent">Win</span> verifiably.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted sm:mt-6 sm:text-lg">
          Put money into a shared pool and keep all of it. Every 10 minutes the pool&apos;s interest goes to a few winners. Nobody can see how much you saved, not even the pool. Anyone can check that a draw was fair.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:mt-8">
          <a href="#play" className="btn-primary btn-lg btn-arrow shine min-w-[150px]">Play</a>
          <a href="#deposit" className="btn-glass btn-lg min-w-[150px]">Deposit</a>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
          <button className="text-accent underline-offset-4 hover:underline" onClick={openExplainer}>New here? What is this, in 60 seconds</button>
          <Link href="/how-it-works" className="text-ink-faint underline-offset-4 hover:text-ink hover:underline">How it works</Link>
        </div>
      </div>

      {/* preview row — the world on the left, one fused game card on the right */}
      <div className="mt-16 grid gap-16 sm:mt-24 md:mt-32 md:grid-cols-[0.95fr_1.05fr] md:gap-12 lg:gap-16">
        <div className="relative">
          <Annotation text="Everyone's money, scrambled" className="absolute -top-11 left-1/2 z-10 w-max -translate-x-1/2 text-accent md:-top-14" tilt={-5} />
          {/* borderless: the sphere may spill outward (left and vertically), never into the card */}
          <div className="relative mx-auto aspect-square w-[86%] max-w-[360px] md:absolute md:-left-24 md:right-0 md:-inset-y-8 md:aspect-auto md:w-auto md:max-w-none">
            <CipherSphere className="absolute inset-0 h-full w-full" points={120 + savers * 24} orbs={state?.winnerSlots ?? 5} drawing={drawing} you={!!user?.poolBalance} />
          </div>
          <div className="hidden md:block md:min-h-[380px]" />
        </div>
        <div className="relative">
          <Annotation text="Your account" className="absolute -top-11 left-1/2 z-10 w-max -translate-x-1/2 text-accent md:-top-14" tilt={4} />
          <GameCard />
        </div>
      </div>

    </section>
  );
}

