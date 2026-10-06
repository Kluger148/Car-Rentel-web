import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { api } from '../lib/api';
import { dateTime, money } from '../lib/format';

/** The scheduler's master switch, its next run and what the scheduled scans are expected to cost. */
export function SchedulerBar() {
  const queryClient = useQueryClient();
  const scheduler = useQuery({ queryKey: ['scheduler'], queryFn: () => api.scheduler(), staleTime: 30_000 });
  const budget = useQuery({ queryKey: ['budget'], queryFn: () => api.budget(), staleTime: 30_000 });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => api.setSchedulerEnabled(enabled),
    onSuccess: (next) => queryClient.setQueryData(['scheduler'], next),
  });

  const s = scheduler.data;
  if (!s) return null;
  const b = budget.data;
  const overBudget = b?.monthlyBudgetUsd != null && s.monthlyUsd > b.monthlyBudgetUsd;

  let state: string;
  if (!s.configured) state = 'Not set up on the server (SCAN_CRON), so nothing runs automatically.';
  else if (!s.enabled) state = 'Off. No search runs automatically; "Run now" still works.';
  else if (b?.exceeded) state = "Stopped: this month's budget is reached.";
  else if (s.searches.length === 0) state = 'On, but no search is switched on.';
  else state = s.nextRunAt ? `Next run ${dateTime(s.nextRunAt)}` : 'On';

  return (
    <section className="card scheduler-bar" aria-label="Scheduler">
      <button
        type="button"
        role="switch"
        className="switch"
        aria-checked={s.enabled}
        aria-label="Scheduler"
        disabled={toggle.isPending}
        onClick={() => toggle.mutate(!s.enabled)}
      >
        <span className="switch__track" />
        <strong>Scheduler</strong>
      </button>
      <span className="scheduler-bar__state">{state}</span>

      {s.searches.length > 0 && (
        <span className="scheduler-bar__cost">
          Estimated <strong>≈ {money(s.monthlyUsd, 'USD', 2)}</strong> per month
          <span className="muted"> · ≈ {money(s.perCycleUsd, 'USD', 2)} if every search runs once</span>
          {s.unknownCosts > 0 && <span className="muted"> · {s.unknownCosts} not yet estimated</span>}
        </span>
      )}
      {overBudget && b?.monthlyBudgetUsd != null && (
        <span className="scheduler-bar__warn">
          Above the {money(b.monthlyBudgetUsd, 'USD', 2)} budget: scans will stop part-way through the month.{' '}
          <Link to="/profile">Change budget</Link>
        </span>
      )}
      {toggle.isError && (
        <span className="form-error" role="alert">
          {toggle.error.message}
        </span>
      )}
    </section>
  );
}
