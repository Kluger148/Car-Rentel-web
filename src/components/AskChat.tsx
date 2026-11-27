import { Link } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDownIcon, CheckIcon, CopyIcon, PinIcon, ReplyArrowIcon, SendIcon, SparklesIcon, StopIcon, VanIcon } from './icons';
import type { ChatDeal } from '../lib/api';
import { useAskChat } from '../lib/askChat';
import { CLASS_LABEL, money } from '../lib/format';

/** The parts of the Ask AI chat shared by the Ask AI page and the sidebar. */

/** **bold** and [text](/deal/<id>) or (/search/<id>) inside one line; any other link stays plain text. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((\/deal\/[0-9a-f]{40}|\/search\/\d+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${m.index}`;
    // Bold text can hold a deal link of its own.
    if (m[1]) out.push(<strong key={k}>{inline(m[1], k)}</strong>);
    else if (m[3].startsWith('/deal/'))
      out.push(
        <Link key={k} to="/deal/$fingerprint" params={{ fingerprint: m[3].slice(6) }}>
          {m[2]}
        </Link>,
      );
    else
      out.push(
        <Link key={k} to="/search/$id" params={{ id: m[3].slice(8) }}>
          {m[2]}
        </Link>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** The small part of Markdown the assistant writes: paragraphs, headings, lists, bold and deal links. */
