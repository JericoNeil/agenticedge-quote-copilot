/**
 * Draft composer and style scorer.
 *
 * The composer is not a template with holes. It does four things that depend on
 * measured data:
 *   1. it samples the greeting and the sign-off from the learned distributions,
 *   2. it picks between phrasings of different lengths to steer the draft's mean
 *      sentence length towards the writer's own,
 *   3. it injects the writer's own recurring phrases where a slot accepts one,
 *   4. it rewrites expanded forms into contractions until the draft's
 *      contraction rate matches the measured rate.
 *
 * The content slots are filled from the extracted requirements, so the message
 * drives what is said and the profile drives how it is said. The draft is then
 * measured with the same functions used on the corpus and scored honestly.
 */

import type { Extraction, Intent } from "./extract";
import type { Quote } from "./quote";
import { formatEur, formatLongDate } from "./quote";
import type { DistributionEntry, StyleProfile, TextMetrics } from "./styleProfile";
import { measureText } from "./styleProfile";
import {
  CONTRACTION_PAIRS,
  clamp,
  countWords,
  escapeRegex,
  hashString,
  makeRng,
  round,
  splitSentences,
} from "./text";

export const PIPELINE_STAGES = [
  "Reading message",
  "Extracting requirements",
  "Matching sender style profile",
  "Composing draft",
  "Scoring style match",
];

export interface StyleScoreComponent {
  key: string;
  label: string;
  weight: number;
  score: number;
  detail: string;
}

export interface StyleScore {
  overall: number;
  components: StyleScoreComponent[];
}

export interface ComposedDraft {
  subject: string;
  text: string;
  greeting: string;
  signOff: string;
  phrasesUsed: string[];
  targetSentenceLength: number;
  metrics: TextMetrics;
  score: StyleScore;
}

export interface ComposeContext {
  messageId: string;
  subject: string;
  recipientFirstName: string;
  recipientCompany: string;
  extraction: Extraction;
  quote: Quote | null;
  today: Date;
  authorName: string;
  authorTitle: string;
  authorCompany: string;
}

/* ------------------------------------------------------------------ dates */

