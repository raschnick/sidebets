import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAppShell } from '../lib/app-shell.js';
import type { GroupDetail } from '../lib/types.js';

export default function GroupMembers() {
  const { bootstrap } = useAppShell();
  const params = useParams();
  const groupId = Number(params.groupId);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = bootstrap.currentUser.id;

  async function loadGroup() {
    if (!Number.isInteger(groupId) || groupId <= 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextGroup = await api.getGroup(groupId);
      setGroup(nextGroup);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load members.');
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

  const canManageMembers =
    bootstrap.currentUser.isAdmin || currentMember?.role === 'group_admin' || group?.createdBy === currentUserId;

  const availableMembers = useMemo(() => {
    if (!group) {
      return [];
    }

    const currentMemberIds = new Set(group.members.map((member) => member.id));
    return bootstrap.users.filter((user) => !currentMemberIds.has(user.id));
  }, [bootstrap.users, group]);

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const memberId = Number(memberIdInput);
    if (!Number.isInteger(memberId) || memberId <= 0) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const nextGroup = await api.addGroupMember(groupId, { userId: memberId });
      setGroup(nextGroup);
      setMemberIdInput('');
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'Could not add member.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(userId: number) {
    setSubmitting(true);
    setError(null);

    try {
      const nextGroup = await api.removeGroupMember(groupId, userId);
      setGroup(nextGroup);
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'Could not remove member.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="stack">
      {loading ? <div className="card muted">Loading members…</div> : null}
      {error ? <div className="card error">{error}</div> : null}

      {group ? (
        <>
          <section className="card stack">
            <div className="row section-header">
              <div>
                <h1 className="page-title">Manage members</h1>
                <p className="muted">{group.name}</p>
              </div>
              <Link className="button-ghost" to={`/groups/${group.id}`}>
                Back to group
              </Link>
            </div>
          </section>

          {canManageMembers ? (
            <>
              <section className="card stack">
                <div>
                  <h2 className="section-title">Add member</h2>
                  <p className="muted">Invite someone from the private roster into this group.</p>
                </div>

                <form className="stack" onSubmit={handleAddMember}>
                  <select
                    className="select"
                    value={memberIdInput}
                    onChange={(event) => setMemberIdInput(event.target.value)}
                    disabled={submitting || availableMembers.length === 0}
                  >
                    <option value="">Select a user</option>
                    {availableMembers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.username}
                        {user.isAdmin ? ' (admin)' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="page-actions">
                    <button className="button" type="submit" disabled={submitting || !memberIdInput}>
                      Add member
                    </button>
                  </div>
                </form>

                {availableMembers.length === 0 ? (
                  <p className="muted">Everyone in the roster is already part of this group.</p>
                ) : null}
              </section>

              <section className="card stack">
                <div>
                  <h2 className="section-title">Current members</h2>
                  <p className="muted">The group creator stays pinned in place. Everyone else can be removed here.</p>
                </div>

                <div className="list">
                  {group.members.map((member) => (
                    <div key={member.id} className="list-item row">
                      <div>
                        <strong>{member.username}</strong>
                        <div className="meta">
                          <span className="pill">{member.role}</span>
                          {group.createdBy === member.id ? <span className="pill pill-accent">creator</span> : null}
                        </div>
                      </div>
                      {group.createdBy !== member.id ? (
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => void handleRemoveMember(member.id)}
                          disabled={submitting}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="card stack">
              <h2 className="section-title">No access</h2>
              <p className="muted">Only group admins, the creator, and app admins can manage this member list.</p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
