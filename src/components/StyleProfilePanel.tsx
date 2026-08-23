import { RefreshCw } from "lucide-react";
import { useState } from "react";
import type { SentEmail } from "../data/sentCorpus";
import type { StyleProfile } from "../engine/styleProfile";
import { Button, Stat, cx } from "./ui";

function pct(value: number): string {
  return Math.round(value * 100) + " percent";
}

export function StyleProfilePanel({
  profile,
  corpus,
  excluded,
  onToggleEmail,
  onRebuild,
  rebuilding,
  rebuildStage,
}: {
  profile: StyleProfile;
  corpus: SentEmail[];
  excluded: Set<string>;
  onToggleEmail: (id: string) => void;
  onRebuild: () => void;
  rebuilding: boolean;
  rebuildStage: string | null;
}) {
  const [showCorpus, setShowCorpus] = useState(false);
  const topGreeting = profile.greetings[0];
  const topSignOff = profile.signOffs[0];

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-1.5">
        <Stat
          label="Mean sentence"
          value={`${profile.meanSentenceLength} words`}
        />
        <Stat label="Std deviation" value={`${profile.sdSentenceLength} words`} />
        <Stat label="Contractions" value={`${pct(profile.contractionRate)}`} />
        <Stat label="Mean paragraphs" value={profile.meanParagraphs} />
      </div>

      <div className="space-y-1">
        {topGreeting ? (
          <Row label="Greeting" value={`"${topGreeting.pattern}"`} share={topGreeting.share} />
        ) : null}
        {topSignOff ? (
          <Row label="Sign-off" value={`"${topSignOff.pattern}"`} share={topSignOff.share} />
        ) : null}
        <div
          className="flex items-baseline gap-2 text-[11px]"
          title={`Lexical register ${profile.lexicalFormality}. Contractions taken on ${profile.contractionsUsed} of ${profile.contractionOpportunities} eligible constructions.`}
        >
          <span className="w-[58px] shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
            Formality
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground">{profile.formalityLabel}</span>
          <span className="shrink-0 font-mono text-[10px] text-accent">
            {profile.formalityIndex}
          </span>
        </div>
      </div>

      <div>
        <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
          Recurring phrases
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {profile.recurringPhrases.length === 0 ? (
            <span className="text-[10px] text-muted-foreground">
              No phrase repeats across at least two messages.
            </span>
          ) : (
            profile.recurringPhrases.map((phrase) => (
              <span
                key={phrase.phrase}
                className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground"
              >
                {phrase.phrase}
                <span className="ml-1 text-muted-foreground">{phrase.count}</span>
              </span>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onRebuild} disabled={rebuilding}>
          <RefreshCw size={11} className={rebuilding ? "animate-spin" : ""} /> Rebuild profile
        </Button>
        <button
          type="button"
          onClick={() => setShowCorpus((value) => !value)}
          className="text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {showCorpus ? "Hide corpus" : `Corpus (${corpus.length - excluded.size} of ${corpus.length})`}
        </button>
      </div>

      {rebuilding && rebuildStage ? (
        <div data-ae="rise"
          className="flex items-center gap-2 text-[10px] text-accent"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          {rebuildStage}
        </div>
      ) : null}

      {showCorpus ? (
        <div
          className="overflow-hidden rounded-md border border-border bg-surface-subtle"
        >
          <p className="border-b border-border px-2 py-1.5 text-[10px] leading-relaxed text-muted-foreground">
            Untick a message and rebuild. Every number above is recomputed from whatever is left.
          </p>
          <ul className="max-h-44 overflow-y-auto scroll-thin">
            {corpus.map((email) => {
              const included = !excluded.has(email.id);
              return (
                <li key={email.id}>
                  <label
                    className={cx(
                      "flex cursor-pointer items-start gap-2 px-2 py-1.5 text-[10px] hover:bg-muted/60",
                      !included && "opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={included}
                      onChange={() => onToggleEmail(email.id)}
                      className="mt-0.5 h-3 w-3 shrink-0 accent-[hsl(var(--accent))]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">{email.subject}</span>
                      <span className="block truncate text-muted-foreground">
                        To {email.to}, {email.date}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value, share }: { label: string; value: string; share: number }) {
  return (
    <div className="flex items-baseline gap-2 text-[11px]">
      <span className="w-[58px] shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground">{value}</span>
      <span className="shrink-0 font-mono text-[10px] text-accent">{pct(share)}</span>
    </div>
  );
}
