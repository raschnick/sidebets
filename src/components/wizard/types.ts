import type { BetType, GroupMember } from '../../lib/types.js';

export interface BetWizardState {
  title: string;
  description: string;
  blind: boolean;
  type: BetType;
  options: string[];
  hiddenUserIds: number[];
}

export interface WizardStepProps {
  value: BetWizardState;
  onChange: (next: BetWizardState) => void;
  members: GroupMember[];
  currentUserId: number;
}
