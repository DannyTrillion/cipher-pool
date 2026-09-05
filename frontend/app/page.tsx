import { Hero } from "@/components/pool/Hero";
import { GrandSlam } from "@/components/pool/GrandSlam";
import { AdminPanel } from "@/components/pool/AdminPanel";
import { SaversLedger } from "@/components/pool/SaversLedger";
import { FlyingCoins } from "@/components/fx/FlyingCoins";
import { GlyphConfetti } from "@/components/fx/GlyphConfetti";

export default function Home() {
  return (
    <div className="space-y-6 md:space-y-8">
      <FlyingCoins />
      <GlyphConfetti />
      <Hero />
      <div className="stagger space-y-6 md:space-y-8">
        <GrandSlam />
        <SaversLedger />
        <AdminPanel />
      </div>
    </div>
  );
}
