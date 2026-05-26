import type { WizardStepProps } from './types.js';

export default function Step1Details({ value, onChange }: WizardStepProps) {
  return (
    <div className="stack">
      <div className="field">
        <label htmlFor="bet-title">Bet title</label>
        <input
          id="bet-title"
          className="input"
          autoFocus
          placeholder="Will we make it before kickoff?"
          value={value.title}
          onChange={(event) => onChange({ ...value, title: event.target.value })}
        />
      </div>

      <div className="field">
        <label htmlFor="bet-description">Short description</label>
        <textarea
          id="bet-description"
          className="textarea"
          placeholder="Optional context for the group."
          value={value.description}
          onChange={(event) => onChange({ ...value, description: event.target.value })}
        />
      </div>

      <label className="checkbox-item">
        <input
          type="checkbox"
          checked={value.blind}
          onChange={(event) => onChange({ ...value, blind: event.target.checked })}
        />
        <div>
          <strong>Blind bet</strong>
          <div className="muted">Hide everyone’s picks until the creator settles the bet.</div>
        </div>
      </label>
    </div>
  );
}
