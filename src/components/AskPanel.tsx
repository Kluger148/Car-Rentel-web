import { useQuery } from '@tanstack/react-query';
import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import { AiAvatar, AskComposer, AskSuggestionList, AskThread } from './AskChat';
import { CloseIcon, ExternalIcon, SparklesIcon } from './icons';
import { api, type ChatContext } from '../lib/api';
import { HELP_QUESTION, useAskChat } from '../lib/askChat';

/**
 * Ask AI as a sidebar on every page (not on the Ask AI page itself). It knows the page it is opened
 * on, so "Is this a good deal?" on a deal page needs no explaining. Same conversation as the page.
 */

interface PageInfo {
  context: ChatContext;
  /** What the chip at the top says the questions are about. */
  label: string;
  questions: string[];
}

/** URL filter names on the deals page, in words for the chip. */
const FILTER_SKIP = new Set(['page', 'sort']);

function pageInfo(pathname: string, search: Record<string, unknown>, searchName: (id: number) => string | undefined): PageInfo {
  const deal = /^\/deal\/([0-9a-f]{40})/.exec(pathname);
  if (deal) {
    return {
      context: { page: 'deal', fingerprint: deal[1] },
      label: 'This deal',
      questions: [
        'Is this a good deal?',
        'Is the same car cheaper on another site or at a nearby branch?',
        'How has this car’s price changed over recent scans?',
        'What does this price include, and what should I check before booking?',
        'What are cheaper alternatives to this car with the same seats?',
      ],
    };
  }
  const deals = /^\/search\/(\d+)/.exec(pathname);
  if (deals) {
    const id = Number(deals[1]);
    const filters: Record<string, string> = {};
    for (const [k, v] of Object.entries(search)) {
      if (FILTER_SKIP.has(k) || v === undefined || v === null || v === '') continue;
      filters[k] = (Array.isArray(v) ? v.join(',') : String(v)).slice(0, 200);
    }
    const n = Object.keys(filters).length;
    return {
      context: { page: 'deals', searchId: id, ...(n ? { filters } : {}) },
      label: `${searchName(id) ?? `Search ${id}`}${n ? ` · ${n} filter${n === 1 ? '' : 's'}` : ''}`,
      questions: [
        'Which of these is the best deal, and why?',
        'Which of these are under my target price?',
        'Which of these have unlimited mileage and free cancellation?',
        'Compare the rental companies in these deals.',
        'Which of these dropped in price since the last scan?',
      ],
    };
  }
  if (pathname.startsWith('/runs')) {
    const id = typeof search.search === 'number' ? search.search : undefined;
    return {
      context: { page: 'runs', ...(id ? { searchId: id } : {}) },
      label: id ? `Scan history · ${searchName(id) ?? `Search ${id}`}` : 'Scan history',
      questions: [
        'Explain my last scan: what worked and what went wrong?',
        'Why did a scan find no offers?',
        'What changed in the last scan?',
        'How much have my recent scans cost?',
      ],
    };
  }
  if (pathname.startsWith('/favourites')) {
    return {
      context: { page: 'favourites' },
      label: 'My favourites',
      questions: [
        'Which of my favourites is cheapest now?',
        'Have any of my favourites changed price?',
        'Are any favourites missing from the latest scan?',
        'Which favourite would you pick for a customer, and why?',
      ],
    };
  }
  return {
    context: { page: pathname === '/' ? 'searches' : 'other' },
    label: 'All my searches',
    questions: [
      'What is the best deal across all my searches?',
      'Which deals dropped in price since the last scan?',
      'Which search has the most deals under my target?',
      'When did each search last scan?',
      HELP_QUESTION,
    ],
  };
}

