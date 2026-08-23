/**
 * Style profiler.
 *
 * Reads a corpus of the user's own sent mail and measures it. Nothing here is
 * hardcoded to a particular writer: remove messages from the corpus and every
 * number below moves, because every number is computed from the text that is
 * still there.
 */

import type { SentEmail } from "../data/sentCorpus";
import {
  PHRASE_LEADING_REJECT,
  PHRASE_TRAILING_REJECT,
  STOPWORDS,
  countContractions,
  countWords,
  formalityIndex,
  formalityLabel,
  mean,
  round,
  scoreLexicon,
  splitSentences,
  stdDev,
  tokenize,
} from "./text";

export interface DistributionEntry {
  pattern: string;
  count: number;
  share: number;
}

export interface RecurringPhrase {
  phrase: string;
  count: number;
  documentFrequency: number;
  size: number;
}

export interface StyleProfile {
  sampleSize: number;
  meanSentenceLength: number;
  sdSentenceLength: number;
  sentenceCount: number;
  meanWordsPerMessage: number;
  meanParagraphs: number;
  greetings: DistributionEntry[];
  signOffs: DistributionEntry[];
  contractionRate: number;
  contractionsUsed: number;
  contractionOpportunities: number;
  lexicalFormality: number;
  formalHits: number;
  informalHits: number;
  formalityIndex: number;
  formalityLabel: string;
  recurringPhrases: RecurringPhrase[];
  questionRate: number;
}

/** A sent message split into the three parts the profiler treats differently. */
export interface ParsedEmail {
  greeting: string | null;
  greetingPattern: string | null;
  paragraphs: string[];
  bodyText: string;
  signOff: string | null;
}

const GREETING_OPENERS = [
  "good morning",
  "good afternoon",
  "good evening",
  "hi",
  "hello",
  "hey",
  "dear",
  "morning",
];

/**
 * Recognise the opening line as a greeting and normalise the recipient name to
 * the token {first}, so "Hi Marc," and "Hi Sofia," collapse to one pattern.
 */
export function parseGreeting(firstLine: string): string | null {
  const trimmed = firstLine.trim().replace(/[,:!]+$/, "");
  const lower = trimmed.toLowerCase();
  const opener = GREETING_OPENERS.filter((o) => lower === o || lower.startsWith(o + " ")).sort(
    (a, b) => b.length - a.length,
  )[0];
  if (!opener) return null;

  const rest = trimmed.slice(opener.length).trim();
  const displayOpener = trimmed.slice(0, opener.length);
  if (rest.length === 0) return displayOpener;

  const namesReplaced = rest
    .split(/\s+/)
    .map((word) => (/^[A-Z][a-zà-ÿ'-]*$/.test(word) ? "{first}" : word))
    .join(" ");
  return displayOpener + " " + namesReplaced;
}

/**
 * Find the sign-off by walking back from the signature line. The closing line
 * sits directly above the line carrying the author's own name. Job title and
 * company lines below the name are tolerated, so a full signature block does
 * not defeat the parser.
 */
export function parseSignOff(
  lines: string[],
  authorFirstName: string,
): { signOff: string; lineIndex: number } | null {
  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (nonEmpty.length < 2) return null;
  const first = authorFirstName.toLowerCase();
  const floor = Math.max(1, nonEmpty.length - 4);

  for (let i = nonEmpty.length - 1; i >= floor; i -= 1) {
    const line = nonEmpty[i];
    const isNameLine =
      line.split(/\s+/).length <= 3 &&
      !/[.!?]$/.test(line) &&
      line.toLowerCase().startsWith(first);
    if (!isNameLine) continue;

    const candidate = nonEmpty[i - 1].replace(/[,.]+$/, "").trim();
    if (candidate.split(/\s+/).length > 4) return null;
    if (/[?!]$/.test(candidate)) return null;
    return { signOff: candidate, lineIndex: i - 1 };
  }
  return null;
}

export function parseEmail(email: SentEmail, authorFirstName: string): ParsedEmail {
  const lines = email.body.split("\n");
  const greetingPattern = parseGreeting(lines[0] ? lines[0] : "");
  const signOffHit = parseSignOff(lines, authorFirstName);
  const signOff = signOffHit ? signOffHit.signOff : null;

  const nonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  let start = 0;
  let end = nonEmpty.length;
  if (greetingPattern) start = 1;
  if (signOffHit) end = signOffHit.lineIndex;

  const bodyLines = nonEmpty.slice(start, end);

  // Paragraphs are the blank line separated blocks of the body only.
  const blocks = email.body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
  const bodyBlocks = blocks.filter((block) => {
    const firstLineOfBlock = block.split("\n")[0].trim();
    if (greetingPattern && parseGreeting(firstLineOfBlock)) return false;
    if (signOff && block.replace(/[,.]+/g, "").trim().split("\n")[0].trim() === signOff) return false;
    return true;
  });

  return {
    greeting: lines[0] ? lines[0].trim() : null,
    greetingPattern,
    paragraphs: bodyBlocks,
    bodyText: bodyLines.join(" "),
    signOff,
  };
}

function toDistribution(counts: Map<string, number>, total: number): DistributionEntry[] {
  return Array.from(counts.entries())
    .map(([pattern, count]) => ({ pattern, count, share: total === 0 ? 0 : count / total }))
    .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern));
}

/**
 * N-gram counting with a stopword aware filter. An n-gram survives only if at
 * least one token carries meaning, and only if it does not open or close on a
 * pronoun, article or auxiliary. That drops "of the" and "i am happy" while
 * keeping "happy to" and "more than happy".
 */
function countNgrams(
  documents: string[][],
  size: number,
): Map<string, { count: number; docs: Set<number> }> {
  const counts = new Map<string, { count: number; docs: Set<number> }>();
  documents.forEach((tokens, docIndex) => {
    for (let i = 0; i + size <= tokens.length; i += 1) {
      const gram = tokens.slice(i, i + size);
      if (gram.every((t) => STOPWORDS.has(t))) continue;
      if (PHRASE_LEADING_REJECT.has(gram[0])) continue;
      if (PHRASE_TRAILING_REJECT.has(gram[gram.length - 1])) continue;
      const key = gram.join(" ");
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
        existing.docs.add(docIndex);
      } else {
        counts.set(key, { count: 1, docs: new Set([docIndex]) });
      }
    }
  });
  return counts;
}

