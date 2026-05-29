import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import UserAvatar from '../components/UserAvatar.js';
import { useAppShell } from '../lib/app-shell.js';
import { getGroupAvatarLabel, getGroupAvatarStyle } from '../lib/group-avatar.js';
import type { BetSummary, GroupDetail } from '../lib/types.js';

export default function Group() {
  const { bootstrap } = useAppShell();
  const params = useParams();
  const groupId = Number(params.groupId);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [bets, setBets] = useState<BetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = bootstrap.currentUser.id;

  async function loadGroup() {
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [groupDetail, betList] = await Promise.all([api.getGroup(groupId), api.listGroupBets(groupId)]);
      setGroup(groupDetail);
      setBets(betList);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load group.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadGroup();
  }, [groupId]);

  const currentMember = useMemo(
    () => group?.members.find((member) => member.id === currentUserId) ?? null,
    [group, currentUserId]
  );

  const openBets = useMemo(() => bets.filter((bet) => bet.status === 'open'), [bets]);

  const canManageMembers =
    bootstrap.currentUser.isAdmin || currentMember?.role === 'group_admin' || group?.createdBy === currentUserId;

  return (
    <div className="stack">
      {loading ? <div className="card muted">Loading group…</div> : null}
      {error ? <div className="card error">{error}</div> : null}

      {group ? (
        <>
          <section className="card stack">
            <div className="row">
              <div>
                <h1 className="page-title">{group.name}</h1>
                <p className="muted">
                  {group.memberCount} members · Created by {group.createdByUsername}
                </p>
              </div>
              <span
                className="group-avatar group-avatar-large"
                style={getGroupAvatarStyle(group.id)}
                aria-hidden="true"
              >
                {getGroupAvatarLabel(group.name)}
              </span>
            </div>

            <div className="row-wrap">
              {group.members.map((member) => (
                <Link key={member.id} className="pill group-member-pill" to={`/users/${member.id}`}>
                  <UserAvatar
                    className="member-pill-avatar"
                    username={member.username}
                    avatarUrl={member.avatarUrl}
                    ariaHidden
                  />
                  <span>{member.username}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="card stack">
            <div className="row section-header">
              <div>
                <h2 className="section-title">Open sidebets</h2>
              </div>
              <div className="button-row">
                {canManageMembers ? (
                  <Link className="button-secondary" to={`/groups/${group.id}/members`}>
                    Manage members
                  </Link>
                ) : null}
                <Link className="button-secondary" to={`/groups/${group.id}/settled`}>
                  Settled sidebets
                </Link>
                <Link className="button" to={`/groups/${group.id}/bets/new`}>
                  Create new sidebet
                </Link>
              </div>
            </div>

            {openBets.length === 0 ? (
              <div className="empty-state">No open sidebets in this group right now.</div>
            ) : (
              <div className="bet-grid">
                {openBets.map((bet) => (
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