function fromIso(iso: string): Date {
  const parts = iso.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoOf(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export interface ProgrammeEstimate {
  onSiteWeeks: number;
  procurementWeeks: number;
  decisionByIso: string | null;
  feasible: boolean;
  weeksAvailable: number | null;
}

/**
 * A small, explicit programme model. On site duration grows with floor area and
 * with the trades in scope; procurement is a flat three weeks. Working back
 * from the client's own completion date gives the date an instruction is needed
 * by, which is the single most useful sentence in a reply of this kind.
 */
export function estimateProgramme(extraction: Extraction, today: Date): ProgrammeEstimate {
  const tags = extraction.scope.map((s) => s.tag);
  const area = extraction.areaSqm !== null ? extraction.areaSqm : 0;

  if (extraction.intent === "scope_change") {
    const sqm = extraction.acousticSqm !== null ? extraction.acousticSqm : 0;
    const installDays = Math.max(1, Math.ceil(sqm / 24));
    const leadDays = 14;
    const deadline = extraction.deadlineIso ? fromIso(extraction.deadlineIso) : null;
    const decisionBy = deadline ? addDays(deadline, -(leadDays + installDays)) : null;
    return {
      onSiteWeeks: round(installDays / 5, 1),
      procurementWeeks: 2,
      decisionByIso: decisionBy ? isoOf(decisionBy) : null,
      feasible: decisionBy ? decisionBy.getTime() >= today.getTime() : true,
      weeksAvailable: deadline
        ? round((deadline.getTime() - today.getTime()) / (7 * 86400000), 1)
        : null,
    };
  }

  const extras = (tags.includes("partitions") ? 1 : 0) + (tags.includes("demolition") ? 1 : 0);
  const onSiteWeeks = Math.max(4, Math.ceil(area / 120) + extras + 1);
  const procurementWeeks = 3;
  const deadline = extraction.deadlineIso ? fromIso(extraction.deadlineIso) : null;
  const decisionBy = deadline ? addDays(deadline, -(onSiteWeeks + procurementWeeks) * 7) : null;

  return {
    onSiteWeeks,
    procurementWeeks,
    decisionByIso: decisionBy ? isoOf(decisionBy) : null,
    feasible: decisionBy ? decisionBy.getTime() >= today.getTime() : true,
    weeksAvailable: deadline
      ? round((deadline.getTime() - today.getTime()) / (7 * 86400000), 1)
      : null,
  };
}

/* -------------------------------------------------------------- sampling */

/** Sample one entry from a measured distribution with a reproducible generator. */
function sampleDistribution(entries: DistributionEntry[], rng: () => number, fallback: string): DistributionEntry {
  if (entries.length === 0) return { pattern: fallback, count: 0, share: 0 };
  const roll = rng();
  let cumulative = 0;
  for (const entry of entries) {
    cumulative += entry.share;
    if (roll <= cumulative) return entry;
  }
  return entries[entries.length - 1];
}

/* --------------------------------------------------- contraction rewriting */

/**
 * Rewrite expanded forms into contractions until the text's contraction rate
 * matches the target. Positions are spread across the text rather than taken
 * from the top, so the register is even from first line to last.
 */
export function applyContractionRate(text: string, targetRate: number): string {
  interface Hit {
    start: number;
    end: number;
    short: string;
  }
  const hits: Hit[] = [];
  for (const pair of CONTRACTION_PAIRS) {
    const re = new RegExp("\\b" + escapeRegex(pair.long) + "\\b", "g");
    let match = re.exec(text);
    while (match !== null) {
      hits.push({ start: match.index, end: match.index + match[0].length, short: pair.short });
      match = re.exec(text);
    }
  }
  hits.sort((a, b) => a.start - b.start);

  const nonOverlapping: Hit[] = [];
  let lastEnd = -1;
  for (const hit of hits) {
    if (hit.start >= lastEnd) {
      nonOverlapping.push(hit);
      lastEnd = hit.end;
    }
  }
  if (nonOverlapping.length === 0) return text;

  const target = Math.round(clamp(targetRate, 0, 1) * nonOverlapping.length);
  if (target === 0) return text;

  const chosen = new Set<number>();
  const step = nonOverlapping.length / target;
  for (let i = 0; i < target; i += 1) {
    chosen.add(Math.min(nonOverlapping.length - 1, Math.floor(i * step + step / 2)));
  }

  let output = "";
  let cursor = 0;
  nonOverlapping.forEach((hit, index) => {
    if (!chosen.has(index)) return;
    const original = text.slice(hit.start, hit.end);
    let replacement = hit.short;
    if (/^[A-Z]/.test(original)) replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
    output += text.slice(cursor, hit.start) + replacement;
    cursor = hit.end;
  });
  output += text.slice(cursor);
  return output;
}

/* ------------------------------------------------------- sentence targeting */

interface Slot {
  id: string;
  /** Slots sharing a group number are joined into one paragraph. */
  group: number;
  variants: string[];
}

/**
 * Greedy selection. For each slot, take the phrasing that moves the running
 * mean sentence length closest to the writer's measured mean.
 */
function selectVariants(slots: Slot[], targetMean: number): string[] {
  let runningWords = 0;
  let runningSentences = 0;
  const chosen: string[] = [];

  for (const slot of slots) {
    let best = slot.variants[0];
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const variant of slot.variants) {
      const sentences = splitSentences(variant);
      const words = sentences.reduce((sum, s) => sum + countWords(s), 0);
      const totalSentences = runningSentences + sentences.length;
      if (totalSentences === 0) continue;
      const projected = (runningWords + words) / totalSentences;
      const distance = Math.abs(projected - targetMean);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = variant;
      }
    }
    const bestSentences = splitSentences(best);
    runningWords += bestSentences.reduce((sum, s) => sum + countWords(s), 0);
    runningSentences += bestSentences.length;
    chosen.push(best);
  }
  return chosen;
}

/* ---------------------------------------------------------- phrase slots */

interface PhraseContext {
  intent: Intent;
  extraction: Extraction;
  quote: Quote | null;
  programme: ProgrammeEstimate;
}

