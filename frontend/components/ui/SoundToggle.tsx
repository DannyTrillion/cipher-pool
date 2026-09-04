"use client";

import { useEffect, useState } from "react";
import { initSoundPref, setSound, sfx } from "@/lib/sound";

export function SoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(initSoundPref()); }, []);
  return (
    <button
      className="btn-ghost h-9 w-9 !p-0 text-ink-muted"
      aria-pressed={on}
      title={on ? "Sound on" : "Sound off"}
      onClick={() => { const v = !on; setOn(v); setSound(v); if (v) sfx.click(); }}
    >
      {on ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 5 6 9H2v6h4l5 4V5z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
      )}
    </button>
  );
}
