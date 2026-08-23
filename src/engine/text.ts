/**
 * Text primitives shared by the style profiler, the composer and the scorer.
 * Pure TypeScript. No React, no side effects.
 */

export const STOPWORDS = new Set([
  "a", "about", "am", "an", "and", "any", "are", "as", "at", "be", "been",
  "being", "but", "by", "can", "could", "did", "do", "does", "for", "from",
  "had", "has", "have", "he", "her", "here", "him", "his", "i", "if", "in",
  "into", "is", "it", "its", "may", "me", "might", "must", "my", "no", "not",
  "of", "on", "once", "or", "our", "out", "over", "shall", "she", "should",
  "so", "that", "the", "their", "them", "then", "there", "these", "they",
  "this", "those", "to", "too", "up", "us", "very", "was", "we", "were",
  "what", "when", "where", "which", "while", "who", "whom", "why", "will",
  "with", "would", "you", "your",
  "all", "also", "both", "each", "just", "many", "more", "most", "much",
  "only", "other", "own", "same", "some", "such", "than", "well",
]);

/**
 * An n-gram that opens with one of these is a sentence fragment, not a phrase.
 * "i am happy" and "am happy to" are noise; "happy to" is the real habit.
 */
export const PHRASE_LEADING_REJECT = new Set([
  "i", "we", "you", "they", "he", "she", "it", "me", "us", "him", "her", "them",
  "that", "this", "these", "those", "the", "a", "an", "and", "but", "or", "so",
  "am", "is", "are", "was", "were", "be", "been", "have", "has", "had", "do",
  "does", "did", "will", "would", "can", "could", "should", "of", "in", "on",
  "at", "to", "for", "with", "as", "by", "from", "if", "which", "who",
]);

/** An n-gram that closes on one of these is also a fragment. */
export const PHRASE_TRAILING_REJECT = new Set([
  "i", "we", "you", "they", "he", "she", "it", "me", "us", "him", "her", "them",
  "the", "a", "an", "this", "that", "these", "those", "my", "our", "your",
  "their", "his", "its", "and", "but", "or",
  "if", "when", "while", "because", "although", "as", "at", "by", "from",
  "in", "into", "on", "with", "of", "for",
]);

/** Abbreviations that end in a full stop but do not end a sentence. */
const ABBREVIATIONS = [
  "e.g.", "i.e.", "etc.", "no.", "approx.", "vs.", "mr.", "mrs.", "ms.", "dr.",
  "sq.", "st.", "ext.", "ref.",
];

const ABBREV_TOKEN = "";

/**
 * Split a block of prose into sentences. Abbreviations are masked first so a
 * full stop inside "e.g." does not create a false sentence boundary.
 */
export function splitSentences(text: string): string[] {
  let masked = text;
  ABBREVIATIONS.forEach((abbr, index) => {
    const pattern = new RegExp(escapeRegex(abbr), "gi");
    masked = masked.replace(pattern, abbr.replace(/\./g, ABBREV_TOKEN + index + ABBREV_TOKEN));
  });

  const parts = masked
    .split(/(?<=[.!?])[\s\n]+/)
    .map((s) => s.replace(new RegExp(ABBREV_TOKEN + "\\d+" + ABBREV_TOKEN, "g"), "."))
    .map((s) => s.trim())
    .filter((s) => countWords(s) > 0);

  return parts;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word tokens. Keeps apostrophes so contractions survive as single tokens. */
export function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-zÀ-ſ]+(?:'[a-z]+)?/g);
  return matches ? matches : [];
}

