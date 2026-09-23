import { useState, type FormEvent } from 'react';
import { VanIcon } from '../components/icons';
import { api, auth } from '../lib/api';

/** Internal tool: two authorised users, accounts created by the admin from the backend CLI. */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      auth.set(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form className="card login__card" onSubmit={(e) => void submit(e)}>
        <div className="brand" style={{ justifyContent: 'center' }}>
          <span className="brand__mark">
            <VanIcon size={17} />
          </span>
          VanScan
        </div>
        <h1 className="login__title">Sign in</h1>
        <p className="login__sub">Internal deal finder. Access is limited to authorised staff.</p>

        <label className="field">
          <span className="field__label">Email</span>
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Password</span>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
