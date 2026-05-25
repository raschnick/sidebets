import type { WizardStepProps } from './types.js';

export default function Step4Confirm({ value, members }: WizardStepProps) {
  const hiddenLabels = members
    .filter((member) => value.hiddenUserIds.includes(member.id))
    .map((member) => member.username);

  return (
    <div className="stack">
      <div className="list-item">
        <div className="page-title">{value.title || 'Untitled bet'}</div>
        <p className="muted">{value.description || 'No extra description provided.'}</p>
      </div>

      <div className="meta">
        <span className="pill pill-accent">{value.type === 'yes_no' ? 'Yes / No' : 'Open value'}</span>
        <span className="pill">{value.blind ? 'Blind mode on' : 'Blind mode off'}</span>
        <span className="pill">
          {hiddenLabels.length > 0 ? `Hidden from ${hiddenLabels.join(', ')}` : 'Visible to the whole group'}
        </span>
      </div>

      {value.type === 'open_value' && value.options.length > 0 ? (
        <div className="list">
          {value.options.map((option) => (
            <div key={option} className="list-item">
              {option}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
