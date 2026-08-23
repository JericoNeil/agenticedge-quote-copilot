import { createPortal } from "react-dom";

/**
 * Progress marker for ?demo=1.
 *
 * It is a thin line pinned to the top of the viewport rather than a floating
 * card, because a card in the middle of the page covers the very content the
 * recording is meant to show.
 *
 * It renders through a portal into document.body on purpose. An ancestor with a
 * transform becomes the containing block for a fixed child, which pinned this
 * to a zero width column instead of the viewport. Going straight to the body
 * means it cannot be trapped by whatever it happens to be rendered next to.
 */
export function DemoBadge({ done, elapsedMs, totalMs }: { done: boolean; elapsedMs: number; totalMs: number }) {
  if (typeof document === "undefined") return null;

  const pct = Math.min(100, Math.round((elapsedMs / totalMs) * 100));

  return createPortal(
    <div className="pointer-events-none fixed left-0 right-0 top-0 z-50 w-full">
      <div
        className={`h-[3px] transition-[width] duration-200 ease-linear ${done ? "bg-ok" : "bg-accent"}`}
        style={{ width: `${pct}%` }}
      />
      <span
        className={`absolute right-2 top-[7px] rounded-full border px-1.5 py-px font-mono text-[9px] uppercase tracking-wider ${
          done ? "border-ok/40 bg-ok/10 text-ok" : "border-accent/40 bg-accent/10 text-accent"
        }`}
      >
        {done ? "demo complete" : "demo"}
      </span>
    </div>,
    document.body,
  );
}
