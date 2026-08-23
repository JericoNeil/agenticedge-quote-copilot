/**
 * Engine self check.
 *
 * Two claims in this prototype deserve to be doubted: that the quote arithmetic
 * is correct, and that the style profile is measured from the corpus rather
 * than decorative. This script recomputes every figure in the quote
 * independently of the engine and compares, then asserts that changing the
 * corpus changes the profile.
 *
 * Run it with:
 *   npm run check
 */

import {
  RATE_CARD,
  PROJECT_MANAGEMENT_RATE,
  CONTINGENCY_RATE,
  IVA_RATE,
  VOLUME_DISCOUNT_TIERS,
  buildQuote,
  withQuantity,
  r2,
} from "../src/engine/quote";
import { extractRequirements, CONFIDENCE_THRESHOLD } from "../src/engine/extract";
import { buildStyleProfile, measureText } from "../src/engine/styleProfile";
import { composeDraft } from "../src/engine/compose";
import { INBOX, DEMO_TODAY } from "../src/data/inbox";
import { SENT_CORPUS, AUTHOR_FIRST_NAME, AUTHOR_FULL_NAME } from "../src/data/sentCorpus";

let failures = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`pass  ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${label}${detail ? `  ${detail}` : ""}`);
  }
}

const eur = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2 });

console.log("\n1. Extraction separates what can be quoted from what cannot\n");

const extractions = INBOX.map((m) => ({ m, e: extractRequirements(m.body, DEMO_TODAY) }));

// m1, m2 and m4 carry real requirements. m3 is a chase against a quote that
// already exists, so there is nothing to price, and m5 is too vague to price.
// Both of the latter must be refused, for different stated reasons.
const QUOTABLE = new Set(["m1", "m2", "m4"]);

for (const { m, e } of extractions) {
  const expected = QUOTABLE.has(m.id);
  check(
    `${m.id} "${m.subject.slice(0, 38)}" is ${expected ? "quotable" : "not quotable"}`,
    e.quotable === expected,
    `${e.intentLabel}, confidence ${(e.confidence * 100).toFixed(0)} percent, threshold ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}`,
  );
}

const chase = extractions.find((x) => x.m.id === "m3")!.e;
check("the chase is recognised as a chase rather than a new request", chase.intent === "quote_chase", chase.intentLabel);
check("the chase picks up the existing quote reference", chase.quoteReference !== null, chase.quoteReference ?? "none");

const vague = extractions.find((x) => x.m.id === "m5")!.e;
check(
  "the vague enquiry produces clarifying questions instead of a quote",
  vague.clarifyingQuestions.length >= 2,
  `${vague.clarifyingQuestions.length} questions`,
);
check(
  "the questions are derived from the fields that are actually missing",
  vague.missing.length > 0,
  `${vague.missing.length} missing fields`,
);
check("the refusal states a reason", vague.blockReason !== null);

console.log("\n2. Quote arithmetic, recomputed independently\n");

const rfq = extractions.find((x) => x.m.id === "m1")!;
const quote = buildQuote(rfq.e, {
  seed: rfq.m.id,
  today: DEMO_TODAY,
  clientName: "Test Client",
  clientCompany: "Test Co",
  projectTitle: "Test project",
});

for (const line of quote.lines) {
  const card = RATE_CARD.find((c) => c.key === line.key);
  const expected = card ? r2(line.quantity * card.rate) : NaN;
  check(
    `line ${line.key} equals quantity times rate`,
    Math.abs(line.total - expected) < 0.005,
    `${line.quantity} x ${card?.rate} = ${eur(expected)}`,
  );
}

const t = quote.totals;
const expectedSubtotal = r2(quote.lines.reduce((sum, l) => sum + l.total, 0));
check("subtotal is the sum of the lines", Math.abs(t.subtotal - expectedSubtotal) < 0.005, eur(t.subtotal));

