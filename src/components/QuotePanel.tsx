import {
  Check,
  Download,
  FileSpreadsheet,
  Paperclip,
  ShieldAlert,
  Table2,
  X,
} from "lucide-react";
import type { Extraction } from "../engine/extract";
import { CONFIDENCE_THRESHOLD } from "../engine/extract";
import type { Quote } from "../engine/quote";
import {
  CONTINGENCY_RATE,
  IVA_RATE,
  PAYMENT_TERMS,
  PROJECT_MANAGEMENT_RATE,
  RATE_CARD,
  VALIDITY_DAYS,
  VOLUME_DISCOUNT_TIERS,
  formatEur,
  formatLongDate,
} from "../engine/quote";
import { AUTHOR_COMPANY } from "../data/sentCorpus";
import { Button, Meter, Pill, cx } from "./ui";

export const QUOTE_STAGES = [
  "Reading extracted quantities",
  "Applying rate card",
  "Computing build up",
];

export type QuoteStatus = "idle" | "running" | "done";

export interface QuoteState {
  status: QuoteStatus;
  stageIndex: number;
  quote: Quote | null;
  attached: boolean;
}

export const EMPTY_QUOTE_STATE: QuoteState = {
  status: "idle",
  stageIndex: -1,
  quote: null,
  attached: false,
};

