/**
 * Quote engine.
 *
 * The rate card, the line item build up and all of the arithmetic. This module
 * is the only place money is calculated, in either engine mode. A language
 * model never computes a number that reaches a client.
 */

import type { Extraction, FieldKey } from "./extract";
import { hashString } from "./text";

export interface RateCardItem {
  key: string;
  description: string;
  unit: string;
  rate: number;
}

export const RATE_CARD: RateCardItem[] = [
  { key: "design", description: "Design and space planning", unit: "sqm", rate: 38 },
  { key: "demolition", description: "Demolition and strip out", unit: "sqm", rate: 22 },
  { key: "partitions", description: "Partitions and glazing", unit: "linear m", rate: 145 },
  { key: "flooring", description: "Flooring supply and install", unit: "sqm", rate: 46 },
  { key: "lighting", description: "Lighting", unit: "sqm", rate: 34 },
  { key: "electrical", description: "Electrical and data", unit: "workstation", rate: 340 },
  { key: "acoustic", description: "Acoustic panelling", unit: "sqm", rate: 78 },
  { key: "furniture", description: "Furniture install", unit: "workstation", rate: 95 },
];

export const PROJECT_MANAGEMENT_RATE = 0.09;
export const CONTINGENCY_RATE = 0.05;
export const IVA_RATE = 0.21;
export const VOLUME_DISCOUNT_TIERS = [
  { thresholdSqm: 600, rate: 0.07 },
  { thresholdSqm: 300, rate: 0.04 },
];
export const VALIDITY_DAYS = 30;
export const PAYMENT_TERMS = "30 days net from invoice date";

/** Line items whose quantity is the floor area, and which therefore drive the volume discount. */
const AREA_DRIVEN = new Set(["design", "demolition", "flooring", "lighting"]);

