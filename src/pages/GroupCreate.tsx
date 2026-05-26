import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAppShell } from '../lib/app-shell.js';

const wizardSteps = ['Name', 'Members', 'Review'] as const;

export default function GroupCreate() {
  const navigate = useNavigate();
  const { bootstrap } = useAppShell();
  const [step, setStep] = useState(0);
  const [groupName, setGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableInvitees = useMemo(
    () => bootstrap.users.filter((user) => user.id !== bootstrap.currentUser.id),
    [bootstrap]
  );

  const selectedMembers = useMemo(
    () => availableInvitees.filter((user) => selectedMemberIds.includes(user.id)),
    [availableInvitees, selectedMemberIds]
  );

  function toggleInvitee(userId: number) {
    setSelectedMemberIds((current) =>
      current.includes(userId) ? current.filter((value) => value !== userId) : [...current, userId]
    );
  }

  async function handleCreateGroup() {
    setSaving(true);
    setError(null);

    try {
      const group = await api.createGroup({
        name: groupName.trim(),
        memberIds: selectedMemberIds
      });
      navigate(`/groups/${group.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create group.');
    } finally {
      setSaving(false);
    }
  }

  const canAdvance = step === 0 ? groupName.trim().length > 0 : true;

  return (
    <div className="stack">
      <section className="card hero stack">
        <span className="pill pill-accent">New group</span>
        <h1>Create a group in three quick steps.</h1>
        <p>Start with a name, choose who belongs, and review everything before the group goes live.</p>
      </section>

      <section className="card stack">
        <div className="wizard-progress" aria-label="Group creation progress">
          {wizardSteps.map((label, index) => {
            const isActive = index === step;
            const isComplete = index < step;

            return (
              <div key={label} className={`wizard-step${isActive ? ' active' : ''}${isComplete ? ' complete' : ''}`}>
                <span className="wizard-step-index">{index + 1}</span>
                <span>{label}</span>
              </div>
            );
          })}
        </div>

        {step === 0 ? (
          <div className="stack">
            <div>
              <h2 className="section-title">Name the group</h2>
              <p className="muted">Pick the label your friends will recognize right away.</p>
            </div>

            <div className="field">
              <label htmlFor="group-name">Group name</label>
              <input
                id="group-name"
                className="input"
                autoFocus
                placeholder="Friday Night Crew"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="stack">
            <div>
              <h2 className="section-title">Choose members</h2>
              <p className="muted">You’ll be added automatically as a group admin.</p>
            </div>

            {availableInvitees.length === 0 ? (
              <div className="empty-state">No other users are available yet. You can still create a solo group.</div>
            ) : (
              <div className="checkbox-list">
                {availableInvitees.map((user) => (
                  <label key={user.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.includes(user.id)}
                      onChange={() => toggleInvitee(user.id)}
                    />
                    <div>
                      <strong>{user.username}</strong>
                      <div className="muted">{user.isAdmin ? 'admin' : 'member'}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="stack">
            <div>
              <h2 className="section-title">Review</h2>
              <p className="muted">This is how the group will be created.</p>
            </div>

            <div className="list-item">
              <strong>{groupName.trim() || 'Untitled group'}</strong>
              <div className="muted">Creator: {bootstrap.currentUser.username}</div>
            </div>

            <div className="stack">
              <div className="row">
                <strong>Members</strong>
                <span className="pill">{selectedMembers.length + 1} total</span>
              </div>

              <div className="list">
                <div className="list-item">
                  <strong>{bootstrap.currentUser.username}</strong>
                  <div className="muted">You’ll join as group admin.</div>
                </div>

                {selectedMembers.length === 0 ? (
                  <div className="empty-state">No additional members selected yet.</div>
                ) : (
                  selectedMembers.map((user) => (
                    <div key={user.id} className="list-item">
                      <strong>{user.username}</strong>
                      <div className="muted">{user.isAdmin ? 'admin' : 'member'}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {error ? <div className="error">{error}</div> : null}

        <div className="page-actions">
          {step === 0 ? (
            <Link className="button-ghost" to="/">
              Cancel
            </Link>
          ) : (
            <button type="button" className="button-ghost" onClick={() => setStep((current) => current - 1)}>
              Back
            </button>
          )}

          {step < wizardSteps.length - 1 ? (
            <button
              type="button"
              className="button"
              disabled={!canAdvance}
              onClick={() => setStep((current) => current + 1)}
            >
              Next
            </button>
          ) : (
            <button type="button" className="button" disabled={saving} onClick={() => void handleCreateGroup()}>
              {saving ? 'Creating…' : 'Create group'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
