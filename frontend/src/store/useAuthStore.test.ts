import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore, getInitials } from './useAuthStore';
import { AuthService } from '../api/auth';
import { queryClient } from '../lib/queryClient';

const {
  jwtDecodeMock,
  authServiceLoginMock,
  authServiceMeMock,
  queryClientClearMock,
  registerLogoutMock,
  triggerLogoutMock,
} = vi.hoisted(() => ({
  jwtDecodeMock: vi.fn(),
  authServiceLoginMock: vi.fn(),
  authServiceMeMock: vi.fn(),
  queryClientClearMock: vi.fn(),
  registerLogoutMock: vi.fn(),
  triggerLogoutMock: vi.fn(),
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: jwtDecodeMock,
}));

vi.mock('../api/auth', () => ({
  AuthService: {
    login: authServiceLoginMock,
    me: authServiceMeMock,
  },
}));

vi.mock('../lib/queryClient', () => ({
  queryClient: {
    clear: queryClientClearMock,
  },
}));

vi.mock('../lib/authLogout', () => ({
  registerLogout: registerLogoutMock,
  triggerLogout: triggerLogoutMock,
}));

function createStorage() {
  const data = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => (data.has(key) ? data.get(key)! : null)),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
    clear: vi.fn(() => { data.clear(); }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  const storage = createStorage();
  const session = createStorage();

  Object.defineProperty(globalThis, 'localStorage', {
    value: storage,
    configurable: true,
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: session,
    configurable: true,
  });

  Object.defineProperty(globalThis, 'window', {
    value: {
      location: { pathname: '/dashboard', origin: 'http://localhost:3000' },
      history: { replaceState: vi.fn() },
      dispatchEvent: vi.fn(),
    },
    configurable: true,
    writable: true,
  });

  (globalThis as any).PopStateEvent = class PopStateEvent extends Event {
    constructor(type: string) {
      super(type);
    }
  };

  useAuthStore.setState({
    token: null,
    role: null,
    user: null,
    isAuthenticated: false,
    isAuthLoading: false,
  });
});

describe('useAuthStore', () => {
  it('logs in successfully and stores the token and user state', async () => {
    authServiceLoginMock.mockResolvedValue({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-1',
        name: 'Alice Example',
        email: 'alice@example.com',
        role: 'Administrator',
      },
    });
    authServiceMeMock.mockResolvedValue({
      user: {
        id: 'user-1',
        name: 'Alice Example',
        email: 'alice@example.com',
        role: 'Administrator',
      },
    });

    await useAuthStore.getState().login({ email: 'alice@example.com', password: 'pass' }, true);

    expect(localStorage.setItem).toHaveBeenCalledWith('access_token', 'access-token');
    expect(localStorage.setItem).toHaveBeenCalledWith('refresh_token', 'refresh-token');
    expect(queryClientClearMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'user-1',
      email: 'alice@example.com',
      role: 'Administrator',
    });
  });

  it('throws when login fails', async () => {
    authServiceLoginMock.mockRejectedValue(new Error('bad credentials'));

    await expect(
      useAuthStore.getState().login({ email: 'alice@example.com', password: 'wrong' })
    ).rejects.toThrow('bad credentials');

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('falls back to JWT decoding when the login response lacks a user object', async () => {
    authServiceLoginMock.mockResolvedValue({
      access_token: 'jwt-token',
      refresh_token: 'refresh-token',
    });
    jwtDecodeMock.mockReturnValue({
      sub: 'user-2',
      email: 'bob@example.com',
      name: 'Bob Example',
      role: 'User',
    });
    authServiceMeMock.mockResolvedValue({ user: null });

    await useAuthStore.getState().login({ username: 'bob@example.com', password: 'pass' }, false);

    expect(jwtDecodeMock).toHaveBeenCalledWith('jwt-token');
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'user-2',
      email: 'bob@example.com',
      role: 'User',
      name: 'Bob Example',
    });
  });

  it('clears auth state and redirects on logout when the session is expired', () => {
    useAuthStore.setState({
      token: 'token',
      role: 'Admin',
      user: { id: '1', name: 'Alice', email: 'alice@example.com', role: 'Admin', status: 'Online', lastLogin: 'Now' },
      isAuthenticated: true,
      isAuthLoading: false,
    });

    useAuthStore.getState().logout(true);

    expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
    expect(sessionStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    expect(queryClientClearMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(window.history.replaceState).toHaveBeenCalledWith({}, '', 'http://localhost:3000/login?expired=true');
  });

  it('restores a valid session on initialize and clears expired tokens', () => {
    jwtDecodeMock.mockReturnValue({
      sub: 'user-3',
      email: 'carol@example.com',
      name: 'Carol User',
      role: 'Analyst',
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    localStorage.setItem('access_token', 'valid-token');

    useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toMatchObject({
      id: 'user-3',
      email: 'carol@example.com',
      role: 'Analyst',
    });

    jwtDecodeMock.mockReturnValue({
      sub: 'user-4',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    localStorage.setItem('access_token', 'expired-token');

    useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
  });

  it('builds initials from display names', () => {
    expect(getInitials('Alice Example')).toBe('AE');
    expect(getInitials('Bob')).toBe('B');
  });
});
