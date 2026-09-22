import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { AuthService, ROLES } from '../../../services/AuthService';
import { User } from '../../../models/User';
import { Role } from '../../../models/Role';

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
    TOKEN_EXPIRY: '1h',
    REFRESH_EXPIRY: '7d',
  },
}));

vi.mock('../../../models/User', () => ({
  User: {
    findOne: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../../../models/Role', () => ({
  Role: {
    findOneAndUpdate: vi.fn(),
    findOne: vi.fn(),
  },
}));

const makeLeanChain = (value: any) => ({
  populate: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(value),
});

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates access and refresh tokens', () => {
    (jwt as any).sign.mockImplementation((payload: any, secret: string) => `token:${payload.sub}:${secret}`);

    const result = AuthService.generateTokens('user-123', ROLES.ADMINISTRATOR, 'admin@example.com', 'Admin User');

    expect(result).toEqual({
      access_token: 'token:user-123:test-secret',
      refresh_token: 'token:user-123:test-refresh-secret',
      token_type: 'Bearer',
    });

    expect((jwt as any).sign).toHaveBeenCalledTimes(2);
    expect((jwt as any).sign).toHaveBeenNthCalledWith(
      1,
      { sub: 'user-123', role: ROLES.ADMINISTRATOR, email: 'admin@example.com', name: 'Admin User' },
      'test-secret',
      { expiresIn: '1h' }
    );
    expect((jwt as any).sign).toHaveBeenNthCalledWith(
      2,
      { sub: 'user-123' },
      'test-refresh-secret',
      { expiresIn: '7d' }
    );
  });

  it('hashes a password using bcrypt', async () => {
    (bcrypt as any).hash.mockResolvedValue('hashed-password');

    const result = await AuthService.hashPassword('plain-text-password');

    expect(result).toBe('hashed-password');
    expect((bcrypt as any).hash).toHaveBeenCalledWith('plain-text-password', 12);
  });

  it('verifies a password using bcrypt', async () => {
    (bcrypt as any).compare.mockResolvedValue(true);

    const result = await AuthService.verifyPassword('plain-text-password', 'hashed-password');

    expect(result).toBe(true);
    expect((bcrypt as any).compare).toHaveBeenCalledWith('plain-text-password', 'hashed-password');
  });

  it('authenticates a valid active user and returns tokens', async () => {
    const user = {
      _id: 'user-123',
      email: 'admin@example.com',
      name: 'Admin User',
      password_hash: 'hashed-password',
      is_active: true,
      role: { name: ROLES.ADMINISTRATOR },
    };

    (User as any).findOne.mockReturnValue(makeLeanChain(user));
    (bcrypt as any).compare.mockResolvedValue(true);
    (jwt as any).sign.mockImplementation((payload: any, secret: string) => `token:${payload.sub}:${secret}`);

    const result = await AuthService.authenticateUser('admin@example.com', 'plain-text-password');

    expect(result).toEqual({
      user: {
        id: 'user-123',
        name: 'Admin User',
        email: 'admin@example.com',
        role: ROLES.ADMINISTRATOR,
        avatar: null,
      },
      tokens: {
        access_token: 'token:user-123:test-secret',
        refresh_token: 'token:user-123:test-refresh-secret',
        token_type: 'Bearer',
      },
    });
    expect((User as any).findOne).toHaveBeenCalledWith({ email: 'admin@example.com' });
  });

  it('returns null when the user does not exist', async () => {
    (User as any).findOne.mockReturnValue(makeLeanChain(null));

    const result = await AuthService.authenticateUser('missing@example.com', 'password');

    expect(result).toBeNull();
  });

  it('returns null when the user is inactive', async () => {
    const user = {
      _id: 'user-456',
      email: 'inactive@example.com',
      name: 'Inactive User',
      password_hash: 'hashed-password',
      is_active: false,
      role: { name: ROLES.USER },
    };

    (User as any).findOne.mockReturnValue(makeLeanChain(user));

    const result = await AuthService.authenticateUser('inactive@example.com', 'password');

    expect(result).toBeNull();
  });

  it('returns null when the password is invalid', async () => {
    const user = {
      _id: 'user-789',
      email: 'user@example.com',
      name: 'User',
      password_hash: 'hashed-password',
      is_active: true,
      role: { name: ROLES.USER },
    };

    (User as any).findOne.mockReturnValue(makeLeanChain(user));
    (bcrypt as any).compare.mockResolvedValue(false);

    const result = await AuthService.authenticateUser('user@example.com', 'wrong-password');

    expect(result).toBeNull();
  });

  it('verifies a refresh token for an active user', async () => {
    const dbUser = {
      _id: 'user-123',
      email: 'admin@example.com',
      name: 'Admin User',
      is_active: true,
      role: { name: ROLES.ADMINISTRATOR },
    };

    (jwt as any).verify.mockReturnValue({ sub: 'user-123' });
    (User as any).findById.mockReturnValue(makeLeanChain(dbUser));

    const result = await AuthService.verifyRefreshToken('valid-refresh-token');

    expect(result).toEqual(dbUser);
    expect((jwt as any).verify).toHaveBeenCalledWith('valid-refresh-token', 'test-refresh-secret');
    expect((User as any).findById).toHaveBeenCalledWith('user-123');
  });

  it('returns null for an invalid refresh token', async () => {
    (jwt as any).verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    const result = await AuthService.verifyRefreshToken('bad-token');

    expect(result).toBeNull();
  });

  it('returns null when the refresh-token user is inactive or missing', async () => {
    (jwt as any).verify.mockReturnValue({ sub: 'user-404' });
    (User as any).findById.mockReturnValue(makeLeanChain(null));

    const result = await AuthService.verifyRefreshToken('token-for-missing-user');

    expect(result).toBeNull();
  });

  it('creates the default roles', async () => {
    (Role as any).findOneAndUpdate.mockImplementation((filter: any, update: any) =>
      Promise.resolve({ name: filter.name, permissions: update.permissions })
    );

    const result = await AuthService.seedDefaultRoles();

    expect((Role as any).findOneAndUpdate).toHaveBeenCalledTimes(4);
    expect(result[ROLES.ADMINISTRATOR]).toMatchObject({ name: ROLES.ADMINISTRATOR });
    expect(result[ROLES.CLOUD_ENGINEER]).toMatchObject({ name: ROLES.CLOUD_ENGINEER });
    expect(result[ROLES.ANALYST]).toMatchObject({ name: ROLES.ANALYST });
    expect(result[ROLES.USER]).toMatchObject({ name: ROLES.USER });
  });

  it('looks up the default user role', async () => {
    (Role as any).findOne.mockResolvedValue({ name: ROLES.USER });

    const result = await AuthService.getUserRole();

    expect(result).toEqual({ name: ROLES.USER });
    expect((Role as any).findOne).toHaveBeenCalledWith({ name: ROLES.USER });
  });
});
