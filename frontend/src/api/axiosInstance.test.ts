import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  createMock,
  requestUseMock,
  responseUseMock,
  postMock,
  apiCallMock,
  triggerLogoutMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  requestUseMock: vi.fn(),
  responseUseMock: vi.fn(),
  postMock: vi.fn(),
  apiCallMock: vi.fn(),
  triggerLogoutMock: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: createMock,
    post: postMock,
  },
}));

vi.mock('../lib/authLogout', () => ({
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
  vi.resetModules();

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
    },
    configurable: true,
  });

  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
  vi.stubEnv('DEV', false);

  const apiInstance = Object.assign(apiCallMock, {
    defaults: { baseURL: 'https://api.example.test' },
    interceptors: {
      request: { use: requestUseMock },
      response: { use: responseUseMock },
    },
    post: postMock,
  });

  createMock.mockReturnValue(apiInstance);
});

describe('axiosInstance', () => {
  it('configures the request interceptor with the bearer token from storage', async () => {
    localStorage.setItem('access_token', 'token-123');
    const api = await import('./axiosInstance');
    const requestHandler = requestUseMock.mock.calls[0][0];

    const config = { url: '/auth/me', headers: {} };
    const result = requestHandler(config as any);

    expect(result.headers.Authorization).toBe('Bearer token-123');
    expect(api.default.defaults.baseURL).toBe('https://api.example.test');
  });

  it('skips 401 interception for auth endpoints and rejects the original error', async () => {
    const { default: api } = await import('./axiosInstance');
    const responseHandler = responseUseMock.mock.calls[0][1];

    const error = { response: { status: 401 }, config: { url: '/auth/login', headers: {} } };

    await expect(responseHandler(error as any)).rejects.toBe(error);
    expect(triggerLogoutMock).not.toHaveBeenCalled();
    expect(api).toBeTruthy();
  });

  it('refreshes expired tokens and retries the original request', async () => {
    await import('./axiosInstance');
    const responseHandler = responseUseMock.mock.calls[0][1];
    const request = { url: '/resources', headers: { Authorization: 'Bearer expired-token' }, _retry: false };

    localStorage.setItem('refresh_token', 'refresh-token');
    postMock.mockResolvedValue({ data: { access_token: 'new-access-token' } });
    apiCallMock.mockResolvedValue({ ok: true });

    const result = await responseHandler({ response: { status: 401 }, config: request } as any);

    expect(postMock).toHaveBeenCalledWith(
      'https://api.example.test/auth/refresh',
      { refresh_token: 'refresh-token' },
      { headers: { 'Content-Type': 'application/json' } }
    );
    expect(request.headers.Authorization).toBe('Bearer new-access-token');
    expect(apiCallMock).toHaveBeenCalledWith(request);
    expect(result).toEqual({ ok: true });
  });

  it('triggers logout when refreshing the token fails', async () => {
    await import('./axiosInstance');
    const responseHandler = responseUseMock.mock.calls[0][1];
    const request = { url: '/resources', headers: { Authorization: 'Bearer expired-token' }, _retry: false };

    localStorage.setItem('refresh_token', 'refresh-token');
    postMock.mockRejectedValue(new Error('refresh failed'));

    await expect(responseHandler({ response: { status: 401 }, config: request } as any)).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(triggerLogoutMock).toHaveBeenCalledWith(true);
  });

  it('uses the production configuration error when VITE_API_BASE_URL is missing', async () => {
    vi.resetModules();
    const env = import.meta.env as any;
    const originalBaseUrl = env.VITE_API_BASE_URL;
    const originalDev = env.DEV;

    try {
      env.VITE_API_BASE_URL = '';
      env.DEV = false;

      await expect(import('./axiosInstance')).rejects.toThrow('VITE_API_BASE_URL must be configured for production');
    } finally {
      env.VITE_API_BASE_URL = originalBaseUrl;
      env.DEV = originalDev;
    }
  });
});
