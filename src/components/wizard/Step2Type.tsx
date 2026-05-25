import type { WizardStepProps } from './types.js';

export default function Step2Type({ value, onChange }: WizardStepProps) {
  const optionText = value.options.join('\n');

  return (
    <div className="stack">
      <div className="row-wrap">
        <button
          type="button"
          className={value.type === 'yes_no' ? 'button' : 'button-secondary'}
          onClick={() => onChange({ ...value, type: 'yes_no', options: [] })}
        >
          Yes / No
        </button>
        <button
          type="button"
          className={value.type === 'open_value' ? 'button' : 'button-secondary'}
          onClick={() => onChange({ ...value, type: 'open_value' })}
        >
          Open value
        </button>
      </div>

      <div className="muted">
        {value.type === 'yes_no'
          ? 'Two fixed choices will be created automatically.'
          : 'Add suggested answers if you want a starting point. Friends can still add their own later.'}
      </div>

      {value.type === 'open_value' ? (
        <div className="field">
          <label htmlFor="starting-options">Suggested options</label>
          <textarea
            id="starting-options"
            className="textarea"
            placeholder={'19:30\n19:45\n20:00'}
            value={optionText}
            onChange={(event) =>
              onChange({
                ...value,
                options: event.target.value
                  .split('\n')
                  .map((entry) => entry.trim())
                  .filter(Boolean)
              })
            }
          />
        </div>
      ) : null}
    </div>
  );
}
