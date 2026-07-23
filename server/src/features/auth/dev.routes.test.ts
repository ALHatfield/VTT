import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../app.js';
import { prisma } from '../../shared/db/prisma.js';
import { hashPassword } from '../../shared/utils/password.js';

describe('Dev Routes', () => {
  let testUserId: string;
  let testUserEmail: string;

  beforeEach(async () => {
    // Create a test user
    testUserEmail = 'testdev@example.com';
    const passwordHash = await hashPassword('password123');

    const user = await prisma.user.create({
      data: {
        username: 'TestDevUser',
        email: testUserEmail,
        passwordHash,
      },
    });

    testUserId = user.id;
  });

  afterEach(async () => {
    // Clean up test user
    await prisma.user.delete({ where: { id: testUserId } });
  });

  describe('GET /api/dev/users', () => {
    it('should return all users', async () => {
      const response = await request(app).get('/api/dev/users').expect(200);

      expect(response.body).toHaveProperty('users');
      expect(Array.isArray(response.body.users)).toBe(true);
      expect(response.body.users.length).toBeGreaterThan(0);

      // Verify user structure
      const user = response.body.users[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
      expect(user).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /api/dev/login', () => {
    it('should auto-login user by ID', async () => {
      const response = await request(app)
        .post('/api/dev/login')
        .send({ userId: testUserId })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        id: testUserId,
        email: testUserEmail,
        username: 'TestDevUser',
      });
    });

    it('should reject missing userId', async () => {
      const response = await request(app)
        .post('/api/dev/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'MISSING_USER_ID');
    });

    it('should reject invalid userId', async () => {
      const response = await request(app)
        .post('/api/dev/login')
        .send({ userId: 'invalid-user-id' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'USER_NOT_FOUND');
    });
  });
});
