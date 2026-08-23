/**
 * Requirement extraction.
 *
 * Reads an inbound message and pulls out the fields the rate card needs. Every
 * field carries the exact substring it came from, so the interface can show the
 * evidence next to the value rather than asking anyone to trust it.
 */

import { clamp, round } from "./text";

export type ScopeTag =
  | "design"
  | "demolition"
  | "partitions"
  | "flooring"
  | "lighting"
  | "electrical"
  | "data"
  | "acoustic"
  | "furniture";

export type FieldKey =
  | "scope"
  | "areaSqm"
  | "workstations"
  | "partitionMetres"
  | "acousticSqm"
  | "sites"
  | "deadline"
  | "budget";

export type Intent = "quote_request" | "quote_chase" | "scope_change" | "vague_enquiry";

export interface Evidence {
  quote: string;
  index: number;
}

export interface ExtractedField {
  key: FieldKey;
  label: string;
  found: boolean;
  applicable: boolean;
  weight: number;
  /** Numeric value where the field is a quantity, otherwise null. */
  value: number | null;
  display: string;
  evidence: Evidence | null;
  question: string;
}

export interface Extraction {
  intent: Intent;
  intentLabel: string;
  fields: ExtractedField[];
  scope: Array<{ tag: ScopeTag; label: string; evidence: Evidence }>;
  areaSqm: number | null;
  areaPerSite: boolean;
  workstations: number | null;
  partitionMetres: number | null;
  partitionMetresEstimated: boolean;
  acousticSqm: number | null;
  sites: number;
  deadlineIso: string | null;
  deadlineLabel: string | null;
  budgetEur: number | null;
  quoteReference: string | null;
  confidence: number;
  foundWeight: number;
  applicableWeight: number;
  missing: ExtractedField[];
  clarifyingQuestions: string[];
  quotable: boolean;
  blockReason: string | null;
}

/** Below this the copilot refuses to quote and hands the message to a person. */
export const CONFIDENCE_THRESHOLD = 0.55;

export const SCOPE_LABELS: Record<ScopeTag, string> = {
  design: "Design and space planning",
  demolition: "Demolition and strip out",
  partitions: "Partitions and glazing",
  flooring: "Flooring",
  lighting: "Lighting",
  electrical: "Electrical and power",
  data: "Data and comms",
  acoustic: "Acoustic treatment",
  furniture: "Furniture install",
};

const SCOPE_KEYWORDS: Record<ScopeTag, string[]> = {
  design: ["space planning", "test fit", "layout drawings", "design and", "concept design"],
  demolition: ["strip out", "strip-out", "stripout", "demolition", "demolish", "remove the existing", "clear the existing"],
  partitions: ["partition", "partitioning", "glazed", "glazing", "glass partition", "glass wall"],
  flooring: ["flooring", "floor covering", "new floors", "carpet", "vinyl", "lvt"],
  lighting: ["lighting", "light fittings", "luminaire", "downlights"],
  electrical: ["electrical", "small power", "power and data", "sockets", "power to"],
  data: ["data and", "power and data", "data outlets", "data cabling", "network points", "comms"],
  acoustic: ["acoustic", "acoustic panelling", "acoustic panels", "sound absorption", "soundproof"],
  furniture: ["furniture", "furniture install", "loose furniture", "desk install"],
};

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

const FIELD_LABELS: Record<FieldKey, string> = {
  scope: "Scope of works",
  areaSqm: "Floor area",
  workstations: "Workstations",
  partitionMetres: "Partitioning",
  acousticSqm: "Acoustic area",
  sites: "Number of sites",
  deadline: "Completion date",
  budget: "Budget range",
};

const FIELD_WEIGHTS: Record<FieldKey, number> = {
  scope: 0.25,
  areaSqm: 0.28,
  workstations: 0.14,
  partitionMetres: 0.08,
  acousticSqm: 0.14,
  sites: 0.06,
  deadline: 0.12,
  budget: 0.05,
};

const FIELD_QUESTIONS: Record<FieldKey, string> = {
  scope:
    "Which trades should the price cover: strip out, partitions and glazing, flooring, lighting, electrical and data, acoustic treatment, furniture install?",
  areaSqm: "What is the total floor area in square metres, and is it one floor or several?",
  workstations: "How many workstations should we plan power, data and furniture for?",
  partitionMetres: "Roughly how many linear metres of partitioning and glazing do you need?",
  acousticSqm: "How many square metres of acoustic treatment are we pricing?",
  sites: "How many sites are included, and are they all the same size?",
  deadline: "What completion date are you working towards, and is there a date you must be occupying by?",
  budget: "Do you have an approved budget range we should design to?",
};

