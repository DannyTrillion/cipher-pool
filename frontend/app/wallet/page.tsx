import { WalletView } from "@/components/pool/WalletView";

export const metadata = { title: "Wallet | Cipher Pool" };

export default function WalletPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="display text-3xl sm:text-4xl">Wallet</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">Everything about you in one place: balances, prizes waiting, your draws and what you have done.</p>
      </div>
      <WalletView />
    </div>
  );
}
