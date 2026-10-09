import bcrypt from 'bcrypt';
import { afterAll, vi } from 'vitest';

import { httpServer } from './app.js';

/**
 * Production bcrypt cost (12) is ~250 ms per hash and per login; tests create and log in
 * users in nearly every beforeEach, which starved the event loop in full runs (hook
 * timeouts, dropped sessions, ECONNRESET). Tests only — production hashing is unchanged.
 */
const TEST_BCRYPT_ROUNDS = 4;

vi.mock('./shared/utils/password.js', () => ({
  hashPassword: (password: string): Promise<string> => bcrypt.hash(password, TEST_BCRYPT_ROUNDS),
  verifyPassword: (password: string, hash: string): Promise<boolean> =>
    bcrypt.compare(password, hash),
}));

/**
 * Global server test teardown.
 * Closes the HTTP server (and thus releases the bound port) after each test
 * file finishes so subsequent test files can bind to the same port without
 * getting EADDRINUSE errors.
 */
afterAll(
  () =>
    new Promise<void>((resolve) => {
      if (httpServer.listening) {
        httpServer.close(() => resolve());
      } else {
        resolve();
      }
    }),
);
