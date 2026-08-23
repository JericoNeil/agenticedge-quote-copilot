import { Check, CornerUpLeft, Paperclip, RefreshCw, Send, Sparkles } from "lucide-react";
import type { ComposedDraft } from "../engine/compose";
import { PIPELINE_STAGES } from "../engine/compose";
import { Button, Meter, Pill, cx } from "./ui";

export type RunStatus = "idle" | "running" | "done";

export interface DraftState {
  status: RunStatus;
  stageIndex: number;
  streamText: string;
  draft: ComposedDraft | null;
  editedText: string;
  inserted: boolean;
  attachedQuote: string | null;
  liveNotice: string | null;
}

export const EMPTY_DRAFT_STATE: DraftState = {
  status: "idle",
  stageIndex: -1,
  streamText: "",
  draft: null,
  editedText: "",
  inserted: false,
  attachedQuote: null,
  liveNotice: null,
};

function scoreTone(score: number): "ok" | "warn" | "accent" {
  if (score >= 0.85) return "ok";
  if (score >= 0.65) return "accent";
  return "warn";
}

export function DraftPanel({
  state,
  live,
  onDraft,
  onRegenerate,
  onInsert,
  onEdit,
}: {
  state: DraftState;
  live: boolean;
  onDraft: () => void;
  onRegenerate: () => void;
  onInsert: () => void;
  onEdit: (text: string) => void;
}) {
  const running = state.status === "running";

  return (
    <div className="space-y-3">
      {state.status === "idle" ? (
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          Writes a reply in the voice measured above, from this message only.
        </p>
      ) : null}

      {state.status === "idle" ? (
        <Button variant="primary" onClick={onDraft} className="w-full">
          <Sparkles size={12} /> Draft reply
        </Button>
      ) : null}

      {running ? (
        <ol className="space-y-1.5">
          {PIPELINE_STAGES.map((stage, index) => {
            const done = index < state.stageIndex;
            const active = index === state.stageIndex;
            return (
              <li
                key={stage}
                className={cx(
                  "flex items-center gap-2 text-[11px] transition-colors",
                  done ? "text-muted-foreground" : active ? "text-foreground" : "text-muted-foreground/40",
                )}
              >
                <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                  {done ? (
                    <Check size={11} className="text-ok" />
                  ) : active ? (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                  ) : (
                    <span className="h-1 w-1 rounded-full bg-border" />
                  )}
                </span>
                {stage}
                {active && live && index === 3 ? (
                  <span className="ml-auto font-mono text-[9px] text-accent">streaming</span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}

      {running && live && state.streamText ? (
        <pre className="scroll-thin max-h-32 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-surface-subtle px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
          {state.streamText}
        </pre>
      ) : null}

      {state.liveNotice ? (
        <p className="rounded-md border border-warn/40 bg-warn/10 px-2.5 py-2 text-[10px] leading-relaxed text-warn">
          {state.liveNotice}
        </p>
      ) : null}

      {state.status === "done" && state.draft ? (
        <div data-ae="rise"
          className="space-y-3"
        >
          <div className="flex items-center gap-2">
            <Pill tone="accent">{live ? "Claude API" : "Local engine"}</Pill>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {state.draft.subject}
            </span>
          </div>

          <textarea
            value={state.editedText}
            onChange={(event) => onEdit(event.target.value)}
            spellCheck={false}
            rows={14}
            className="scroll-thin w-full resize-y rounded-md border border-border bg-surface-subtle px-2.5 py-2 text-[11.5px] leading-[1.65] text-foreground outline-none focus:border-accent"
          />

          {state.attachedQuote ? (
            <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-2.5 py-1.5 text-[10px] text-accent">
              <Paperclip size={11} />
              <span className="truncate font-mono">{state.attachedQuote}.md</span>
              <span className="ml-auto shrink-0 text-muted-foreground">attached</span>
            </div>
          ) : null}

          <StyleMatch draft={state.draft} />

          <div className="flex flex-wrap gap-1.5">
            <Button variant="primary" size="sm" onClick={onInsert}>
              <CornerUpLeft size={11} /> {state.inserted ? "Inserted" : "Insert into reply"}
            </Button>
            <Button size="sm" onClick={onRegenerate}>
              <RefreshCw size={11} /> Regenerate
            </Button>
            <Button
              size="sm"
              disabled
              title="Human approval required. This prototype does not send."
            >
              <Send size={11} /> Send
            </Button>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Send is disabled by design. Nothing leaves the mailbox without a person approving it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StyleMatch({ draft }: { draft: ComposedDraft }) {
  const overall = draft.score.overall;
  return (
    <div className="rounded-md border border-border bg-surface-subtle px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Style match</span>
        <span
          className={cx(
            "font-mono text-sm font-semibold",
            overall >= 0.85 ? "text-ok" : overall >= 0.65 ? "text-accent" : "text-warn",
          )}
        >
          {Math.round(overall * 100)}%
        </span>
      </div>
      <div className="mt-1.5">
        <Meter value={overall} tone={scoreTone(overall)} />
      </div>
      <ul className="mt-2 space-y-1.5">
        {draft.score.components.map((component) => (
          <li key={component.key}>
            <div className="flex items-baseline justify-between gap-2 text-[10px]">
              <span className="text-foreground">{component.label}</span>
              <span className="shrink-0 font-mono text-muted-foreground">
                {Math.round(component.score * 100)}%
                <span className="ml-1 opacity-60">
                  w{Math.round(component.weight * 100)}
                </span>
              </span>
            </div>
            <div className="mt-0.5 text-[9.5px] leading-relaxed text-muted-foreground">
              {component.detail}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[9.5px] leading-relaxed text-muted-foreground">
        Scored by measuring the draft with the same functions used on the corpus. A perfect score is
        not the goal and is not claimed.
      </p>
    </div>
  );
}
