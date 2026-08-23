import { Mail, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_TOTAL_MS, isDemoMode, step } from "./lib/demo";
import { DemoBadge } from "./components/DemoBadge";
import { CopilotPane } from "./components/CopilotPane";
import type { PanelOpenState } from "./components/CopilotPane";
import type { DraftState } from "./components/DraftPanel";
import { EMPTY_DRAFT_STATE } from "./components/DraftPanel";
import type { FolderId, ListRow } from "./components/MailShell";
import { FolderRail, MessageList, ReadingPane, SentReadingPane } from "./components/MailShell";
import type { QuoteState } from "./components/QuotePanel";
import { EMPTY_QUOTE_STATE, QUOTE_STAGES, RateCardModal } from "./components/QuotePanel";
import type { EngineMode } from "./components/SettingsDrawer";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { DEMO_TODAY, INBOX } from "./data/inbox";
import {
  AUTHOR_COMPANY,
  AUTHOR_EMAIL,
  AUTHOR_FIRST_NAME,
  AUTHOR_FULL_NAME,
  AUTHOR_TITLE,
  SENT_CORPUS,
} from "./data/sentCorpus";
import { PIPELINE_STAGES, composeDraft, scoreDraft } from "./engine/compose";
import type { ComposedDraft } from "./engine/compose";
import { CONFIDENCE_THRESHOLD, extractRequirements } from "./engine/extract";
import type { Extraction } from "./engine/extract";
import { buildQuote, quoteToMarkdown, withQuantity } from "./engine/quote";
import { buildStyleProfile, measureText } from "./engine/styleProfile";
import { LIVE_KEY_STORAGE, generateLiveDraft } from "./lib/live";

const REPO_URL = "https://github.com/JericoNeil/agenticedge-quote-copilot";

