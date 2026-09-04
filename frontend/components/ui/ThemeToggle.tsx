"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/sound";

export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('cipherpool.theme');if(t==='light'){document.documentElement.setAttribute('data-theme','light')}}catch(e){}})();`;

export function ThemeToggle() {
  const [light, setLight] = useState(false);
  useEffect(() => { setLight(document.documentElement.getAttribute("data-theme") === "light"); }, []);
  const toggle = () => {
    const next = !light;
    setLight(next);
    document.documentElement.setAttribute("data-theme", next ? "light" : "dark");
    try { localStorage.setItem("cipherpool.theme", next ? "light" : "dark"); } catch {}
    window.dispatchEvent(new Event("cipherpool-theme"));
    sfx.click();
  };
  return (
    <button className="btn-ghost h-9 w-9 !p-0 text-ink-muted" aria-pressed={light} title={light ? "Switch to dark" : "Switch to light"} onClick={toggle}>
      {light ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      )}
    </button>
  );
}
