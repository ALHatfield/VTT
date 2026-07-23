---
description: "Conventions for GSAP animations in React components — page transitions, UI interactions, and cleanup."
applyTo: "client/**/*.tsx"
---
# GSAP Animation Conventions

GSAP handles all DOM-based UI animations. PixiJS handles canvas rendering. These two systems are separate — never use GSAP to animate PixiJS objects.

## Setup
- Use `@gsap/react` package with the `useGSAP` hook for React integration
- Register plugins once in the app entry point: `gsap.registerPlugin(ScrollTrigger, Flip, ...)`
- Import GSAP per-component: `import gsap from 'gsap'` and `import { useGSAP } from '@gsap/react'`

## useGSAP Hook Pattern
Always use `useGSAP` instead of raw `useEffect` + `gsap` — it auto-cleans up tweens on unmount.

```tsx
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

export function CampaignCard({ name }: CampaignCardProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    gsap.from(containerRef.current, {
      opacity: 0,
      y: 20,
      duration: 0.4,
      ease: 'power2.out',
    });
  }, { scope: containerRef });

  return <div ref={containerRef}>{name}</div>;
}
```

## Animation Patterns
- **Mount animations**: `gsap.from()` with `opacity: 0` and slight `y` or `x` offset
- **Exit animations**: Use `gsap.to()` before removing elements — coordinate with React state
- **Stagger**: Use `stagger` property for lists of elements entering sequentially
- **Page transitions**: Animate out current page, swap route, animate in new page
- **Hover/interaction**: Use `gsap.to()` with short durations (0.2–0.3s) for micro-interactions

## Timelines
- Use `gsap.timeline()` for sequenced multi-step animations
- Store timeline refs for play/pause/reverse control
- Always set `paused: true` on timelines that should be triggered by user action

## Performance
- Prefer `transform` properties (`x`, `y`, `scale`, `rotation`) over layout-triggering properties (`width`, `height`, `top`, `left`)
- Use `will-change: transform` on elements that animate frequently
- Kill tweens when they're no longer needed — `useGSAP` handles this automatically
- Avoid animating during canvas-heavy operations (token dragging, map panning)

## Do NOT
- Animate PixiJS canvas elements with GSAP — use `PIXI.Ticker` and PixiJS APIs instead
- Use CSS transitions/animations for complex sequences — use GSAP timelines
- Create tweens in render functions without cleanup