export function r2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatEur(value: number): string {
  return value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface QuoteLine {
  key: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  total: number;
  /** Which extracted field supplied the quantity, for the evidence trail. */
  sourceField: FieldKey;
  sourceQuote: string | null;
  estimated: boolean;
}

export interface QuoteTotals {
  subtotal: number;
  projectManagementRate: number;
  projectManagement: number;
  contingencyRate: number;
  contingency: number;
  grossBeforeDiscount: number;
  discountAreaSqm: number;
  discountRate: number;
  discountAmount: number;
  taxableBase: number;
  ivaRate: number;
  iva: number;
  total: number;
}

export interface Quote {
  number: string;
  issueDateIso: string;
  validUntilIso: string;
  paymentTerms: string;
  clientName: string;
  clientCompany: string;
  projectTitle: string;
  completionIso: string | null;
  lines: QuoteLine[];
  totals: QuoteTotals;
}

function isoDate(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function formatLongDate(iso: string): string {
  const parts = iso.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Totals, computed in the order a quantity surveyor computes them: line items,
 * subtotal, project management, contingency, volume discount, taxable base,
 * IVA, total. Every step is rounded to two decimals as it is produced, so the
 * printed figures add up exactly.
 */
export function computeTotals(lines: QuoteLine[]): QuoteTotals {
  const subtotal = r2(lines.reduce((sum, line) => sum + r2(line.quantity * line.rate), 0));
  const projectManagement = r2(subtotal * PROJECT_MANAGEMENT_RATE);
  const contingency = r2(subtotal * CONTINGENCY_RATE);
  const grossBeforeDiscount = r2(subtotal + projectManagement + contingency);

  const discountAreaSqm = lines
    .filter((line) => AREA_DRIVEN.has(line.key))
    .reduce((largest, line) => Math.max(largest, line.quantity), 0);
  const tier = VOLUME_DISCOUNT_TIERS.find((t) => discountAreaSqm > t.thresholdSqm);
  const discountRate = tier ? tier.rate : 0;
  const discountAmount = r2(grossBeforeDiscount * discountRate);

  const taxableBase = r2(grossBeforeDiscount - discountAmount);
  const iva = r2(taxableBase * IVA_RATE);
  const total = r2(taxableBase + iva);

  return {
    subtotal,
    projectManagementRate: PROJECT_MANAGEMENT_RATE,
    projectManagement,
    contingencyRate: CONTINGENCY_RATE,
    contingency,
    grossBeforeDiscount,
    discountAreaSqm,
    discountRate,
    discountAmount,
    taxableBase,
    ivaRate: IVA_RATE,
    iva,
    total,
  };
}

function rateFor(key: string): RateCardItem {
  const item = RATE_CARD.find((r) => r.key === key);
  if (!item) throw new Error("Unknown rate card key: " + key);
  return item;
}

function evidenceFor(extraction: Extraction, field: FieldKey): string | null {
  const match = extraction.fields.find((f) => f.key === field);
  return match && match.evidence ? match.evidence.quote : null;
}

/** Turn the extracted quantities into priced lines using the rate card. */
export function buildLines(extraction: Extraction): QuoteLine[] {
  const lines: QuoteLine[] = [];
  const tags = extraction.scope.map((s) => s.tag);
  const area = extraction.areaSqm;
  const workstations = extraction.workstations;

  const push = (key: string, quantity: number, sourceField: FieldKey, estimated: boolean) => {
    const card = rateFor(key);
    lines.push({
      key,
      description: card.description,
      unit: card.unit,
      quantity,
      rate: card.rate,
      total: r2(quantity * card.rate),
      sourceField,
      sourceQuote: evidenceFor(extraction, sourceField),
      estimated,
    });
  };

  if (area !== null && tags.includes("design")) push("design", area, "areaSqm", false);
  if (area !== null && tags.includes("demolition")) push("demolition", area, "areaSqm", false);
  if (extraction.partitionMetres !== null && tags.includes("partitions")) {
    push("partitions", extraction.partitionMetres, "partitionMetres", extraction.partitionMetresEstimated);
  }
  if (area !== null && tags.includes("flooring")) push("flooring", area, "areaSqm", false);
  if (area !== null && tags.includes("lighting")) push("lighting", area, "areaSqm", false);
  if (workstations !== null && (tags.includes("electrical") || tags.includes("data"))) {
    push("electrical", workstations, "workstations", false);
  }
  if (extraction.acousticSqm !== null && tags.includes("acoustic")) {
    push("acoustic", extraction.acousticSqm, "acousticSqm", false);
  }
  if (workstations !== null && tags.includes("furniture")) push("furniture", workstations, "workstations", false);

  return lines;
}

export function quoteNumber(seed: string, year: number): string {
  const sequence = 100 + (hashString(seed) % 850);
  return `NFI-${year}-${String(sequence).padStart(4, "0")}`;
}

export interface QuoteRequest {
  seed: string;
  today: Date;
  clientName: string;
  clientCompany: string;
  projectTitle: string;
}

export function buildQuote(extraction: Extraction, request: QuoteRequest): Quote {
  const lines = buildLines(extraction);
  const validUntil = new Date(request.today);
  validUntil.setDate(validUntil.getDate() + VALIDITY_DAYS);

  return {
    number: quoteNumber(request.seed, request.today.getFullYear()),
    issueDateIso: isoDate(request.today),
    validUntilIso: isoDate(validUntil),
    paymentTerms: PAYMENT_TERMS,
    clientName: request.clientName,
    clientCompany: request.clientCompany,
    projectTitle: request.projectTitle,
    completionIso: extraction.deadlineIso,
    lines,
    totals: computeTotals(lines),
  };
}

/** Recompute a quote after a quantity has been edited in the interface. */
export function withQuantity(quote: Quote, lineKey: string, quantity: number): Quote {
  const safe = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
  const lines = quote.lines.map((line) =>
    line.key === lineKey
      ? { ...line, quantity: safe, total: r2(safe * line.rate), estimated: false }
      : line,
  );
  return { ...quote, lines, totals: computeTotals(lines) };
}

export function quoteToMarkdown(quote: Quote, supplier: { name: string; contact: string; email: string }): string {
  const rows = quote.lines
    .map(
      (line) =>
        `| ${line.description}${line.estimated ? " (estimated)" : ""} | ${line.quantity} ${line.unit} | ${formatEur(
          line.rate,
        )} | ${formatEur(line.total)} |`,
    )
    .join("\n");

  const t = quote.totals;
  const discountLine =
    t.discountRate > 0
      ? `| Volume discount (${Math.round(t.discountRate * 100)} percent, ${t.discountAreaSqm} sqm) | -${formatEur(
          t.discountAmount,
        )} |`
      : `| Volume discount (not applicable below 300 sqm) | 0.00 |`;

  return `# Quotation ${quote.number}

**${supplier.name}**
${supplier.contact}
${supplier.email}

| | |
| --- | --- |
| Client | ${quote.clientName}, ${quote.clientCompany} |
| Project | ${quote.projectTitle} |
| Issue date | ${formatLongDate(quote.issueDateIso)} |
| Valid until | ${formatLongDate(quote.validUntilIso)} |
| Target completion | ${quote.completionIso ? formatLongDate(quote.completionIso) : "to be confirmed"} |
| Payment terms | ${quote.paymentTerms} |

## Line items

| Description | Quantity | Rate EUR | Total EUR |
| --- | --- | --- | --- |
${rows}

## Build up

| | Amount EUR |
| --- | --- |
| Subtotal | ${formatEur(t.subtotal)} |
| Project management (${Math.round(t.projectManagementRate * 100)} percent) | ${formatEur(t.projectManagement)} |
| Contingency (${Math.round(t.contingencyRate * 100)} percent) | ${formatEur(t.contingency)} |
| Gross before discount | ${formatEur(t.grossBeforeDiscount)} |
${discountLine}
| Taxable base | ${formatEur(t.taxableBase)} |
| IVA (${Math.round(t.ivaRate * 100)} percent) | ${formatEur(t.iva)} |
| **Total payable** | **${formatEur(t.total)}** |

Prices hold for ${VALIDITY_DAYS} days from the issue date. All figures exclude
items not listed above. Quantities marked as estimated are confirmed on survey.

Generated by the Agentic Edge Email and Quote Copilot. All arithmetic is
computed locally in TypeScript, never by a language model.
`;
}
