import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AiAvatar, AskComposer, AskSuggestionList, AskThread } from '../components/AskChat';
import { ErrorState } from '../components/States';
import { SparklesIcon } from '../components/icons';
import { api, type SavedSearch } from '../lib/api';
import { HELP_QUESTION, useAskChat } from '../lib/askChat';

/** Starting questions shown before the first one is asked; all about rental cars and the user's deals. */
type TopicKey = 'picks' | 'vans' | 'places' | 'prices' | 'sites' | 'tips';
const TOPICS: Array<{ key: TopicKey; label: string }> = [
  { key: 'picks', label: 'Best deals' },
  { key: 'vans', label: 'Vans & SUVs' },
  { key: 'places', label: 'Near a place' },
  { key: 'prices', label: 'Price changes' },
  { key: 'sites', label: 'Sites & companies' },
  { key: 'tips', label: 'Rental tips' },
];
/** Rows shown per topic before "Show more". */
const FIRST_ROWS = 4;

/** The search the questions are written for: the one chosen, or else the newest. */
function suggestionsFor(s: SavedSearch | undefined): Record<TopicKey, string[]> {
  // A town or ZIP the assistant can measure miles from; a whole-state search only names its state.
  const town = s?.zipCity ? `${s.zipCity}, ${s.zipState ?? ''}`.replace(/,\s*$/, '') : null;
  const where = town ? ` in ${town}` : s?.states?.[0] ? ` in ${s.states[0]}` : '';
  const near = s?.zip ?? town;
  const days = s?.rentalDays ?? 300;
  // Site names as the deals show them (the search keeps ids like 'priceline').
  const SITE: Record<string, string> = {
    skyscanner: 'Skyscanner',
    kayak: 'KAYAK',
    priceline: 'Priceline',
    enterprise: 'Enterprise.com',
    avis: 'Avis.com',
  };
  const sources = (s?.sources ?? []).map((x) => SITE[x] ?? x);
  const twoSites = sources.length >= 2 ? `${sources[0]} and ${sources[1]}` : 'Priceline and Enterprise.com';
  return {
    picks: [
      `What is the best deal for a ${days}-day rental${where}?`,
      'Which deals are under my target price right now?',
      `Give me my top 3 picks to quote a customer${where}, with the reason for each.`,
      `What is the cheapest minivan with unlimited mileage${where}?`,
      'What is the cheapest car of each class in my latest scan?',
    ],
    vans: [
      'Show 12 to 15 passenger vans under $2,000 per 30 days.',
      'What is the cheapest 7-seat SUV in my latest scan?',
      'Compare minivans and large SUVs on the 30-day price.',
      'Which minivans have free cancellation?',
      'Which passenger van gives the most seats for the money?',
    ],
    places: [
      s?.customerAddress
        ? `What is the cheapest van closest to ${s.customerAddress}?`
        : near
          ? `What is the cheapest minivan within 10 miles of ${near}?`
          : `Which branch${where} has the cheapest minivan?`,
      town ? `Which branch near ${town} has the most deals?` : `Which branch${where} has the most deals?`,
      'Are airport branches more expensive than neighbourhood branches?',
      town ? `What is the best deal within 25 miles of ${town}?` : `Which town${where} has the cheapest vans?`,
      'Which state or area has the cheapest minivans?',
    ],
    prices: [
      'Which deals dropped in price since the last scan?',
      'What new deals showed up in the latest scan?',
      'Are minivan prices going up or down over recent scans?',
      'Is now a good time to book, or should I wait?',
      'Which deals went up in price since the last scan?',
    ],
    sites: [
      `Compare ${twoSites} for minivans.`,
      'Which rental company is cheapest for vans?',
      'Which site has the most offers in my latest scan?',
      'Compare Hertz, Avis and Enterprise on the median 30-day price.',
      'Is the same car cheaper on another site?',
    ],
    tips: [
      `What should I check before booking a ${days}-day rental?`,
      'How do mileage limits work on a long-term rental?',
      'What extra fees do airport branches usually charge?',
      'How do insurance and damage cover work on a long rental?',
      HELP_QUESTION,
    ],
  };
}

export function AskPage() {
  const { turns, searchId, setSearchId, send, clear } = useAskChat();
  const [topic, setTopic] = useState<TopicKey>('picks');

  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api.config(),
    staleTime: 60_000,
  });
  const searches = useQuery({
    queryKey: ['searches'],
    queryFn: () => api.searches(),
    staleTime: 30_000,
  });

  const available = config.data?.chat?.available;
  const chosen = searches.data?.find((s) => s.id === searchId);
  const searchName = chosen?.name;
  // Questions are written for the chosen search, or the first in the list when asking about all.
  const suggestions = suggestionsFor(chosen ?? searches.data?.[0])[topic];
  const ask = (q: string) => send(q);

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
          <AskThread
            onAsk={ask}
            empty={
              <div className="ask-empty">
                <span className="ask-empty__orb">
                  <SparklesIcon size={28} />
                </span>
                <h2>Which car are you looking for?</h2>
                <p>
                  Ask about rental prices, vans, branches or price changes in{' '}
                  {searchName ? <strong>{searchName}</strong> : 'any of your searches'}.
                </p>
                <div className="ask-topics" role="tablist" aria-label="Question topics">
                  {TOPICS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={topic === t.key}
                      className={`ask-topic${topic === t.key ? ' is-active' : ''}`}
                      onClick={() => setTopic(t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <AskSuggestionList questions={suggestions} first={FIRST_ROWS} onAsk={ask} />
              </div>
            }
          />
          <AskComposer placeholder={searchName ? `Ask about ${searchName}…` : 'Ask about your deals…'} onAsk={ask} autoFocus />
          <p className="ask-note">
            AI can make mistakes. Check the price on the deal page before quoting a customer. Enter to send, Shift+Enter for a new line.
          </p>
        </div>
      )}
    </div>
  );
}
