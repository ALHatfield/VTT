import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

describe('Auth Routes', () => {
  let testUserId: string;
  let testUserEmail: string;
  let testUserPassword: string;

  beforeEach(async () => {
    // Create a test user
    testUserEmail = 'test@example.com';
    testUserPassword = 'password123';
    const passwordHash = await hashPassword(testUserPassword);

    // Clean up leftovers from previous (aborted) runs so create never collides
    await prisma.user.deleteMany({
      where: { OR: [{ username: 'TestUser' }, { email: testUserEmail }] },
    });

    const user = await prisma.user.create({
      data: {
        username: 'TestUser',
        email: testUserEmail,
        passwordHash,
      },
    });

    testUserId = user.id;
  });

  afterEach(async () => {
    // deleteMany: never throws when the row is already gone (aborted-run safety)
    await prisma.user.deleteMany({ where: { id: testUserId } });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: testUserEmail,
        username: 'TestUser',
      });
      expect(response.body.user).not.toHaveProperty('passwordHash');
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testUserPassword,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'authentication_failed');
      expect(response.body).toHaveProperty('message', 'Invalid username or password');
    });

    it('should reject invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'authentication_failed');
      expect(response.body).toHaveProperty('message', 'Invalid username or password');
    });

    it('should reject missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'validation_error');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user when authenticated', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Get current user
      const response = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        email: testUserEmail,
        username: 'TestUser',
      });
    });

    it('should return 401 when not authenticated', async () => {
      const response = await request(app).get('/api/auth/me').expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should destroy session and clear cookie', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUserEmail,
          password: testUserPassword,
        });

      const cookies = loginResponse.headers['set-cookie'];

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(204);

      // Verify session is destroyed by trying to access /me
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(401);

      expect(meResponse.body).toHaveProperty('error');
      expect(meResponse.body.error).toHaveProperty('code', 'UNAUTHORIZED');
    });
  });
});
