---
description: "Conventions for React components including JSX patterns, hooks, and CSS Modules."
applyTo: "client/**/*.tsx"
---
# React Component Conventions

## Component Structure
- Functional components only — no class components
- Use named exports, not default exports
- Props interface named `{ComponentName}Props`, defined directly above the component
- Destructure props in the function signature

```tsx
import styles from './TokenCard.module.css';

interface TokenCardProps {
  name: string;
  hp: number;
  onSelect: (id: string) => void;
}

export function TokenCard({ name, hp, onSelect }: TokenCardProps) {
  return (
    <div className={styles.container}>
      <span className={styles.name}>{name}</span>
    </div>
  );
}
```

## CSS Modules
- One `.module.css` file per component, co-located in the same directory
- Import as `styles`: `import styles from './Foo.module.css'`
- Use camelCase class names in the module file (`.container`, `.headerText`)
- No inline styles — use CSS Modules classes or CSS custom properties

## Hooks
- Feature-specific hooks live in their feature directory: `client/src/features/{feature}/hooks/`
- Cross-cutting hooks live in `client/src/shared/hooks/` and start with `use` prefix
- Extract complex logic (socket listeners, canvas interactions) into custom hooks
- Always include cleanup in `useEffect` — especially for socket and canvas event listeners
- For GSAP animations, use the `useGSAP` hook from `@gsap/react` instead of raw `useEffect`

## File Organization (Feature-Based)
- Components live inside their feature directory: `client/src/features/{feature}/components/`
- Cross-cutting components (layout, nav, buttons) live in `client/src/shared/components/`
- Never import directly from another feature directory — use `shared/` for cross-cutting code

## State Management
- Use React context for cross-cutting concerns (auth, theme, campaign context)
- Feature-specific context lives in `client/src/features/{feature}/context/`
- App-level context lives in `client/src/shared/context/`
- Keep state as close to where it's used as possible
- Avoid prop drilling beyond 2 levels — extract to context or composition
