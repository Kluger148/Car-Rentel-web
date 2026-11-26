import { useState } from 'react';
import { overnightOf } from '../lib/api';
import { clockLabel } from '../lib/format';

const n = (v: number | undefined) => (v ?? 0).toLocaleString('en-US');

/** "Fri 11:00 PM" in the viewer's own time. */
function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
}

/**
 * The overnight Enterprise.com part of a scan ("whole area" mode): finding branches, pricing them
 * at night, or done. Renders nothing for a scan without one. `onStop` adds a Stop button.
 */
export function OvernightStatus({ meta, onStop, stopping = false }: { meta: unknown; onStop?: () => void; stopping?: boolean }) {
  const o = overnightOf(meta);
  const [confirming, setConfirming] = useState(false);
  // The time the line was drawn: the list refreshes often enough for "on a break" to stay right.
  const [now] = useState(() => Date.now());
  if (!o) return null;
  const window = o.window ? `${clockLabel(o.window.start)}-${clockLabel(o.window.end)} ET` : 'overnight';
  const total = (o.branchesDone ?? 0) + (o.branchesFailed ?? 0) + (o.branchesLeft ?? 0) || o.branchesQueued || 0;
  const finished = o.phase === 'done' || o.phase === 'ended' || o.evaluated === true;

  let text: string;
  if (finished) {
    const priced = o.branchesPriced ?? o.branchesDone ?? 0;
    text = `Enterprise.com: ${n(priced)} branches priced, ${n(o.offers)} offers`;
    if ((o.branchesDropped ?? 0) > 0) text += `, ${n(o.branchesDropped)} left out`;
  } else if (o.phase === 'queued' || o.phase === 'directory' || (total === 0 && (o.lookupsDone ?? 0) + (o.lookupsLeft ?? 0) > 0)) {
    text = `Enterprise.com: finding every branch in ${o.states?.join(', ') || 'the area'}`;
    if (o.lookupsDone) text += ` (${n(o.lookupsDone)} lookups done)`;
  } else {
    text = `Enterprise.com: ${n(o.branchesDone)} of ${n(total)} branches priced · ${n(o.offers)} offers`;
  }

  let wait = '';
  if (!finished) {
    const paced = o.schedule === 'paced';
    const onBreak = o.nextSittingAt && new Date(o.nextSittingAt).getTime() > now;
    if (!paced && o.waitingFor === 'night' && o.nextWindowAt) wait = `Runs ${window}; next start ${whenLabel(o.nextWindowAt)}`;
    else if (o.waitingFor) wait = `Waiting: ${o.waitingFor}`;
    else if (onBreak) wait = `On a break; next few branches at ${whenLabel(o.nextSittingAt!)}`;
    else wait = paced ? 'Working now, slowly with breaks' : `Working now, slowly with breaks (${window})`;
  }

  return (
    <div className={`overnight${finished ? ' is-done' : ''}`}>
      <span className="overnight__dot" aria-hidden="true" />
      <div className="overnight__body">
        <div>{text}</div>
        {wait && <div className="muted">{wait}</div>}
        {finished && o.note && <div className="muted">{o.note}</div>}
      </div>
      {onStop && !finished && (
        <span className="overnight__stop">
          {confirming ? (
            <>
              <button type="button" className="btn btn--danger btn--sm" disabled={stopping} onClick={onStop}>
                {stopping ? 'Stopping…' : 'Stop overnight'}
              </button>
              <button type="button" className="btn btn--ghost btn--sm" disabled={stopping} onClick={() => setConfirming(false)}>
                Keep going
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirming(true)}>
              Stop
            </button>
          )}
        </span>
      )}
    </div>
  );
}
