import { DrawHistory } from "@/components/pool/DrawHistory";

export const metadata = { title: "Draws — Cipher Pool" };

export default function DrawsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Draw history</h1>
        <p className="mt-1 text-sm text-ink-muted">Every draw, its public FHE seed and prize. Winners stay private unless they choose to publish a proof.</p>
      </div>
      <DrawHistory />
    </div>
  );
}
