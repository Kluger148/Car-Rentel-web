import { useEffect, useRef } from 'react';

interface FieldHelp {
  name: string;
  what: string;
  tip?: string;
}

/** What each field of the search form does, in the order the form shows them. */
const FIELDS: FieldHelp[] = [
  {
    name: 'Search prices on',
    what: 'The sites to search: Skyscanner (booking sites plus Hertz and Sixt direct), Priceline (the rental companies through Priceline, the same prices as priceline.com) and KAYAK. Tick one or more: the same car from several sites becomes one deal, cheapest first.',
    tip: 'Priceline is free on the current plan and usually best for minivans and vans. KAYAK is slower and charged per offer.',
  },
  {
    name: 'ZIP code (optional)',
    what: "The customer's ZIP code. Distances to every rental branch are measured from here. Leave it empty to search every town in the chosen states instead.",
    tip: 'Cannot be changed after saving: create a new search for a different area.',
  },
  {
    name: 'Max distance (miles)',
    what: 'How far from the ZIP a branch may be. Every town with a ZIP inside this distance becomes a place to search, and offers from branches further away are dropped. Only used with a ZIP.',
    tip: '50 miles suits a local customer. Wider areas cover more branches but take longer to scan.',
  },
  {
    name: 'States',
    what: 'Only search towns in these states, and drop offers from branches in other states. With a ZIP this is optional (empty = any state within the distance). Without a ZIP it is required: every town in these states is searched, biggest first.',
    tip: 'Useful near a state line, e.g. NJ only for a customer who will not cross into NY. Check the code: AK is Alaska, AL is Alabama.',
  },
  {
    name: 'Rental companies (optional)',
    what: 'Keep only offers from these companies (Avis, Budget, Hertz…). Empty = every company. The booking sites that sell them (eDreams, Trip.com…) are not filtered.',
  },
  {
    name: 'Car types (optional)',
    what: 'The car types the customer wants (Minivan, Passenger van, Full-size SUV…). The search still finds every type, but its deals page opens filtered to these. Empty = every type.',
    tip: 'The filter can be changed or cleared on the deals page at any time.',
  },
  {
    name: 'Pickup date',
    what: 'The day the customer collects the vehicle. Each search is one complete rental from this date, returned to the same branch: 330 days on Skyscanner and KAYAK, 300 days on Priceline (Priceline prices at most 310 days, and 10 whole months is cheapest there). Prices are compared per 30 days.',
    tip: 'If the date passes, scheduled scans move it to tomorrow automatically.',
  },
  {
    name: 'Flexible pickup',
    what: 'Also price the same rental starting 1, 2 or 3 weeks later (one extra date per week). The cheapest date is shown on each deal, and every offer shows its own pickup date.',
    tip: 'Long-term prices change a lot with the pickup day. Each extra date adds one search per place, so it costs and takes longer.',
  },
  {
    name: 'Priceline pickup dates',
    what: 'Shown when Priceline is ticked and Flexible pickup is on. "One day a week" prices the same dates as the other sites (e.g. Nov 2, 9, 16). "Every day" makes Priceline try every pickup day in the window (Nov 2, 3, 4 … 16) and keep each car\'s cheapest day: the same car at the same branch can be $50–100 a month cheaper on another day.',
    tip: 'Every day means one Priceline search per place per day: about 5 times the searches and time of weekly dates. Skyscanner and KAYAK always stay one day a week. On the deals page, the Pickup date filter shows each day\'s cheapest price.',
  },
  {
    name: 'Places to search',
    what: 'How many towns in the area (within the distance, or in the states) are searched, largest first. "All places in the area" (the default) searches every town on Skyscanner and Priceline; KAYAK always searches only the 15 biggest. More places reach smaller suburban branches, which are often cheaper than airports.',
    tip: 'Up to 100 places takes about 15 minutes per pickup date. A whole state (NY has 1,628 towns) takes a few hours and about $1.30–2.60 per pickup date on Skyscanner, so repeat big areas weekly. Press Preview places to see the count first.',
  },
  {
    name: 'Repeat',
    what: 'How often the search re-runs on its own once automatic runs are switched on: daily, weekly, every 15 or every 30 days. Price drops and new deals are flagged after each scan.',
  },
  {
    name: 'Name and Notes (optional)',
    what: 'Your own labels, e.g. the customer name and what they asked for. Without a name, the search is named after the ZIP, distance and date (or, without a ZIP, the states and date).',
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
          A search looks on Skyscanner, Priceline and KAYAK for complete long-term rentals around the customer's ZIP, or
          across whole states, and keeps the cheapest offer for each car. Prices are shown as an average per 30 days (the
          total ÷ the number of days × 30), so 300-day and 330-day rentals compare fairly.
        </p>
        <div className="help-note">
          <strong>Where to search: give a ZIP, a state, or both</strong>
          <span>
            <em>State only</em> (no ZIP): every town in the states, e.g. NY = all 1,628 New York towns.{' '}
            <em>ZIP + distance</em>: every town within the distance, in any state, e.g. ZIP 10950 + 50 miles = 624 towns in
            NY, NJ, CT and PA. <em>ZIP + distance + states</em>: only towns that are both, e.g. ZIP 10950 + 50 miles + NY =
            345 towns. A ZIP always needs a distance. If nothing matches, the message lists the states that are near the ZIP.
          </span>
        </div>
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
        <div className="help-note">
          <strong>Deleting a search</strong>
          <span>
            The trash icon in the saved searches list deletes the search with all its scans, prices, price history and
            favourites, after you confirm. It cannot be undone. To keep a search but stop its scans, switch{' '}
            <em>Scheduled</em> off instead.
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
