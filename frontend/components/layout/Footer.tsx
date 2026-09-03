import { deployment } from "@/lib/contracts";
import { truncateAddress } from "@/lib/format";

const GITHUB = process.env.NEXT_PUBLIC_GITHUB_URL;

export function Footer() {
  const pool = deployment.contracts.ConfidentialPrizePool.address;
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-ink-faint sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          Built on the <a className="text-ink-muted hover:text-ink" href="https://docs.zama.org/protocol" target="_blank" rel="noreferrer">Zama Protocol</a> · FHEVM · ERC-7984 ·
          {" "}Zama Developer Program Season 4
        </div>
        <div className="flex items-center gap-4 font-mono">
          <a className="hover:text-ink" href={`https://sepolia.etherscan.io/address/${pool}`} target="_blank" rel="noreferrer">
            Pool {truncateAddress(pool)}
          </a>
          {GITHUB && (
            <a className="hover:text-ink" href={GITHUB} target="_blank" rel="noreferrer">
              GitHub
            </a>
          )}
        </div>
      </div>
    </footer>
  );
}