function Answer({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `li${blocks.length}-${i}`)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  let table: string[][] | null = null;
  const flushTable = () => {
    if (!table) return;
    const [head, ...body] = table;
    const k = `t${blocks.length}`;
    blocks.push(
      <div key={k} className="ask-table">
        <table>
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i}>{inline(c, `${k}h${i}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>
                {row.map((c, i) => (
                  <td key={i}>{inline(c, `${k}r${r}c${i}`)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    table = null;
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    // Markdown table rows: | a | b |. The |---|---| line under the header is skipped.
    if (/^\|.*\|$/.test(line)) {
      flush();
      if (/^\|[\s:|-]+\|$/.test(line)) continue;
      (table ??= []).push(
        line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim()),
      );
      continue;
    }
    flushTable();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flush();
    if (!line || /^-{3,}$/.test(line)) continue;
    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    blocks.push(
      heading ? (
        <h3 key={blocks.length}>{inline(heading[1], `h${blocks.length}`)}</h3>
      ) : (
        <p key={blocks.length}>{inline(line, `p${blocks.length}`)}</p>
      ),
    );
  }
  flush();
  flushTable();
  return <div className={`ask-answer${streaming ? ' is-streaming' : ''}`}>{blocks}</div>;
}

function DealCard({ d }: { d: ChatDeal }) {
  const [broken, setBroken] = useState(false);
  const drop = d.change === 'PRICE_DOWN';
  return (
    <Link to="/deal/$fingerprint" params={{ fingerprint: d.fingerprint }} className="ask-deal">
      <div className="ask-deal__media">
        {d.imageUrl && !broken ? <img src={d.imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} /> : <VanIcon size={30} />}
        <span className="ask-deal__src">{d.source}</span>
      </div>
      <div className="ask-deal__body">
        <span className="ask-deal__name">{d.vehicleName}</span>
        <span className="ask-deal__meta">
          {d.supplier} · {CLASS_LABEL[d.vehicleClass] ?? d.vehicleClass}
          {d.seats ? ` · ${d.seats} seats` : ''}
        </span>
        <span className="ask-deal__meta">
          <PinIcon size={12} /> <span className="ask-deal__place">{d.place}</span>
          {d.distanceMiles !== null && <span className="ask-deal__mi">· {Math.round(d.distanceMiles)} mi</span>}
        </span>
        <span className="ask-deal__foot">
          <span className="ask-deal__price">
            {money(d.monthlyRate)}
            <small>/30 days</small>
          </span>
          {drop && (
            <span className="ask-deal__badge ask-deal__badge--down">
              <ArrowDownIcon size={11} /> Price down
            </span>
          )}
          {d.change === 'NEW' && <span className="ask-deal__badge">New</span>}
        </span>
        <span className="ask-deal__total">
          {money(d.totalPrice)} total · {d.durationDays} days
        </span>
      </div>
    </Link>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    // Links become their text: the copy reads well in a message to a customer.
    const plain = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '');
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  };
  return (
    <button type="button" className="ask-action" onClick={() => void copy()} aria-label="Copy answer">
      {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function AiAvatar() {
  return (
    <span className="ask-avatar" aria-hidden="true">
      <SparklesIcon size={16} />
    </span>
  );
}

/** Starting questions, one per row, with "Show more" past the first `first`. */
export function AskSuggestionList({ questions, first = 4, onAsk }: { questions: string[]; first?: number; onAsk: (q: string) => void }) {
  // Unfolded for one list only: another topic or page starts folded again.
  const key = questions.join('|');
  const [openFor, setOpenFor] = useState<string | null>(null);
  const showAll = openFor === key;
  const setShowAll = (f: (v: boolean) => boolean) => setOpenFor(f(showAll) ? key : null);
  const shown = showAll ? questions : questions.slice(0, first);
  return (
    <div className="ask-suggestions">
      {shown.map((q) => (
        <button key={q} type="button" className="ask-suggestion" onClick={() => onAsk(q)}>
          <ReplyArrowIcon size={16} className="ask-suggestion__icon" />
          <span>{q}</span>
        </button>
      ))}
      {questions.length > first && (
        <button type="button" className="ask-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

/** The conversation: every turn, then the answer on its way. `empty` shows before the first question. */
export function AskThread({ empty, onAsk }: { empty: ReactNode; onAsk: (q: string) => void }) {
  const { turns, pending, status, draft } = useAskChat();
  const endRef = useRef<HTMLDivElement>(null);
  const lastQuestion = [...turns].reverse().find((t) => t.role === 'user')?.content;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, pending, status, draft]);

  return (
    <div className="ask-thread" aria-live="polite">
      {turns.length === 0 && !pending && empty}
      {turns.map((t, i) =>
        t.role === 'user' ? (
          <div key={i} className="ask-row ask-row--user">
            <div className="ask-bubble">{t.content}</div>
          </div>
        ) : (
          <div key={i} className={`ask-row ask-row--ai${t.error ? ' is-error' : ''}`}>
            <AiAvatar />
            <div className="ask-row__body">
              {t.error ? (
                <div className="ask-error" role="alert">
                  <span>{t.content}</span>
                  {lastQuestion && i === turns.length - 1 && (
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => onAsk(lastQuestion)}>
                      Try again
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <Answer text={t.content} />
                  {t.deals && t.deals.length > 0 && (
                    <div className="ask-deals">
                      {t.deals.map((d) => (
                        <DealCard key={d.fingerprint} d={d} />
                      ))}
                    </div>
                  )}
                  <div className="ask-actions">
                    <CopyButton text={t.content} />
                  </div>
                </>
              )}
            </div>
          </div>
        ),
      )}
      {pending && (
        <div className="ask-row ask-row--ai">
          <AiAvatar />
          <div className="ask-row__body">
            {draft ? (
              <Answer text={draft} streaming />
            ) : (
              <div className="ask-status">
                <span className="ask-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="ask-status__label">{status}…</span>
              </div>
            )}
          </div>
        </div>
      )}
      <div ref={endRef} className="ask-end" />
    </div>
  );
}

/** The question box: Enter sends, Shift+Enter is a new line, Stop while an answer is on its way. */
export function AskComposer({
  placeholder,
  onAsk,
  autoFocus = false,
}: {
  placeholder: string;
  onAsk: (q: string) => void;
  autoFocus?: boolean;
}) {
  const { pending, stop } = useAskChat();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // The box grows with the question, up to a few lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Back in the box once an answer is in.
  useEffect(() => {
    if (!pending) inputRef.current?.focus({ preventScroll: true });
  }, [pending]);

  const submit = () => {
    if (!text.trim() || pending) return;
    onAsk(text);
    setText('');
  };

  return (
    <form
      className="ask-composer"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        maxLength={4000}
        placeholder={placeholder}
        aria-label="Your question"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {pending ? (
        <button type="button" className="ask-send ask-send--stop" onClick={stop} aria-label="Stop answering">
          <StopIcon size={14} />
        </button>
      ) : (
        <button type="submit" className="ask-send" disabled={!text.trim()} aria-label="Send question">
          <SendIcon size={18} />
        </button>
      )}
    </form>
  );
}
