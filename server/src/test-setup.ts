import { afterAll } from 'vitest';

import { httpServer } from './app.js';

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