/** Longest run of tokens shared by two phrases, used to remove near duplicates. */
function longestContiguousOverlap(a: string[], b: string[]): number {
  let best = 0;
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      let run = 0;
      while (i + run < a.length && j + run < b.length && a[i + run] === b[j + run]) run += 1;
      if (run > best) best = run;
    }
  }
  return best;
}

function contains(longer: string, shorter: string): boolean {
  return (" " + longer + " ").includes(" " + shorter + " ");
}

/**
 * Bigram, trigram and four-gram frequencies, deduplicated. Candidates are
 * visited most frequent first. A candidate whose longest shared run of tokens
 * accounts for half or more of either phrase is treated as the same habit and
 * dropped, unless it fully contains the kept phrase and is strictly more
 * frequent, in which case it replaces it.
 */
function extractRecurringPhrases(documents: string[][], limit: number): RecurringPhrase[] {
  const collected: RecurringPhrase[] = [];
  for (const size of [2, 3, 4]) {
    const counts = countNgrams(documents, size);
    counts.forEach((value, phrase) => {
      if (value.count < 2 || value.docs.size < 2) return;
      collected.push({ phrase, count: value.count, documentFrequency: value.docs.size, size });
    });
  }

  const ranked = collected.sort(
    (a, b) =>
      b.count - a.count ||
      b.documentFrequency - a.documentFrequency ||
      a.size - b.size ||
      a.phrase.localeCompare(b.phrase),
  );

  const kept: RecurringPhrase[] = [];
  for (const candidate of ranked) {
    const candidateTokens = candidate.phrase.split(" ");
    let rejected = false;
    for (let k = 0; k < kept.length; k += 1) {
      const existing = kept[k];
      const existingTokens = existing.phrase.split(" ");
      const overlap = longestContiguousOverlap(candidateTokens, existingTokens);
      const sameHabit =
        overlap / candidateTokens.length >= 0.5 || overlap / existingTokens.length >= 0.5;
      if (!sameHabit) continue;
      if (contains(candidate.phrase, existing.phrase) && candidate.count > existing.count) {
        kept[k] = candidate;
      }
      rejected = true;
      break;
    }
    if (!rejected) kept.push(candidate);
  }

  return kept.slice(0, limit);
}

