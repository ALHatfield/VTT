---
description: "Auth feature — pre-seeded accounts (MVP), session management, and security patterns."
applyTo: "**/features/auth/**"
---
# Feature: auth

> For current phase status and tasks, see `.project/features/auth.md`

## MVP Scope
- Pre-seeded user accounts only — no registration endpoint, no public signup
- Session-based auth with express-session and a PostgreSQL session store
- Secure cookie flags: `HttpOnly`, `Secure`, `SameSite=Strict`
- Login endpoint returns session cookie, not JWT — keeps tokens out of client-side JS
- Seed script creates accounts with bcrypt-hashed passwords in `prisma/seed.ts`

## Route Protection
- `requireAuth` middleware validates session on every request — applied at the router level
- `requireRole(role)` middleware checks campaign membership and role (DM, Player, Observer)
- Auth checks happen server-side — never rely on hiding UI elements as access control
- Generic error messages on login failure: "Invalid username or password" (prevent account enumeration)

## Session Lifecycle
- Sessions stored in PostgreSQL via `connect-pg-simple` — not in-memory
- Session expiry: configurable via environment variable (`SESSION_MAX_AGE`)
- Logout destroys the session server-side and clears the cookie
- Password changes invalidate all other active sessions for that user

## Prior Art (Project_Pathfinder)
- JWT-based auth with bcrypt password hashing and refresh tokens
- Middleware chain: `authenticateToken` → `requireRole` → route handler
- Test account auto-login in development (`testdm@email.com`)
- Dev user switcher component for testing different roles

## Post-MVP Roadmap
- Strong password policies with breach database checks
- WebAuthn (Passkeys) and OAuth 2.0 providers (Google, Apple)
- Multi-factor authentication (TOTP, push notifications)
- Rate limiting on login endpoints (IP-based throttling)
- Security event logging (failed logins, IP changes, MFA updates)
- Password reset with single-use, short-lived tokens via email

## Integration Points
- Campaign role checks depend on auth session — `requireRole` reads `req.session.userId`
- Socket.IO connections authenticate via the session cookie in the handshake
- Character sheet ownership tied to authenticated user
