"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePoolState, useUserState, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { CipherSphere } from "@/components/fx/CipherSphere";
import { DecryptText } from "@/components/fx/DecryptText";
import { RadialCountdown } from "@/components/ui/RadialCountdown";
import { TierOrbits } from "@/components/pool/TierOrbits";
import { Annotation } from "@/components/fx/Annotation";
import { PositionTile, DrawTile } from "@/components/pool/HeroTiles";
import { formatAmount } from "@/lib/format";
import { DECIMALS, SYMBOL } from "@/lib/contracts";

export function Hero() {
  const { state } = usePoolState();
  const { user } = useUserState(state?.epoch);
  const { reveal, retry, values, errors } = usePublicReveal();
  const h = state?.prizeReserveHandle;
  useEffect(() => { if (h) void reveal([h]); }, [h, reveal]);
  useEffect(() => {
    if (!h || !errors[h]) return;
    const id = setTimeout(() => retry(h), 12_000);
    return () => clearTimeout(id);
  }, [h, errors, retry]);
  const prizeRaw = h ? values[h] : undefined;
  const prize = useCountUp(prizeRaw);
  const drawing = !!state && state.phase !== Phase.Open;
  const savers = Number(state?.participantCount ?? 0n);

  return (
    <section className="relative" aria-label="Cipher Pool">
      {/* headline block — quiet, left, no badge */}
      <div className="max-w-4xl pt-10 md:pt-16">
        <h1 className="hero-title max-w-[17ch]" style={{ textWrap: "balance" }}>
          <DecryptText text="The no-loss prize pool where nobody can see what you hold." duration={1400} />
        </h1>
        <p className="mt-6 max-w-3xl text-lg leading-relaxed text-ink-muted sm:text-xl">
          Deposit, keep every cent of your principal, and win the pool&apos;s yield through tiered draws. Your balance, your odds and
          your winnings are ciphertext on-chain — even to the contract — and the draw is verifiable by anyone.
          <span className="ml-3 inline-flex items-center gap-2 align-middle">
            <span className="cipher-mask inline-block h-5 w-16" />
            <span className="hand text-base">← encrypted</span>
          </span>
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <a href="#position" className="btn-primary shine px-6 py-3 text-[15px]">Deposit privately</a>
          <Link href="/how-it-works" className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline">How the blind draw works →</Link>
        </div>
      </div>

      {/* preview row — the product, annotated */}
      <div className="mt-16 grid gap-6 md:grid-cols-[1.05fr_0.9fr_0.9fr] md:gap-5">
        <div className="relative">
          <Annotation text="Encrypted pool" className="absolute -top-14 left-1/2 -translate-x-1/2 text-accent" tilt={-5} />
          <div className="tile relative aspect-[1.05] overflow-hidden md:aspect-auto md:h-full md:min-h-[380px]">
            <CipherSphere className="absolute inset-0 h-full w-full" points={120 + savers * 24} orbs={state?.winnerSlots ?? 5} drawing={drawing} you={!!user?.poolBalance} />
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-[11px] text-ink-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-cipher" /> {savers} saver{savers === 1 ? "" : "s"} · every point a ciphertext
            </div>
          </div>
        </div>
        <div className="relative">
          <Annotation text="Your position" className="absolute -top-14 left-1/2 -translate-x-1/2 text-accent" tilt={4} />
          <PositionTile />
        </div>
        <div className="relative">
          <Annotation text="Blind draw" className="absolute -top-14 left-1/2 -translate-x-1/2 text-accent" tilt={-3} />
          <DrawTile />
        </div>
      </div>

      {/* stat rail — unchanged */}
      <div className="glass mt-8 grid grid-cols-1 gap-6 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-[1.6fr_auto_auto_auto] lg:items-center lg:gap-10 [&>*]:min-w-0">
        <div className="sm:col-span-2 lg:col-span-1">
          <div className="label">Prize up for grabs · public</div>
          <div className="mt-2 flex items-baseline gap-3">
            {prize !== undefined ? (
              <DecryptText text={formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })} className="display prize-glow text-5xl tabular sm:text-6xl" duration={700} />
            ) : (
              <span className="cipher-mask inline-block h-12 w-44 sm:h-14 sm:w-56" aria-label="Loading prize" />
            )}
            <span className="font-mono text-lg text-ink-muted">{SYMBOL}</span>
          </div>
          <div className="mt-2 text-xs text-ink-faint">
            Split across {state?.winnerSlots ?? 5} winners every {state ? human(Number(state.drawPeriod)) : "…"} · {state ? `${(Number(state.apyBps) / 100).toFixed(2)}% APY` : "…"} simulated yield
            {h && errors[h] && prize === undefined && " · relayer catching up, retrying…"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {state ? <RadialCountdown start={Number(state.epochStart)} end={Number(state.nextDrawAt)} drawing={drawing} /> : <div className="h-[132px] w-[132px]" />}
        </div>
        <div>
          <div className="label">Savers</div>
          <div className="display mt-1 text-4xl tabular">{state ? savers : "…"}</div>
          <div className="mt-1 text-xs text-ink-faint">Draw #{state ? (state.epoch + 1n).toString() : "…"} · positions encrypted</div>
        </div>
        <div className="flex items-center gap-4">
          {state && <TierOrbits tiers={state.tiers} size={104} />}
          <div>
            <div className="label">Tiers</div>
            <ul className="mt-1 space-y-0.5 font-mono text-xs text-ink-muted">
              {state?.tiers.map((t, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: ["#FFD600", "#8B9CFF", "#5EEAD4", "#F472B6"][i % 4] }} />
                  {t.winners} × {(t.shareBps / 100 / t.winners).toFixed(0)}%
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function human(s: number) {
  if (s % 86400 === 0) return `${s / 86400} day${s / 86400 > 1 ? "s" : ""}`;
  if (s % 3600 === 0) return `${s / 3600} hour${s / 3600 > 1 ? "s" : ""}`;
  if (s % 60 === 0) return `${s / 60} minutes`;
  return `${s}s`;
}