export function buildStyleProfile(corpus: SentEmail[], authorFirstName: string): StyleProfile {
  if (corpus.length === 0) {
    return {
      sampleSize: 0,
      meanSentenceLength: 0,
      sdSentenceLength: 0,
      sentenceCount: 0,
      meanWordsPerMessage: 0,
      meanParagraphs: 0,
      greetings: [],
      signOffs: [],
      contractionRate: 0,
      contractionsUsed: 0,
      contractionOpportunities: 0,
      lexicalFormality: 0.5,
      formalHits: 0,
      informalHits: 0,
      formalityIndex: 0.5,
      formalityLabel: formalityLabel(0.5),
      recurringPhrases: [],
      questionRate: 0,
    };
  }

  const parsed = corpus.map((email) => parseEmail(email, authorFirstName));

  const sentenceLengths: number[] = [];
  const paragraphCounts: number[] = [];
  const wordsPerMessage: number[] = [];
  const greetingCounts = new Map<string, number>();
  const signOffCounts = new Map<string, number>();
  const phraseDocuments: string[][] = [];
  let greetingTotal = 0;
  let signOffTotal = 0;
  let questionCount = 0;

  let allBodyText = "";

  for (const email of parsed) {
    const sentences = splitSentences(email.bodyText);
    sentences.forEach((s) => {
      sentenceLengths.push(countWords(s));
      if (s.trim().endsWith("?")) questionCount += 1;
    });
    paragraphCounts.push(email.paragraphs.length);
    wordsPerMessage.push(countWords(email.bodyText));
    allBodyText += " " + email.bodyText;
    phraseDocuments.push(tokenize(email.bodyText));

    if (email.greetingPattern) {
      greetingTotal += 1;
      greetingCounts.set(
        email.greetingPattern,
        (greetingCounts.get(email.greetingPattern) || 0) + 1,
      );
    }
    if (email.signOff) {
      signOffTotal += 1;
      signOffCounts.set(email.signOff, (signOffCounts.get(email.signOff) || 0) + 1);
    }
  }

  const contractions = countContractions(allBodyText);
  const lexicon = scoreLexicon(allBodyText);
  const meanSentence = mean(sentenceLengths);
  const index = formalityIndex(lexicon.score, contractions.rate, meanSentence);

  return {
    sampleSize: corpus.length,
    meanSentenceLength: round(meanSentence, 1),
    sdSentenceLength: round(stdDev(sentenceLengths), 1),
    sentenceCount: sentenceLengths.length,
    meanWordsPerMessage: round(mean(wordsPerMessage), 0),
    meanParagraphs: round(mean(paragraphCounts), 1),
    greetings: toDistribution(greetingCounts, greetingTotal),
    signOffs: toDistribution(signOffCounts, signOffTotal),
    contractionRate: round(contractions.rate, 3),
    contractionsUsed: contractions.contracted,
    contractionOpportunities: contractions.contracted + contractions.expanded,
    lexicalFormality: round(lexicon.score, 3),
    formalHits: lexicon.formalHits,
    informalHits: lexicon.informalHits,
    formalityIndex: round(index, 2),
    formalityLabel: formalityLabel(index),
    recurringPhrases: extractRecurringPhrases(phraseDocuments, 5),
    questionRate: round(sentenceLengths.length === 0 ? 0 : questionCount / sentenceLengths.length, 3),
  };
}

/** Metrics of a single candidate text, measured with the same functions. */
export interface TextMetrics {
  meanSentenceLength: number;
  paragraphs: number;
  contractionRate: number;
  /** How many contraction eligible constructions the text contains at all. */
  contractionOpportunities: number;
  formalityIndex: number;
  greetingPattern: string | null;
  signOff: string | null;
  wordCount: number;
}

export function measureText(text: string, authorFirstName: string): TextMetrics {
  const parsed = parseEmail(
    { id: "candidate", to: "", company: "", subject: "", date: "", body: text },
    authorFirstName,
  );
  const sentences = splitSentences(parsed.bodyText);
  const contractions = countContractions(parsed.bodyText);
  const lexicon = scoreLexicon(parsed.bodyText);
  const meanSentence = mean(sentences.map((s) => countWords(s)));
  return {
    meanSentenceLength: round(meanSentence, 1),
    paragraphs: parsed.paragraphs.length,
    contractionRate: round(contractions.rate, 3),
    contractionOpportunities: contractions.contracted + contractions.expanded,
    formalityIndex: round(formalityIndex(lexicon.score, contractions.rate, meanSentence), 2),
    greetingPattern: parsed.greetingPattern,
    signOff: parsed.signOff,
    wordCount: countWords(parsed.bodyText),
  };
}
