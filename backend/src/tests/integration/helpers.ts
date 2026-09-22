import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../app';

export async function clearDatabase() {
  const db = mongoose.connection.db;
  if (db) {
    await db.dropDatabase().catch(() => undefined);
  }
}

export async function registerAndLogin({
  name = 'Admin User',
  email = 'admin@example.com',
  password = 'Password123!',
}: {
  name?: string;
  email?: string;
  password?: string;
} = {}) {
  const signup = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password });

  if (signup.status !== 201) {
    throw new Error(`Signup failed: ${signup.status} ${JSON.stringify(signup.body)}`);
  }

  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  if (login.status !== 200) {
    throw new Error(`Login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return {
    signup,
    login,
    token: login.body.access_token,
    refreshToken: login.body.refresh_token,
    user: login.body.user,
  };
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
