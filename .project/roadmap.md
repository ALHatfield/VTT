# VTT Roadmap

> Master overview only. Detailed tasks live in per-feature docs under `.project/features/`.

## Feature Status

| Slug        | Feature         | Phases           | Status      | Current Phase |
| ----------- | --------------- | ---------------- | ----------- | ------------- |
| `auth`      | Auth & Sessions | 1A–1B            | In Progress | 1A Complete   |
| `portal`    | Portal          | 2A–2B            | In Progress | 2A Complete   |
| `campaigns` | Campaigns       | 3A–3B            | Complete    | 3B Complete   |
| `play-area` | Play Area       | 4A–4K, 4F.1–4F.5 | In Progress | 4I Complete   |
| `editor`    | Campaign Editor | 5A–5E, 5A.1      | Complete    | 5E Complete   |

| `characters` | Character Sheets | 6A–6E | In Progress | 6A Complete |

> **Editor phase names updated 2026-06-10:** 5A → "Editor Mode & Asset Library", 5E → "Grid Alignment Tool"

## Cross-Cutting

| Phase | Name                       | Status   |
| ----- | -------------------------- | -------- |
| 0     | Foundation & Project Setup | Complete |

## Dependency Graph

```mermaid
graph TD
    P0[Phase 0: Foundation] --> A1A[auth 1A]
    A1A --> A1B[auth 1B]
    A1A --> PO2A[portal 2A]
    PO2A --> C3A[campaigns 3A]
    C3A --> C3B[campaigns 3B]
    C3A --> PA4A[play-area 4A]
    C3A --> E5A[editor 5A]
    C3A --> CH6A[characters 6A]
    PA4A --> PA4B[play-area 4B]
    PA4A --> PA4F[play-area 4F: Fog]
    PA4A --> E5A
    PA4B --> PA4C[play-area 4C]
    PA4C --> PA4D[play-area 4D: Chat]
    PA4D --> PA4E[play-area 4E: Dice]
    PA4E --> PA4G[play-area 4G: Player & NPC Tokens]
    PA4F --> PA4F1[play-area 4F.1: Token Vision]
    PA4G --> PA4F1
    PA4F1 --> PA4F2[play-area 4F.2: NPC Subtypes]
    PA4F2 --> PA4F3[play-area 4F.3: Canvas Toolbar]
    PA4F3 --> PA4F4[play-area 4F.4: Fog Toolbar]
    PA4F3 --> PA4F5[play-area 4F.5: NPC Placement]
    PA4F3 --> PA4J[play-area 4J: Measure Tool]
    PA4F3 --> PA4K[play-area 4K: Drawing Tools]
    PA4F3 --> PA4H[play-area 4H: Initiative]
    PA4C --> PA4I[play-area 4I: Auras]
    CH6A --> PA4H
    E5A --> E5A1[editor 5A.1: Built-in Assets]
    E5A1 --> E5B
    E5B --> E5C[editor 5C: Layer Mgmt]
    E5B --> E5E[editor 5E: Grid Align]
    CH6A --> CH6B[characters 6B]
    CH6A --> CH6D[characters 6D]
    CH6A --> CH6E[characters 6E: Export]
    PA4B --> CH6B
    PA4E --> CH6C[characters 6C]
    CH6A --> CH6C
```

## Feature Docs

Each feature has its own detailed document with phases, tasks, and decisions:

- [`.project/features/portal.md`](features/portal.md)
- [`.project/features/auth.md`](features/auth.md)
- [`.project/features/campaigns.md`](features/campaigns.md)
- [`.project/features/play-area.md`](features/play-area.md)
- [`.project/features/editor.md`](features/editor.md)
- [`.project/features/characters.md`](features/characters.md)
- [`.project/foundation.md`](foundation.md) — Phase 0: Foundation & Project Setup

## Phase 0: Foundation & Project Setup

See [`.project/foundation.md`](foundation.md) for tasks and status.

## Future (Post-MVP)

- Advanced authentication (WebAuthn, OAuth, MFA, rate limiting)
- Advanced combat engine (NPC stat blocks, automated attack rolls, damage resistance/vulnerability, AoE rendering, encounter difficulty calculator, combat log)
- Sound & ambience (integrated soundboard)
- Built-in voice & video chat
- Dynamic lighting and line-of-sight
- 3D dice integration (Three.js + cannon-es)
- Instant join via URL codes
- Compendium / rule lookup system
