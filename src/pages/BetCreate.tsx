import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Step1Details from '../components/wizard/Step1Details.js';
import Step2Type from '../components/wizard/Step2Type.js';
import Step3Visibility from '../components/wizard/Step3Visibility.js';
import Step4Confirm from '../components/wizard/Step4Confirm.js';
import type { BetWizardState } from '../components/wizard/types.js';
import { useAppShell } from '../lib/app-shell.js';
import { api } from '../lib/api.js';
import type { GroupDetail } from '../lib/types.js';

const initialWizardState: BetWizardState = {
  title: '',
  description: '',
  blind: false,
  type: 'yes_no',
  options: [],
  hiddenUserIds: []
};

export default function BetCreate() {
  const navigate = useNavigate();
  const params = useParams();
  const groupId = Number(params.groupId);
  const { bootstrap } = useAppShell();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizard, setWizard] = useState<BetWizardState>(initialWizardState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGroup() {
      if (!Number.isInteger(groupId) || groupId <= 0) {
        setLoading(false);
        setError('Invalid group.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const nextGroup = await api.getGroup(groupId);
        setGroup(nextGroup);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load group.');
      } finally {
        setLoading(false);
      }
    }

    void loadGroup();
  }, [groupId]);

  async function handleCreateBet() {
    setSaving(true);
    setError(null);

    try {
      const bet = await api.createBet({
        groupId,
        title: wizard.title,
        description: wizard.description,
        type: wizard.type,
        blind: wizard.blind,
        hiddenUserIds: wizard.hiddenUserIds,
        options: wizard.options
      });

      navigate(`/bets/${bet.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not create bet.');
    } finally {
      setSaving(false);
    }
  }

  const canAdvanceStep1 = wizard.title.trim().length > 0;
  const canAdvanceStep2 = wizard.type === 'yes_no' || wizard.options.length > 0;

  return (
    <div className="stack">
      {loading ? <div className="card muted">Loading bet creator…</div> : null}
      {error ? <div className="card error">{error}</div> : null}

      {group ? (
        <>
          <section className="card hero stack">
            <span className="pill pill-accent">New sidebet</span>
            <h1>Create a sidebet for {group.name}.</h1>
            <p>Build the bet step by step, choose the type, and lock down visibility before anyone joins.</p>
          </section>

          <section className="card stack">
            <div className="row section-header">
              <div>
                <h2 className="section-title">Create a sidebet</h2>
                <p className="muted">Step {wizardStep} of 4 for {group.name}.</p>
              </div>
              <span className="pill">{bootstrap.currentUser.username}</span>
            </div>

            {wizardStep === 1 ? (
              <Step1Details
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={bootstrap.currentUser.id}
              />
            ) : null}

            {wizardStep === 2 ? (
              <Step2Type
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={bootstrap.currentUser.id}
              />
            ) : null}

            {wizardStep === 3 ? (
              <Step3Visibility
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={bootstrap.currentUser.id}
              />
            ) : null}

            {wizardStep === 4 ? (
              <Step4Confirm
                value={wizard}
                onChange={setWizard}
                members={group.members}
                currentUserId={bootstrap.currentUser.id}
              />
            ) : null}

            <div className="page-actions">
              {wizardStep > 1 ? (
                <button type="button" className="button-ghost" onClick={() => setWizardStep((step) => step - 1)}>
                  Back
                </button>
              ) : (
                <Link className="button-ghost" to={`/groups/${group.id}`}>
                  Cancel
                </Link>
              )}

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
                  {saving ? 'Creating…' : 'Create sidebet'}
                </button>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