const expectedPm = r2(expectedSubtotal * PROJECT_MANAGEMENT_RATE);
check(
  `project management is ${PROJECT_MANAGEMENT_RATE * 100} percent of subtotal`,
  Math.abs(t.projectManagement - expectedPm) < 0.005,
  eur(t.projectManagement),
);

const expectedContingency = r2(expectedSubtotal * CONTINGENCY_RATE);
check(
  `contingency is ${CONTINGENCY_RATE * 100} percent of subtotal`,
  Math.abs(t.contingency - expectedContingency) < 0.005,
  eur(t.contingency),
);

const expectedGross = r2(expectedSubtotal + expectedPm + expectedContingency);
check("gross before discount adds up", Math.abs(t.grossBeforeDiscount - expectedGross) < 0.005, eur(t.grossBeforeDiscount));

const areaForTier = rfq.e.areaSqm ?? 0;
const tier = VOLUME_DISCOUNT_TIERS.find((x) => areaForTier > x.thresholdSqm);
const expectedDiscount = tier ? r2(expectedGross * tier.rate) : 0;
check(
  "the volume discount matches the band for the floor area",
  Math.abs(t.discountAmount - expectedDiscount) < 0.005,
  `${areaForTier} sqm, ${tier ? tier.rate * 100 : 0} percent, ${eur(t.discountAmount)}`,
);

const expectedBase = r2(expectedGross - expectedDiscount);
check("taxable base is gross less discount", Math.abs(t.taxableBase - expectedBase) < 0.005, eur(t.taxableBase));

const expectedIva = r2(expectedBase * IVA_RATE);
check(`IVA is ${IVA_RATE * 100} percent of the taxable base`, Math.abs(t.iva - expectedIva) < 0.005, eur(t.iva));

const expectedTotal = r2(expectedBase + expectedIva);
check("total payable is base plus IVA", Math.abs(t.total - expectedTotal) < 0.005, eur(t.total));