/** Parse a run of number words such as "four hundred and twenty". */
function parseWordNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let sawNumber = false;
  for (const raw of words) {
    const word = raw.toLowerCase();
    if (word === "and") continue;
    const value = NUMBER_WORDS[word];
    if (value === undefined) return null;
    sawNumber = true;
    if (value === 100) {
      current = (current === 0 ? 1 : current) * 100;
    } else if (value === 1000) {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
    } else {
      current += value;
    }
  }
  if (!sawNumber) return null;
  return total + current;
}

function parseDigits(token: string): number | null {
  const cleaned = token.replace(/\.(?=\d{3}\b)/g, "").replace(/,(?=\d{3}\b)/g, "").replace(/,/g, ".");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * Look backwards from a unit match and read the quantity in front of it.
 * Handles "420 sqm", "420 square metres" and "four hundred and twenty square
 * metres" with the same code path.
 */
function numberBefore(text: string, unitIndex: number): { value: number; start: number } | null {
  const before = text.slice(0, unitIndex).replace(/\s+$/, "");
  const digitMatch = before.match(/([\d][\d.,]*)\s*$/);
  if (digitMatch) {
    const value = parseDigits(digitMatch[1]);
    if (value !== null) return { value, start: before.length - digitMatch[1].length };
  }

  const words = before.split(/\s+/);
  const collected: string[] = [];
  let consumed = 0;
  for (let i = words.length - 1; i >= 0 && collected.length < 6; i -= 1) {
    const token = words[i].toLowerCase().replace(/[^a-z]/g, "");
    if (NUMBER_WORDS[token] === undefined && token !== "and") break;
    collected.unshift(token);
    consumed += words[i].length + 1;
  }
  if (collected.length === 0) return null;
  while (collected.length > 0 && collected[0] === "and") collected.shift();
  const value = parseWordNumber(collected);
  if (value === null || value === 0) return null;
  return { value, start: Math.max(0, before.length - consumed) };
}

function makeEvidence(text: string, start: number, end: number): Evidence {
  const from = Math.max(0, start);
  const to = Math.min(text.length, end);
  return { quote: text.slice(from, to).trim(), index: from };
}

interface AreaHit {
  value: number;
  evidence: Evidence;
  perSite: boolean;
  acoustic: boolean;
}

const AREA_UNIT = /sq\.?\s?m\b|sqm\b|m2\b|m²|square\s+met(?:er|re)s?/gi;

/** Paragraph spans, used to attribute a quantity to the trade discussed around it. */
function paragraphSpans(text: string): Array<{ start: number; end: number; text: string }> {
  const spans: Array<{ start: number; end: number; text: string }> = [];
  const re = /\n\s*\n/g;
  let cursor = 0;
  let match = re.exec(text);
  while (match !== null) {
    spans.push({ start: cursor, end: match.index, text: text.slice(cursor, match.index) });
    cursor = match.index + match[0].length;
    match = re.exec(text);
  }
  spans.push({ start: cursor, end: text.length, text: text.slice(cursor) });
  return spans;
}

function findAreas(text: string): AreaHit[] {
  const hits: AreaHit[] = [];
  const spans = paragraphSpans(text);
  const perSiteRe = /\beach\b|\bper\s+(site|store|unit|branch|location)\b|\bapiece\b/;
  AREA_UNIT.lastIndex = 0;
  let match = AREA_UNIT.exec(text);
  while (match !== null) {
    const quantity = numberBefore(text, match.index);
    if (quantity) {
      const tail = text.slice(match.index, match.index + match[0].length + 24).toLowerCase();
      const nearHead = text.slice(Math.max(0, quantity.start - 42), quantity.start).toLowerCase();
      // A quantity belongs to the trade its own paragraph is about.
      const span = spans.find((s) => quantity.start >= s.start && quantity.start <= s.end);
      const paragraph = span ? span.text.toLowerCase() : text.toLowerCase();
      hits.push({
        value: quantity.value,
        evidence: makeEvidence(text, quantity.start, match.index + match[0].length),
        perSite: perSiteRe.test(tail) || perSiteRe.test(nearHead),
        acoustic: /acoustic|sound absorption|soundproof/.test(paragraph),
      });
    }
    match = AREA_UNIT.exec(text);
  }
  return hits;
}

const COUNT_PATTERNS: Array<{ key: "workstations" | "sites"; re: RegExp }> = [
  { key: "workstations", re: /\b(workstations?|desks?|work\s?stations?|desk\s+positions?)\b/gi },
  { key: "workstations", re: /\bteam\s+of\b/gi },
  { key: "sites", re: /\b(sites?|stores?|locations?|branches|units?|premises)\b/gi },
];

function findCount(text: string, re: RegExp): { value: number; evidence: Evidence } | null {
  re.lastIndex = 0;
  let match = re.exec(text);
  while (match !== null) {
    if (/team\s+of/i.test(match[0])) {
      const after = text.slice(match.index + match[0].length, match.index + match[0].length + 24);
      const digit = after.match(/^\s*([\d][\d.,]*)/);
      if (digit) {
        const value = parseDigits(digit[1]);
        if (value !== null) {
          return {
            value,
            evidence: makeEvidence(text, match.index, match.index + match[0].length + digit[0].length),
          };
        }
      }
      const words = after.trim().split(/\s+/);
      const collected: string[] = [];
      for (const word of words) {
        const token = word.toLowerCase().replace(/[^a-z]/g, "");
        if (NUMBER_WORDS[token] === undefined && token !== "and") break;
        collected.push(token);
      }
      const worded = parseWordNumber(collected);
      if (worded !== null && worded > 0) {
        return {
          value: worded,
          evidence: makeEvidence(text, match.index, match.index + match[0].length + collected.join(" ").length + 2),
        };
      }
    } else {
      const quantity = numberBefore(text, match.index);
      if (quantity) {
        return {
          value: quantity.value,
          evidence: makeEvidence(text, quantity.start, match.index + match[0].length),
        };
      }
    }
    match = re.exec(text);
  }
  return null;
}

const PARTITION_RE =
  /\b(?:linear\s+met(?:er|re)s?|lin\.?\s?m\b|lm\b)\s*(?:of\s+)?(?:[a-z ]{0,24}?)(?:partition\w*|glazing|glazed\s+\w+)/gi;
const PARTITION_REVERSE_RE =
  /\b(?:partition\w*|glazing|glazed\s+\w+)[a-z ,]{0,32}?\b(?:linear\s+met(?:er|re)s?|lin\.?\s?m\b|lm\b)/gi;

function findPartitionMetres(text: string): { value: number; evidence: Evidence } | null {
  for (const re of [PARTITION_RE, PARTITION_REVERSE_RE]) {
    re.lastIndex = 0;
    let match = re.exec(text);
    while (match !== null) {
      const unitIndex = match.index + match[0].search(/linear\s+met|lin\.?\s?m\b|lm\b/i);
      const quantity = numberBefore(text, unitIndex);
      if (quantity) {
        return {
          value: quantity.value,
          evidence: makeEvidence(text, quantity.start, match.index + match[0].length),
        };
      }
      match = re.exec(text);
    }
  }
  return null;
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function toIso(year: number, monthIndex: number, day: number): string {
  const mm = String(monthIndex + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Push a date forward a year when the plain reading would land in the past. */
function resolveYear(today: Date, monthIndex: number, day: number): number {
  const candidate = new Date(today.getFullYear(), monthIndex, day);
  return candidate.getTime() < today.getTime() ? today.getFullYear() + 1 : today.getFullYear();
}

export interface DeadlineHit {
  iso: string;
  label: string;
  evidence: Evidence;
}

export function findDeadline(text: string, today: Date): DeadlineHit | null {
  const monthAlt = MONTHS.map((m) => m.slice(0, 3)).join("|");

  const endOfMonth = new RegExp(`\\b(end|start|beginning|middle|mid)\\s+of\\s+(${monthAlt})[a-z]*`, "i").exec(text);
  if (endOfMonth) {
    const monthIndex = MONTHS.findIndex((m) => m.startsWith(endOfMonth[2].toLowerCase()));
    const which = endOfMonth[1].toLowerCase();
    const day =
      which === "end" ? lastDayOfMonth(today.getFullYear(), monthIndex) : which === "mid" || which === "middle" ? 15 : 1;
    const year = resolveYear(today, monthIndex, day);
    return {
      iso: toIso(year, monthIndex, lastDayOfMonth(year, monthIndex) < day ? lastDayOfMonth(year, monthIndex) : day),
      label: endOfMonth[0],
      evidence: makeEvidence(text, endOfMonth.index, endOfMonth.index + endOfMonth[0].length),
    };
  }

  const dayMonth = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthAlt})[a-z]*(?:\\s+(\\d{4}))?`, "i").exec(text);
  if (dayMonth) {
    const monthIndex = MONTHS.findIndex((m) => m.startsWith(dayMonth[2].toLowerCase()));
    const day = Number(dayMonth[1]);
    const year = dayMonth[3] ? Number(dayMonth[3]) : resolveYear(today, monthIndex, day);
    return {
      iso: toIso(year, monthIndex, day),
      label: dayMonth[0],
      evidence: makeEvidence(text, dayMonth.index, dayMonth.index + dayMonth[0].length),
    };
  }

  const monthDay = new RegExp(`\\b(${monthAlt})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?`, "i").exec(text);
  if (monthDay) {
    const monthIndex = MONTHS.findIndex((m) => m.startsWith(monthDay[1].toLowerCase()));
    const day = Number(monthDay[2]);
    const year = resolveYear(today, monthIndex, day);
    return {
      iso: toIso(year, monthIndex, day),
      label: monthDay[0],
      evidence: makeEvidence(text, monthDay.index, monthDay.index + monthDay[0].length),
    };
  }

  const relative = /\b(?:in|within)\s+([a-z\d]+)\s+(week|month)s?\b/i.exec(text);
  if (relative) {
    const token = relative[1].toLowerCase();
    const count = /^\d+$/.test(token) ? Number(token) : parseWordNumber([token]);
    if (count !== null && count > 0) {
      const target = new Date(today);
      if (relative[2].toLowerCase() === "week") target.setDate(target.getDate() + count * 7);
      else target.setMonth(target.getMonth() + count);
      return {
        iso: toIso(target.getFullYear(), target.getMonth(), target.getDate()),
        label: relative[0],
        evidence: makeEvidence(text, relative.index, relative.index + relative[0].length),
      };
    }
  }

  return null;
}

const CURRENCY_RE = /(?:€\s*([\d][\d.,]*)\s*(k)?)|(?:([\d][\d.,]*)\s*(k)?\s*(?:euros?|eur)\b)/gi;
const BUDGET_CUES = /budget|spend|allowance|cap|envelope|approved\s+(?:sum|figure)/i;

function findBudget(text: string): { value: number; evidence: Evidence } | null {
  CURRENCY_RE.lastIndex = 0;
  let match = CURRENCY_RE.exec(text);
  while (match !== null) {
    const head = text.slice(Math.max(0, match.index - 70), match.index);
    if (BUDGET_CUES.test(head)) {
      const raw = match[1] !== undefined ? match[1] : match[3];
      const kilo = match[2] !== undefined ? match[2] : match[4];
      const parsed = parseDigits(raw);
      if (parsed !== null) {
        const value = kilo ? parsed * 1000 : parsed;
        return { value, evidence: makeEvidence(text, match.index, match.index + match[0].length) };
      }
    }
    match = CURRENCY_RE.exec(text);
  }
  return null;
}

function findScope(text: string): Array<{ tag: ScopeTag; label: string; evidence: Evidence }> {
  const found: Array<{ tag: ScopeTag; label: string; evidence: Evidence }> = [];
  const lower = text.toLowerCase();
  (Object.keys(SCOPE_KEYWORDS) as ScopeTag[]).forEach((tag) => {
    for (const keyword of SCOPE_KEYWORDS[tag]) {
      const index = lower.indexOf(keyword);
      if (index >= 0) {
        found.push({
          tag,
          label: SCOPE_LABELS[tag],
          evidence: makeEvidence(text, index, index + keyword.length),
        });
        return;
      }
    }
  });
  return found;
}

const QUOTE_REF_RE = /\bNFI-\d{4}-\d{4}\b/;

function classifyIntent(text: string, hasQuoteRef: boolean): Intent {
  const lower = text.toLowerCase();
  const chase =
    hasQuoteRef &&
    /(update|where are we|chasing|come back|heard|decision|board meets|competitor|another contractor|cheaper|lower)/.test(
      lower,
    );
  if (chase) return "quote_chase";

  const change =
    /\b(add|added|additional|also want|variation|extra)\b/.test(lower) &&
    /\b(on site|works|current project|live job|programme|contract|already underway|ceilings close)\b/.test(lower);
  if (change) return "scope_change";

  const asksForPrice = /(quote|quotation|price|pricing|cost|estimate|tender)/.test(lower);
  if (asksForPrice) return "quote_request";
  return "vague_enquiry";
}

const INTENT_LABELS: Record<Intent, string> = {
  quote_request: "New quote request",
  quote_chase: "Follow up on an issued quote",
  scope_change: "Scope change on a live job",
  vague_enquiry: "Unqualified enquiry",
};

export function extractRequirements(text: string, today: Date): Extraction {
  const scope = findScope(text);
  const scopeTags = scope.map((s) => s.tag);
  const areas = findAreas(text);
  const acousticArea = areas.find((a) => a.acoustic);
  const generalAreas = areas.filter((a) => !a.acoustic);
  const primaryArea = generalAreas.length > 0 ? generalAreas[0] : null;

  const workstationHit =
    findCount(text, COUNT_PATTERNS[0].re) || findCount(text, COUNT_PATTERNS[1].re);
  const siteHit = findCount(text, COUNT_PATTERNS[2].re);
  const partitionHit = findPartitionMetres(text);
  const deadline = findDeadline(text, today);
  const budget = findBudget(text);
  const quoteRefMatch = QUOTE_REF_RE.exec(text);

  const sites = siteHit && siteHit.value > 1 ? siteHit.value : 1;
  const areaPerSite = primaryArea ? primaryArea.perSite : false;
  const areaSqm = primaryArea ? (areaPerSite ? primaryArea.value * sites : primaryArea.value) : null;

  let intent = classifyIntent(text, quoteRefMatch !== null);

  // Which fields the rate card actually needs for the scope that was detected.
  const needsArea =
    scopeTags.length === 0 ||
    scopeTags.some((t) => t === "design" || t === "demolition" || t === "flooring" || t === "lighting");
  const needsWorkstations =
    scopeTags.length === 0 || scopeTags.some((t) => t === "electrical" || t === "data" || t === "furniture");
  const needsPartitions = scopeTags.includes("partitions");
  const needsAcoustic = scopeTags.includes("acoustic");
  const needsSites = siteHit !== null && siteHit.value > 1;

  let partitionMetres = partitionHit ? partitionHit.value : null;
  let partitionMetresEstimated = false;
  const meetingRooms = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:glass\s+|glazed\s+)?meeting\s+rooms?/i.exec(
    text,
  );
  if (partitionMetres === null && needsPartitions && meetingRooms) {
    const token = meetingRooms[1].toLowerCase();
    const rooms = /^\d+$/.test(token) ? Number(token) : parseWordNumber([token]);
    if (rooms !== null && rooms > 0) {
      partitionMetres = rooms * 18;
      partitionMetresEstimated = true;
    }
  }

  const definitions: Array<{ key: FieldKey; applicable: boolean; found: boolean; value: number | null; display: string; evidence: Evidence | null }> = [
    {
      key: "scope",
      applicable: true,
      found: scope.length > 0,
      value: scope.length,
      display: scope.length > 0 ? scope.map((s) => s.label).join(", ") : "not stated",
      evidence: scope.length > 0 ? scope[0].evidence : null,
    },
    {
      key: "areaSqm",
      applicable: needsArea,
      found: areaSqm !== null,
      value: areaSqm,
      display:
        areaSqm !== null
          ? areaPerSite
            ? `${primaryArea?.value} sqm per site, ${areaSqm} sqm total`
            : `${areaSqm} sqm`
          : "not stated",
      evidence: primaryArea ? primaryArea.evidence : null,
    },
    {
      key: "workstations",
      applicable: needsWorkstations,
      found: workstationHit !== null,
      value: workstationHit ? workstationHit.value : null,
      display: workstationHit ? `${workstationHit.value} positions` : "not stated",
      evidence: workstationHit ? workstationHit.evidence : null,
    },
    {
      key: "partitionMetres",
      applicable: needsPartitions,
      found: partitionMetres !== null,
      value: partitionMetres,
      display:
        partitionMetres === null
          ? "not stated"
          : partitionMetresEstimated
            ? `${partitionMetres} linear m, estimated from room count`
            : `${partitionMetres} linear m`,
      evidence: partitionHit
        ? partitionHit.evidence
        : meetingRooms && partitionMetresEstimated
          ? makeEvidence(text, meetingRooms.index, meetingRooms.index + meetingRooms[0].length)
          : null,
    },
    {
      key: "acousticSqm",
      applicable: needsAcoustic,
      found: acousticArea !== undefined,
      value: acousticArea ? acousticArea.value : null,
      display: acousticArea ? `${acousticArea.value} sqm` : "not stated",
      evidence: acousticArea ? acousticArea.evidence : null,
    },
    {
      key: "sites",
      applicable: needsSites,
      found: siteHit !== null && siteHit.value > 1,
      value: sites,
      display: sites > 1 ? `${sites} sites` : "1 site",
      evidence: siteHit ? siteHit.evidence : null,
    },
    {
      key: "deadline",
      applicable: true,
      found: deadline !== null,
      value: null,
      display: deadline ? `${deadline.label} (${deadline.iso})` : "not stated",
      evidence: deadline ? deadline.evidence : null,
    },
    {
      key: "budget",
      applicable: true,
      found: budget !== null,
      value: budget ? budget.value : null,
      display: budget ? `EUR ${budget.value.toLocaleString("en-GB")}` : "not stated",
      evidence: budget ? budget.evidence : null,
    },
  ];

  const fields: ExtractedField[] = definitions.map((d) => ({
    key: d.key,
    label: FIELD_LABELS[d.key],
    found: d.found,
    applicable: d.applicable,
    weight: FIELD_WEIGHTS[d.key],
    value: d.value,
    display: d.display,
    evidence: d.evidence,
    question: FIELD_QUESTIONS[d.key],
  }));

  const applicableFields = fields.filter((f) => f.applicable);
  const applicableWeight = applicableFields.reduce((sum, f) => sum + f.weight, 0);
  const foundWeight = applicableFields.filter((f) => f.found).reduce((sum, f) => sum + f.weight, 0);
  const confidence = applicableWeight === 0 ? 0 : clamp(foundWeight / applicableWeight, 0, 1);
  const missing = applicableFields.filter((f) => !f.found);

  const priceableLines =
    (areaSqm !== null ? 1 : 0) +
    (partitionMetres !== null && needsPartitions ? 1 : 0) +
    (acousticArea !== undefined ? 1 : 0) +
    (workstationHit !== null && needsWorkstations && scopeTags.length > 0 ? 1 : 0);

  // A message that asks for a price but carries almost nothing measurable is an
  // unqualified enquiry, not a quote request. The label follows the measurement.
  if (intent === "quote_request" && confidence < CONFIDENCE_THRESHOLD) intent = "vague_enquiry";

  let quotable = confidence >= CONFIDENCE_THRESHOLD && priceableLines > 0;
  let blockReason: string | null = null;

  if (intent === "quote_chase") {
    quotable = false;
    blockReason = quoteRefMatch
      ? `This message follows up on quote ${quoteRefMatch[0]}, which is already issued. There are no new quantities to price.`
      : "This message follows up on a quote that is already issued. There are no new quantities to price.";
  } else if (!quotable) {
    blockReason = `Extraction confidence ${Math.round(confidence * 100)} percent is below the ${Math.round(
      CONFIDENCE_THRESHOLD * 100,
    )} percent threshold. The copilot will not invent quantities, so this message is handed to you with the questions below.`;
  }

  return {
    intent,
    intentLabel: INTENT_LABELS[intent],
    fields,
    scope,
    areaSqm,
    areaPerSite,
    workstations: workstationHit ? workstationHit.value : null,
    partitionMetres,
    partitionMetresEstimated,
    acousticSqm: acousticArea ? acousticArea.value : null,
    sites,
    deadlineIso: deadline ? deadline.iso : null,
    deadlineLabel: deadline ? deadline.label : null,
    budgetEur: budget ? budget.value : null,
    quoteReference: quoteRefMatch ? quoteRefMatch[0] : null,
    confidence: round(confidence, 3),
    foundWeight: round(foundWeight, 3),
    applicableWeight: round(applicableWeight, 3),
    missing,
    clarifyingQuestions: missing.map((f) => f.question),
    quotable,
    blockReason,
  };
}
