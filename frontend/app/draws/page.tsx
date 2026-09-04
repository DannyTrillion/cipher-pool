import { DrawsTimeline } from "@/components/pool/DrawsTimeline";

export const metadata = { title: "Prizes — Cipher Pool" };

export default function DrawsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl sm:text-4xl">Prizes</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">What is building up now, and every draw on the record. Prizes and seeds are public so anyone can check a draw was fair. Who won stays private — unless a winner chooses to show the world.</p>
      </div>
      <DrawsTimeline />
    </div>
  );
}