/**
 * Sentences that carry one of the writer's own recurring phrases. Only phrases
 * the profiler actually found are offered, so removing messages from the corpus
 * changes which of these can appear.
 */
const PHRASE_TEMPLATES: Record<string, (ctx: PhraseContext) => string | null> = {
  "happy to": (ctx) => {
    if (ctx.intent === "quote_chase") return "I am happy to go through their price with you line by line.";
    if (ctx.intent === "vague_enquiry") return "I am happy to visit the space first if that is easier.";
    return "I am happy to walk you through the build up line by line.";
  },
  "let me know": (ctx) => {
    if (ctx.intent === "vague_enquiry") return "Let me know what suits and I will hold a slot this week.";
    if (ctx.intent === "scope_change") return "Let me know if you want the drawings reissued with the change marked up.";
    return "Let me know if you would like the programme sent across as well.";
  },
  "before iva": (ctx) =>
    ctx.quote
      ? `The subtotal before IVA is ${formatEur(ctx.quote.totals.taxableBase)} euros, so you can compare like for like.`
      : null,
  "fixed price": (ctx) =>
    ctx.intent === "quote_request" ? "The fixed price holds for thirty days from the issue date." : null,
  "completion date": (ctx) =>
    ctx.extraction.deadlineIso && ctx.programme.feasible
      ? `The completion date you have asked for is achievable on that basis.`
      : null,
};

/* ------------------------------------------------------------- body slots */

/** Shorter wording for the trades, for use inside a sentence rather than a table. */
const SCOPE_PROSE: Record<string, string> = {
  design: "design",
  demolition: "strip out",
  partitions: "partitions and glazing",
  flooring: "flooring",
  lighting: "lighting",
  electrical: "power and data",
  data: "power and data",
  acoustic: "acoustic treatment",
  furniture: "furniture install",
};

const SMALL_NUMBERS = [
  "zero", "one", "two", "three", "four", "five",
  "six", "seven", "eight", "nine", "ten",
];

/** Small counts read better as words in prose than as digits. */
function spellOut(value: number): string {
  return value >= 0 && value < SMALL_NUMBERS.length ? SMALL_NUMBERS[value] : String(value);
}

function joinList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

function scopeSentence(extraction: Extraction): string {
  const seen: string[] = [];
  extraction.scope.forEach((s) => {
    const prose = SCOPE_PROSE[s.tag];
    if (prose && !seen.includes(prose)) seen.push(prose);
  });
  if (seen.length === 0) return "the works you describe";
  return joinList(seen);
}