check(
  "no total carries more than two decimals",
  [t.subtotal, t.projectManagement, t.contingency, t.discountAmount, t.taxableBase, t.iva, t.total].every(
    (v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6,
  ),
);

console.log("\n3. Editing a quantity recomputes the whole quote\n");

const areaLine = quote.lines.find((l) => l.unit === "sqm");
if (!areaLine) throw new Error("expected at least one area driven line");

const bigger = withQuantity(quote, areaLine.key, 700);
check("changing a quantity changes the subtotal", bigger.totals.subtotal !== quote.totals.subtotal);
check(
  "crossing 600 sqm moves the discount to the higher band",
  bigger.totals.discountRate > quote.totals.discountRate,
  `${(quote.totals.discountRate * 100).toFixed(0)} percent to ${(bigger.totals.discountRate * 100).toFixed(0)} percent`,
);
check(
  "the recomputed total still adds up",
  Math.abs(bigger.totals.total - r2(bigger.totals.taxableBase + bigger.totals.iva)) < 0.005,
  eur(bigger.totals.total),
);

const zeroed = withQuantity(quote, areaLine.key, 0);
check("a zero quantity is handled without producing NaN", Number.isFinite(zeroed.totals.total));

console.log("\n4. The style profile is measured, not declared\n");

const profile = buildStyleProfile(SENT_CORPUS, AUTHOR_FIRST_NAME);
check("the profile reports the real corpus size", profile.sampleSize === SENT_CORPUS.length, `${profile.sampleSize} messages`);
check(
  "mean sentence length is plausible for business email",
  profile.meanSentenceLength > 6 && profile.meanSentenceLength < 30,
  `${profile.meanSentenceLength.toFixed(1)} words`,
);
check(
  "the greeting distribution sums to about one",
  Math.abs(profile.greetings.reduce((s, g) => s + g.share, 0) - 1) < 0.02,
);
check(
  "the contraction rate is a ratio of used to eligible",
  profile.contractionsUsed <= profile.contractionOpportunities &&
    Math.abs(profile.contractionRate - profile.contractionsUsed / profile.contractionOpportunities) < 0.02,
  `${profile.contractionsUsed} of ${profile.contractionOpportunities}`,
);
check("recurring phrases were found", profile.recurringPhrases.length > 0, profile.recurringPhrases.map((p) => p.phrase).join(", "));

const half = buildStyleProfile(SENT_CORPUS.slice(0, 6), AUTHOR_FIRST_NAME);
check(
  "halving the corpus changes the measured profile",
  half.meanSentenceLength !== profile.meanSentenceLength ||
    half.contractionRate !== profile.contractionRate ||
    half.formalityIndex !== profile.formalityIndex,
  `contraction rate ${(half.contractionRate * 100).toFixed(0)} against ${(profile.contractionRate * 100).toFixed(0)} percent`,
);
check("halving the corpus changes the reported sample size", half.sampleSize === 6);

console.log("\n5. The draft follows the measured profile\n");

const draft = composeDraft(
  {
    messageId: rfq.m.id,
    subject: rfq.m.subject,
    recipientFirstName: "Helena",
    recipientCompany: "Test Co",
    extraction: rfq.e,
    quote,
    today: DEMO_TODAY,
    authorName: AUTHOR_FULL_NAME,
    authorTitle: "Commercial Director",
    authorCompany: "Nordic Fit Interiors, S.L.",
  },
  profile,
);

const knownGreetings = profile.greetings.map((g) => g.pattern.replace("{first}", "Helena"));
const knownSignOffs = profile.signOffs.map((s) => s.pattern);
check(
  "the greeting is one the author actually uses",
  knownGreetings.some((g) => draft.text.startsWith(g)),
  draft.greeting,
);
check("the sign-off is one the author actually uses", knownSignOffs.includes(draft.signOff), draft.signOff);
check("the draft carries a style score", draft.score.overall > 0 && draft.score.overall <= 1, `${(draft.score.overall * 100).toFixed(0)} percent`);
check("the score is broken into components", draft.score.components.length >= 3, `${draft.score.components.length} components`);

// The score is only honest if the metrics it was computed from describe the
// text that was actually produced, so measure the finished draft again.
const remeasured = measureText(draft.text, AUTHOR_FIRST_NAME);
check(
  "the reported metrics describe the draft that was produced",
  Math.abs(remeasured.meanSentenceLength - draft.metrics.meanSentenceLength) < 0.6,
  `${remeasured.meanSentenceLength.toFixed(1)} against a reported ${draft.metrics.meanSentenceLength.toFixed(1)}`,
);
check(
  "the draft length is near the target drawn from the profile",
  Math.abs(remeasured.meanSentenceLength - draft.targetSentenceLength) < 6,
  `${remeasured.meanSentenceLength.toFixed(1)} against a target of ${draft.targetSentenceLength.toFixed(1)}`,
);

const quantitiesInDraft = [rfq.e.areaSqm, rfq.e.workstations].filter((n): n is number => n !== null);
check(
  "the extracted quantities appear in the draft",
  quantitiesInDraft.every((n) => draft.text.includes(String(n))),
  quantitiesInDraft.join(", "),
);

console.log("\n6. The engine is deterministic where it matters\n");

const again = buildQuote(rfq.e, {
  seed: rfq.m.id,
  today: DEMO_TODAY,
  clientName: "Test Client",
  clientCompany: "Test Co",
  projectTitle: "Test project",
});
check("the same request produces the same total", again.totals.total === quote.totals.total, eur(again.totals.total));
check("the same request produces the same quote number", again.number === quote.number, again.number);

const e2 = extractRequirements(rfq.m.body, DEMO_TODAY);
check("extraction is stable across runs", e2.confidence === rfq.e.confidence && e2.areaSqm === rfq.e.areaSqm);

console.log("");
if (failures > 0) {
  console.log(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log("All checks passed.");
