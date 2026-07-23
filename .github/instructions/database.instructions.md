---
description: "Conventions for Prisma schema, migrations, and database interactions."
applyTo: "**/prisma/**"
---
# Database Conventions (Prisma)

## Schema
- Use `@map` and `@@map` to keep TypeScript names PascalCase while database tables/columns use snake_case
- Always include `createdAt` and `updatedAt` fields on models
- Use `@relation` explicitly — don't rely on implicit relations
- Add `@@index` for fields used in WHERE clauses and foreign keys

## Migrations
- Run `npx prisma migrate dev --name descriptive-name` to generate migrations
- Never edit generated migration SQL files manually
- Seed data goes in `prisma/seed.ts` — this includes the pre-seeded user accounts for MVP

## Client Usage
- Import the singleton Prisma client from `server/src/utils/prisma.ts`
- Use `select` or `include` to fetch only needed fields — avoid fetching entire records
- Use transactions (`prisma.$transaction`) for operations that must be atomic
- Never expose Prisma models directly to API responses — map to response DTOs
