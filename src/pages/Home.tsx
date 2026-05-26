import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import type { GroupSummary } from '../lib/types.js';

export default function Home() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadGroups() {
    setLoading(true);
    setError(null);

    try {
      const nextGroups = await api.listGroups();
      setGroups(nextGroups);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your groups.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroups();
  }, []);

  return (
    <div className="stack">
      <section className="card hero stack">
        <h1>Your private groups.</h1>
        <p>
          Start a new group with a short guided flow, then keep every bet scoped to the people who should actually see
          it.
        </p>
        <div className="button-row">
          <Link className="button" to="/groups/new">
            Create new group
          </Link>
        </div>
      </section>

      <section className="card stack">
        <div className="row section-header">
          <div>
            <h2 className="section-title">Your groups</h2>
          </div>
        </div>

        {error ? <div className="error">{error}</div> : null}

        {loading ? <div className="muted">Loading groups…</div> : null}

        {!loading && groups.length === 0 ? (
          <div className="empty-state">No groups yet for this user. Create one above to get started.</div>
        ) : (
          <div className="group-grid">
            {groups.map((group) => (
              <Link key={group.id} to={`/groups/${group.id}`} className="card card-link stack">
                <div className="row">
                  <strong>{group.name}</strong>
                  <span className="pill">{group.memberCount} members</span>
                </div>
                <div className="muted">Created {new Date(group.createdAt).toLocaleDateString()}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
