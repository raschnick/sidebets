import type { WizardStepProps } from './types.js';

export default function Step3Visibility({ value, onChange, members, currentUserId }: WizardStepProps) {
  return (
    <div className="stack">
      <p className="muted">
        Pick any group members who should never see this bet anywhere in the app.
      </p>

      <div className="checkbox-list">
        {members
          .filter((member) => member.id !== currentUserId)
          .map((member) => {
            const checked = value.hiddenUserIds.includes(member.id);

            return (
              <label key={member.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const hiddenUserIds = event.target.checked
                      ? [...value.hiddenUserIds, member.id]
                      : value.hiddenUserIds.filter((userId) => userId !== member.id);

                    onChange({
                      ...value,
                      hiddenUserIds
                    });
                  }}
                />
                <div>
                  <strong>{member.username}</strong>
                  <div className="muted">
                    User #{member.id} · {member.role === 'group_admin' ? 'Group admin' : 'Member'}
                  </div>
                </div>
              </label>
            );
          })}
      </div>
    </div>
  );
}
