import request from 'supertest';

import { app } from '../../app.js';

const LOGIN_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 150;
const DEFAULT_TEST_PASSWORD = 'password123';

/**
 * Log in a test user and return the session cookies.
 *
 * Retries when the response has no set-cookie header — full-suite runs
 * occasionally hit transient session-store contention that makes a single
 * login attempt fail even though credentials are valid.
 */
export async function loginAs(
  email: string,
  password: string = DEFAULT_TEST_PASSWORD,
): Promise<string[]> {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt++) {
    const res = await request(app).post('/api/auth/login').send({ email, password });
    const cookies = res.headers['set-cookie'] as unknown as string[] | undefined;

    if (res.status === 200 && cookies && cookies.length > 0) {
      return cookies;
    }

    lastStatus = res.status;
    if (attempt < LOGIN_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt));
    }
  }

  throw new Error(
    `loginAs(${email}) got no session cookie after ${LOGIN_ATTEMPTS} attempts (last status ${lastStatus})`,
  );
}

/** loginAs variant returning a single Cookie header string (socket tests). */
export async function loginAsHeader(
  email: string,
  password: string = DEFAULT_TEST_PASSWORD,
): Promise<string> {
  const cookies = await loginAs(email, password);
  return cookies.join('; ');
}
