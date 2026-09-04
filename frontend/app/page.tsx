import { Hero } from "@/components/pool/Hero";
import { PlayPanel } from "@/components/pool/PlayPanel";
import { ResultsPanel } from "@/components/pool/ResultsPanel";
import { AdminPanel } from "@/components/pool/AdminPanel";
import { SaversLedger } from "@/components/pool/SaversLedger";
import { HowStrip } from "@/components/pool/HowStrip";
import { FlyingCoins } from "@/components/fx/FlyingCoins";
import { GlyphConfetti } from "@/components/fx/GlyphConfetti";

export default function Home() {
  return (
    <div className="space-y-8">
      <FlyingCoins />
      <GlyphConfetti />
      <Hero />
      <div className="stagger space-y-8">
        <div className="grid gap-6 lg:grid-cols-2" id="position">
          <PlayPanel />
          <ResultsPanel />
        </div>
        <SaversLedger />
        <AdminPanel />
        <HowStrip />
      </div>
    </div>
  );
}
