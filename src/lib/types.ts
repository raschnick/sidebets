export type BetType = 'yes_no' | 'open_value';
export type BetStatus = 'open' | 'settled';
export type GroupRole = 'member' | 'group_admin';

export interface UserSummary {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
}

export interface AppBootstrap {
  currentUser: UserSummary;
  users: UserSummary[];
}

export interface AuthSession {
  token: string;
  user: UserSummary;
}

export interface GroupMember extends UserSummary {
  role: GroupRole;
}

export interface GroupSummary {
  id: number;
  name: string;
  createdBy: number;
  createdByUsername: string;
  createdAt: string;
  memberCount: number;
}

export interface GroupDetail extends GroupSummary {
  members: GroupMember[];
}

export interface BetOption {
  id: number;
  betId: number;
  label: string;
  isCustom: boolean;
  createdBy: number | null;
  createdAt: string;
  pickCount?: number;
}

export interface BetPick {
  id: number;
  betId: number;
  userId: number;
  optionId: number | null;
  displayName: string;
  joinedAt: string;
  updatedAt: string;
}

export interface UserPick {
  id: number;
  betId: number;
  userId: number;
  optionId: number | null;
  joinedAt: string;
  updatedAt: string;
}

export interface BetSummary {
  id: number;
  groupId: number;
  title: string;
  description: string;
  type: BetType;
  status: BetStatus;
  blind: boolean;
  createdBy: number;
  createdAt: string;
  settledAt: string | null;
  winnerOptionId: number | null;
  participantCount: number;
  myPick: BetPick | null;
  options: BetOption[];
  canSettle: boolean;
  settlement: BetSettlementSummary | null;
}

export interface BetDetail extends BetSummary {
  picks: BetPick[];
  hiddenUserIds: number[];
  hiddenUsernames: string[];
  winners: BetPick[];
}

export interface BetSettlementSummary {
  totalPot: number;
  winnerCount: number;
  payoutPerWinner: number | null;
}

export interface CreateGroupInput {
  name: string;
  memberIds?: number[];
}

export interface AddGroupMemberInput {
  userId: number;
  role?: GroupRole;
}

export interface CreateBetInput {
  groupId: number;
  title: string;
  description?: string;
  type: BetType;
  blind: boolean;
  hiddenUserIds?: number[];
  options?: string[];
}

export interface SubmitPickInput {
  optionId: number;
}

export interface SettleBetInput {
  winnerOptionId: number;
}

export interface AddCustomOptionInput {
  label: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  isAdmin?: boolean;
}

export interface UpdateUserInput {
  username?: string;
  password?: string;
  isAdmin?: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
}
