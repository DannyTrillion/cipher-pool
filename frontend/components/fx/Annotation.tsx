/** Handwritten label with a hand-drawn arrow, in the spirit of the reference's "Search Worldwide ↓" notes. */
export function Annotation({ text, className = "", tilt = -6, arrow = "down" }: { text: string; className?: string; tilt?: number; arrow?: "down" | "down-left" | "down-right" }) {
  const d = arrow === "down" ? "M12 2 C 14 12, 10 20, 14 30" : arrow === "down-left" ? "M22 2 C 20 12, 10 18, 6 30" : "M6 2 C 8 12, 18 18, 22 30";
  return (
    <div className={`hand pointer-events-none flex flex-col items-center gap-0.5 ${className}`} aria-hidden="true">
      <span style={{ transform: `rotate(${tilt}deg)` }}>{text}</span>
      <svg width="28" height="34" viewBox="0 0 28 34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
        <path d={arrow === "down" ? "M9 25 L14 31 L19 25" : arrow === "down-left" ? "M4 23 L6 31 L13 28" : "M15 28 L22 31 L24 23"} />
      </svg>
    </div>
  );
}
