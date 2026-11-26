import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ErrorState } from '../components/States';
import {
  ArrowDownIcon,
  CheckIcon,
  CopyIcon,
  PinIcon,
  SendIcon,
  SparklesIcon,
  StopIcon,
  VanIcon,
} from '../components/icons';
import { api, ApiError, chatStream, type ChatDeal, type ChatMessage } from '../lib/api';
import { CLASS_LABEL, money } from '../lib/format';

/** One turn on screen: the text, and for answers the deals it links to. */
interface Turn extends ChatMessage {
  deals?: ChatDeal[];
  /** The answer ended in an error and is shown as one. */
  error?: boolean;
}

const STORE_KEY = 'ask-ai';
const SUGGESTIONS = [
  { title: 'Cheapest minivan', detail: 'in my latest scan', q: 'What is the cheapest minivan in my latest scan?' },
  { title: 'Price drops', detail: 'since the last scan', q: 'Which deals dropped in price since the last scan?' },
  { title: 'Compare sites', detail: 'Priceline vs Enterprise.com', q: 'Compare Priceline and Enterprise.com for 7-seat SUVs.' },
  { title: 'Big vans', detail: '12-15 seats under $2,000', q: 'Show 12 to 15 passenger vans under $2,000 per 30 days.' },
];

function loadStored(): { turns: Turn[]; searchId: number | null } {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as { turns?: Turn[]; searchId?: number | null };
      return { turns: Array.isArray(v.turns) ? v.turns : [], searchId: v.searchId ?? null };
    }
  } catch {
    // Blocked or broken storage: start empty.
  }
  return { turns: [], searchId: null };
}

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
      (table ??= []).push(line.slice(1, -1).split('|').map((c) => c.trim()));
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
        {d.imageUrl && !broken ? (
          <img src={d.imageUrl} alt="" loading="lazy" onError={() => setBroken(true)} />
        ) : (
          <VanIcon size={30} />
        )}
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

function AiAvatar() {
  return (
    <span className="ask-avatar" aria-hidden="true">
      <SparklesIcon size={16} />
    </span>
  );
}

export function AskPage() {
  const [turns, setTurns] = useState<Turn[]>(() => loadStored().turns);
  const [searchId, setSearchId] = useState<number | null>(() => loadStored().searchId);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const config = useQuery({ queryKey: ['config'], queryFn: () => api.config(), staleTime: 60_000 });
  const searches = useQuery({ queryKey: ['searches'], queryFn: () => api.searches(), staleTime: 30_000 });

  // Keep the conversation for this tab (a reload keeps it; a new tab starts fresh).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ turns, searchId }));
    } catch {
      // Blocked storage: the conversation just isn't kept on reload.
    }
  }, [turns, searchId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, pending, status, draft]);

  // The box grows with the question, up to a few lines.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  // Leaving the page cancels a question still being answered.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (q: string) => {
    const question = q.trim().slice(0, 4000);
    if (!question || pending) return;
    // Drop a failed answer and its question: the conversation must alternate user / assistant.
    let base = turns;
    if (base.at(-1)?.error) base = base.slice(0, -2);
    const next: Turn[] = [...base, { role: 'user', content: question }];
    setTurns(next);
    setText('');
    setPending(true);
    setStatus('Reading your question');
    setDraft('');
    const abort = new AbortController();
    abortRef.current = abort;
    // The API takes the last 40 messages and they must start with a question.
    const history = next.filter((t) => !t.error).slice(-39);
    const window = history[0]?.role === 'assistant' ? history.slice(1) : history;
    try {
      const reply = await chatStream(
        window.map(({ role, content }) => ({ role, content })),
        searchId ?? undefined,
        (e) => {
          // A lookup starting means any text so far was a note before it, not the answer.
          if (e.type === 'status') {
            setStatus(e.label);
            setDraft('');
          } else if (e.type === 'reset') setDraft('');
          else setDraft((d) => d + e.delta);
        },
        abort.signal,
      );
      setTurns((t) => [...t, { role: 'assistant', content: reply.reply, deals: reply.deals }]);
    } catch (err) {
      if (abort.signal.aborted) {
        // Stopped by the user: keep the question, show nothing more.
        setTurns((t) => [...t, { role: 'assistant', content: 'Stopped.', error: true }]);
      } else {
        const msg = err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
        setTurns((t) => [...t, { role: 'assistant', content: msg, error: true }]);
      }
    } finally {
      setPending(false);
      setStatus('');
      setDraft('');
      abortRef.current = null;
      inputRef.current?.focus();
    }
  };

  const clear = () => {
    abortRef.current?.abort();
    setTurns([]);
    inputRef.current?.focus();
  };

  const available = config.data?.chat?.available;
  const searchName = searches.data?.find((s) => s.id === searchId)?.name;
  const lastQuestion = [...turns].reverse().find((t) => t.role === 'user')?.content;

  return (
    <div className="container ask-page">
      <header className="ask-head">
        <div className="ask-head__title">
          <AiAvatar />
          <div>
            <h1>Ask AI</h1>
            <p>Answers from your latest scans, with a link to every deal.</p>
          </div>
        </div>
        <div className="ask-head__tools">
          <label className="ask-scope">
            <span className="sr-only">Search to ask about</span>
            <select value={searchId ?? ''} onChange={(e) => setSearchId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">All my searches</option>
              {(searches.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {turns.length > 0 && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={clear}>
              New chat
            </button>
          )}
        </div>
      </header>

      {config.isError && <ErrorState error={config.error} onRetry={() => void config.refetch()} />}
      {config.isPending && <div className="card skeleton" style={{ height: 220 }} />}

      {config.isSuccess && !available && (
        <div className="card state">
          <h2>Ask AI is not set up yet</h2>
          <p className="muted">The server needs an Anthropic API key (ANTHROPIC_API_KEY) before questions can be answered.</p>
        </div>
      )}

      {available && (
        <div className="ask-chat">
          <div className="ask-thread" aria-live="polite">
            {turns.length === 0 && !pending && (
              <div className="ask-empty">
                <span className="ask-empty__orb">
                  <SparklesIcon size={28} />
                </span>
                <h2>What would you like to know?</h2>
                <p>
                  Ask about prices, companies, branches or price changes in{' '}
                  {searchName ? <strong>{searchName}</strong> : 'any of your searches'}.
                </p>
                <div className="ask-suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s.q} type="button" className="ask-suggestion" onClick={() => void send(s.q)}>
                      <span className="ask-suggestion__title">{s.title}</span>
                      <span className="ask-suggestion__detail">{s.detail}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void send(lastQuestion)}>
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

          <form
            className="ask-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(text);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              maxLength={4000}
              placeholder={searchName ? `Ask about ${searchName}…` : 'Ask about your deals…'}
              aria-label="Your question"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(text);
                }
              }}
            />
            {pending ? (
              <button type="button" className="ask-send ask-send--stop" onClick={() => abortRef.current?.abort()} aria-label="Stop answering">
                <StopIcon size={14} />
              </button>
            ) : (
              <button type="submit" className="ask-send" disabled={!text.trim()} aria-label="Send question">
                <SendIcon size={18} />
              </button>
            )}
          </form>
          <p className="ask-note">
            AI can make mistakes. Check the price on the deal page before quoting a customer. Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      )}
    </div>
  );
}
