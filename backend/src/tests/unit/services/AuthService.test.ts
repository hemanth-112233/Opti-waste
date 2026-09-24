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

  it('authenticates with the default User role when user.role is missing', async () => {
    const user = {
      _id: 'user-role-missing',
      email: 'role-missing@example.com',
      name: 'User Missing Role',
      password_hash: 'hashed-password',
      is_active: true,
    };

    (User as any).findOne.mockReturnValue(makeLeanChain(user));
    (bcrypt as any).compare.mockResolvedValue(true);
    (jwt as any).sign.mockImplementation((payload: any, secret: string) => `token:${payload.sub}:${secret}`);

    const result = await AuthService.authenticateUser('role-missing@example.com', 'plain-text-password');

    expect(result?.user.role).toBe(ROLES.USER);
    expect(result?.tokens.token_type).toBe('Bearer');
  });

  it('returns null when user.password_hash is missing', async () => {
    const user = {
      _id: 'user-no-hash',
      email: 'nohash@example.com',
      name: 'No Hash User',
      is_active: true,
      role: { name: ROLES.USER },
    };

    (User as any).findOne.mockReturnValue(makeLeanChain(user));
    (bcrypt as any).compare.mockResolvedValue(false);

    const result = await AuthService.authenticateUser('nohash@example.com', 'plain-text-password');

    expect(result).toBeNull();
  });

  it('propagates a User.findOne error during authentication', async () => {
    (User as any).findOne.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('db lookup failed')),
    });

    await expect(AuthService.authenticateUser('error@example.com', 'plain-text-password')).rejects.toThrow('db lookup failed');
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

  it('returns null when refresh token payload has no sub', async () => {
    (jwt as any).verify.mockReturnValue({});
    (User as any).findById.mockReturnValue(makeLeanChain(null));

    const result = await AuthService.verifyRefreshToken('token-without-sub');

    expect(result).toBeNull();
    expect((User as any).findById).toHaveBeenCalledWith(undefined);
  });

  it('returns null when the refresh-token user is missing and distinguishes that from an inactive user', async () => {
    const inactiveUser = {
      _id: 'user-inactive',
      email: 'inactive@example.com',
      name: 'Inactive',
      is_active: false,
      role: { name: ROLES.USER },
    };

    (jwt as any).verify.mockReturnValue({ sub: 'user-404' });
    (User as any).findById.mockReturnValueOnce(makeLeanChain(null)).mockReturnValueOnce(makeLeanChain(inactiveUser));

    const missingResult = await AuthService.verifyRefreshToken('token-for-missing-user');
    const inactiveResult = await AuthService.verifyRefreshToken('token-for-inactive-user');

    expect(missingResult).toBeNull();
    expect(inactiveResult).toBeNull();
  });

  it('returns null when User.findById throws during refresh verification', async () => {
    (jwt as any).verify.mockReturnValue({ sub: 'user-123' });
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('findById failed')),
    });

    const result = await AuthService.verifyRefreshToken('token-triggering-findbyid-error');

    expect(result).toBeNull();
  });

  it('hashes a password using bcrypt', async () => {
    (bcrypt as any).hash.mockResolvedValue('hashed-password');

    const result = await AuthService.hashPassword('plain-text-password');

    expect(result).toBe('hashed-password');
    expect((bcrypt as any).hash).toHaveBeenCalledWith('plain-text-password', 12);
  });

  it('propagates a bcrypt.hash error', async () => {
    (bcrypt as any).hash.mockRejectedValue(new Error('hash failed'));

    await expect(AuthService.hashPassword('plain-text-password')).rejects.toThrow('hash failed');
  });

  it('verifies a password using bcrypt', async () => {
    (bcrypt as any).compare.mockResolvedValue(true);

    const result = await AuthService.verifyPassword('plain-text-password', 'hashed-password');

    expect(result).toBe(true);
    expect((bcrypt as any).compare).toHaveBeenCalledWith('plain-text-password', 'hashed-password');
  });

  it('returns false when bcrypt.compare returns false', async () => {
    (bcrypt as any).compare.mockResolvedValue(false);

    const result = await AuthService.verifyPassword('plain-text-password', 'hashed-password');

    expect(result).toBe(false);
  });

  it('propagates a bcrypt.compare error', async () => {
    (bcrypt as any).compare.mockRejectedValue(new Error('compare failed'));

    await expect(AuthService.verifyPassword('plain-text-password', 'hashed-password')).rejects.toThrow('compare failed');
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

  it('seedDefaultRoles verifies the exact update arguments include upsert and new flags', async () => {
    (Role as any).findOneAndUpdate.mockImplementation((filter: any, update: any) =>
      Promise.resolve({ name: filter.name, permissions: update.permissions })
    );

    await AuthService.seedDefaultRoles();

    expect((Role as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { name: ROLES.ADMINISTRATOR },
      { name: ROLES.ADMINISTRATOR, permissions: ['*'] },
      { upsert: true, new: true }
    );
    expect((Role as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { name: ROLES.CLOUD_ENGINEER },
      { name: ROLES.CLOUD_ENGINEER, permissions: ['read', 'write'] },
      { upsert: true, new: true }
    );
    expect((Role as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      3,
      { name: ROLES.ANALYST },
      { name: ROLES.ANALYST, permissions: ['read'] },
      { upsert: true, new: true }
    );
    expect((Role as any).findOneAndUpdate).toHaveBeenNthCalledWith(
      4,
      { name: ROLES.USER },
      { name: ROLES.USER, permissions: ['read'] },
      { upsert: true, new: true }
    );
  });

  it('propagates a role update failure from seedDefaultRoles', async () => {
    (Role as any).findOneAndUpdate.mockRejectedValue(new Error('role update failed'));

    await expect(AuthService.seedDefaultRoles()).rejects.toThrow('role update failed');
  });

  it('looks up the default user role', async () => {
    (Role as any).findOne.mockResolvedValue({ name: ROLES.USER });

    const result = await AuthService.getUserRole();

    expect(result).toEqual({ name: ROLES.USER });
    expect((Role as any).findOne).toHaveBeenCalledWith({ name: ROLES.USER });
  });

  it('returns null when no User role exists', async () => {
    (Role as any).findOne.mockResolvedValue(null);

    const result = await AuthService.getUserRole();

    expect(result).toBeNull();
  });
});
