import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto mt-10 max-w-lg p-6">
      <div className="label">Not found</div>
      <p className="mt-2 text-sm text-ink-muted">That page doesn&apos;t exist.</p>
      <Link href="/" className="btn-primary mt-4 inline-flex">Back to the pool</Link>
    </div>
  );
}
