/**
 * Self playing demo.
 *
 * Loading the page with ?demo=1 runs the presentation sequence on its own, with
 * no cursor and no clicking. It exists so the prototype can be screen recorded
 * in a single take, or played live in front of an audience, and look identical
 * every time.
 *
 * The demo drives the same state the buttons drive. It does not have a private
 * path through the engine, so what it shows is what a person clicking would get.
 */

export const DEMO_TOTAL_MS = 15000;

export function isDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("demo");
  return value !== null && value !== "0" && value !== "false";
}

/** Resolves after ms unless the run has been cancelled, in which case it throws. */
export function step(ms: number, cancelled: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (cancelled()) reject(new Error("demo cancelled"));
      else resolve();
    }, ms);
    if (cancelled()) {
      window.clearTimeout(timer);
      reject(new Error("demo cancelled"));
    }
  });
}
