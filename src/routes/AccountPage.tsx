import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { SettingsTabs } from '../components/SettingsTabs';
import { ErrorState } from '../components/States';
import { api, auth } from '../lib/api';
import { dateTime, fullDate } from '../lib/format';

/** Same minimum the API enforces (auth/crypto.ts). */
const MIN_PASSWORD_LENGTH = 12;

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const change = useMutation({
    mutationFn: () => api.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
    },
    onError: (e) => setError(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    change.reset();
    if (next.length < MIN_PASSWORD_LENGTH) return setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    if (next !== confirm) return setError('The new passwords do not match');
    change.mutate();
  };

  return (
    <form className="card section search-form" onSubmit={submit}>
      <h2>Change password</h2>
      <div className="form-grid">
        <label className="field">
          <span className="field__label">Current password</span>
          <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">New password</span>
          <input type="password" required autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">Repeat new password</span>
          <input type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn--primary" disabled={change.isPending}>
          {change.isPending ? 'Changing…' : 'Change password'}
        </button>
        {change.isSuccess && <span className="form-ok">Password changed</span>}
        <span className="muted">At least {MIN_PASSWORD_LENGTH} characters.</span>
      </div>
    </form>
  );
}

export function AccountPage() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => api.profile() });
  const user = profile.data;

  const signOut = () => {
    auth.set(null);
    queryClient.clear();
  };

  return (
    <div className="container container--narrow">
      <div className="page-head">
        <h1>Account</h1>
        <p>Sign-in details and password.</p>
      </div>
      <SettingsTabs active="account" />

      {profile.isError && <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />}
      {user && (
        <section className="card section">
          <h2>Sign-in</h2>
          <div className="detail-grid">
            <div>
              <div className="detail__label">Email</div>
              <div>{user.email}</div>
            </div>
            <div>
              <div className="detail__label">Last sign-in</div>
              <div>{user.lastLoginAt ? dateTime(user.lastLoginAt) : '—'}</div>
            </div>
            {user.createdAt && (
              <div>
                <div className="detail__label">Account created</div>
                <div>{fullDate(user.createdAt.slice(0, 10))}</div>
              </div>
            )}
          </div>
          <div className="form-actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn btn--ghost" onClick={signOut}>
              Sign out
            </button>
          </div>
        </section>
      )}

      <PasswordForm />
    </div>
  );
}
