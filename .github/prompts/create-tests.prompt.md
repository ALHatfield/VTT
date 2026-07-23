---
description: "Generate comprehensive unit tests for the selected or specified code."
agent: agent
argument-hint: "File or function to test"
---
Generate comprehensive unit tests using **Vitest** for the provided code.

- Use `describe` blocks grouped by function/component name
- Use `it` (not `test`) with descriptive names that read as sentences
- Follow the Arrange-Act-Assert pattern in each test
- Cover happy paths, edge cases, and error scenarios
- For API routes: test role-based access (DM, Player, Observer), validation errors, and success responses
- For Socket.IO handlers: mock socket objects with event emitter stubs
- For React components: use `@testing-library/react` for rendering and interaction
- Mock Prisma client using `vitest.mock` with a shared factory
- Mock Express req/res as lightweight objects
- Co-locate test files next to source: `Foo.test.ts` beside `Foo.ts`