function buildSlots(ctx: ComposeContext, programme: ProgrammeEstimate): Slot[] {
  const e = ctx.extraction;
  const slots: Slot[] = [];
  const deadlineLong = e.deadlineIso ? formatLongDate(e.deadlineIso) : null;
  const decisionLong = programme.decisionByIso ? formatLongDate(programme.decisionByIso) : null;

  if (e.intent === "quote_request") {
    slots.push({
      id: "ack",
      group: 0,
      variants: [
        "Thank you for sending this over.",
        "Thank you for sending this over, there is enough detail here to price properly.",
        "Thank you for sending this over. There is enough detail in your message to put a firm price together without a survey first.",
      ],
    });

    const parts: string[] = [];
    if (e.areaSqm !== null) {
      parts.push(
        e.areaPerSite
          ? `${e.sites} units at roughly ${Math.round(e.areaSqm / e.sites)} square metres each`
          : `${e.areaSqm} square metres`,
      );
    }
    if (e.workstations !== null) parts.push(`${e.workstations} workstations`);
    if (e.partitionMetres !== null) parts.push(`${e.partitionMetres} linear metres of glazed partitioning`);
    const quantities = parts.length > 0 ? joinList(parts) : "the quantities you have given";
    slots.push({
      id: "readback",
      group: 0,
      variants: [
        `I have priced ${scopeSentence(e)} over ${quantities}.`,
        `I have priced ${scopeSentence(e)} across ${quantities}, using our current rate card.`,
        `I have priced ${scopeSentence(e)} across ${quantities}. Every figure is taken from your message, so tell me if any of them have moved.`,
      ],
    });

    if (ctx.quote) {
      slots.push({
        id: "price",
        group: 0,
        variants: [
          `The total is ${formatEur(ctx.quote.totals.total)} euros including IVA, quote ${ctx.quote.number}.`,
          `The total is ${formatEur(ctx.quote.totals.total)} euros including IVA, and the quote reference is ${ctx.quote.number}.`,
        ],
      });
    } else {
      slots.push({
        id: "price",
        group: 0,
        variants: [
          "The fixed price and the build up are attached.",
          "I have attached the fixed price with the build up, so you can see exactly where the money sits.",
        ],
      });
    }

    if (deadlineLong && decisionLong) {
      slots.push({
        id: "programme",
        group: 1,
        variants: [
          `You need this complete by ${deadlineLong}. To hold that we would need your instruction by ${decisionLong}.`,
          `You need this complete by ${deadlineLong}. That is ${programme.onSiteWeeks} weeks on site plus ${programme.procurementWeeks} weeks of procurement, so we would need your instruction by ${decisionLong}.`,
        ],
      });
    }

    const missingBudget = e.missing.find((f) => f.key === "budget");
    if (missingBudget) {
      slots.push({
        id: "gap",
        group: 1,
        variants: [
          "One thing I do not have is a budget range.",
          "One thing I do not have from you is a budget range, and it changes what I would recommend on the finishes.",
        ],
      });
    }
    return slots;
  }

  if (e.intent === "quote_chase") {
    slots.push({
      id: "ack",
      group: 0,
      variants: [
        "Thank you for coming back to me, and for being straight about the other price.",
        `Thank you for coming back to me on ${e.quoteReference ? e.quoteReference : "the quote"}, and for being straight about the other number.`,
      ],
    });
    slots.push({
      id: "position",
      group: 0,
      variants: [
        "I would rather show you where the difference sits than drop our number blind.",
        "I would rather show you where the difference sits than drop our number blind, because a gap that size is usually scope and not margin.",
      ],
    });
    slots.push({
      id: "action",
      group: 1,
      variants: [
        "Send me their summary and I will mark up what is in ours and not in theirs.",
        "If you can send me their summary, I will mark up line by line what is in our price and not in theirs, and where we can genuinely flex.",
      ],
    });
    slots.push({
      id: "commit",
      group: 1,
      variants: [
        "You will have that from me by Wednesday afternoon, ahead of your board.",
        "You will have that from me by Wednesday afternoon, which gives you a clear day before the board meets.",
      ],
    });
    return slots;
  }

  if (e.intent === "scope_change") {
    const sqm = e.acousticSqm !== null ? e.acousticSqm : 0;
    const installDays = Math.max(1, Math.ceil(sqm / 24));
    slots.push({
      id: "ack",
      group: 0,
      variants: [
        "Thank you for flagging this now rather than after the ceilings close.",
        "Thank you for flagging this now. Doing it before the ceilings close is far cheaper than coming back afterwards.",
      ],
    });
    slots.push({
      id: "readback",
      group: 0,
      variants: [
        `${sqm} square metres of acoustic panelling across the two rooms is straightforward.`,
        `${sqm} square metres of acoustic panelling across the two rooms is straightforward, and it will take the reverberation down noticeably.`,
      ],
    });
    slots.push({
      id: "programme",
      group: 1,
      variants: [
        `The panels are a two week lead time and ${installDays} days to install.`,
        `The panels are a two week lead time and ${installDays} days to install, so this sits inside the current programme rather than extending it.`,
      ],
    });
    slots.push({
      id: "cost",
      group: 1,
      variants: [
        "I will issue it as a variation on the current contract.",
        "I will issue it as a variation on the current contract, priced at our contract rate rather than as new work.",
      ],
    });
    if (decisionLong) {
      slots.push({
        id: "decision",
        group: 1,
        variants: [
          `I would need the variation signed by ${decisionLong}.`,
          `To keep it off the critical path I would need the variation signed by ${decisionLong}.`,
        ],
      });
    }
    return slots;
  }

  // vague_enquiry: the handoff. The copilot does not price and does not guess.
  slots.push({
    id: "ack",
    group: 0,
    variants: [
      "Thank you for getting in touch about the move.",
      "Thank you for getting in touch about the move, and for thinking of us.",
    ],
  });
  slots.push({
    id: "refuse",
    group: 0,
    variants: [
      "I could give you a number today, but it would be a guess and guesses tend to be wrong in both directions.",
      "I could give you a number today, but it would be a guess.",
    ],
  });
  slots.push({
    id: "questions",
    group: 1,
    variants: [
      `There are ${spellOut(e.clarifyingQuestions.length)} things I need before I can price anything:`,
      `Before I can price anything properly, there are ${spellOut(e.clarifyingQuestions.length)} things I need from you:`,
    ],
  });
  slots.push({
    id: "turnaround",
    group: 2,
    variants: [
      "Once I have those I can turn a fixed price around in two working days.",
      "Once I have those answers I can turn a fixed price around in two working days.",
    ],
  });
  return slots;
}

