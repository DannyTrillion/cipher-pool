import { DrawsTimeline } from "@/components/pool/DrawsTimeline";

export const metadata = { title: "Prizes | Cipher Pool" };

export default function DrawsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl sm:text-4xl">Prizes</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">The prize building up now, and every past draw. Prizes and draw numbers are public. Who won stays private unless a winner announces it.</p>
      </div>
      <DrawsTimeline />
    </div>
  );
}
