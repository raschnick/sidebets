import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import type { BetSummary, GroupDetail } from '../lib/types.js';

export default function GroupSettled() {
  const params = useParams();
  const groupId = Number(params.groupId);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [bets, setBets] = useState<BetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadGroup() {
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [groupDetail, betList] = await Promise.all([api.getGroup(groupId), api.listGroupBets(groupId)]);
      setGroup(groupDetail);
      setBets(betList.filter((bet) => bet.status === 'settled'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load settled sidebets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroup();
  }, [groupId]);

  return (
    <div className="stack">
      {loading ? <div className="card muted">Loading settled sidebets…</div> : null}
      {error ? <div className="card error">{error}</div> : null}

      {group ? (
        <>
          <section className="card stack">
            <div className="row section-header">
              <div>
                <h1 className="page-title">Settled sidebets</h1>
                <p className="muted">{group.name}</p>
              </div>
              <Link className="button-ghost" to={`/groups/${group.id}`}>
                Back to group
              </Link>
            </div>
          </section>

          <section className="card stack">
            {bets.length === 0 ? (
              <div className="empty-state">No settled sidebets in this group yet.</div>
            ) : (
              <div className="bet-grid">
                {bets.map((bet) => (
                  <Link key={bet.id} to={`/bets/${bet.id}`} className="card card-link stack">
                    <div className="row">
                      <strong>{bet.title}</strong>
                      <span className="pill">{bet.status}</span>
                    </div>
                    <p className="muted">{bet.description || 'No description provided.'}</p>
                    <div className="meta">
                      <span className="pill">{bet.type === 'yes_no' ? 'Yes / No' : 'Open value'}</span>
                      <span className="pill">{bet.blind ? 'Blind' : 'Open picks'}</span>
                      <span className="pill">{bet.participantCount} participants</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
