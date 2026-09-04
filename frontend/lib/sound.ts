"use client";

/** Tiny synth sound kit (no assets). Off by default; toggled from the header. */
let ctx: AudioContext | null = null;
let enabled = false;
const KEY = "cipherpool.sound";

export function soundEnabled() {
  return enabled;
}
export function initSoundPref() {
  try { enabled = localStorage.getItem(KEY) === "1"; } catch { enabled = false; }
  return enabled;
}
export function setSound(on: boolean) {
  enabled = on;
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
  if (on) void ensure();
}
async function ensure() {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") await ctx.resume();
  return ctx;
}
function tone(freq: number, dur: number, type: OscillatorType, gain = 0.06, slide = 0) {
  if (!enabled) return;
  void ensure().then((c) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  });
}
export const sfx = {
  click: () => tone(520, 0.06, "square", 0.03),
  coin: () => { tone(880, 0.12, "triangle", 0.05); setTimeout(() => tone(1320, 0.18, "triangle", 0.05), 70); },
  lock: () => tone(220, 0.16, "sawtooth", 0.05, -120),
  whoosh: () => tone(300, 0.35, "sine", 0.04, 900),
  sweep: () => tone(160, 0.5, "sawtooth", 0.03, 420),
  chime: () => [660, 880, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.35, "sine", 0.05), i * 110)),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, 0.4, "triangle", 0.06), i * 90)),
  lose: () => tone(330, 0.3, "sine", 0.04, -120),
};