/** The floating "Ask AI" button and the sidebar it opens. */
export function AskPanel() {
  const { turns, send, clear, panelOpen, setPanelOpen } = useAskChat();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({
    select: (s) => s.location.search as Record<string, unknown>,
  });
  // The chip can be removed: the next questions are then about everything, not this page.
  // Removed for one page only: a new page brings its own context back.
  const [unscopedOn, setUnscopedOn] = useState<string | null>(null);
  const scoped = unscopedOn !== pathname;
  const setScoped = (on: boolean) => setUnscopedOn(on ? null : pathname);

  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api.config(),
    staleTime: 60_000,
  });
  const searches = useQuery({
    queryKey: ['searches'],
    queryFn: () => api.searches(),
    staleTime: 30_000,
    enabled: panelOpen,
  });

  const onAskPage = pathname.startsWith('/ask');
  const info = useMemo(
    () => pageInfo(pathname, search, (id) => searches.data?.find((s) => s.id === id)?.name),
    [pathname, search, searches.data],
  );

  // The Ask AI page shows the same chat full size.
  useEffect(() => {
    if (onAskPage) setPanelOpen(false);
  }, [onAskPage, setPanelOpen]);

  // "/" opens the sidebar (outside text boxes); Escape closes it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey && !onAskPage) {
        e.preventDefault();
        setPanelOpen(true);
      } else if (e.key === 'Escape' && panelOpen) setPanelOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAskPage, panelOpen, setPanelOpen]);

  // While open on a wide screen, the page makes room instead of hiding under it.
  useEffect(() => {
    document.documentElement.classList.toggle('has-ask-panel', panelOpen);
    return () => document.documentElement.classList.remove('has-ask-panel');
  }, [panelOpen]);

  if (onAskPage || !config.data?.chat?.available) return null;

  const ask = (q: string) => send(q, scoped ? info.context : { page: 'other' });

  return (
    <>
      {!panelOpen && (
        <button type="button" className="ask-fab" onClick={() => setPanelOpen(true)} aria-label="Ask AI about this page" title="Ask AI (/)">
          <SparklesIcon size={18} />
          <span>Ask AI</span>
        </button>
      )}
      {panelOpen && (
        <aside className="ask-panel" aria-label="Ask AI">
          <header className="ask-panel__head">
            <AiAvatar />
            <strong>Ask AI</strong>
            <span className="ask-panel__tools">
              {turns.length > 0 && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={clear}>
                  New chat
                </button>
              )}
              <Link to="/ask" className="ask-icon-btn" aria-label="Open Ask AI full page" title="Open full page">
                <ExternalIcon size={15} />
              </Link>
              <button
                type="button"
                className="ask-icon-btn"
                onClick={() => setPanelOpen(false)}
                aria-label="Close Ask AI"
                title="Close (Esc)"
              >
                <CloseIcon size={16} />
              </button>
            </span>
          </header>

          <div className="ask-panel__context">
            {scoped ? (
              <span className="ask-chip">
                Using: <b>{info.label}</b>
                {info.context.page !== 'searches' && info.context.page !== 'other' && (
                  <button type="button" onClick={() => setScoped(false)} aria-label="Ask about everything instead">
                    <CloseIcon size={12} />
                  </button>
                )}
              </span>
            ) : (
              <button type="button" className="ask-chip ask-chip--off" onClick={() => setScoped(true)}>
                Asking about everything · use <b>{info.label}</b>
              </button>
            )}
          </div>

          <div className="ask-panel__body">
            <AskThread
              onAsk={ask}
              empty={
                <div className="ask-empty ask-empty--panel">
                  <span className="ask-empty__orb">
                    <SparklesIcon size={24} />
                  </span>
                  <h2>How can I help with this page?</h2>
                  <AskSuggestionList questions={scoped ? info.questions : pageInfo('/', {}, () => undefined).questions} onAsk={ask} />
                </div>
              }
            />
          </div>
          <div className="ask-panel__foot">
            <AskComposer
              placeholder={scoped && info.context.page === 'deal' ? 'Ask about this deal…' : 'Ask about your deals…'}
              onAsk={ask}
              autoFocus
            />
            <p className="ask-note">AI can make mistakes. Check the deal page before quoting a customer.</p>
          </div>
        </aside>
      )}
    </>
  );
}