export function HandoffCard({ extraction }: { extraction: Extraction }) {
  return (
    <div data-ae="rise"
      className="space-y-2.5 rounded-md border border-warn/40 bg-warn/[0.07] px-2.5 py-2.5"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="shrink-0 text-warn" />
        <span className="text-[11px] font-semibold text-warn">Handed to a person</span>
      </div>
      <p className="text-[10.5px] leading-relaxed text-foreground">{extraction.blockReason}</p>

      {extraction.missing.length > 0 ? (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Missing required fields
          </div>
          <ul className="mt-1 space-y-1">
            {extraction.missing.map((field) => (
              <li key={field.key} className="flex items-baseline gap-1.5 text-[10.5px]">
                <X size={9} className="mt-[3px] shrink-0 text-warn" />
                <span className="text-foreground">{field.label}</span>
                <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                  weight {field.weight.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {extraction.clarifyingQuestions.length > 0 ? (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Questions generated from those gaps
          </div>
          <ul className="mt-1 space-y-1.5">
            {extraction.clarifyingQuestions.map((question) => (
              <li
                key={question}
                className="rounded border border-border bg-surface-subtle px-2 py-1.5 text-[10.5px] leading-relaxed text-foreground"
              >
                {question}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted-foreground">
            These are already in the drafted reply. They are derived from which fields are missing,
            not from a fixed list.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function RateCardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  return (
    <div data-ae="rise"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div data-ae="rise"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[520px] overflow-hidden rounded-lg border border-border bg-card"
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Rate card</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close rate card"
          >
            <X size={15} />
          </button>
        </header>
        <div className="px-4 py-3">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-border text-left text-[9px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-1.5 font-medium">Item</th>
                <th className="pb-1.5 text-right font-medium">Rate EUR</th>
                <th className="pb-1.5 pl-3 text-left font-medium">Per</th>
              </tr>
            </thead>
            <tbody>
              {RATE_CARD.map((item) => (
                <tr key={item.key} className="border-b border-border/60">
                  <td className="py-1.5 text-foreground">{item.description}</td>
                  <td className="py-1.5 text-right font-mono text-foreground">{item.rate}</td>
                  <td className="py-1.5 pl-3 text-muted-foreground">{item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 space-y-1 text-[11px]">
            <Line label="Project management" value={`${Math.round(PROJECT_MANAGEMENT_RATE * 100)} percent of subtotal`} />
            <Line label="Contingency" value={`${Math.round(CONTINGENCY_RATE * 100)} percent of subtotal`} />
            <Line
              label="Volume discount"
              value={VOLUME_DISCOUNT_TIERS.map(
                (tier) => `${Math.round(tier.rate * 100)} percent above ${tier.thresholdSqm} sqm`,
              )
                .reverse()
                .join(", ")}
            />
            <Line label="IVA" value={`${Math.round(IVA_RATE * 100)} percent`} />
            <Line label="Validity" value={`${VALIDITY_DAYS} days from issue`} />
            <Line label="Payment terms" value={PAYMENT_TERMS} />
          </dl>

          <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
            Fictional rates for a fictional contractor. In a real deployment this table is the
            client&rsquo;s own and lives in their own spreadsheet or ERP.
          </p>
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

function BuildUpRow({
  label,
  value,
  emphasis = false,
  negative = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex items-baseline justify-between gap-2 py-1",
        emphasis ? "border-t border-border pt-1.5" : "",
      )}
    >
      <span className={cx("text-[10.5px]", emphasis ? "font-semibold text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cx(
          "shrink-0 font-mono",
          emphasis ? "text-[12px] font-semibold text-accent" : "text-[10.5px] text-foreground",
          negative && "text-ok",
        )}
      >
        {negative ? "-" : ""}
        {value}
      </span>
    </div>
  );
}

export function QuoteDocument({
  quote,
  onQuantityChange,
}: {
  quote: Quote;
  onQuantityChange: (lineKey: string, quantity: number) => void;
}) {
  const t = quote.totals;
  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-subtle">
      <header className="border-b border-border bg-card px-2.5 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-[3px] rounded-full bg-accent" aria-hidden="true" />
              <span className="truncate text-[11px] font-semibold text-foreground">
                {AUTHOR_COMPANY}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[9.5px] text-muted-foreground">
              Commercial interior fit out, Barcelona
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-[11px] text-accent">{quote.number}</div>
            <div className="text-[9px] text-muted-foreground">Quotation</div>
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-x-2 gap-y-1 border-b border-border px-2.5 py-2 text-[9.5px]">
        <Meta label="Client" value={`${quote.clientName}, ${quote.clientCompany}`} />
        <Meta label="Issued" value={formatLongDate(quote.issueDateIso)} />
        <Meta label="Valid until" value={formatLongDate(quote.validUntilIso)} />
        <Meta
          label="Target completion"
          value={quote.completionIso ? formatLongDate(quote.completionIso) : "to be confirmed"}
        />
        <Meta label="Payment terms" value={quote.paymentTerms} />
        <Meta label="Currency" value="EUR" />
      </dl>

      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="border-b border-border text-left text-[8.5px] uppercase tracking-wide text-muted-foreground">
            <th className="px-2.5 py-1.5 font-medium">Item</th>
            <th className="w-[62px] px-1 py-1.5 text-center font-medium">Qty</th>
            <th className="px-2.5 py-1.5 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line) => (
            <tr key={line.key} className="border-b border-border/60 align-top">
              <td className="px-2.5 py-1.5">
                <div className="text-foreground">{line.description}</div>
                <div className="font-mono text-[9px] text-muted-foreground">
                  {formatEur(line.rate)} per {line.unit}
                </div>
                {line.sourceQuote ? (
                  <div className="mt-0.5 flex items-start gap-1 text-[9px] italic leading-relaxed text-muted-foreground">
                    <span className="mt-[3px] h-1.5 w-[2px] shrink-0 rounded-full bg-accent" />
                    &ldquo;{line.sourceQuote}&rdquo;
                  </div>
                ) : null}
                {line.estimated ? (
                  <div className="mt-0.5 text-[9px] text-warn">
                    Estimated from the room count, confirmed on survey.
                  </div>
                ) : null}
              </td>
              <td className="px-1 py-1.5">
                <input
                  type="number"
                  min={0}
                  value={line.quantity}
                  onChange={(event) => onQuantityChange(line.key, Number(event.target.value))}
                  className="w-full rounded border border-border bg-card px-1 py-0.5 text-center font-mono text-[10px] text-foreground outline-none focus:border-accent"
                  aria-label={`Quantity for ${line.description}`}
                />
              </td>
              <td className="px-2.5 py-1.5 text-right font-mono text-foreground">
                {formatEur(line.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="px-2.5 py-2">
        <BuildUpRow label="Subtotal" value={formatEur(t.subtotal)} />
        <BuildUpRow
          label={`Project management (${Math.round(t.projectManagementRate * 100)} percent)`}
          value={formatEur(t.projectManagement)}
        />
        <BuildUpRow
          label={`Contingency (${Math.round(t.contingencyRate * 100)} percent)`}
          value={formatEur(t.contingency)}
        />
        <BuildUpRow label="Gross before discount" value={formatEur(t.grossBeforeDiscount)} />
        <BuildUpRow
          label={
            t.discountRate > 0
              ? `Volume discount (${Math.round(t.discountRate * 100)} percent, ${t.discountAreaSqm} sqm)`
              : "Volume discount (none below 300 sqm)"
          }
          value={formatEur(t.discountAmount)}
          negative={t.discountRate > 0}
        />
        <BuildUpRow label="Taxable base" value={formatEur(t.taxableBase)} />
        <BuildUpRow label={`IVA (${Math.round(t.ivaRate * 100)} percent)`} value={formatEur(t.iva)} />
        <BuildUpRow label="Total payable EUR" value={formatEur(t.total)} emphasis />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[8.5px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

/** The evidence trail: every field the rate card needs, and where it came from. */
function ExtractedFields({ extraction }: { extraction: Extraction }) {
  const applicable = extraction.fields.filter((field) => field.applicable);
  const found = applicable.filter((field) => field.found).length;

  return (
    <details className="rounded-md border border-border bg-surface-subtle">
      <summary className="cursor-pointer list-none px-2.5 py-1.5 text-[10px] text-muted-foreground marker:content-none hover:text-foreground">
        Extracted requirements ({found} of {applicable.length} found)
      </summary>
      <ul className="space-y-1.5 border-t border-border px-2.5 py-2">
        {applicable.map((field) => (
          <li key={field.key}>
            <div className="flex items-baseline gap-1.5 text-[10.5px]">
              {field.found ? (
                <Check size={10} className="mt-[3px] shrink-0 text-ok" />
              ) : (
                <X size={10} className="mt-[3px] shrink-0 text-warn" />
              )}
              <span className="shrink-0 text-muted-foreground">{field.label}</span>
              <span className="min-w-0 flex-1 truncate text-right text-foreground" title={field.display}>
                {field.display}
              </span>
            </div>
            {field.evidence ? (
              <div className="mt-0.5 flex items-start gap-1 pl-4 text-[9px] italic leading-relaxed text-muted-foreground">
                <span className="mt-[3px] h-1.5 w-[2px] shrink-0 rounded-full bg-accent" />
                &ldquo;{field.evidence.quote}&rdquo;
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {extraction.quoteReference ? (
        <p className="border-t border-border px-2.5 py-1.5 text-[9.5px] text-muted-foreground">
          Existing quote reference found in the message:{" "}
          <span className="font-mono text-accent">{extraction.quoteReference}</span>
        </p>
      ) : null}
    </details>
  );
}

export function QuotePanel({
  extraction,
  state,
  onBuild,
  onQuantityChange,
  onAttach,
  onDownload,
  onOpenRateCard,
}: {
  extraction: Extraction | null;
  state: QuoteState;
  onBuild: () => void;
  onQuantityChange: (lineKey: string, quantity: number) => void;
  onAttach: () => void;
  onDownload: () => void;
  onOpenRateCard: () => void;
}) {
  if (!extraction) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Pill tone={extraction.quotable ? "ok" : "warn"}>
            {extraction.quotable ? "Quotable" : "Not quotable"}
          </Pill>
          <span className="font-mono text-[10px] text-muted-foreground">
            {Math.round(extraction.confidence * 100)} percent confidence
          </span>
        </div>
        <button
          type="button"
          onClick={onOpenRateCard}
          className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          <Table2 size={10} /> Rate card
        </button>
      </div>

      <ExtractedFields extraction={extraction} />

      {!extraction.quotable ? <HandoffCard extraction={extraction} /> : null}

      {extraction.quotable && state.status === "idle" ? (
        <>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Prices the extracted quantities against the rate card. Every figure is computed here in
            the browser, in TypeScript. No model touches the arithmetic.
          </p>
          <Button variant="primary" onClick={onBuild} className="w-full">
            <FileSpreadsheet size={12} /> Build quote
          </Button>
        </>
      ) : null}

      {state.status === "running" ? (
        <ol className="space-y-1.5">
          {QUOTE_STAGES.map((stage, index) => {
            const done = index < state.stageIndex;
            const active = index === state.stageIndex;
            return (
              <li
                key={stage}
                className={cx(
                  "flex items-center gap-2 text-[11px]",
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
              </li>
            );
          })}
        </ol>
      ) : null}

      {state.status === "done" && state.quote ? (
        <div data-ae="rise"
          className="space-y-2.5"
        >
          <QuoteDocument quote={state.quote} onQuantityChange={onQuantityChange} />
          <p className="text-[9.5px] leading-relaxed text-muted-foreground">
            Change any quantity above. Subtotal, fees, the volume discount band, IVA and the total
            all recompute from that edit.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="primary" size="sm" onClick={onAttach}>
              <Paperclip size={11} /> {state.attached ? "Attached" : "Attach to reply"}
            </Button>
            <Button size="sm" onClick={onDownload}>
              <Download size={11} /> Download as Markdown
            </Button>
          </div>
        </div>
      ) : null}

      {extraction.quotable ? (
        <div>
          <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
            Extraction confidence
          </div>
          <div className="mt-1">
            <Meter
              value={extraction.confidence}
              tone={extraction.confidence >= CONFIDENCE_THRESHOLD ? "ok" : "warn"}
            />
          </div>
          <p className="mt-1 text-[9.5px] leading-relaxed text-muted-foreground">
            {Math.round(extraction.foundWeight * 100)} of{" "}
            {Math.round(extraction.applicableWeight * 100)} weighted points of required fields were
            found. Threshold to quote is {Math.round(CONFIDENCE_THRESHOLD * 100)} percent.
          </p>
        </div>
      ) : null}
    </div>
  );
}
