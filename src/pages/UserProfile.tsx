import { Link, Navigate, useParams } from 'react-router-dom';
import UserAvatar from '../components/UserAvatar.js';
import { useAppShell } from '../lib/app-shell.js';

export default function UserProfile() {
  const { bootstrap } = useAppShell();
  const params = useParams();
  const userId = Number(params.userId);

  if (!Number.isInteger(userId) || userId <= 0) {
    return <Navigate to="/" replace />;
  }

  if (userId === bootstrap.currentUser.id) {
    return <Navigate to="/profile" replace />;
  }

  const user = bootstrap.users.find((entry) => entry.id === userId) ?? null;

  return (
    <div className="stack">
      {!user ? (
        <section className="card stack">
          <h1 className="page-title">User not found</h1>
          <p className="muted">That profile is not available.</p>
          <div className="inline-actions">
            <Link className="button-ghost" to="/">
              Back home
            </Link>
          </div>
        </section>
      ) : (
        <section className="card stack">
          <div className="row section-header">
            <div className="profile-summary">
              <UserAvatar
                className="profile-avatar"
                username={user.username}
                avatarUrl={user.avatarUrl}
                ariaHidden
              />

              <div className="stack profile-summary-copy">
                <div>
                  <h1 className="page-title">{user.username}</h1>
                  <p className="muted profile-status-copy">{user.status || 'No status yet.'}</p>
                </div>
              </div>
            </div>

            <Link className="button-ghost" to="/">
              Back
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
