import { Bot, Lock } from "lucide-react";
import type { RefObject } from "react";
import type { SentEmail } from "../data/sentCorpus";
import type { Extraction } from "../engine/extract";
import { CONFIDENCE_THRESHOLD } from "../engine/extract";
import type { StyleProfile } from "../engine/styleProfile";
import type { DraftState } from "./DraftPanel";
import { DraftPanel } from "./DraftPanel";
import type { QuoteState } from "./QuotePanel";
import { QuotePanel } from "./QuotePanel";
import { StyleProfilePanel } from "./StyleProfilePanel";
import { Meter, Pill, Section } from "./ui";

export interface PanelOpenState {
  style: boolean;
  draft: boolean;
  quote: boolean;
}

export function CopilotPane({
  profile,
  corpus,
  excluded,
  onToggleEmail,
  onRebuild,
  rebuilding,
  rebuildStage,
  extraction,
  draftState,
  quoteState,
  live,
  open,
  onToggleSection,
  onDraft,
  onRegenerate,
  onInsert,
  onEditDraft,
  onBuildQuote,
  onQuantityChange,
  onAttach,
  onDownload,
  onOpenRateCard,
  draftRef,
  quoteRef,
  scrollRef,
}: {
  profile: StyleProfile;
  corpus: SentEmail[];
  excluded: Set<string>;
  onToggleEmail: (id: string) => void;
  onRebuild: () => void;
  rebuilding: boolean;
  rebuildStage: string | null;
  extraction: Extraction | null;
  draftState: DraftState;
  quoteState: QuoteState;
  live: boolean;
  open: PanelOpenState;
  onToggleSection: (key: keyof PanelOpenState) => void;
  onDraft: () => void;
  onRegenerate: () => void;
  onInsert: () => void;
  onEditDraft: (text: string) => void;
  onBuildQuote: () => void;
  onQuantityChange: (lineKey: string, quantity: number) => void;
  onAttach: () => void;
  onDownload: () => void;
  onOpenRateCard: () => void;
  draftRef: RefObject<HTMLDivElement>;
  quoteRef: RefObject<HTMLDivElement>;
  scrollRef: RefObject<HTMLDivElement>;
}) {
  const confident = extraction ? extraction.confidence >= CONFIDENCE_THRESHOLD : false;

  return (
    <aside className="flex w-[372px] shrink-0 flex-col border-l border-border bg-card">
      <header className="border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent">
            <Bot size={13} />
          </span>
          <h2 className="min-w-0 flex-1 truncate text-xs font-semibold">Agentic Edge Copilot</h2>
          <Pill tone={live ? "warn" : "accent"}>{live ? "Live" : "Local"}</Pill>
        </div>

        {extraction ? (
          <div className="mt-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10.5px] text-foreground">{extraction.intentLabel}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                {Math.round(extraction.confidence * 100)} percent
              </span>
            </div>
            <div className="mt-1">
              <Meter value={extraction.confidence} tone={confident ? "ok" : "warn"} />
            </div>
            <p className="mt-1 text-[9px] leading-snug text-muted-foreground">
              {confident
                ? "Above the threshold. The copilot may draft and price."
                : "Below the threshold. The copilot drafts questions and refuses to price."}
            </p>
          </div>
        ) : null}
      </header>

      <div ref={scrollRef} className="scroll-thin flex-1 overflow-y-auto">
        <Section
          title="Style profile"
          step={1}
          open={open.style}
          onToggle={() => onToggleSection("style")}
          right={
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {profile.sampleSize} sent
            </span>
          }
        >
          <StyleProfilePanel
            profile={profile}
            corpus={corpus}
            excluded={excluded}
            onToggleEmail={onToggleEmail}
            onRebuild={onRebuild}
            rebuilding={rebuilding}
            rebuildStage={rebuildStage}
          />
        </Section>

        <div ref={draftRef}>
          <Section
            title="Draft reply"
            step={2}
            open={open.draft}
            onToggle={() => onToggleSection("draft")}
            right={
              draftState.draft ? (
                <span className="shrink-0 font-mono text-[10px] text-accent">
                  {Math.round(draftState.draft.score.overall * 100)}% match
                </span>
              ) : null
            }
          >
            <DraftPanel
              state={draftState}
              live={live}
              onDraft={onDraft}
              onRegenerate={onRegenerate}
              onInsert={onInsert}
              onEdit={onEditDraft}
            />
          </Section>
        </div>

        <div ref={quoteRef}>
          <Section
            title="Quote"
            step={3}
            open={open.quote}
            onToggle={() => onToggleSection("quote")}
            right={
              quoteState.quote ? (
                <span className="shrink-0 font-mono text-[10px] text-accent">
                  {quoteState.quote.number}
                </span>
              ) : null
            }
          >
            <QuotePanel
              extraction={extraction}
              state={quoteState}
              onBuild={onBuildQuote}
              onQuantityChange={onQuantityChange}
              onAttach={onAttach}
              onDownload={onDownload}
              onOpenRateCard={onOpenRateCard}
            />
          </Section>
        </div>
      </div>

      <footer className="flex items-start gap-1.5 border-t border-border px-3 py-2">
        <Lock size={11} className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-[9.5px] leading-relaxed text-muted-foreground">
          Runs inside the client&rsquo;s own mailbox and tenant. The style profile is measured from
          the client&rsquo;s own sent mail, the rate card is the client&rsquo;s own, and neither
          leaves this device in local mode.
        </p>
      </footer>
    </aside>
  );
}
