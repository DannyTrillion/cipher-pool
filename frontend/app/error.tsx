"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6">
      <div className="label">Something went wrong</div>
      <p className="mt-2 text-sm text-ink-muted">Something went wrong showing this page. Your funds are not affected. This is a display problem, not a blockchain problem.</p>
      <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-well p-3 text-xs text-ink-faint">{error.message}</pre>
      <button className="btn-primary mt-4" onClick={reset}>Try again</button>
    </div>
  );
}
