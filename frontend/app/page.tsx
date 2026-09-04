import { PrizeHero } from "@/components/pool/PrizeHero";
import { PositionPanel } from "@/components/pool/PositionPanel";
import { DrawPanel } from "@/components/pool/DrawPanel";
import { AdminPanel } from "@/components/pool/AdminPanel";
import { MyDraws } from "@/components/pool/MyDraws";
import { HowStrip } from "@/components/pool/HowStrip";

export default function Home() {
  return (
    <div className="space-y-6">
      <PrizeHero />
      <div className="grid gap-6 lg:grid-cols-2">
        <PositionPanel />
        <DrawPanel />
      </div>
      <MyDraws />
      <AdminPanel />
      <HowStrip />
    </div>
  );
}
