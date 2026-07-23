---
description: "Scaffold a new React component with a co-located CSS Module file."
agent: agent
argument-hint: "Component name and purpose"
---
Create a new React component following the project conventions:

1. Create a functional component with named export in `client/src/features/{slug}/components/` (or `client/src/shared/components/` for cross-cutting UI)
2. Define a `{ComponentName}Props` interface directly above the component
3. Destructure props in the function signature
4. Create a co-located `.module.css` file with the same name
5. Import the CSS Module as `styles`
6. Use TypeScript strict typing — explicit return type of `JSX.Element`
7. If the component needs socket events, extract them into a custom hook in `client/src/features/{slug}/hooks/` (or `client/src/shared/hooks/` for cross-cutting hooks)
