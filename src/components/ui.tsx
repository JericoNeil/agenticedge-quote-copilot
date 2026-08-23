import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Pill({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: "muted" | "accent" | "warn" | "ok";
}) {
  const tones = {
    muted: "border-border bg-muted text-muted-foreground",
    accent: "border-accent/40 bg-accent/10 text-accent",
    warn: "border-warn/40 bg-warn/10 text-warn",
    ok: "border-ok/40 bg-ok/10 text-ok",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "secondary",
  disabled = false,
  title,
  className,
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  title?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const variants = {
    primary: "bg-accent text-accent-foreground hover:brightness-110 border-transparent",
    secondary: "bg-muted text-foreground hover:bg-border border-border",
    ghost: "bg-transparent text-muted-foreground hover:text-foreground border-transparent",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        variants[variant],
        disabled && "cursor-not-allowed opacity-40 hover:brightness-100",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Section({
  title,
  step,
  open,
  onToggle,
  right,
  children,
}: {
  title: string;
  step: number;
  open: boolean;
  onToggle: () => void;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <div className="flex w-full items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            size={14}
            className={cx(
              "shrink-0 text-muted-foreground transition-transform",
              !open && "-rotate-90",
            )}
          />
          <span className="shrink-0 font-mono text-[10px] text-accent">{step}</span>
          <span className="truncate text-xs font-semibold tracking-wide">{title}</span>
        </button>
        {right}
      </div>
      {open ? <div className="px-3 pb-3.5">{children}</div> : null}
    </section>
  );
}

/** A labelled horizontal meter. Width is the value, never decoration. */
export function Meter({
  value,
  tone = "accent",
}: {
  value: number;
  tone?: "accent" | "warn" | "ok";
}) {
  const tones = { accent: "bg-accent", warn: "bg-warn", ok: "bg-ok" };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cx("h-full rounded-full transition-all duration-500", tones[tone])}
        style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }}
      />
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-mono text-[11px] text-foreground">{value}</div>
    </div>
  );
}

/** The citation marker used everywhere a value traces back to source text. */
export function Evidence({ quote }: { quote: string }) {
  return (
    <span className="mt-1 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
      <span className="mt-[3px] h-2 w-[2px] shrink-0 rounded-full bg-accent" aria-hidden="true" />
      <span className="italic">&ldquo;{quote}&rdquo;</span>
    </span>
  );
}
