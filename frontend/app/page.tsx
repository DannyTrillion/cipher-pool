import { Hero } from "@/components/pool/Hero";
import { PositionPanel } from "@/components/pool/PositionPanel";
import { DrawPanel } from "@/components/pool/DrawPanel";
import { AdminPanel } from "@/components/pool/AdminPanel";
import { MyDraws } from "@/components/pool/MyDraws";
import { HowStrip } from "@/components/pool/HowStrip";

export default function Home() {
  return (
    <div className="space-y-8">
      <Hero />
      <div className="stagger space-y-8">
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
