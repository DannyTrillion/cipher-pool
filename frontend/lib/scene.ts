"use client";

/**
 * The scene bus: one tiny store that the UI writes game events into and the
 * stage (sphere, flying coins, confetti) reads from. Keeps chain logic and
 * choreography decoupled: actions fire events when receipts land; visuals react.
 */
export type SceneEvent =
  | { type: "faucet"; amount: bigint }
  | { type: "deposit"; amount: bigint }
  | { type: "withdraw"; amount: bigint }
  | { type: "sponsor"; amount: bigint }
  | { type: "shield"; amount: bigint }
  | { type: "claim" }
  | { type: "drawStart" }
  | { type: "drawSweep"; pass: 1 | 2; cursor: number; total: number }
  | { type: "drawDone" }
  | { type: "reveal" }
  | { type: "win"; amount: bigint }
  | { type: "lose" }
  | { type: "interact" };

type Listener = (e: SceneEvent) => void;
const listeners = new Set<Listener>();
let lastInteraction = typeof performance !== "undefined" ? performance.now() : 0;

export function fire(e: SceneEvent) {
  if (e.type !== "interact") lastInteraction = performance.now();
  listeners.forEach((l) => l(e));
}
export function onScene(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function touch() {
  lastInteraction = performance.now();
}
export function idleMs() {
  return performance.now() - lastInteraction;
}

/** Anchors: DOM elements the stage flies coins between (`data-anchor="wallet"` etc.). */
export function anchorRect(name: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-anchor="${name}"]`);
  return el ? el.getBoundingClientRect() : null;
}

/** The sphere registers where its core is (viewport coords) so DOM overlays can aim at it. */
let sphereCenter: (() => { x: number; y: number } | null) | null = null;
export function registerSphereCenter(fn: typeof sphereCenter) {
  sphereCenter = fn;
}
export function getSphereCenter() {
  return sphereCenter?.() ?? null;
}