/* ------------------------------------------------------------- assembly */

export function composeDraft(ctx: ComposeContext, profile: StyleProfile): ComposedDraft {
  // Greeting and sign-off are drawn independently, each from its own measured
  // distribution. The seed is the message plus the recipient, so the same
  // correspondent always gets the same treatment and a re-take of the screen
  // recording is identical.
  const seedBase = ctx.messageId + "|" + ctx.recipientFirstName;
  const greetingRng = makeRng(hashString(seedBase + "|salutation"));
  const signOffRng = makeRng(hashString(seedBase + "|salutation|close"));
  const programme = estimateProgramme(ctx.extraction, ctx.today);

  const greetingEntry = sampleDistribution(profile.greetings, greetingRng, "Hi {first}");
  const signOffEntry = sampleDistribution(profile.signOffs, signOffRng, "Best regards");
  const greeting = greetingEntry.pattern.replace("{first}", ctx.recipientFirstName) + ",";

  const slots = buildSlots(ctx, programme);
  const chosen = selectVariants(slots, profile.meanSentenceLength);

  // Recurring phrase injection, in the order the profiler ranked them.
  const phraseCtx: PhraseContext = {
    intent: ctx.extraction.intent,
    extraction: ctx.extraction,
    quote: ctx.quote,
    programme,
  };
  const phrasesUsed: string[] = [];
  const closing: string[] = [];
  for (const phrase of profile.recurringPhrases) {
    if (phrasesUsed.length >= 2) break;
    const template = PHRASE_TEMPLATES[phrase.phrase];
    if (!template) continue;
    const sentence = template(phraseCtx);
    if (!sentence) continue;
    if (chosen.some((slot) => slot.toLowerCase().includes(phrase.phrase))) {
      phrasesUsed.push(phrase.phrase);
      continue;
    }
    closing.push(sentence);
    phrasesUsed.push(phrase.phrase);
  }

  // Slots sharing a group become one paragraph, in group order.
  const groups: number[] = [];
  slots.forEach((slot) => {
    if (!groups.includes(slot.group)) groups.push(slot.group);
  });

  const blocks: string[] = [];
  groups.forEach((group) => {
    const text = slots
      .map((slot, index) => ({ slot, text: chosen[index] }))
      .filter((entry) => entry.slot.group === group)
      .map((entry) => entry.text)
      .join(" ");
    if (text.trim().length > 0) blocks.push(text);

    // The handoff renders the clarifying questions as a list directly under the
    // sentence that introduces them, one line per missing field.
    const introducesQuestions = slots.some((slot) => slot.group === group && slot.id === "questions");
    if (introducesQuestions && ctx.extraction.clarifyingQuestions.length > 0) {
      blocks.push(ctx.extraction.clarifyingQuestions.map((q) => "- " + q).join("\n"));
    }
  });
  if (closing.length > 0) blocks.push(closing.join(" "));

  const contracted = applyContractionRate(blocks.join("\n\n"), profile.contractionRate);
  const signature = `${signOffEntry.pattern},\n${ctx.authorName}\n${ctx.authorTitle}, ${ctx.authorCompany}`;
  const text = `${greeting}\n\n${contracted}\n\n${signature}`;

  const metrics = measureText(text, ctx.authorName.split(" ")[0]);
  const score = scoreDraft(text, profile, { greetingEntry, signOffEntry, metrics });

  return {
    subject: ctx.subject.toLowerCase().startsWith("re:") ? ctx.subject : "Re: " + ctx.subject,
    text,
    greeting,
    signOff: signOffEntry.pattern,
    phrasesUsed,
    targetSentenceLength: profile.meanSentenceLength,
    metrics,
    score,
  };
}

