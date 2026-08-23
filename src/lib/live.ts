/**
 * Optional live mode.
 *
 * When the settings drawer is switched to "Claude API (live)" and a key is
 * present, the draft is written by Claude instead of by the local composer. The
 * model is given the measured style profile as structured data and is asked to
 * return JSON matching the local engine's contract, so the same interface
 * renders both modes.
 *
 * The quote is never routed through the model. Line items, the rate card, the
 * build up and every total stay in local TypeScript in both modes.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Extraction } from "../engine/extract";
import type { StyleProfile } from "../engine/styleProfile";

export const LIVE_KEY_STORAGE = "ae_anthropic_key";

export const LIVE_WARNING =
  "Your key is sent directly from this browser to the Anthropic API and is never sent to any Agentic Edge server. In production this call sits behind a server side proxy. Use a key with a low spend limit.";

const SYSTEM_PROMPT = `You are the drafting stage of an email copilot used by a commercial interiors contractor in Barcelona.

You will be given:
1. A measured style profile of the person you are writing as. Every number in it was computed from that person's own sent mail.
2. The requirements a local extraction engine pulled out of an inbound message, with a confidence score.
3. The inbound message itself.

Write the reply as that person would write it. Match the profile literally:
- Open with the most frequent greeting pattern, substituting the recipient's first name.
- Close with the most frequent sign-off, then the signature block you are given.
- Aim for the stated mean sentence length, give or take two words.
- Use contractions at roughly the stated rate, not more and not less.
- Work in one or two of the listed recurring phrases where they fit naturally.
- Keep the paragraph count close to the stated mean.

Hard rules:
- Never invent a quantity, a price, a date or a total. Use only what the extraction gives you.
- If the extraction confidence is below the stated threshold, do not attempt a price. Ask the listed clarifying questions instead, as a short list.
- Never use an em dash or an en dash. Use commas, colons, semicolons or a full stop.
- Write in English.

Return only a single JSON object, with no prose around it and no code fence:
{"draft": "the full reply including greeting and sign-off, with \\n for line breaks", "notes": "one short sentence on what you matched"}
The "draft" key must come first.`;

export interface LiveDraftInput {
  profile: StyleProfile;
  extraction: Extraction;
  messageBody: string;
  messageSubject: string;
  recipientFirstName: string;
  signatureBlock: string;
  confidenceThreshold: number;
}

function buildUserContent(input: LiveDraftInput): string {
  const p = input.profile;
  const profileJson = {
    sampleSize: p.sampleSize,
    meanSentenceLengthWords: p.meanSentenceLength,
    sdSentenceLengthWords: p.sdSentenceLength,
    meanParagraphs: p.meanParagraphs,
    greetingDistribution: p.greetings.map((g) => ({ pattern: g.pattern, share: Number(g.share.toFixed(2)) })),
    signOffDistribution: p.signOffs.map((s) => ({ pattern: s.pattern, share: Number(s.share.toFixed(2)) })),
    contractionRate: p.contractionRate,
    formalityIndex: p.formalityIndex,
    formalityLabel: p.formalityLabel,
    recurringPhrases: p.recurringPhrases.map((r) => r.phrase),
  };

  const e = input.extraction;
  const extractionJson = {
    intent: e.intent,
    confidence: e.confidence,
    confidenceThreshold: input.confidenceThreshold,
    quotable: e.quotable,
    areaSqm: e.areaSqm,
    workstations: e.workstations,
    partitionLinearMetres: e.partitionMetres,
    acousticSqm: e.acousticSqm,
    sites: e.sites,
    completionDate: e.deadlineIso,
    scope: e.scope.map((s) => s.label),
    missingFields: e.missing.map((f) => f.label),
    clarifyingQuestions: e.clarifyingQuestions,
  };

  return [
    "STYLE PROFILE (measured, do not argue with it):",
    JSON.stringify(profileJson, null, 2),
    "",
    "EXTRACTED REQUIREMENTS (from the local engine, the only facts you may use):",
    JSON.stringify(extractionJson, null, 2),
    "",
    "RECIPIENT FIRST NAME: " + input.recipientFirstName,
    "SUBJECT: " + input.messageSubject,
    "",
    "SIGNATURE BLOCK to end with, exactly:",
    input.signatureBlock,
    "",
    "INBOUND MESSAGE:",
    input.messageBody,
  ].join("\n");
}

/**
 * Pull the value of a string key out of a JSON document that is still
 * streaming, so the interface can show text arriving rather than a spinner.
 */
export function partialJsonString(buffer: string, key: string): string {
  const marker = '"' + key + '"';
  const keyIndex = buffer.indexOf(marker);
  if (keyIndex < 0) return "";
  const colon = buffer.indexOf(":", keyIndex + marker.length);
  if (colon < 0) return "";
  let i = colon + 1;
  while (i < buffer.length && /\s/.test(buffer[i])) i += 1;
  if (buffer[i] !== '"') return "";
  i += 1;

  let out = "";
  while (i < buffer.length) {
    const ch = buffer[i];
    if (ch === "\\") {
      const next = buffer[i + 1];
      if (next === undefined) break;
      if (next === "n") out += "\n";
      else if (next === "t") out += "\t";
      else if (next === "r") out += "";
      else out += next;
      i += 2;
      continue;
    }
    if (ch === '"') break;
    out += ch;
    i += 1;
  }
  return out;
}

export interface LiveDraftOutput {
  draft: string;
  notes: string;
}

export async function generateLiveDraft(
  apiKey: string,
  input: LiveDraftInput,
  onPartial: (text: string) => void,
): Promise<LiveDraftOutput> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true,
    defaultHeaders: { "anthropic-dangerous-direct-browser-access": "true" },
  });

  const stream = client.messages.stream({
    model: "claude-opus-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserContent(input) }],
    // output_config is newer than the pinned SDK's type definitions, so it is
    // spread in. It is sent on the wire exactly as written and keeps the demo
    // call fast.
    ...({ output_config: { effort: "low" } } as object),
  });

  let buffer = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      buffer += event.delta.text;
      onPartial(partialJsonString(buffer, "draft"));
    }
  }

  const start = buffer.indexOf("{");
  const end = buffer.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Claude did not return a JSON object.");
  const parsed = JSON.parse(buffer.slice(start, end + 1)) as Partial<LiveDraftOutput>;
  if (typeof parsed.draft !== "string" || parsed.draft.trim().length === 0) {
    throw new Error("Claude returned JSON without a draft.");
  }
  return { draft: parsed.draft, notes: typeof parsed.notes === "string" ? parsed.notes : "" };
}
