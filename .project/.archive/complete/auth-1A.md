# Auth — Phase 1A: MVP Authentication

**Completed:** May 27, 2026  
**Feature:** `auth`

---

## Deliverables

### Shared Package (`shared/`)
- `src/types/auth.ts` — AuthUser, LoginPayload, SessionData, AuthResponse types
- `src/validators/auth.ts` — Zod schema for login validation
- `src/constants/auth.ts` — Session cookie name, bcrypt rounds, session max age
- `src/types/index.ts` — Export auth types
- `src/validators/index.ts` — Export auth validators
- `src/constants/index.ts` — Export auth constants

### Server Package (`server/`)
**Database:**
- `prisma/schema.prisma` — User and Session models
- `prisma/migrations/20260528011955_add_user_and_session_models/` — Migration SQL
- `prisma/seed.ts` — Pre-seeded test accounts (testdm, testplayer, testobserver)

**Utilities:**
- `src/shared/utils/password.ts` — bcrypt hash/verify functions
- `src/shared/types/session.d.ts` — Express session type declarations

**Middleware:**
- `src/shared/middleware/session.ts` — PostgreSQL session store configuration

**Auth Feature:**
- `src/features/auth/auth.service.ts` — authenticateUser, getUserById
- `src/features/auth/auth.middleware.ts` — requireAuth middleware
- `src/features/auth/auth.routes.ts` — /login, /logout, /me endpoints
- `src/features/auth/auth.routes.test.ts` — 7 integration tests

**App Integration:**
- `src/app.ts` — Session middleware and auth routes registered

### Client Package (`client/`)
**Auth Feature:**
- `src/features/auth/AuthContext.tsx` — Global auth state provider
- `src/features/auth/Login.tsx` — Login page component
- `src/features/auth/Login.module.css` — Login page styles
- `src/features/auth/ProtectedRoute.tsx` — Route wrapper for authenticated pages
- `src/features/auth/Login.test.tsx` — 4 component tests
- `src/features/auth/ProtectedRoute.test.tsx` — 3 component tests

**App Integration:**
- `src/App.tsx` — BrowserRouter, AuthProvider, routes for /login and /campaigns
- `src/main.tsx` — Removed duplicate BrowserRouter
- `src/test-setup.ts` — Test environment setup

**Config:**
- `vitest.config.ts` — Added setupFiles configuration

---

## Test Results

**Command:** `npm test`

### Server Tests (7/7 passing)
```
✓ Auth Routes > POST /api/auth/login > should login with valid credentials
✓ Auth Routes > POST /api/auth/login > should reject invalid email
✓ Auth Routes > POST /api/auth/login > should reject invalid password
✓ Auth Routes > POST /api/auth/login > should reject missing fields
✓ Auth Routes > GET /api/auth/me > should return current user when authenticated
✓ Auth Routes > GET /api/auth/me > should return 401 when not authenticated
✓ Auth Routes > POST /api/auth/logout > should destroy session and clear cookie
```

### Client Tests (7/7 passing)
```
✓ Login Component > renders login form
✓ Login Component > shows validation error when fields are empty
✓ Login Component > displays dev account hints
✓ Login Component > toggles password visibility
✓ ProtectedRoute Component > redirects to login when not authenticated
✓ ProtectedRoute Component > shows protected content when authenticated
✓ ProtectedRoute Component > shows loading state initially
```

**Total:** 14/14 tests passing

### Manual Testing
**Dev servers:** http://localhost:5173 (client), http://localhost:3001 (server)

**Verified:**
- ✅ Login with valid credentials (testdm@email.com / password123)
- ✅ Login with invalid credentials shows generic error message
- ✅ Session persists across page refreshes
- ✅ Protected routes redirect to /login when not authenticated
- ✅ Successful login redirects to /campaigns
- ✅ Dev account hints visible only in development mode

---

## Decisions & Insights

### Security Decisions
- **Session-based auth over JWT:** Keeps tokens server-side, immune to XSS attacks on session cookies
- **Generic error messages:** "Invalid username or password" prevents username/email enumeration
- **HttpOnly cookies:** JavaScript cannot access session cookies
- **Secure flag:** Cookies only sent over HTTPS in production
- **SameSite=Strict:** Prevents CSRF attacks
- **bcrypt cost factor 12:** Industry standard balance of security and performance

### Implementation Patterns Established
- **Error response format:** `{ error: { code, message } }` for consistency across all API errors
- **Session data structure:** Store userId, email, username in session for easy access
- **Auth check on mount:** AuthContext fetches `/api/auth/me` to restore session on page load
- **Protected route pattern:** Wrapper component checks auth state before rendering children
- **Dev-only UI hints:** Use `import.meta.env.DEV` to conditionally render dev tools

### Gotchas Encountered
- **Duplicate BrowserRouter:** Had both in main.tsx and App.tsx — React Router requires only one
- **Port conflicts during tests:** Server startup in test files conflicts with running dev server
- **Import path conventions:** Auth routes must import from shared with proper .js extensions for ESM
- **Session store table name:** connect-pg-simple uses "session" by default, must match Prisma model

### Technical Debt Identified
- None for auth Phase 1A — implementation is clean and complete

---

## Dependencies Unlocked

Per the dependency graph in `.project/roadmap.md`:
- ✅ **auth Phase 1B** (Dev Tooling) — now unblocked
- ✅ **portal Phase 2A** (Portal Shell & Welcome) — now unblocked
- ✅ **campaigns Phase 3A** (Campaign CRUD) — now unblocked
