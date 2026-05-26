import { useAppShell } from '../lib/app-shell.js';

export default function Profile() {
  const { bootstrap } = useAppShell();

  return (
    <div className="stack">
      <section className="card hero stack">
        <span className="pill pill-accent">Profile</span>
        <h1>{bootstrap.currentUser.username}</h1>
        <p>This profile area is a placeholder for now. It gives us a clean home for account settings later.</p>
      </section>

      <section className="card stack">
        <div>
          <h2 className="section-title">Coming soon</h2>
          <p className="muted">We can later add avatar uploads, password changes, notification preferences, and group activity here.</p>
        </div>

        <div className="list">
          <div className="list-item">
            <strong>Username</strong>
            <div className="muted">{bootstrap.currentUser.username}</div>
          </div>
          <div className="list-item">
            <strong>Role</strong>
            <div className="muted">{bootstrap.currentUser.isAdmin ? 'Admin' : 'Member'}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
