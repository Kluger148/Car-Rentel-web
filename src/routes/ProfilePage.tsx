import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { SettingsTabs } from '../components/SettingsTabs';
import { ErrorState } from '../components/States';
import { api, auth, type Budget, type User } from '../lib/api';
import { dateTime, money } from '../lib/format';

const resetDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function DetailsForm({ user }: { user: User }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(user.name ?? '');
  const [email, setEmail] = useState(user.email);

  const save = useMutation({
    mutationFn: () => api.updateProfile({ name: name.trim() || null, email: email.trim() }),
    onSuccess: (next) => {
      queryClient.setQueryData(['profile'], next);
      // The top bar reads the name from the stored session.
      if (auth.session) auth.set({ ...auth.session, user: next });
    },
  });
  const dirty = name.trim() !== (user.name ?? '') || email.trim().toLowerCase() !== user.email;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <form className="card section search-form" onSubmit={submit}>
      <h2>Your details</h2>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Name</span>
          <input value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Email (used to sign in)</span>
          <input type="email" required value={email} autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
      </div>
      {save.isError && (
        <p className="form-error" role="alert">
          {save.error.message}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save details'}
        </button>
        {save.isSuccess && !dirty && <span className="form-ok">Saved</span>}
      </div>
    </form>
  );
}

function BudgetForm({ budget }: { budget: Budget }) {
  const queryClient = useQueryClient();
  const scheduler = useQuery({ queryKey: ['scheduler'], queryFn: () => api.scheduler(), staleTime: 30_000 });
  const planned = scheduler.data && scheduler.data.searches.length > 0 ? scheduler.data.monthlyUsd : null;
  const [amount, setAmount] = useState(budget.monthlyBudgetUsd === null ? '' : String(budget.monthlyBudgetUsd));

  const save = useMutation({
    mutationFn: (usd: number | null) => api.setBudget(usd),
    onSuccess: (next) => queryClient.setQueryData(['budget'], next),
  });

  const parsed = Number.parseFloat(amount);
  const valid = Number.isFinite(parsed) && parsed > 0;
  const dirty = valid && parsed !== budget.monthlyBudgetUsd;
  const limit = budget.monthlyBudgetUsd;
  const pct = limit === null ? 0 : Math.min(100, (budget.spentUsd / limit) * 100);
  const resets = resetDate.format(new Date(budget.periodEnd));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) save.mutate(parsed);
  };

  return (
    <form className="card section search-form" onSubmit={submit}>
      <h2>Monthly Apify budget</h2>
      <p className="muted">
        Scheduled scans stop for the rest of the month once Apify spend reaches this amount, and start again on{' '}
        {resets}. The budget is shared by everyone who signs in. "Run now" still works after the budget is reached.
      </p>

      <div className={`budget${budget.exceeded ? ' budget--over' : ''}`}>
        <div className="budget__figures">
          <span>
            <strong>{money(budget.spentUsd, 'USD', 2)}</strong> spent this month
          </span>
          <span>{limit === null ? 'No budget set' : `of ${money(limit, 'USD', 2)}`}</span>
        </div>
        {limit !== null && (
          <div
            className="budget__bar"
            role="progressbar"
            aria-label="Budget used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <span style={{ width: `${pct}%` }} />
          </div>
        )}
        {budget.exceeded ? (
          <p className="budget__note budget__note--over" role="status">
            Budget reached: scheduled scans are stopped until {resets}. Raise the budget to resume sooner.
          </p>
        ) : (
          limit !== null && (
            <p className="budget__note">
              {money(budget.remainingUsd, 'USD', 2)} left until {resets}.
            </p>
          )
        )}
      </div>

      {planned !== null && (
        <p className="muted">
          The searches switched on now are expected to cost about <strong>{money(planned, 'USD', 2)}</strong> per
          month at their current schedules
          {limit !== null && planned > limit ? ', which is above this budget.' : '.'}
        </p>
      )}

      <div className="form-grid">
        <label className="field">
          <span className="field__label">Budget per month (USD)</span>
          <input
            type="number"
            min={1}
            step="0.01"
            inputMode="decimal"
            placeholder="No limit"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
      </div>
      {save.isError && (
        <p className="form-error" role="alert">
          {save.error.message}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={!dirty || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save budget'}
        </button>
        {limit !== null && (
          <button type="button" className="btn btn--ghost" disabled={save.isPending} onClick={() => save.mutate(null)}>
            Remove budget
          </button>
        )}
        {budget.updatedAt && (
          <span className="muted">
            Last changed {dateTime(budget.updatedAt)}
            {budget.updatedBy && ` by ${budget.updatedBy}`}
          </span>
        )}
      </div>
    </form>
  );
}

export function ProfilePage() {
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.profile() });
  const budget = useQuery({ queryKey: ['budget'], queryFn: () => api.budget() });

  return (
    <div className="container container--narrow">
      <div className="page-head">
        <h1>Profile</h1>
        <p>Your details and the monthly spending limit for scheduled scans.</p>
      </div>
      <SettingsTabs active="profile" />

      {profile.isError && <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />}
      {profile.data && <DetailsForm user={profile.data} />}

      {budget.isError && <ErrorState error={budget.error} onRetry={() => void budget.refetch()} />}
      {/* Keyed on the saved amount so the input resets to it after a save or removal. */}
      {budget.data && <BudgetForm key={String(budget.data.monthlyBudgetUsd)} budget={budget.data} />}
    </div>
  );
}
