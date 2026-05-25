import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAppShell } from '../lib/app-shell.js';
import type { BetSummary, GroupDetail } from '../lib/types.js';
import Step1Details from '../components/wizard/Step1Details.js';
import Step2Type from '../components/wizard/Step2Type.js';
import Step3Visibility from '../components/wizard/Step3Visibility.js';
import Step4Confirm from '../components/wizard/Step4Confirm.js';
import type { BetWizardState } from '../components/wizard/types.js';

const initialWizardState: BetWizardState = {
  title: '',
  description: '',
  blind: false,
  type: 'yes_no',
  options: [],
  hiddenUserIds: []
};

export default function Group() {
  const { bootstrap } = useAppShell();
  const params = useParams();
  const groupId = Number(params.groupId);
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [bets, setBets] = useState<BetSummary[]>([]);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizard, setWizard] = useState<BetWizardState>(initialWizardState);
  const [memberIdInput, setMemberIdInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const availableMembers = useMemo(() => {
    if (!bootstrap || !group) {
      return [];
    }

    const currentMemberIds = new Set(group.members.map((member) => member.id));
    return bootstrap.users.filter((user) => !currentMemberIds.has(user.id));
  }, [bootstrap, group]);

  const canManageMembers =
    bootstrap.currentUser.isAdmin || currentMember?.role === 'group_admin' || group?.createdBy === currentUserId;

  async function handleCreateBet() {
    setSaving(true);
    setError(null);

    try {
      await api.createBet({
        groupId,
        title: wizard.title,
        description: wizard.description,
        type: wizard.type,
        blind: wizard.blind,
        hiddenUserIds: wizard.hiddenUserIds,
        options: wizard.options
      });

      setWizard(initialWizardState);
      setWizardStep(1);
      await loadGroup();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create bet.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const memberId = Number(memberIdInput);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return;
    }

    try {
      const nextGroup = await api.addGroupMember(groupId, {
        userId: memberId
      });
      setGroup(nextGroup);
      setMemberIdInput('');
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'Could not add member.');
    }
  }

  async function handleRemoveMember(userId: number) {
    try {
      const nextGroup = await api.removeGroupMember(groupId, userId);
      setGroup(nextGroup);
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'Could not remove member.');
    }
  }

  const canAdvanceStep1 = wizard.title.trim().length > 0;
  const canAdvanceStep2 = wizard.type === 'yes_no' || wizard.options.length > 0;

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
                  {group.memberCount} members · Creator #{group.createdBy}
                </p>
              </div>
              <span className="pill pill-accent">
                {`You are ${bootstrap.currentUser.username}`}
              </span>
            </div>

            <div className="row-wrap">
              {group.members.map((member) => (
                <span key={member.id} className="pill">
                  {member.username} #{member.id}
                </span>
              ))}
            </div>
          </section>

          <section className="card stack">
            <div className="row">
              <div>
                <h2 className="section-title">Create a bet</h2>
                <p className="muted">Four-step wizard with blind mode and hidden visibility.</p>
              </div>
              <span className="pill">Step {wizardStep} / 4</span>
            </div>

            {wizardStep === 1 ? (
              <Step1Details
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={currentUserId}
              />
            ) : null}

            {wizardStep === 2 ? (
              <Step2Type
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={currentUserId}
              />
            ) : null}

            {wizardStep === 3 ? (
              <Step3Visibility
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={currentUserId}
              />
            ) : null}

            {wizardStep === 4 ? (
              <Step4Confirm
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={currentUserId}
              />
            ) : null}

            <div className="button-row">
              {wizardStep > 1 ? (
                <button type="button" className="button-ghost" onClick={() => setWizardStep((step) => step - 1)}>
                  Back
                </button>
              ) : null}

              {wizardStep < 4 ? (
                <button
                  type="button"
                  className="button"
                  disabled={(wizardStep === 1 && !canAdvanceStep1) || (wizardStep === 2 && !canAdvanceStep2)}
                  onClick={() => setWizardStep((step) => step + 1)}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  className="button"
                  disabled={saving}
                  onClick={() => void handleCreateBet()}
                >
                  {saving ? 'Creating…' : 'Create bet'}
                </button>
              )}
            </div>
          </section>

          <section className="card stack">
            <div className="row">
              <div>
                <h2 className="section-title">Visible bets</h2>
                <p className="muted">Server-side filtering already hides restricted bets from this list.</p>
              </div>
              <button type="button" className="button-ghost" onClick={() => void loadGroup()}>
                Refresh
              </button>
            </div>

            {bets.length === 0 ? (
              <div className="empty-state">No visible bets in this group yet.</div>
            ) : (
              <div className="bet-grid">
                {bets.map((bet) => (
                  <Link key={bet.id} to={`/bets/${bet.id}`} className="card stack">
                    <div className="row">
                      <strong>{bet.title}</strong>
                      <span className="pill">{bet.status}</span>
                    </div>
                    <p className="muted">{bet.description || 'No description provided.'}</p>
                    <div className="meta">
                      <span className="pill">{bet.type === 'yes_no' ? 'Yes / No' : 'Open value'}</span>
                      <span className="pill">{bet.blind ? 'Blind' : 'Visible picks'}</span>
                      <span className="pill">{bet.participantCount} participants</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {canManageMembers ? (
            <section className="card stack">
              <div>
                <h2 className="section-title">Manage members</h2>
                <p className="muted">Group admins can add any friend who exists in the private roster.</p>
              </div>

              <form className="button-row" onSubmit={handleAddMember}>
                <select
                  className="select"
                  style={{ flex: '1 1 12rem' }}
                  value={memberIdInput}
                  onChange={(event) => setMemberIdInput(event.target.value)}
                >
                  <option value="">Select a user</option>
                  {availableMembers.map((user) => (
                  <option key={user.id} value={user.id}>
                      {user.username}
                      {user.isAdmin ? ' (admin)' : ''}
                    </option>
                  ))}
                </select>
                <button className="button" type="submit" disabled={!memberIdInput}>
                  Add member
                </button>
              </form>

              <div className="list">
                {group.members.map((member) => (
                  <div key={member.id} className="list-item row">
                    <div>
                      <strong>{member.username}</strong>
                      <div className="muted">
                        User #{member.id} · {member.role}
                      </div>
                    </div>
                    {group.createdBy !== member.id ? (
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => void handleRemoveMember(member.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
