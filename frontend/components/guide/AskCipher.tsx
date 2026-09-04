"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OPENING, SUGGESTED, BANK, answer } from "@/lib/knowledge";
import { LogoMark } from "@/components/brand/Logo";
import { sfx } from "@/lib/sound";
import { cn } from "@/lib/cn";

interface Msg { id: number; from: "you" | "cipher"; text: string; chips?: string[] }
let seq = 1;

/** "Ask Cipher": a bottom-right helper that answers from the knowledge bank only. */
export function AskCipher() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([{ id: seq++, from: "cipher", text: OPENING, chips: SUGGESTED }]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOpen = (e: Event) => { setOpen(true); const q = (e as CustomEvent<string>).detail; if (q) setTimeout(() => ask(q), 250); };
    window.addEventListener("cipherpool-ask", onOpen);
    return () => window.removeEventListener("cipherpool-ask", onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 200); }, [open]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs, typing]);

  const ask = (q: string) => {
    const text = q.trim();
    if (!text) return;
    sfx.click();
    setMsgs((m) => [...m, { id: seq++, from: "you", text }]);
    setInput("");
    setTyping(true);
    const { entry, alternatives } = answer(text);
    setTimeout(() => {
      setTyping(false);
      if (entry) setMsgs((m) => [...m, { id: seq++, from: "cipher", text: entry.a, chips: entry.follow }]);
      else setMsgs((m) => [...m, { id: seq++, from: "cipher", text: "I do not know that one yet. I only answer from what I know about this pool. Try one of these, or read How it works.", chips: alternatives.length ? alternatives.map((e) => e.q) : SUGGESTED.slice(0, 3) }]);
    }, 350 + Math.min(600, text.length * 12));
  };

  return (
    <>
      <motion.button
        aria-label={open ? "Close Ask Cipher" : "Ask Cipher"}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-[70] grid h-14 w-14 place-items-center rounded-full bg-accent text-black shadow-[0_0_0_1px_rgb(120_90_0/0.5),0_12px_30px_-8px_rgb(255_214_0/0.7)]"
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { setOpen((o) => !o); sfx.click(); }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        ) : (
          <span className="relative">
            <LogoMark size={30} />
            {!open && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-mint ring-2 ring-accent" />}
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label="Ask Cipher"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="glass fixed bottom-24 right-5 z-[70] flex h-[min(72vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
              <LogoMark size={24} />
              <div>
                <div className="text-sm font-semibold">Ask Cipher</div>
                <div className="text-[11px] text-ink-faint">Answers about this pool, in plain words</div>
              </div>
            </div>
            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {msgs.map((m) => (
                <div key={m.id} className={cn("flex", m.from === "you" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[88%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed", m.from === "you" ? "rounded-br-md bg-accent text-black" : "rounded-bl-md bg-white/[0.06] text-ink")}>
                    {m.text}
                    {m.chips && m.chips.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {m.chips.map((c) => (
                          <button key={c} className="rounded-full border border-line bg-black/20 px-2.5 py-1 text-[12px] text-ink-muted hover:border-accent/50 hover:text-ink" onClick={() => ask(c)}>{c}</button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {typing && (
                <div className="flex justify-start"><div className="rounded-2xl rounded-bl-md bg-white/[0.06] px-3.5 py-2.5"><span className="inline-flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:0ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-faint [animation-delay:240ms]" /></span></div></div>
              )}
            </div>
            <form className="flex items-center gap-2 border-t border-line p-2.5" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
              <input ref={inputRef} className="input !rounded-full !py-2 !text-[14px] !font-sans" placeholder="Ask a question…" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Your question" list="cipher-questions" />
              <datalist id="cipher-questions">{BANK.map((b) => <option key={b.id} value={b.q} />)}</datalist>
              <button type="submit" className="btn-primary btn-sm shrink-0" disabled={!input.trim()}>Ask</button>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

/** Open the helper from anywhere, optionally with a question. */
export function askCipher(question?: string) {
  window.dispatchEvent(new CustomEvent("cipherpool-ask", { detail: question }));
}
