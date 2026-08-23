import { AlertTriangle, RotateCcw, X } from "lucide-react";
import { LIVE_WARNING } from "../lib/live";
import { Button, cx } from "./ui";

export type EngineMode = "local" | "live";

export function SettingsDrawer({
  open,
  onClose,
  mode,
  onModeChange,
  apiKey,
  onApiKeyChange,
  remember,
  onRememberChange,
  onClearKey,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  mode: EngineMode;
  onModeChange: (mode: EngineMode) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  remember: boolean;
  onRememberChange: (remember: boolean) => void;
  onClearKey: () => void;
  onReset: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <div data-ae="rise"
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />
      <aside data-ae="slide"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col border-l border-border bg-card"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close settings"
          >
            <X size={16} />
          </button>
        </header>

        <div className="scroll-thin flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Engine mode
            </h3>
            <div className="mt-2 grid grid-cols-2 gap-1 rounded-md border border-border bg-surface-subtle p-1">
              {(
                [
                  { id: "local", label: "Local engine (default)" },
                  { id: "live", label: "Claude API (live)" },
                ] as Array<{ id: EngineMode; label: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onModeChange(option.id)}
                  className={cx(
                    "rounded px-2 py-2 text-[11px] font-medium transition-colors",
                    mode === option.id
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              The local engine needs no key and no network. Live mode routes only the draft
              through Claude. Quote arithmetic stays in local TypeScript in both modes.
            </p>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Anthropic API key
            </h3>
            <input
              type="password"
              value={apiKey}
              onChange={(event) => onApiKeyChange(event.target.value)}
              placeholder="sk-ant-..."
              className="mt-2 w-full rounded-md border border-border bg-surface-subtle px-2.5 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-accent"
            />
            <label className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => onRememberChange(event.target.checked)}
                className="h-3.5 w-3.5 accent-[hsl(var(--accent))]"
              />
              Remember on this device
            </label>
            <div className="mt-2">
              <Button onClick={onClearKey} size="sm">
                Clear key
              </Button>
            </div>
            <div className="mt-3 flex gap-2 rounded-md border border-warn/40 bg-warn/10 px-2.5 py-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn" />
              <p className="text-[11px] leading-relaxed text-warn">{LIVE_WARNING}</p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Demo
            </h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Returns the inbox, the style profile corpus, every draft and every quote to first
              load. Use this between takes.
            </p>
            <div className="mt-2">
              <Button onClick={onReset} size="sm">
                <RotateCcw size={12} /> Reset demo
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
