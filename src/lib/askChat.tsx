import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ApiError, chatStream, type ChatContext, type ChatDeal, type ChatMessage } from './api';

/**
 * Ask AI's conversation, shared by the Ask AI page and the sidebar on every other page: a question
 * started in one carries on in the other, and keeps being answered while the user moves around.
 */

/** One turn on screen: the text, and for answers the deals it links to. */
export interface Turn extends ChatMessage {
  deals?: ChatDeal[];
  /** The answer ended in an error and is shown as one. */
  error?: boolean;
}

export const HELP_QUESTION = 'What can I ask Ask AI?';
export const HELP_ANSWER = [
  'I answer questions about the rental deals in your VanScan searches, using your latest scans. For example:',
  '- **Best deals**: the cheapest minivan, SUV or passenger van, deals under your target, a top pick to quote a customer.',
  '- **Places**: deals near a ZIP, town or customer address, the closest branch, airport vs neighbourhood branches.',
  '- **Prices over time**: price drops, new deals, whether prices are rising, one car’s price history.',
  '- **Sites and companies**: Priceline vs Enterprise.com vs Avis.com vs Skyscanner vs KAYAK, which company is cheapest.',
  '- **Scans and favourites**: why a scan found nothing, what it cost, which favourite is cheapest now.',
  '- **Rental basics**: mileage limits, fees, insurance, deposits and cancellation on long rentals.',
  'Open Ask AI from any page and I know what you are looking at: on a deal, just ask “Is this a good deal?”.',
  'Every deal I name links to its page. I can’t run scans or book cars: use Run now on a search, or View deal on a deal page.',
].join('\n');

const STORE_KEY = 'ask-ai';

interface Stored {
  turns: Turn[];
  searchId: number | null;
}

function loadStored(): Stored {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<Stored>;
      return {
        turns: Array.isArray(v.turns) ? v.turns : [],
        searchId: v.searchId ?? null,
      };
    }
  } catch {
    // Blocked or broken storage: start empty.
  }
  return { turns: [], searchId: null };
}

interface AskChatState {
  turns: Turn[];
  pending: boolean;
  /** What is being looked up while an answer is on its way. */
  status: string;
  /** The answer as it is being written. */
  draft: string;
  /** The search the Ask AI page asks about; null = all searches. */
  searchId: number | null;
  setSearchId: (id: number | null) => void;
  /** Asks a question. `context` says which page it is asked from (the sidebar sends it). */
  send: (question: string, context?: ChatContext) => void;
  stop: () => void;
  clear: () => void;
  /** The sidebar is open. */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}

const AskChat = createContext<AskChatState | null>(null);

export function AskChatProvider({ children }: { children: ReactNode }) {
  const [turns, setTurns] = useState<Turn[]>(() => loadStored().turns);
  const [searchId, setSearchId] = useState<number | null>(() => loadStored().searchId);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  const [draft, setDraft] = useState('');
  const [panelOpen, setPanelOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  // The latest turns, for send() without re-creating it on every change.
  const turnsRef = useRef(turns);
  useLayoutEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  // Keep the conversation for this tab (a reload keeps it; a new tab starts fresh).
  useEffect(() => {
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify({ turns, searchId }));
    } catch {
      // Blocked storage: the conversation just isn't kept on reload.
    }
  }, [turns, searchId]);

  // Signing out (the provider unmounts) cancels a question still being answered.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = useCallback(
    (q: string, context?: ChatContext) => {
      const question = q.trim().slice(0, 4000);
      if (!question || abortRef.current) return;
      // Drop a failed answer and its question: the conversation must alternate user / assistant.
      let base = turnsRef.current;
      if (base.at(-1)?.error) base = base.slice(0, -2);
      // "What can I ask?" is answered here: no lookup, no cost.
      if (question === HELP_QUESTION) {
        setTurns([...base, { role: 'user', content: question }, { role: 'assistant', content: HELP_ANSWER }]);
        return;
      }
      const next: Turn[] = [...base, { role: 'user', content: question }];
      setTurns(next);
      setPending(true);
      setStatus('Reading your question');
      setDraft('');
      const abort = new AbortController();
      abortRef.current = abort;
      // The API takes the last 40 messages and they must start with a question.
      const history = next.filter((t) => !t.error).slice(-39);
      const window = history[0]?.role === 'assistant' ? history.slice(1) : history;
      void chatStream(
        window.map(({ role, content }) => ({ role, content })),
        context ? undefined : (searchId ?? undefined),
        (e) => {
          // A lookup starting means any text so far was a note before it, not the answer.
          if (e.type === 'status') {
            setStatus(e.label);
            setDraft('');
          } else if (e.type === 'reset') setDraft('');
          else setDraft((d) => d + e.delta);
        },
        abort.signal,
        context,
      )
        .then((reply) => setTurns((t) => [...t, { role: 'assistant', content: reply.reply, deals: reply.deals }]))
        .catch((err: unknown) => {
          const msg = abort.signal.aborted ? 'Stopped.' : err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
          setTurns((t) => [...t, { role: 'assistant', content: msg, error: true }]);
        })
        .finally(() => {
          setPending(false);
          setStatus('');
          setDraft('');
          abortRef.current = null;
        });
    },
    [searchId],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const clear = useCallback(() => {
    abortRef.current?.abort();
    setTurns([]);
  }, []);

  const value = useMemo<AskChatState>(
    () => ({
      turns,
      pending,
      status,
      draft,
      searchId,
      setSearchId,
      send,
      stop,
      clear,
      panelOpen,
      setPanelOpen,
    }),
    [turns, pending, status, draft, searchId, send, stop, clear, panelOpen],
  );
  return <AskChat.Provider value={value}>{children}</AskChat.Provider>;
}

export function useAskChat(): AskChatState {
  const v = useContext(AskChat);
  if (!v) throw new Error('useAskChat needs AskChatProvider');
  return v;
}
