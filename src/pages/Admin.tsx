import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAppShell } from '../lib/app-shell.js';
import type { UserSummary } from '../lib/types.js';

type UserDraft = {
  username: string;
  password: string;
  isAdmin: boolean;
};

const emptyUserDraft: UserDraft = {
  username: '',
  password: '',
  isAdmin: false
};

function buildDraftMap(users: UserSummary[]) {
  return Object.fromEntries(
    users.map((user) => [
      user.id,
      {
        username: user.username,
        password: '',
        isAdmin: user.isAdmin
      }
    ])
  ) as Record<number, UserDraft>;
}

export default function Admin() {
  const { bootstrap, refreshBootstrap } = useAppShell();
  const [newUser, setNewUser] = useState<UserDraft>(emptyUserDraft);
  const [userDrafts, setUserDrafts] = useState<Record<number, UserDraft>>(() => buildDraftMap(bootstrap.users));
  const [creatingUser, setCreatingUser] = useState(false);
  const [savingUserId, setSavingUserId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedUsers = useMemo(() => [...bootstrap.users].sort((a, b) => a.username.localeCompare(b.username)), [bootstrap.users]);

  useEffect(() => {
    setUserDrafts(buildDraftMap(bootstrap.users));
  }, [bootstrap.users]);

  if (!bootstrap.currentUser.isAdmin) {
    return <Navigate to="/" replace />;
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingUser(true);
    setError(null);
    setNotice(null);

    try {
      await api.createUser(newUser);
      await refreshBootstrap();
      setNewUser(emptyUserDraft);
      setNotice(`Created ${newUser.username}.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create user.');
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleSaveUser(userId: number) {
    const draft = userDrafts[userId];

    if (!draft) {
      return;
    }

    setSavingUserId(userId);
    setError(null);
    setNotice(null);

    try {
      await api.updateUser(userId, {
        username: draft.username,
        password: draft.password || undefined,
        isAdmin: draft.isAdmin
      });
      await refreshBootstrap();
      setNotice(`Updated ${draft.username}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update user.');
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <div className="stack">
      <section className="card hero stack">
        <span className="pill pill-accent">Admin space</span>
        <h1>User management for SideBets.</h1>
        <p>Use this area to create test accounts, promote admins, and rotate passwords without leaving the app.</p>
        <div className="meta">
          <span className="pill">Signed in as {bootstrap.currentUser.username}</span>
          <span className="pill">{bootstrap.users.length} total users</span>
        </div>
      </section>

      <section className="card stack">
        <div>
          <h2 className="section-title">Create a user</h2>
          <p className="muted">New users can immediately log in and join private groups.</p>
        </div>

        <form className="stack" onSubmit={handleCreateUser}>
          <div className="field">
            <label htmlFor="new-username">Username</label>
            <input
              id="new-username"
              className="input"
              autoFocus
              placeholder="casey"
              value={newUser.username}
              onChange={(event) => setNewUser((current) => ({ ...current, username: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="new-password">Password</label>
            <input
              id="new-password"
              className="input"
              type="password"
              placeholder="At least 8 characters"
              value={newUser.password}
              onChange={(event) => setNewUser((current) => ({ ...current, password: event.target.value }))}
            />
          </div>

          <label className="checkbox-item">
            <input
              type="checkbox"
              checked={newUser.isAdmin}
              onChange={(event) => setNewUser((current) => ({ ...current, isAdmin: event.target.checked }))}
            />
            <div>
              <strong>Grant admin access</strong>
              <div className="muted">Admins can view hidden bets and manage all users and groups.</div>
            </div>
          </label>

          <div className="page-actions">
            <button className="button" type="submit" disabled={creatingUser}>
              {creatingUser ? 'Creating user…' : 'Create user'}
            </button>
          </div>
        </form>
      </section>

      <section className="card stack">
        <div className="row section-header">
          <div>
            <h2 className="section-title">Existing users</h2>
            <p className="muted">Edit usernames, toggle admin access, or set a fresh password.</p>
          </div>
        </div>

        {notice ? <div className="success">{notice}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <div className="list">
          {sortedUsers.map((user) => {
            const draft = userDrafts[user.id] ?? {
              username: user.username,
              password: '',
              isAdmin: user.isAdmin
            };

            return (
              <div key={user.id} className="list-item stack">
                <div className="row">
                  <strong>{draft.username}</strong>
                  <span className="pill">{draft.isAdmin ? 'Admin' : 'Member'}</span>
                </div>

                <div className="field">
                  <label htmlFor={`username-${user.id}`}>Username</label>
                  <input
                    id={`username-${user.id}`}
                    className="input"
                    value={draft.username}
                    onChange={(event) =>
                      setUserDrafts((current) => ({
                        ...current,
                        [user.id]: {
                          ...draft,
                          username: event.target.value
                        }
                      }))
                    }
                  />
                </div>

                <div className="field">
                  <label htmlFor={`password-${user.id}`}>New password</label>
                  <input
                    id={`password-${user.id}`}
                    className="input"
                    type="password"
                    placeholder="Leave blank to keep the current password"
                    value={draft.password}
                    onChange={(event) =>
                      setUserDrafts((current) => ({
                        ...current,
                        [user.id]: {
                          ...draft,
                          password: event.target.value
                        }
                      }))
                    }
                  />
                </div>

                <label className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={draft.isAdmin}
                    onChange={(event) =>
                      setUserDrafts((current) => ({
                        ...current,
                        [user.id]: {
                          ...draft,
                          isAdmin: event.target.checked
                        }
                      }))
                    }
                  />
                  <div>
                    <strong>Admin access</strong>
                    <div className="muted">This unlocks the dedicated admin area and full bet visibility.</div>
                  </div>
                </label>

                <div className="inline-actions">
                  <button
                    type="button"
                    className="button-secondary"
                    disabled={savingUserId === user.id}
                    onClick={() => void handleSaveUser(user.id)}
                  >
                    {savingUserId === user.id ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
