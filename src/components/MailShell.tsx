import { FileText, Inbox as InboxIcon, PenLine, Send } from "lucide-react";
import type { ReactNode } from "react";
import type { InboundMessage } from "../data/inbox";
import type { SentEmail } from "../data/sentCorpus";
import type { Extraction } from "../engine/extract";
import { cx } from "./ui";

export type FolderId = "inbox" | "sent" | "drafts" | "quotes";

const FOLDER_ICONS: Record<FolderId, ReactNode> = {
  inbox: <InboxIcon size={14} />,
  sent: <Send size={14} />,
  drafts: <PenLine size={14} />,
  quotes: <FileText size={14} />,
};

export function FolderRail({
  active,
  onSelect,
  unread,
  sentCount,
  draftCount,
  quoteCount,
}: {
  active: FolderId;
  onSelect: (folder: FolderId) => void;
  unread: number;
  sentCount: number;
  draftCount: number;
  quoteCount: number;
}) {
  const folders: Array<{ id: FolderId; label: string; badge: number; highlight: boolean }> = [
    { id: "inbox", label: "Inbox", badge: unread, highlight: true },
    { id: "sent", label: "Sent", badge: sentCount, highlight: false },
    { id: "drafts", label: "Drafts", badge: draftCount, highlight: false },
    { id: "quotes", label: "Quotes", badge: quoteCount, highlight: false },
  ];

  return (
    <nav className="flex w-[116px] shrink-0 flex-col gap-0.5 border-r border-border bg-surface-subtle p-2">
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onSelect(folder.id)}
          className={cx(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
            active === folder.id
              ? "bg-accent/15 text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <span className={active === folder.id ? "text-accent" : ""}>{FOLDER_ICONS[folder.id]}</span>
          <span className="min-w-0 flex-1 truncate">{folder.label}</span>
          {folder.badge > 0 ? (
            <span
              className={cx(
                "shrink-0 font-mono text-[10px]",
                folder.highlight ? "text-accent" : "text-muted-foreground",
              )}
            >
              {folder.badge}
            </span>
          ) : null}
        </button>
      ))}
    </nav>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-[10px] text-muted-foreground">
      {initials}
    </span>
  );
}

export interface ListRow {
  id: string;
  from: string;
  subject: string;
  when: string;
  preview: string;
  unread: boolean;
}

export function MessageList({
  title,
  rows,
  selectedId,
  onSelect,
  emptyNote,
}: {
  title: string;
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  emptyNote: string;
}) {
  return (
    <div className="flex w-[292px] shrink-0 flex-col border-r border-border">
      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="scroll-thin flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-[11px] leading-relaxed text-muted-foreground">{emptyNote}</p>
        ) : (
          rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => onSelect(row.id)}
              className={cx(
                "block w-full border-b border-border px-3 py-2.5 text-left transition-colors",
                selectedId === row.id ? "bg-accent/10" : "hover:bg-muted/60",
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cx(
                    "truncate text-[12px]",
                    row.unread ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {row.from}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {row.when}
                </span>
              </div>
              <div
                className={cx(
                  "mt-0.5 truncate text-[11px]",
                  selectedId === row.id ? "text-accent" : "text-foreground",
                )}
              >
                {row.subject}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-muted-foreground">
                {row.preview}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

interface Span {
  start: number;
  end: number;
  label: string;
}

/** Merge the extraction's evidence spans so overlapping matches render once. */
function evidenceSpans(extraction: Extraction): Span[] {
  const raw: Span[] = [];
  extraction.fields.forEach((field) => {
    if (field.evidence && field.found) {
      raw.push({
        start: field.evidence.index,
        end: field.evidence.index + field.evidence.quote.length,
        label: field.label,
      });
    }
  });
  extraction.scope.forEach((tag) => {
    raw.push({
      start: tag.evidence.index,
      end: tag.evidence.index + tag.evidence.quote.length,
      label: tag.label,
    });
  });

  const sorted = raw.filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  const merged: Span[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start <= last.end) {
      last.end = Math.max(last.end, span.end);
      if (!last.label.includes(span.label)) last.label = last.label + ", " + span.label;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}

function HighlightedBody({ body, extraction }: { body: string; extraction: Extraction | null }) {
  if (!extraction) {
    return <>{body}</>;
  }
  const spans = evidenceSpans(extraction);
  if (spans.length === 0) return <>{body}</>;

  const nodes: ReactNode[] = [];
  let cursor = 0;
  spans.forEach((span, index) => {
    if (span.start > cursor) nodes.push(body.slice(cursor, span.start));
    nodes.push(
      <mark
        key={index}
        title={span.label}
        className="rounded-[3px] bg-accent/15 px-0.5 text-foreground decoration-accent/60 underline-offset-2"
      >
        {body.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });
  if (cursor < body.length) nodes.push(body.slice(cursor));
  return <>{nodes}</>;
}

export function ReadingPane({
  message,
  extraction,
}: {
  message: InboundMessage | null;
  extraction: Extraction | null;
}) {
  if (!message) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-[11px] text-muted-foreground">
        Select a message to open it.
      </div>
    );
  }

  return (
    <div data-ae="rise"
      key={message.id}
      className="scroll-thin flex min-w-0 flex-1 flex-col overflow-y-auto"
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold leading-snug text-foreground">{message.subject}</h2>
        <div className="mt-2 flex items-center gap-2">
          <Avatar name={message.from} />
          <div className="min-w-0">
            <div className="truncate text-[11px] text-foreground">
              {message.from}
              <span className="text-muted-foreground"> ({message.fromCompany})</span>
            </div>
            <div className="truncate font-mono text-[10px] text-muted-foreground">
              {message.fromEmail}
            </div>
          </div>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
            {message.receivedLabel}
          </span>
        </div>
      </header>

      <div className="flex-1 px-4 py-3">
        <p className="whitespace-pre-wrap text-[12.5px] leading-[1.7] text-foreground">
          <HighlightedBody body={message.body} extraction={extraction} />
        </p>
      </div>

      {extraction ? (
        <footer className="border-t border-border px-4 py-2">
          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-2 w-[2px] rounded-full bg-accent" aria-hidden="true" />
            Highlighted text is what the copilot extracted. Hover any highlight for the field it
            filled.
          </p>
        </footer>
      ) : null}
    </div>
  );
}

export function SentReadingPane({ email }: { email: SentEmail | null }) {
  if (!email) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-[11px] text-muted-foreground">
        Select a message to open it.
      </div>
    );
  }
  return (
    <div data-ae="rise"
      key={email.id}
      className="scroll-thin flex min-w-0 flex-1 flex-col overflow-y-auto"
    >
      <header className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold leading-snug">{email.subject}</h2>
        <div className="mt-2 flex items-center gap-2">
          <Avatar name={email.to} />
          <div className="min-w-0">
            <div className="truncate text-[11px] text-muted-foreground">
              To {email.to} ({email.company})
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">{email.date}</div>
          </div>
        </div>
      </header>
      <div className="flex-1 px-4 py-3">
        <p className="whitespace-pre-wrap text-[12.5px] leading-[1.7] text-foreground">
          {email.body}
        </p>
      </div>
      <footer className="border-t border-border px-4 py-2">
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          This message is one of the twelve the style profile was measured from. Untick it in the
          style profile corpus and rebuild to see the numbers move.
        </p>
      </footer>
    </div>
  );
}
