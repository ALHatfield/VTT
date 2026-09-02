# Archived Phase 4I: Token Auras & Status Visualization

- Feature: `play-area`
- Source: `.project/features/play-area.md`
- Archived: 2026-09-02

---

## Phase 4I: Token Auras & Status Visualization

**Dependencies:** Phase 4C (real-time sync for aura broadcasts)

### Tasks

- [x] Aura radius configuration (DM-controlled), concentric rings around tokens
- [x] Aura color customization (RGB picker), visibility toggle
- [x] Aura types: presence, turn indicator, condition status
- [x] Condition auras with semantic colors (stunned=red, poisoned=purple, blessed=gold)
- [x] GSAP pulse/glow animations (200ms transitions) for aura effects
- [x] WebSocket broadcast for aura changes (`play-area:aura:update` → `play-area:aura:updated`)
- [x] Token inspector integration for aura radius/color fields
- [x] Preset aura templates (Aura of Protection, Healing Aura, Danger Zone)
- [x] Database: `auraRadius`, `auraColor` columns on Token model
- [x] Shared types: `AuraConfig`, `AuraType`, `AuraUpdatePayload`
- [x] Tests: aura rendering, DM-only controls, WebSocket broadcast, performance

### Decisions

- Aura state is stored directly on `Token` and updated through the existing authenticated token update path so REST, persistence, and DM-only authorization stay centralized.
- The aura-specific socket event (`play-area:aura:update` → `play-area:aura:updated`) uses the same service update path and also emits the existing token update broadcast for client state convergence.
- Condition auras use semantic colors at render time, so status meaning is preserved even if a custom aura color is set.

### Performance Targets

- <5ms render per token aura
- 50+ simultaneous auras without frame drops

---