export function countWords(text: string): number {
  return tokenize(text).length;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) * (v - m), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function round(value: number, places: number): number {
  const factor = Math.pow(10, places);
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Contraction pairs. The left side is the contracted form, the right side is
 * the expanded form. Both directions are needed: the profiler counts how often
 * the writer took each option, and the composer rewrites a draft to match the
 * measured rate.
 */
export const CONTRACTION_PAIRS: Array<{ short: string; long: string }> = [
  { short: "I'm", long: "I am" },
  { short: "I'll", long: "I will" },
  { short: "I've", long: "I have" },
  { short: "I'd", long: "I would" },
  { short: "we're", long: "we are" },
  { short: "we'll", long: "we will" },
  { short: "we've", long: "we have" },
  { short: "we'd", long: "we would" },
  { short: "you're", long: "you are" },
  { short: "you'll", long: "you will" },
  { short: "you've", long: "you have" },
  { short: "they're", long: "they are" },
  { short: "they'll", long: "they will" },
  { short: "it's", long: "it is" },
  { short: "that's", long: "that is" },
  { short: "there's", long: "there is" },
  { short: "here's", long: "here is" },
  { short: "let's", long: "let us" },
  { short: "don't", long: "do not" },
  { short: "doesn't", long: "does not" },
  { short: "didn't", long: "did not" },
  { short: "won't", long: "will not" },
  { short: "can't", long: "cannot" },
  { short: "isn't", long: "is not" },
  { short: "aren't", long: "are not" },
  { short: "wasn't", long: "was not" },
  { short: "weren't", long: "were not" },
  { short: "haven't", long: "have not" },
  { short: "hasn't", long: "has not" },
  { short: "shouldn't", long: "should not" },
  { short: "couldn't", long: "could not" },
  { short: "wouldn't", long: "would not" },
];

export interface ContractionCount {
  contracted: number;
  expanded: number;
  /** contracted / (contracted + expanded), or 0 when no eligible construction exists */
  rate: number;
}

/**
 * Count contractions against contraction eligible constructions. The rate is
 * a share of opportunities taken, not a raw frequency, so a short email and a
 * long one contribute on the same scale.
 */
export function countContractions(text: string): ContractionCount {
  let contracted = 0;
  let expanded = 0;

  for (const pair of CONTRACTION_PAIRS) {
    const shortHits = text.match(new RegExp("\\b" + escapeRegex(pair.short) + "\\b", "gi"));
    if (shortHits) contracted += shortHits.length;
    const longHits = text.match(new RegExp("\\b" + escapeRegex(pair.long) + "\\b", "gi"));
    if (longHits) expanded += longHits.length;
  }

  const eligible = contracted + expanded;
  return { contracted, expanded, rate: eligible === 0 ? 0 : contracted / eligible };
}

/** Words that push a text towards a formal register. */
export const FORMAL_LEXICON: Record<string, number> = {
  regarding: 1, kindly: 1.2, further: 0.6, furthermore: 1.2, accordingly: 1.2,
  herewith: 1.5, subsequently: 1.2, therefore: 1, additionally: 1,
  pursuant: 1.5, confirm: 0.6, confirmation: 0.7, provide: 0.6, request: 0.5,
  require: 0.6, sincerely: 1.2, respectfully: 1.2, enclosed: 0.9,
  aforementioned: 1.5, remain: 0.8, hereby: 1.5, whilst: 0.9, shall: 1,
  proceed: 0.7, forthcoming: 0.9, appreciate: 0.5, advise: 0.6,
};

/** Words that push a text towards a casual register. */
export const INFORMAL_LEXICON: Record<string, number> = {
  thanks: 0.7, cheers: 1.2, quick: 0.8, quickly: 0.6, just: 0.7, happy: 0.6,
  great: 0.8, sure: 0.6, fine: 0.5, bit: 0.9, grab: 1, chat: 1, sorted: 1.1,
  ok: 1, okay: 1, stuff: 1.1, keen: 0.8, nice: 0.8, lovely: 1, fab: 1.3,
  really: 0.6, pretty: 0.7, anyway: 0.8, gotcha: 1.4,
};

export interface LexiconScore {
  formalHits: number;
  informalHits: number;
  /** 0 casual, 1 formal, 0.5 when the two registers cancel out */
  score: number;
}

export function scoreLexicon(text: string): LexiconScore {
  const tokens = tokenize(text);
  let formal = 0;
  let informal = 0;
  for (const token of tokens) {
    if (FORMAL_LEXICON[token]) formal += FORMAL_LEXICON[token];
    if (INFORMAL_LEXICON[token]) informal += INFORMAL_LEXICON[token];
  }
  const total = formal + informal;
  const score = total === 0 ? 0.5 : (formal - informal) / total / 2 + 0.5;
  return { formalHits: round(formal, 2), informalHits: round(informal, 2), score };
}

/**
 * Formality index. Three measured signals, weighted:
 *   45 percent lexical register, 30 percent how often contractions are avoided,
 *   25 percent sentence length mapped from 8 words (casual) to 22 words (formal).
 */
export function formalityIndex(
  lexical: number,
  contractionRate: number,
  meanSentenceLength: number,
): number {
  const contractionSignal = 1 - contractionRate;
  const lengthSignal = clamp((meanSentenceLength - 8) / 14, 0, 1);
  return clamp(0.45 * lexical + 0.3 * contractionSignal + 0.25 * lengthSignal, 0, 1);
}

export function formalityLabel(index: number): string {
  if (index < 0.3) return "casual direct";
  if (index < 0.5) return "conversational professional";
  if (index < 0.7) return "measured formal";
  return "formal";
}

/**
 * Deterministic pseudo random generator (mulberry32). The composer samples the
 * learned greeting and sign-off distributions, so it needs randomness that is
 * reproducible: the same message always produces the same draft, which is what
 * a repeatable screen recording requires.
 */
export function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
