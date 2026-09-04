import { Hero } from "@/components/pool/Hero";
import { PositionPanel } from "@/components/pool/PositionPanel";
import { DrawPanel } from "@/components/pool/DrawPanel";
import { AdminPanel } from "@/components/pool/AdminPanel";
import { MyDraws } from "@/components/pool/MyDraws";
import { HowStrip } from "@/components/pool/HowStrip";
import { Badges } from "@/components/pool/Badges";
import { FlyingCoins } from "@/components/fx/FlyingCoins";
import { GlyphConfetti } from "@/components/fx/GlyphConfetti";

export default function Home() {
  return (
    <div className="space-y-8">
      <FlyingCoins />
      <GlyphConfetti />
      <Hero />
      <div className="stagger space-y-8">
        <Badges />
        <div className="grid gap-6 lg:grid-cols-2" id="position">
          <PositionPanel />
          <DrawPanel />
        </div>
        <MyDraws />
        <AdminPanel />
        <HowStrip />
      </div>
    </div>
  );
}