/* --------------------------------------------------------------- scoring */

function proximity(actual: number, expected: number, tolerance: number): number {
  if (tolerance <= 0) return actual === expected ? 1 : 0;
  return clamp(1 - Math.abs(actual - expected) / tolerance, 0, 1);
}

export function scoreDraft(
  text: string,
  profile: StyleProfile,
  context: {
    greetingEntry: DistributionEntry;
    signOffEntry: DistributionEntry;
    metrics: TextMetrics;
  },
): StyleScore {
  const m = context.metrics;
  const lower = text.toLowerCase();
  const topGreetingShare = profile.greetings.length > 0 ? profile.greetings[0].share : 1;
  const topSignOffShare = profile.signOffs.length > 0 ? profile.signOffs[0].share : 1;

  const phrasesPresent = profile.recurringPhrases.filter((p) => lower.includes(p.phrase)).length;

  const components: StyleScoreComponent[] = [
    {
      key: "sentenceLength",
      label: "Sentence length",
      weight: 0.22,
      score: proximity(m.meanSentenceLength, profile.meanSentenceLength, Math.max(4, profile.sdSentenceLength)),
      detail: `${m.meanSentenceLength} words against a profile mean of ${profile.meanSentenceLength}`,
    },
    {
      key: "greeting",
      label: "Greeting",
      weight: 0.14,
      score: topGreetingShare === 0 ? 0 : clamp(context.greetingEntry.share / topGreetingShare, 0, 1),
      detail: `"${context.greetingEntry.pattern}" is used in ${Math.round(context.greetingEntry.share * 100)} percent of sent mail`,
    },
    {
      key: "signOff",
      label: "Sign-off",
      weight: 0.14,
      score: topSignOffShare === 0 ? 0 : clamp(context.signOffEntry.share / topSignOffShare, 0, 1),
      detail: `"${context.signOffEntry.pattern}" is used in ${Math.round(context.signOffEntry.share * 100)} percent of sent mail`,
    },
    {
      // A short reply has few contraction eligible constructions, so it cannot
      // land arbitrarily close to the profile rate. The tolerance widens to one
      // contraction step rather than treating quantisation as a style error.
      key: "contractions",
      label: "Contraction rate",
      weight: 0.15,
      score: proximity(
        m.contractionRate,
        profile.contractionRate,
        Math.max(0.15, 1 / Math.max(1, m.contractionOpportunities)),
      ),
      detail: `${Math.round(m.contractionRate * 100)} percent of ${m.contractionOpportunities} eligible constructions against a profile rate of ${Math.round(profile.contractionRate * 100)} percent`,
    },
    {
      key: "formality",
      label: "Formality",
      weight: 0.15,
      score: proximity(m.formalityIndex, profile.formalityIndex, 0.25),
      detail: `index ${m.formalityIndex} against a profile index of ${profile.formalityIndex}`,
    },
    {
      key: "phrases",
      label: "Recurring phrases",
      weight: 0.12,
      score: clamp(phrasesPresent / 2, 0, 1),
      detail:
        phrasesPresent > 0
          ? `${phrasesPresent} of the writer's own phrases appear in the draft`
          : "no learned phrase fitted this reply",
    },
    {
      key: "paragraphs",
      label: "Paragraph count",
      weight: 0.08,
      score: proximity(m.paragraphs, profile.meanParagraphs, 3),
      detail: `${m.paragraphs} paragraphs against a profile mean of ${profile.meanParagraphs}`,
    },
  ];

  const overall = components.reduce((sum, c) => sum + c.weight * c.score, 0);
  return { overall: round(overall, 3), components: components.map((c) => ({ ...c, score: round(c.score, 3) })) };
}
