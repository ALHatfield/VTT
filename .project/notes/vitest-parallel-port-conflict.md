# Vitest 3.x Parallel Port Conflict in Integration Tests

**Created:** May 29, 2026
**Applies to:** `server/vitest.config.ts`, any feature with integration tests that import `app.ts`

---

## Problem

When Vitest 3.x runs test files in parallel (the default), each file runs in a separate worker process (`forks` pool). If multiple test files all import `app.ts`, each worker executes the `httpServer.listen(env.PORT, ...)` call at module load time. Two workers trying to bind the same port causes `EADDRINUSE`, which triggers `process.exit(1)` in `app.ts`. Vitest intercepts `process.exit` and throws an unhandled exception that contaminates the entire test run — ALL tests fail, not just the file that got the port conflict.

This worked in Vitest 2.x because the default pool was `threads` (shared V8 VM), so module state was shared and `httpServer.listen()` was only called once.

## Fix Applied

Added `fileParallelism: false` to `server/vitest.config.ts`:

```ts
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,   // ← prevents parallel port conflicts
  },
});
```

This makes test files run sequentially. Each file's worker starts the server, runs its tests, then Vitest sends SIGTERM which triggers graceful shutdown (releasing the port) before the next file's worker starts.

## Trade-off

Sequential file execution is slower (~40s vs ~10s for 3 files). This is acceptable for integration tests that need a real server and database.

## Alternative (not used)

The architecturally cleaner fix is to move `httpServer.listen()` out of `app.ts` into a separate `server.ts` entry point. Tests would import `app` without starting the HTTP server; supertest binds its own ephemeral server. This would allow parallel test files again. Flagged as potential future improvement if test suite grows and sequential execution becomes a bottleneck.
