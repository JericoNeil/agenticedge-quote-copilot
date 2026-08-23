# Email + Quote Copilot

An email copilot that drafts replies in the sender's own measured writing style and builds a fully costed quote from the content of an inbound request.

**Live prototype: https://jericoneil.github.io/agenticedge-quote-copilot/**

Add `?demo=1` and it plays itself: [https://jericoneil.github.io/agenticedge-quote-copilot/?demo=1](https://jericoneil.github.io/agenticedge-quote-copilot/?demo=1). About fifteen seconds, no cursor and no clicking, so it can be screen recorded in one take or run live in front of an audience.

This is Automation D from the Agentic Edge catalogue of eight productised automations, built as a working prototype for the Agentic Edge business plan (Master's Final Project, Esade).

## What this proves

The business plan describes Automation D as "an Outlook add-in that drafts replies and quotes in the sender's own style, with a company template layer", sold on the AI Automations line at EUR 249 Essential, EUR 399 Standard or EUR 699 Advanced per month with implementation included and no setup fee.

Three claims from the plan are visible on screen:

| Claim | Where you see it |
| --- | --- |
| Grounded in the client's own material, not a generic model prior | The style profile panel, which reports the actual measured statistics of twelve past sent messages and names the recurring phrases it learned from them |
| Confidence based human handoff | Message 5 in the inbox. Extraction confidence falls below the 0.55 threshold, the copilot refuses to quote, and it generates clarifying questions derived from exactly which required fields are missing |
| Nothing leaves without a person | The `Send` control is permanently disabled and labelled `Human approval required. This prototype does not send.` |

One further point worth making to a reader: **no figure in the quote is produced by a language model.** All arithmetic runs in TypeScript in `src/engine/quote.ts`. Even with the live Claude toggle enabled, the model writes prose and the quote maths stays in code. A system that lets a language model compute a price is not one an SME should put in front of its clients.

## How it works

Everything runs in the browser. There is no server and no backend.

### Style profiler, `src/engine/styleProfile.ts`

Twelve past sent messages from the fictional user sit in `src/data/sentCorpus.ts`. The profiler parses each into greeting, body paragraphs and sign-off, then computes:

- Mean and standard deviation of sentence length in words
- The distribution of greeting patterns and of sign-offs, as frequencies
- Contraction rate, measured as contractions used over contraction eligible constructions, not as a raw count
- Mean paragraph count and mean words per message
- A formality index built from a scored lexicon combined with contraction rate and mean sentence length
- Recurring multi-word phrases, from bigram and trigram frequency counts filtered so a phrase cannot begin or end on a stopword
- Question rate

Remove messages from the corpus and the profile changes, because it is measured rather than declared.

### Requirement extraction, `src/engine/extract.ts`

Parses an inbound message for the fields the rate card needs: floor area, workstation count, number of sites, linear metres of partition, deadline, and scope tags such as flooring, lighting, electrical, acoustic, partitions, furniture and demolition. It handles unit variants (`sqm`, `m2`, `square metres`) and written numbers, classifies the message intent as a quote request, a chase, a scope change or a vague enquiry, and records the evidence span for each field it found.

Extraction confidence is the share of required fields present, weighted by importance. The threshold is 0.55, exported as `CONFIDENCE_THRESHOLD`. Below it the copilot will not quote.

### Draft composer, `src/engine/compose.ts`

Not a fixed template. The composer samples a greeting and a sign-off from the learned distributions, targets the learned mean sentence length when choosing constructions, injects learned recurring phrases where they fit, and fills content slots from the extracted requirements. Both the profile and the message content drive the result.

It then scores the draft it produced against the profile using the same metric functions, and reports the score broken into components. The score is reported honestly, including when a component is a poor match.

### Quote engine, `src/engine/quote.ts`

The rate card, fictional but plausible for a Barcelona interior fit-out contractor:

| Line | Unit | Rate |
| --- | --- | --- |
| Design and space planning | sqm | EUR 38 |
| Demolition and strip out | sqm | EUR 22 |
| Partitions and glazing | linear m | EUR 145 |
| Flooring supply and install | sqm | EUR 46 |
| Lighting | sqm | EUR 34 |
| Electrical and data | workstation | EUR 340 |
| Acoustic panelling | sqm | EUR 78 |
| Furniture install | workstation | EUR 95 |

Then project management at 9 percent of subtotal, contingency at 5 percent, a volume discount of 4 percent above 300 square metres or 7 percent above 600, and IVA at 21 percent, applied in that order with every step shown. Quantities are editable in the rendered quote and the whole document recomputes live. Rounding is to two decimals at each step so the totals add up when checked.

## Tests

The engine ships with a self check that asserts the claims this prototype makes, rather than
just that it compiles:

```bash
npm run check
```

It recomputes every figure in the quote independently of the engine and compares, line by line,
through subtotal, project management, contingency, the volume discount band, IVA and the total.
It also asserts that the five inbox messages are classified correctly, that the two that cannot
be priced are refused for their own stated reasons, and that halving the sent corpus changes the
measured style profile, which is what shows the profile is measured rather than decorative.

## Run locally

```bash
npm install
npm run dev
```

## Live mode

Open the settings drawer in the header. The default is the local engine, which needs no key, no network and no configuration, and produces the same result every time.

Switching to `Claude API (live)` and entering an Anthropic API key routes draft composition through `claude-opus-5` instead. The key is held in React state and, only if you tick the box, in `localStorage`. It is sent directly from your browser to the Anthropic API and never to any Agentic Edge server. There is a `Clear key` button. In production this call would sit behind a server side proxy and the key would never reach the browser at all.

The model receives the measured style profile as structured data plus the inbound message, and returns JSON matching the local engine's contract, so the same interface renders both modes. If the call fails or the response does not parse, the app falls back to the local engine rather than dead ending.

The quote arithmetic never routes through the model in either mode.

## Scope and limits

This is a prototype built to demonstrate a business plan, not a production deployment. A real client deployment would add:

- A genuine Outlook task pane using the Office add-in manifest and Microsoft Graph, replacing this mail shell
- A server side key and a per-tenant proxy, so no credential reaches the browser
- The style profile built from the user's real sent folder, with a refresh cadence and a per-user store
- An evaluation harness over held out messages, measuring extraction accuracy and style match against human written replies
- Audit logging of every draft, every edit and every send, which is what makes the human approval gate defensible
- The rate card driven from the client's own pricing system rather than a constant in the source

The mail shell is a demonstration frame. It is not affiliated with Microsoft and does not use Microsoft branding.

## Demo data

Every company, person, message and price in this repository is fictional. Nordic Fit Interiors, S.L. and its correspondents do not exist. The rate card is invented for the demonstration.

See [DEMO.md](DEMO.md) for the recording script.

## Licence

MIT. Copyright 2026 Jerico Neil Agdan Papasin.