const REBUILD_STAGES = [
  "Reading sent folder",
  "Splitting sentences and paragraphs",
  "Counting greetings and sign-offs",
  "Scoring register and phrases",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function firstName(fullName: string): string {
  return fullName.split(/\s+/)[0];
}

export default function App() {
  const [folder, setFolder] = useState<FolderId>("inbox");
  const [selectedInboxId, setSelectedInboxId] = useState<string | null>(INBOX[0].id);
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set([INBOX[0].id]));

  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [profile, setProfile] = useState(() => buildStyleProfile(SENT_CORPUS, AUTHOR_FIRST_NAME));
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildStage, setRebuildStage] = useState<string | null>(null);

  const [draftStates, setDraftStates] = useState<Record<string, DraftState>>({});
  const [quoteStates, setQuoteStates] = useState<Record<string, QuoteState>>({});
  const [open, setOpen] = useState<PanelOpenState>({ style: true, draft: true, quote: true });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rateCardOpen, setRateCardOpen] = useState(false);
  const [mode, setMode] = useState<EngineMode>("local");
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);

  const demoActive = useMemo(() => isDemoMode(), []);
  const [demoDone, setDemoDone] = useState(false);
  const [demoElapsed, setDemoElapsed] = useState(0);

  const draftRef = useRef<HTMLDivElement>(null);
  const quoteRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LIVE_KEY_STORAGE);
      if (stored) {
        setApiKey(stored);
        setRemember(true);
      }
    } catch {
      // localStorage can be unavailable; the demo works without it.
    }
  }, []);

  const corpus = useMemo(() => SENT_CORPUS.filter((email) => !excluded.has(email.id)), [excluded]);

  const selectedMessage = useMemo(
    () => INBOX.find((message) => message.id === selectedInboxId) || null,
    [selectedInboxId],
  );
  const selectedSent = useMemo(
    () => SENT_CORPUS.find((email) => email.id === selectedSentId) || null,
    [selectedSentId],
  );

  const extraction: Extraction | null = useMemo(
    () => (selectedMessage ? extractRequirements(selectedMessage.body, DEMO_TODAY) : null),
    [selectedMessage],
  );

  const draftState = selectedInboxId
    ? draftStates[selectedInboxId] || EMPTY_DRAFT_STATE
    : EMPTY_DRAFT_STATE;
  const quoteState = selectedInboxId
    ? quoteStates[selectedInboxId] || EMPTY_QUOTE_STATE
    : EMPTY_QUOTE_STATE;

  const patchDraft = useCallback(
    (id: string, patch: Partial<DraftState>) => {
      setDraftStates((current) => ({
        ...current,
        [id]: { ...(current[id] || EMPTY_DRAFT_STATE), ...patch },
      }));
    },
    [],
  );

  const patchQuote = useCallback((id: string, patch: Partial<QuoteState>) => {
    setQuoteStates((current) => ({
      ...current,
      [id]: { ...(current[id] || EMPTY_QUOTE_STATE), ...patch },
    }));
  }, []);

  const selectInbox = useCallback((id: string) => {
    setSelectedInboxId(id);
    setReadIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);

  const signatureBlock = `${AUTHOR_FULL_NAME}\n${AUTHOR_TITLE}, ${AUTHOR_COMPANY}`;

  const runDraft = useCallback(async () => {
    if (!selectedMessage || !extraction) return;
    const id = selectedMessage.id;
    const live = mode === "live" && apiKey.trim().length > 0;

    patchDraft(id, {
      status: "running",
      stageIndex: 0,
      streamText: "",
      liveNotice: null,
      inserted: false,
    });

    // Stage 1: read the message.
    await sleep(300);
    patchDraft(id, { stageIndex: 1 });

    // Stage 2: extraction. Re-run here so the stage corresponds to real work.
    const freshExtraction = extractRequirements(selectedMessage.body, DEMO_TODAY);
    await sleep(320);
    patchDraft(id, { stageIndex: 2 });

    // Stage 3: the style profile is the input to composition.
    await sleep(280);
    patchDraft(id, { stageIndex: 3 });

    const context = {
      messageId: id,
      subject: selectedMessage.subject,
      recipientFirstName: firstName(selectedMessage.from),
      recipientCompany: selectedMessage.fromCompany,
      extraction: freshExtraction,
      quote: quoteStates[id] ? quoteStates[id].quote : null,
      today: DEMO_TODAY,
      authorName: AUTHOR_FULL_NAME,
      authorTitle: AUTHOR_TITLE,
      authorCompany: AUTHOR_COMPANY,
    };

    let composed: ComposedDraft = composeDraft(context, profile);
    let notice: string | null = null;

    if (live) {
      try {
        const result = await generateLiveDraft(
          apiKey.trim(),
          {
            profile,
            extraction: freshExtraction,
            messageBody: selectedMessage.body,
            messageSubject: selectedMessage.subject,
            recipientFirstName: firstName(selectedMessage.from),
            signatureBlock,
            confidenceThreshold: CONFIDENCE_THRESHOLD,
          },
          (partial) => patchDraft(id, { streamText: partial }),
        );
        // The live draft is scored with the same local functions, so the two
        // modes are measured on identical terms.
        const metrics = measureText(result.draft, AUTHOR_FIRST_NAME);
        const greetingEntry =
          profile.greetings.find((g) => g.pattern === metrics.greetingPattern) ||
          (profile.greetings[0] || { pattern: "Hi {first}", count: 0, share: 0 });
        const signOffEntry =
          profile.signOffs.find((s) => s.pattern === metrics.signOff) ||
          (profile.signOffs[0] || { pattern: "Best regards", count: 0, share: 0 });
        composed = {
          ...composed,
          text: result.draft,
          greeting: metrics.greetingPattern || composed.greeting,
          signOff: metrics.signOff || composed.signOff,
          metrics,
          score: scoreDraft(result.draft, profile, { greetingEntry, signOffEntry, metrics }),
        };
      } catch (error) {
        notice =
          "Live mode failed (" +
          (error instanceof Error ? error.message : "unknown error") +
          "). Showing the local engine result instead.";
      }
    } else {
      await sleep(300);
    }

    // Stage 5: score the produced draft.
    patchDraft(id, { stageIndex: 4 });
    await sleep(300);

    patchDraft(id, {
      status: "done",
      stageIndex: PIPELINE_STAGES.length,
      draft: composed,
      editedText: composed.text,
      liveNotice: notice,
      streamText: "",
    });
  }, [apiKey, extraction, mode, patchDraft, profile, quoteStates, selectedMessage, signatureBlock]);

  const runQuote = useCallback(async () => {
    if (!selectedMessage || !extraction || !extraction.quotable) return;
    const id = selectedMessage.id;
    patchQuote(id, { status: "running", stageIndex: 0, attached: false });
    await sleep(280);
    patchQuote(id, { stageIndex: 1 });
    await sleep(300);
    patchQuote(id, { stageIndex: 2 });
    const quote = buildQuote(extraction, {
      seed: id,
      today: DEMO_TODAY,
      clientName: selectedMessage.from,
      clientCompany: selectedMessage.fromCompany,
      projectTitle: selectedMessage.subject,
    });
    await sleep(280);
    patchQuote(id, { status: "done", stageIndex: QUOTE_STAGES.length, quote });
  }, [extraction, patchQuote, selectedMessage]);

  // Bring the freshly produced result into view without the user scrolling.
  useEffect(() => {
    if (draftState.status === "done" && draftRef.current) {
      draftRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [draftState.status]);

  useEffect(() => {
    if (quoteState.status === "done" && quoteRef.current) {
      quoteRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [quoteState.status]);

  const rebuildProfile = useCallback(async () => {
    setRebuilding(true);
    for (const stage of REBUILD_STAGES) {
      setRebuildStage(stage);
      await sleep(260);
    }
    setProfile(buildStyleProfile(corpus, AUTHOR_FIRST_NAME));
    setRebuildStage(null);
    setRebuilding(false);
  }, [corpus]);

  const handleQuantityChange = useCallback(
    (lineKey: string, quantity: number) => {
      if (!selectedInboxId) return;
      setQuoteStates((current) => {
        const state = current[selectedInboxId];
        if (!state || !state.quote) return current;
        return {
          ...current,
          [selectedInboxId]: { ...state, quote: withQuantity(state.quote, lineKey, quantity) },
        };
      });
    },
    [selectedInboxId],
  );

  const handleAttach = useCallback(() => {
    if (!selectedInboxId) return;
    const quote = quoteStates[selectedInboxId] ? quoteStates[selectedInboxId].quote : null;
    if (!quote) return;
    patchQuote(selectedInboxId, { attached: true });

    const current = draftStates[selectedInboxId];
    if (current && current.draft) {
      const line = `The total is ${quote.totals.total.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} euros including IVA, quote ${quote.number}.`;
      const alreadyThere = current.editedText.includes(quote.number);
      patchDraft(selectedInboxId, {
        attachedQuote: quote.number,
        editedText: alreadyThere
          ? current.editedText
          : current.editedText.replace(
              /(The fixed price and the build up are attached\.|I have attached the fixed price with the build up, so you can see exactly where the money sits\.)/,
              line,
            ),
      });
    } else {
      patchDraft(selectedInboxId, { attachedQuote: quote.number });
    }
  }, [draftStates, patchDraft, patchQuote, quoteStates, selectedInboxId]);

  const handleDownload = useCallback(() => {
    if (!selectedInboxId) return;
    const state = quoteStates[selectedInboxId];
    if (!state || !state.quote) return;
    const markdown = quoteToMarkdown(state.quote, {
      name: AUTHOR_COMPANY,
      contact: `${AUTHOR_FULL_NAME}, ${AUTHOR_TITLE}`,
      email: AUTHOR_EMAIL,
    });
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${state.quote.number}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, [quoteStates, selectedInboxId]);

  const handleReset = useCallback(() => {
    setFolder("inbox");
    setSelectedInboxId(INBOX[0].id);
    setSelectedSentId(null);
    setReadIds(new Set([INBOX[0].id]));
    setExcluded(new Set());
    setProfile(buildStyleProfile(SENT_CORPUS, AUTHOR_FIRST_NAME));
    setDraftStates({});
    setQuoteStates({});
    setOpen({ style: true, draft: true, quote: true });
    setSettingsOpen(false);
    setRateCardOpen(false);
  }, []);

  const handleRememberChange = useCallback(
    (value: boolean) => {
      setRemember(value);
      try {
        if (value && apiKey) window.localStorage.setItem(LIVE_KEY_STORAGE, apiKey);
        else window.localStorage.removeItem(LIVE_KEY_STORAGE);
      } catch {
        // ignore storage failures
      }
    },
    [apiKey],
  );

  const handleApiKeyChange = useCallback(
    (value: string) => {
      setApiKey(value);
      try {
        if (remember && value) window.localStorage.setItem(LIVE_KEY_STORAGE, value);
      } catch {
        // ignore storage failures
      }
    },
    [remember],
  );

  const handleClearKey = useCallback(() => {
    setApiKey("");
    setRemember(false);
    try {
      window.localStorage.removeItem(LIVE_KEY_STORAGE);
    } catch {
      // ignore storage failures
    }
  }, []);

  const draftCount = Object.values(draftStates).filter((state) => state.status === "done").length;
  const quoteCount = Object.values(quoteStates).filter((state) => state.quote !== null).length;
  const unread = INBOX.filter((message) => !readIds.has(message.id)).length;

  const inboxRows: ListRow[] = INBOX.map((message) => ({
    id: message.id,
    from: message.from,
    subject: message.subject,
    when: message.receivedLabel,
    preview: message.body.split("\n").slice(2).join(" ").slice(0, 110),
    unread: !readIds.has(message.id),
  }));

  const sentRows: ListRow[] = SENT_CORPUS.map((email) => ({
    id: email.id,
    from: `To ${email.to}`,
    subject: email.subject,
    when: email.date.slice(5),
    preview: email.body.split("\n").slice(2).join(" ").slice(0, 110),
    unread: false,
  }));

  const draftRows: ListRow[] = Object.entries(draftStates)
    .filter(([, state]) => state.status === "done" && state.draft)
    .map(([id, state]) => {
      const message = INBOX.find((m) => m.id === id);
      return {
        id,
        from: `To ${message ? message.from : "recipient"}`,
        subject: state.draft ? state.draft.subject : "Draft",
        when: "Now",
        preview: state.editedText.split("\n").slice(2).join(" ").slice(0, 110),
        unread: false,
      };
    });

  const quoteRows: ListRow[] = Object.entries(quoteStates)
    .filter(([, state]) => state.quote !== null)
    .map(([id, state]) => {
      const quote = state.quote;
      return {
        id,
        from: quote ? quote.clientCompany : "",
        subject: quote ? quote.number : "",
        when: "Now",
        preview: quote
          ? `${quote.lines.length} line items, total EUR ${quote.totals.total.toLocaleString("en-GB", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "",
        unread: false,
      };
    });

  const listConfig: Record<string, { title: string; rows: ListRow[]; empty: string }> = {
    inbox: { title: "Inbox", rows: inboxRows, empty: "No messages." },
    sent: {
      title: "Sent",
      rows: sentRows,
      empty: "No messages.",
    },
    drafts: {
      title: "Drafts",
      rows: draftRows,
      empty: "No drafts yet. Open a message and use Draft reply in the copilot.",
    },
    quotes: {
      title: "Quotes",
      rows: quoteRows,
      empty: "No quotes yet. Open a message and use Build quote in the copilot.",
    },
  };
  const list = listConfig[folder];

  const selectedListId =
    folder === "sent" ? selectedSentId : folder === "inbox" ? selectedInboxId : selectedInboxId;

  // Self playing demo. It calls the same runDraft and runQuote the buttons call,
  // so the draft, the quote and the refusal are produced the ordinary way.
  useEffect(() => {
    if (!demoActive) return;
    let cancelled = false;
    const isCancelled = () => cancelled;

    const started = Date.now();
    const ticker = window.setInterval(() => setDemoElapsed(Date.now() - started), 100);

    (async () => {
      try {
        await step(700, isCancelled);
        await runDraft();
        await step(2400, isCancelled);
        await runQuote();
        await step(3400, isCancelled);
        setSelectedInboxId(INBOX[INBOX.length - 1].id);
        setReadIds((prev) => new Set(prev).add(INBOX[INBOX.length - 1].id));
        await step(2800, isCancelled);
        if (!cancelled) setDemoDone(true);
      } catch {
        // cancelled on unmount
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(ticker);
    };
    // Deliberately runs once, on mount, in demo mode only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoActive]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-page items-center gap-3 px-4 py-2.5">
          <span className="text-sm font-semibold tracking-tight">Agentic Edge</span>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Email + Quote Copilot</span>
          <span className="ml-auto rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-medium text-accent">
            Automation D - Standard EUR 399/mo
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-md border border-border bg-muted p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Open settings"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full min-h-0 max-w-page flex-1 flex-col px-4 py-3">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
            <Mail size={13} className="shrink-0 text-muted-foreground" />
            <span className="shrink-0 text-xs font-semibold">Mail</span>
            <span className="h-3 w-px shrink-0 bg-border" aria-hidden="true" />
            <span className="truncate text-[10px] text-muted-foreground">
              {AUTHOR_FULL_NAME}, {AUTHOR_TITLE}, {AUTHOR_COMPANY}
            </span>
            <span className="ml-auto hidden shrink-0 text-[10px] text-muted-foreground lg:inline">
              Add-in shell shown for demonstration. Production deploys as an Outlook task pane.
            </span>
          </div>

          <div className="flex min-h-0 flex-1">
            <FolderRail
              active={folder}
              onSelect={(next) => {
                setFolder(next);
                if (next === "sent" && !selectedSentId) setSelectedSentId(SENT_CORPUS[0].id);
              }}
              unread={unread}
              sentCount={SENT_CORPUS.length}
              draftCount={draftCount}
              quoteCount={quoteCount}
            />
            <MessageList
              title={list.title}
              rows={list.rows}
              selectedId={selectedListId}
              onSelect={(id) => {
                if (folder === "sent") setSelectedSentId(id);
                else {
                  setFolder("inbox");
                  selectInbox(id);
                }
              }}
              emptyNote={list.empty}
            />
            {folder === "sent" ? (
              <SentReadingPane email={selectedSent} />
            ) : (
              <ReadingPane message={selectedMessage} extraction={extraction} />
            )}
            <CopilotPane
              profile={profile}
              corpus={SENT_CORPUS}
              excluded={excluded}
              onToggleEmail={(id) =>
                setExcluded((current) => {
                  const next = new Set(current);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onRebuild={rebuildProfile}
              rebuilding={rebuilding}
              rebuildStage={rebuildStage}
              extraction={folder === "sent" ? null : extraction}
              draftState={draftState}
              quoteState={quoteState}
              live={mode === "live" && apiKey.trim().length > 0}
              open={open}
              onToggleSection={(key) => setOpen((current) => ({ ...current, [key]: !current[key] }))}
              onDraft={runDraft}
              onRegenerate={() => {
                if (selectedInboxId) patchDraft(selectedInboxId, EMPTY_DRAFT_STATE);
                void runDraft();
              }}
              onInsert={() => {
                if (selectedInboxId) patchDraft(selectedInboxId, { inserted: true });
              }}
              onEditDraft={(text) => {
                if (selectedInboxId) patchDraft(selectedInboxId, { editedText: text });
              }}
              onBuildQuote={runQuote}
              onQuantityChange={handleQuantityChange}
              onAttach={handleAttach}
              onDownload={handleDownload}
              onOpenRateCard={() => setRateCardOpen(true)}
              draftRef={draftRef}
              quoteRef={quoteRef}
              scrollRef={scrollRef}
            />
          </div>
        </div>
      </main>

      <footer className="shrink-0 border-t border-border bg-card">
        <div className="mx-auto flex w-full max-w-page items-center gap-2 px-4 py-2 text-[10px] text-muted-foreground">
          <span>
            Prototype built for the Agentic Edge business plan (TFM, Esade). Demo data is fictional.
          </span>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="ml-auto underline underline-offset-2 hover:text-foreground"
          >
            github.com/JericoNeil/agenticedge-quote-copilot
          </a>
        </div>
      </footer>

      {demoActive && (
        <DemoBadge done={demoDone} elapsedMs={demoElapsed} totalMs={DEMO_TOTAL_MS} />
      )}

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        mode={mode}
        onModeChange={setMode}
        apiKey={apiKey}
        onApiKeyChange={handleApiKeyChange}
        remember={remember}
        onRememberChange={handleRememberChange}
        onClearKey={handleClearKey}
        onReset={handleReset}
      />
      <RateCardModal open={rateCardOpen} onClose={() => setRateCardOpen(false)} />
    </div>
  );
}
