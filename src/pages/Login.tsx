import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, hasSessionToken } from '../lib/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hasSessionToken()) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await api.login({ username, password });
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <img className="login-logo" src="/sidebets-logo.png" alt="SideBets logo" />

        <section className="card stack">
          <div>
            <h2 className="section-title">Log in</h2>
            <p className="muted">Sessions stay in local storage until you log out.</p>
          </div>

          <form className="stack" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                className="input"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="page-actions">
              <button className="button" type="submit" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          {error ? <div className="error">{error}</div> : null}
        </section>
      </div>
    </div>
  );
}
