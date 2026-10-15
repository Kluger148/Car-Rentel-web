import { useEffect, useRef } from 'react';

interface FieldHelp {
  name: string;
  what: string;
  tip?: string;
}

/** What each field of the search form does, in the order the form shows them. */
const FIELDS: FieldHelp[] = [
  {
    name: 'Starting ZIP',
    what: "The customer's ZIP code. Distances to every rental branch are measured from here.",
    tip: 'Cannot be changed after saving: create a new search for a different area.',
  },
  {
    name: 'Max distance (miles)',
    what: 'How far from the ZIP a branch may be. Every town with a ZIP inside this distance becomes a place to search, and offers from branches further away are dropped.',
    tip: '50 miles suits a local customer. Wider areas cover more branches but take longer to scan.',
  },
  {
    name: 'States (optional)',
    what: 'Only search towns in these states, and drop offers from branches in other states. Empty = any state within the distance.',
    tip: 'Useful near a state line, e.g. NJ only for a customer who will not cross into NY.',
  },
  {
    name: 'Rental companies (optional)',
    what: 'Keep only offers from these companies (Avis, Budget, Hertz…). Empty = every company. The booking sites that sell them (eDreams, Trip.com…) are not filtered.',
  },
  {
    name: 'Pickup date',
    what: 'The day the customer collects the vehicle. Every search is one complete 330-day rental from this date, returned to the same branch.',
    tip: 'If the date passes, scheduled scans move it to tomorrow automatically.',
  },
  {
    name: 'Flexible pickup',
    what: 'Also price the same rental starting 1, 2 or 3 weeks later (one extra date per week). The cheapest date is shown on each deal, and every offer shows its own pickup date.',
    tip: 'Long-term prices change a lot with the pickup day. Each extra date adds one search per place, so it costs and takes longer.',
  },
  {
    name: 'Places to search',
    what: 'How many towns in range are searched on Skyscanner, largest first. More places reach smaller suburban branches, which are often cheaper than airports.',
    tip: 'Up to 15 is quick (a few minutes); up to 100 takes about 15 minutes per pickup date.',
  },
  {
    name: 'Repeat',
    what: 'How often the search re-runs on its own once automatic runs are switched on: daily, weekly, every 15 or every 30 days. Price drops and new deals are flagged after each scan.',
  },
  {
    name: 'Name and Notes (optional)',
    what: 'Your own labels, e.g. the customer name and what they asked for. Without a name, the search is named after the ZIP, distance and date.',
  },
];

/** Explains every field of the new / edit search form. */
export function SearchHelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog dialog--wide"
      aria-labelledby="search-help-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="dialog__body">
        <h2 id="search-help-title" className="dialog__title">
          How a search works
        </h2>
        <p className="dialog__sub">
          A search looks on Skyscanner for complete 330-day rentals around the customer's ZIP and keeps the cheapest
          offer for each car. Prices are shown as an average per 30 days (the 330-day total ÷ 11).
        </p>
        <dl className="help-list">
          {FIELDS.map((f) => (
            <div key={f.name} className="help-list__item">
              <dt>{f.name}</dt>
              <dd>
                {f.what}
                {f.tip && <span className="help-list__tip">{f.tip}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <div className="help-note">
          <strong>Before you save</strong>
          <span>
            The line under the fields shows each scan's searches, time and cost (places × pickup dates). <em>Preview
            places</em> lists the towns that will be searched; nothing is saved or charged until you press{' '}
            <em>Save search</em>, and nothing is scanned until you press <em>Run now</em> or switch on automatic runs.
          </span>
        </div>
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
          Got it
        </button>
      </div>
    </dialog>
  );
}
