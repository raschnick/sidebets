import type {
  AddCustomOptionInput,
  AddGroupMemberInput,
  AppBootstrap,
  AuthSession,
  BetDetail,
  BetOption,
  BetSummary,
  ChangePasswordInput,
  CreateUserInput,
  CreateBetInput,
  CreateGroupInput,
  GroupDetail,
  GroupSummary,
  LoginInput,
  SettleBetInput,
  SubmitPickInput,
  UpdateProfileInput,
  UpdateUserInput,
  UserSummary,
  UserPick
} from './types.js';

const API_BASE = '/api';
const SESSION_TOKEN_STORAGE_KEY = 'sidebets-session-token';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getSessionToken(): string | null {
  return window.localStorage.getItem(SESSION_TOKEN_STORAGE_KEY);
}

export function hasSessionToken(): boolean {
  return Boolean(getSessionToken());
}

export function setSessionToken(token: string) {
  window.localStorage.setItem(SESSION_TOKEN_STORAGE_KEY, token);
  window.dispatchEvent(new CustomEvent('sidebets:auth-changed'));
}

export function clearSessionToken() {
  window.localStorage.removeItem(SESSION_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('sidebets:auth-changed'));
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const sessionToken = getSessionToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json().catch(() => ({}))) as { error?: string } & T;

  if (!response.ok) {
    throw new ApiError(payload.error ?? `Request failed with status ${response.status}`, response.status);
  }

  return payload;
}

export const api = {
  login: async (input: LoginInput): Promise<AuthSession> => {
    const session = await request<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    setSessionToken(session.token);
    return session;
  },

  logout: async (): Promise<void> => {
    try {
      await request<{ ok: boolean }>('/auth/logout', {
        method: 'POST'
      });
    } finally {
      clearSessionToken();
    }
  },

  getBootstrap: async (): Promise<AppBootstrap> => {
    return request<AppBootstrap>('/users/bootstrap');
  },

  listGroups: async (): Promise<GroupSummary[]> => {
    const payload = await request<{ groups: GroupSummary[] }>('/groups');
    return payload.groups;
  },

  createUser: async (input: CreateUserInput): Promise<UserSummary> => {
    const payload = await request<{ user: UserSummary }>('/users', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.user;
  },

  updateUser: async (userId: number, input: UpdateUserInput): Promise<UserSummary> => {
    const payload = await request<{ user: UserSummary }>(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload.user;
  },

  updateProfile: async (input: UpdateProfileInput): Promise<UserSummary> => {
    const payload = await request<{ user: UserSummary }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload.user;
  },

  changePassword: async (input: ChangePasswordInput): Promise<UserSummary> => {
    const payload = await request<{ user: UserSummary }>('/users/me/password', {
      method: 'PATCH',
      body: JSON.stringify(input)
    });
    return payload.user;
  },

  getGroup: async (groupId: number): Promise<GroupDetail> => {
    const payload = await request<{ group: GroupDetail }>(`/groups/${groupId}`);
    return payload.group;
  },

  createGroup: async (input: CreateGroupInput): Promise<GroupDetail> => {
    const payload = await request<{ group: GroupDetail }>('/groups', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.group;
  },

  addGroupMember: async (groupId: number, input: AddGroupMemberInput): Promise<GroupDetail> => {
    const payload = await request<{ group: GroupDetail }>(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.group;
  },

  removeGroupMember: async (groupId: number, userId: number): Promise<GroupDetail> => {
    const payload = await request<{ group: GroupDetail }>(`/groups/${groupId}/members/${userId}`, {
      method: 'DELETE'
    });
    return payload.group;
  },

  listGroupBets: async (groupId: number): Promise<BetSummary[]> => {
    const payload = await request<{ bets: BetSummary[] }>(`/bets/group/${groupId}`);
    return payload.bets;
  },

  createBet: async (input: CreateBetInput): Promise<BetDetail> => {
    const payload = await request<{ bet: BetDetail }>('/bets', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.bet;
  },

  getBet: async (betId: number): Promise<BetDetail> => {
    const payload = await request<{ bet: BetDetail }>(`/bets/${betId}`);
    return payload.bet;
  },

  settleBet: async (betId: number, input: SettleBetInput): Promise<BetDetail> => {
    const payload = await request<{ bet: BetDetail }>(`/bets/${betId}/settle`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.bet;
  },

  joinBet: async (betId: number): Promise<UserPick | null> => {
    const payload = await request<{ pick: UserPick | null }>(`/bets/${betId}/join`, {
      method: 'POST'
    });
    return payload.pick;
  },

  submitPick: async (betId: number, input: SubmitPickInput): Promise<UserPick | null> => {
    const payload = await request<{ pick: UserPick | null }>(`/bets/${betId}/pick`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.pick;
  },

  addCustomOption: async (betId: number, input: AddCustomOptionInput): Promise<BetOption> => {
    const payload = await request<{ option: BetOption }>(`/bets/${betId}/options`, {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return payload.option;
  }
};
