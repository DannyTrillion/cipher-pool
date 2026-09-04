"use client";

import Link from "next/link";
import { CipherMachine } from "@/components/fx/CipherMachine";

/** Full-bleed illustrated header in the spirit of PoolTogether's hero, FHE edition. */
export function HeroBand() {
  return (
    <section className="relative -mx-4 -mt-6 overflow-hidden border-b border-line sm:-mx-6" aria-label="Cipher Pool">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(900px_400px_at_20%_30%,rgb(var(--accent)/0.10),transparent_60%),radial-gradient(700px_360px_at_80%_60%,rgb(var(--cipher)/0.10),transparent_60%)]" />
      <CipherMachine className="absolute inset-0 -z-[5] h-full w-full opacity-90" />
      <div className="mx-auto flex min-h-[340px] w-full max-w-6xl flex-col justify-center px-4 py-12 sm:px-6 md:min-h-[400px]">
        <div className="max-w-xl animate-floatIn">
          <div className="pill mb-4 border-accent/30 bg-accent-faint text-accent">Season 4 · Confidential PoolTogether</div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            Save privately.
            <br />
            <span className="text-accent">Win</span> verifiably.
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-muted sm:text-lg">
            A no-loss prize pool where your deposit, your balance and your winnings are ciphertext — even to the contract. Yield funds the
            prizes. You keep your principal.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#position" className="btn-primary shine">Deposit privately</a>
            <Link href="/how-it-works" className="btn-secondary">How the blind draw works</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
