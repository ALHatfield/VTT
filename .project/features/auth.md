# Feature: auth

> **Slug:** `auth`
> **Feature dirs:** `client/src/features/auth/`, `server/src/features/auth/`
> **Instructions:** `.github/instructions/feature-auth.instructions.md`
> **Shared types:** `shared/types/auth.ts`

---

## Current Status

| Phase | Name | Status |
|-------|------|--------|
| 1B | Dev Tooling | Not Started |

---

## Phase 1B: Dev Tooling

**Dependencies:** Phase 1A

### Tasks
- [ ] Dev auto-login hook for testing (skip login page in development)
- [ ] Dev user switcher component (toggle between DM/Player/Observer accounts)
- [ ] Error boundary component with dev error panel
- [ ] Environment-gated dev tools (stripped from production builds)

---

## Post-MVP Roadmap
- Strong password policies with breach database checks
- WebAuthn (Passkeys) and OAuth 2.0 providers (Google, Apple)
- Multi-factor authentication (TOTP, push notifications)
- Rate limiting on login endpoints (IP-based throttling)
- Security event logging (failed logins, IP changes, MFA updates)
- Password reset with single-use, short-lived tokens via email
- Absolute session revocation on password/email change

---

## Architectural Decisions (from Project_Pathfinder)

**What worked well:**
- bcrypt with cost factor 12 — good balance of security and speed
- Generic error messages on login failure prevent account enumeration
- Dev auto-login (`testdm@email.com`) dramatically speeds development
- Dev user switcher component for testing all three roles without re-logging
- Floating error panel (dev-only) catches issues early

**What we're changing:**
- Project_Pathfinder used JWT tokens → new build uses session cookies (simpler, more secure for browser-only app)
- Project_Pathfinder had full signup/signin → new build starts with pre-seeded accounts only (MVP scope reduction)
- Project_Pathfinder stored JWT secret in `.env` → new build validates all env vars at startup with Zod