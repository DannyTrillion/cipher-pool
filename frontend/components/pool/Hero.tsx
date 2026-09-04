"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePoolState, Phase } from "@/lib/hooks/usePoolData";
import { usePublicReveal } from "@/lib/hooks/useReveal";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { CipherSphere } from "@/components/fx/CipherSphere";
import { DecryptText } from "@/components/fx/DecryptText";
import { RadialCountdown } from "@/components/ui/RadialCountdown";
import { TierOrbits } from "@/components/pool/TierOrbits";
import { formatAmount } from "@/lib/format";
import { DECIMALS, SYMBOL } from "@/lib/contracts";

export function Hero() {
  const { state } = usePoolState();
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
    <section className="hero-bleed relative isolate overflow-hidden" aria-label="Cipher Pool">
      {/* working background: the live ciphertext sphere */}
      <div className="pointer-events-none absolute inset-y-0 right-0 -z-10 w-full md:w-[62%]">
        <CipherSphere className="h-full w-full" points={120 + savers * 24} orbs={state?.winnerSlots ?? 5} drawing={drawing} />
        <div className="absolute inset-y-0 left-0 hidden w-72 bg-gradient-to-r from-[rgb(var(--base))] via-[rgb(var(--base)/0.7)] to-transparent md:block" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[rgb(var(--base))] to-transparent" />
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-16 sm:px-6 md:pt-24">
        <div className="max-w-2xl">
          <div className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_rgb(255_214_0/0.9)]" />
            Confidential prize savings · Zama FHEVM · Sepolia
          </div>
          <h1 className="display mt-5 text-[2.75rem] leading-[0.95] sm:text-6xl md:text-7xl">
            <DecryptText text="Save privately." duration={1100} />
            <br />
            <DecryptText text="Win verifiably." duration={1100} delay={250} className="text-accent" />
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-muted sm:text-lg">
            A no-loss prize pool where your deposit, your balance and your winnings are ciphertext — even to the contract.
            Yield funds tiered prizes. Winners are picked over encrypted balances. You keep your principal.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#position" className="btn-primary shine px-6 py-3 text-[15px]">Deposit privately</a>
            <Link href="/how-it-works" className="btn-glass px-6 py-3 text-[15px]">How the blind draw works</Link>
          </div>
        </div>

        {/* stat rail */}
        <div className="glass mt-14 grid grid-cols-2 gap-6 p-5 sm:p-6 lg:grid-cols-[1.6fr_auto_auto_auto] lg:items-center lg:gap-10">
          <div className="col-span-2 lg:col-span-1">
            <div className="label">Prize up for grabs · public</div>
            <div className="mt-2 flex items-baseline gap-3">
              {prize !== undefined ? (
                <DecryptText
                  text={formatAmount(prize, DECIMALS, { maxFractionDigits: 2 })}
                  className="display prize-glow text-5xl tabular sm:text-6xl"
                  duration={700}
                />
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
