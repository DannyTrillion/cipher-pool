"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { askCipher } from "@/components/guide/AskCipher";
import { sfx } from "@/lib/sound";

const STEPS = [
  { t: "Everyone puts money in", d: "Like a shared piggy bank. Your money stays yours.", icon: (
    <svg viewBox="0 0 48 48" className="h-10 w-10"><circle cx="24" cy="28" r="14" fill="rgba(255,214,0,0.15)" stroke="#FFD600" strokeWidth="2" /><path d="M24 8v12M18 14l6 6 6-6" fill="none" stroke="#FFD600" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>) },
  { t: "The interest becomes a prize", d: "The pool earns interest on the whole pile. That is the prize.", icon: (
    <svg viewBox="0 0 48 48" className="h-10 w-10"><rect x="10" y="26" width="6" height="12" rx="1.5" fill="rgba(255,255,255,0.2)" /><rect x="21" y="18" width="6" height="20" rx="1.5" fill="rgba(255,255,255,0.3)" /><rect x="32" y="10" width="6" height="28" rx="1.5" fill="#5EEAD4" /></svg>) },
  { t: "A draw picks winners in secret", d: "Every 5 minutes. Bigger savers have bigger odds. Nobody learns who won.", icon: (
    <svg viewBox="0 0 48 48" className="h-10 w-10"><circle cx="24" cy="24" r="16" fill="none" stroke="#8B9CFF" strokeWidth="2" strokeDasharray="4 5" /><circle cx="24" cy="24" r="5" fill="#FFD600" /></svg>) },
  { t: "Nobody loses their money", d: "Only the interest is given away. What you put in is never at risk.", icon: (
    <svg viewBox="0 0 48 48" className="h-10 w-10"><rect x="14" y="20" width="20" height="16" rx="3" fill="rgba(139,156,255,0.25)" stroke="#8B9CFF" strokeWidth="2" /><path d="M18 20v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#8B9CFF" strokeWidth="2.5" /></svg>) },
  { t: "Take it out any time", d: "Your money comes back whenever you want it.", icon: (
    <svg viewBox="0 0 48 48" className="h-10 w-10"><circle cx="24" cy="20" r="14" fill="rgba(94,234,212,0.15)" stroke="#5EEAD4" strokeWidth="2" /><path d="M24 28v12M18 34l6 6 6-6" fill="none" stroke="#5EEAD4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>) },
];

/** "What is this, in 60 seconds": a plain explainer, opened from the hero. */
export function Explainer() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener("cipherpool-explainer", on);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("cipherpool-explainer", on); window.removeEventListener("keydown", esc); };
  }, []);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <motion.div role="dialog" aria-label="What is this" initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="glass relative w-full max-w-2xl p-6 sm:p-8">
            <button className="btn-ghost absolute right-3 top-3 h-9 w-9 !p-0" aria-label="Close" onClick={() => setOpen(false)}>✕</button>
            <div className="label">What is this, in 60 seconds</div>
            <h2 className="display mt-2 text-2xl sm:text-3xl">A shared piggy bank where the interest is the prize.</h2>
            <ol className="mt-6 space-y-4">
              {STEPS.map((s, i) => (
                <motion.li key={s.t} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 + i * 0.07 }} className="flex items-start gap-4">
                  <div className="shrink-0 rounded-xl border border-line bg-black/20 p-1.5">{s.icon}</div>
                  <div>
                    <div className="font-semibold"><span className="mr-2 font-mono text-xs text-accent">{i + 1}</span>{s.t}</div>
                    <div className="mt-0.5 text-sm text-ink-muted">{s.d}</div>
                  </div>
                </motion.li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-ink-muted">The twist: your money is scrambled on the blockchain. Nobody can see how much you saved, not even the pool. Anyone can check that a draw was fair.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="#play" className="btn-primary btn-arrow shine" onClick={() => { setOpen(false); sfx.click(); }}>Try it</a>
              <button className="btn-glass" onClick={() => { setOpen(false); askCipher(); }}>Ask Cipher a question</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function openExplainer() {
  window.dispatchEvent(new Event("cipherpool-explainer"));
}
