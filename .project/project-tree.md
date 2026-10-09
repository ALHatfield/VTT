# VTT Project Tree

> **This file must reflect the actual filesystem at all times.** Every agent and prompt that creates or modifies files must update this tree before finishing. Mark new files with `(NEW - Phase X.Y)` and modified files with `(MODIFIED - Phase X.Y)`.
>
> For the planned target structure, see `copilot-instructions.md` § Project Structure.
```
VTT/
├── .github/
│   ├── agents/
│   │   ├── architect.agent.md
│   │   ├── code-reviewer.agent.md
│   │   ├── developer.agent.md
│   │   ├── docs-keeper.agent.md
│   │   ├── project.agent.md             (NEW - Phase PM3)
│   │   └── security.agent.md
│   ├── instructions/
│   │   ├── api-routes.instructions.md
│   │   ├── canvas.instructions.md
│   │   ├── coding-standards.instructions.md
│   │   ├── database.instructions.md
│   │   ├── feature-auth.instructions.md
│   │   ├── feature-bestiary.instructions.md (NEW - Phase 8)
│   │   ├── feature-campaigns.instructions.md
│   │   ├── feature-characters.instructions.md
│   │   ├── feature-dice.instructions.md (NEW - Phase 9)
│   │   ├── feature-editor.instructions.md
│   │   ├── feature-inventory.instructions.md (NEW - Phase 10)
│   │   ├── feature-play-area.instructions.md (MODIFIED - Phase 9)
│   │   ├── feature-portal.instructions.md (NEW - Phase 2A)
│   │   ├── feature-story.instructions.md (NEW - Phase 7)
│   │   ├── gsap-animations.instructions.md
│   │   ├── react-components.instructions.md
│   │   └── websocket-events.instructions.md (MODIFIED - Phase 9)
│   ├── prompts/
│   │   ├── create-api-route.prompt.md
│   │   ├── create-component.prompt.md
│   │   ├── create-feature.prompt.md
│   │   ├── create-tests.prompt.md
│   │   ├── docs-audit.prompt.md
│   │   ├── kill-bloat.prompt.md
│   │   ├── next-phase.prompt.md
│   │   ├── note.prompt.md
│   │   └── update-feature.prompt.md
│   └── copilot-instructions.md          (MODIFIED - Phase 9)
├── .project/
│   ├── .archive/
│   │   ├── complete/
│   │   │   ├── auth-1A.md
│   │   │   ├── campaigns-3A.md
│   │   │   ├── campaigns-3B.md
│   │   │   ├── campaigns-3C.md          (NEW - Phase 3C)
│   │   │   ├── characters-6A.md         (NEW - Phase 6A)
│   │   │   ├── characters-6B.md         (NEW - Phase 6B)
│   │   │   ├── characters-6C.md         (NEW - Phase 6C)
│   │   │   ├── characters-6D.md         (NEW - Phase 6D)
│   │   │   ├── dice-9F.md               (NEW - Phase 9F)
│   │   │   ├── editor-5A.1.md
│   │   │   ├── editor-5A.md             (NEW - Phase 5A)
│   │   │   ├── editor-5B.md
│   │   │   ├── editor-5C.md
│   │   │   ├── editor-5E.md
│   │   │   ├── editor-5F.md             (NEW - Phase 5F)
│   │   │   ├── editor-5G.md             (NEW - Phase 5G)
│   │   │   ├── editor-5H.md             (NEW - Phase 5H)
│   │   │   ├── phase-0.md
│   │   │   ├── play-area-4A.md
│   │   │   ├── play-area-4B.1.md
│   │   │   ├── play-area-4B.md
│   │   │   ├── play-area-4C.md
│   │   │   ├── play-area-4D.md
│   │   │   ├── play-area-4E.md
│   │   │   ├── play-area-4F.1.md        (NEW - Phase 4F.1)
│   │   │   ├── play-area-4F.2.md
│   │   │   ├── play-area-4F.3.md
│   │   │   ├── play-area-4F.4.md
│   │   │   ├── play-area-4F.5.md        (NEW - Phase 4F.5)
│   │   │   ├── play-area-4F.md
│   │   │   ├── play-area-4G.md
│   │   │   ├── play-area-4H.md
│   │   │   ├── play-area-4I.md          (NEW - Phase 4I)
│   │   │   ├── play-area-4J.md
│   │   │   ├── play-area-4K.md
│   │   │   ├── play-area-PM1.md         (NEW - Phase PM1)
│   │   │   ├── play-area-PM2.md         (NEW - Phase PM2)
│   │   │   ├── play-area-PM3.md         (NEW - Phase PM3)
│   │   │   ├── play-area-PM4.md         (NEW - Phase PM4)
│   │   │   ├── portal-2A.md
│   │   │   └── README.md
│   │   └── features/
│   │       ├── auth/
│   │       │   └── phase-1A.md
│   │       ├── campaigns/
│   │       │   ├── phase-3A.md
│   │       │   ├── phase-3B.md
│   │       │   └── phase-3C.md          (NEW - Phase 3C)
│   │       ├── characters/              (NEW - Phase 6A)
│   │       │   ├── phase-6A.md          (NEW - Phase 6A)
│   │       │   ├── phase-6B.md          (NEW - Phase 6B)
│   │       │   ├── phase-6C.md          (NEW - Phase 6C)
│   │       │   └── phase-6D.md          (NEW - Phase 6D)
│   │       ├── dice/                    (NEW - Phase 9F)
│   │       │   └── phase-9F.md          (NEW - Phase 9F)
│   │       ├── editor/                  (NEW - Phase 5A)
│   │       │   ├── phase-5A.1.md
│   │       │   ├── phase-5A.md          (NEW - Phase 5A)
│   │       │   ├── phase-5C.md
│   │       │   ├── phase-5E.md
│   │       │   ├── phase-5F.md          (NEW - Phase 5F)
│   │       │   ├── phase-5G.md          (NEW - Phase 5G)
│   │       │   └── phase-5H.md          (NEW - Phase 5H)
│   │       ├── play-area/
│   │       │   ├── phase-4A.md
│   │       │   ├── phase-4B.1.md
│   │       │   ├── phase-4B.md
│   │       │   ├── phase-4C.md
│   │       │   ├── phase-4D.md
│   │       │   ├── phase-4E.md
│   │       │   ├── phase-4F.1.md        (NEW - Phase 4F.1)
│   │       │   ├── phase-4F.2.md
│   │       │   ├── phase-4F.3.md
│   │       │   ├── phase-4F.4.md
│   │       │   ├── phase-4F.5.md
│   │       │   ├── phase-4F.md
│   │       │   ├── phase-4G.md
│   │       │   ├── phase-4H.md
│   │       │   ├── phase-4I.md          (NEW - Phase 4I)
│   │       │   ├── phase-4J.md
│   │       │   ├── phase-4K.md
│   │       │   ├── phase-PM1.md         (NEW - Phase PM1)
│   │       │   ├── phase-PM2.md         (NEW - Phase PM2)
│   │       │   ├── phase-PM3.md         (NEW - Phase PM3)
│   │       │   └── phase-PM4.md         (NEW - Phase PM4)
│   │       ├── portal/
│   │       │   └── phase-2A.md
│   │       └── README.md
│   ├── features/
│   │   ├── auth.md                      (MODIFIED - Phase 1A)
│   │   ├── bestiary.md                  (NEW - Phase 8)
│   │   ├── campaigns.md                 (MODIFIED - Phase 3A, Phase 3B)
│   │   ├── characters.md
│   │   ├── dice.md                      (NEW - Phase 9)
│   │   ├── editor.md                    (MODIFIED - Phase 5G)
│   │   ├── inventory.md                 (NEW - Phase 10)
│   │   ├── play-area.md                 (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1, Phase 4C, Phase 4D, Phase 4E)
│   │   ├── portal.md                    (MODIFIED - Phase 2A)
│   │   └── story.md                     (NEW - Phase 7)
│   ├── handoffs/
│   │   ├── editor-5B-builtin-assets.md
│   │   ├── editor-5B-pathfinder-port.md
│   │   ├── notes-and-handoffs-naming-convention.md
│   │   ├── play-area-general-playground-asset-drops.md
│   │   └── play-area-PM1-3d-dice-roller.md
│   ├── notes/
│   │   ├── editor-5A-editor-mode-integration.md (NEW - Phase 5A)
│   │   ├── phase0-design.md             (NEW - Phase 0)
│   │   ├── phase0-rbac-architecture.md
│   │   ├── play-area-4F-fog-compositing.md
│   │   ├── play-area-4F.3-toolbar-features.md (NEW - Phase 5A)
│   │   ├── play-area-general-pixiejs-canvas-notes.md
│   │   ├── play-area-general-pixijs-v8.md
│   │   ├── play-area-general-seed-scene-idempotency.md
│   │   ├── play-area-PM2-fog-benchmark.md (NEW - Phase PM2)
│   │   ├── play-area-PM2-fog-rendering.md
│   │   ├── play-area-PM3-line-of-sight.md
│   │   ├── play-area-PM4-lighting-effects.md
│   │   ├── play-area-PM5-environmental-effects.md
│   │   ├── README.md
│   │   └── vitest-parallel-port-conflict.md (NEW - Phase 3B)
│   ├── wireframes/
│   │   └── wireframe.png
│   ├── phase-0.md
│   ├── project-tree.md                  (MODIFIED - Phase 0, Phase 1A, Phase 2A, Phase 3A, Phase 3B, Phase 4A, Phase 4B, Phase 4B.1, Phase 4C, Phase 4D, Phase 4E)
│   └── roadmap.md                       (MODIFIED - Phase 0, Phase 1A, Phase 2A, Phase 3A, Phase 3B, Phase 4A, Phase 4B, Phase 4B.1, Phase 4C, Phase 4D, Phase 4E, Phase 9)
├── .vscode/
│   ├── extensions.json
│   └── settings.json
├── client/                              (NEW - Phase 0)
│   ├── public/
│   │   ├── tiles/
│   │   │   ├── tile1.png
│   │   │   └── tile2.png
│   │   └── tokens/
│   │       ├── token1.png
│   │       ├── token2.png
│   │       ├── token3.png
│   │       ├── token4.png
│   │       ├── token5.png
│   │       └── token6.png
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── AuthContext.tsx      (NEW - Phase 1A)
│   │   │   │   ├── DevUserSwitcher.module.css (NEW - Phase 1A)
│   │   │   │   ├── DevUserSwitcher.tsx  (NEW - Phase 1A)
│   │   │   │   ├── Login.module.css     (NEW - Phase 1A)
│   │   │   │   ├── Login.test.tsx       (NEW - Phase 1A)
│   │   │   │   ├── Login.tsx            (NEW - Phase 1A)
│   │   │   │   ├── ProtectedRoute.test.tsx (NEW - Phase 1A, MODIFIED - Phase 4G)
│   │   │   │   ├── ProtectedRoute.tsx   (NEW - Phase 1A)
│   │   │   │   └── useDevAutoLogin.ts   (NEW - Phase 1A)
│   │   │   ├── bestiary/                (NEW - Phase 8)
│   │   │   │   ├── components/          (NEW - Phase 8)
│   │   │   │   │   └── index.ts         (NEW - Phase 8)
│   │   │   │   ├── hooks/               (NEW - Phase 8)
│   │   │   │   │   └── .gitkeep         (NEW - Phase 8)
│   │   │   │   ├── utils/               (NEW - Phase 8)
│   │   │   │   │   └── .gitkeep         (NEW - Phase 8)
│   │   │   │   └── types.ts             (NEW - Phase 8)
│   │   │   ├── campaigns/
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useCampaignActions.ts (NEW - Phase 3A)
│   │   │   │   │   ├── useCampaigns.ts  (NEW - Phase 3A)
│   │   │   │   │   └── useMemberActions.ts (NEW - Phase 3B)
│   │   │   │   ├── CampaignDetail.module.css (MODIFIED - Phase 3A, Phase 3B)
│   │   │   │   ├── CampaignDetail.tsx   (MODIFIED - Phase 3A, Phase 3B)
│   │   │   │   ├── CampaignForm.module.css (NEW - Phase 3A)
│   │   │   │   ├── CampaignForm.tsx     (NEW - Phase 3A)
│   │   │   │   ├── CampaignList.module.css (NEW - Phase 3A)
│   │   │   │   ├── CampaignList.tsx     (MODIFIED - Phase 3A, Phase 4A)
│   │   │   │   ├── GameSystemBadge.module.css (NEW - Phase 3C)
│   │   │   │   ├── GameSystemBadge.test.tsx (NEW - Phase 3C)
│   │   │   │   └── GameSystemBadge.tsx  (NEW - Phase 3C)
│   │   │   ├── characters/
│   │   │   │   ├── components/          (NEW - Phase 6B)
│   │   │   │   │   ├── CharacterCards.module.css (NEW - Phase 6B)
│   │   │   │   │   ├── CharacterCards.tsx (NEW - Phase 6B)
│   │   │   │   │   ├── MemberLinkControls.module.css (NEW - Phase 6B)
│   │   │   │   │   ├── MemberLinkControls.test.tsx (NEW - Phase 6B)
│   │   │   │   │   ├── MemberLinkControls.tsx (NEW - Phase 6B)
│   │   │   │   │   ├── SpellsTab.module.css (NEW - Phase 6D)
│   │   │   │   │   ├── SpellsTab.test.tsx (NEW - Phase 6D)
│   │   │   │   │   ├── SpellsTab.tsx    (NEW - Phase 6D)
│   │   │   │   │   ├── StatsTab.module.css (NEW - Phase 6C)
│   │   │   │   │   ├── StatsTab.test.tsx (NEW - Phase 6C)
│   │   │   │   │   └── StatsTab.tsx     (NEW - Phase 6C)
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useCharacterActions.ts (NEW - Phase 6A)
│   │   │   │   │   ├── useCharacterDetail.ts (NEW - Phase 6A)
│   │   │   │   │   ├── useCharacterLinking.ts (NEW - Phase 6B)
│   │   │   │   │   ├── useCharacters.ts (NEW - Phase 6A)
│   │   │   │   │   └── useCharacterSocket.ts (NEW - Phase 6B)
│   │   │   │   ├── CharacterCreate.module.css (NEW - Phase 6A)
│   │   │   │   ├── CharacterCreate.tsx  (NEW - Phase 6A)
│   │   │   │   ├── CharacterSheet.module.css (NEW - Phase 6A)
│   │   │   │   ├── CharacterSheet.tsx   (NEW - Phase 6A)
│   │   │   │   └── utils.ts             (NEW - Phase 6A)
│   │   │   ├── dice/                    (NEW - Phase 9)
│   │   │   │   ├── components/          (NEW - Phase 9)
│   │   │   │   │   ├── DiceOverlay.module.css (NEW - Phase 9F)
│   │   │   │   │   ├── DiceOverlay.test.tsx (NEW - Phase 9F)
│   │   │   │   │   ├── DiceOverlay.tsx  (NEW - Phase 9F)
│   │   │   │   │   ├── DiceRollerButton.module.css (NEW - Phase 9F)
│   │   │   │   │   ├── DiceRollerButton.tsx (NEW - Phase 9F)
│   │   │   │   │   └── index.ts         (NEW - Phase 9)
│   │   │   │   ├── dice3d/              (NEW - Phase 9F)
│   │   │   │   │   ├── animator.ts      (NEW - Phase 9F)
│   │   │   │   │   ├── constants.test.ts (NEW - Phase 9F)
│   │   │   │   │   ├── roll-mapping.test.ts (NEW - Phase 9F)
│   │   │   │   │   ├── roll-mapping.ts  (NEW - Phase 9F)
│   │   │   │   │   └── three-dice-animator.ts (NEW - Phase 9F)
│   │   │   │   ├── engine/              (NEW - Phase 9F)
│   │   │   │   │   ├── dice.test.ts     (NEW - Phase 9F)
│   │   │   │   │   └── dice.ts          (NEW - Phase 9F)
│   │   │   │   ├── hooks/               (NEW - Phase 9)
│   │   │   │   │   ├── use3dDiceReveal.test.ts (NEW - Phase 9F)
│   │   │   │   │   ├── use3dDiceReveal.ts (NEW - Phase 9F)
│   │   │   │   │   └── useDiceSettings.ts (NEW - Phase 9F)
│   │   │   │   ├── renderer/            (NEW - Phase 9F)
│   │   │   │   │   ├── geometry.test.ts (NEW - Phase 9F)
│   │   │   │   │   ├── geometry.ts      (NEW - Phase 9F)
│   │   │   │   │   ├── physics.ts       (NEW - Phase 9F)
│   │   │   │   │   ├── scene.test.ts    (NEW - Phase 9F)
│   │   │   │   │   └── scene.ts         (NEW - Phase 9F)
│   │   │   │   ├── utils/               (NEW - Phase 9)
│   │   │   │   │   └── .gitkeep         (NEW - Phase 9)
│   │   │   │   └── types.ts             (NEW - Phase 9)
│   │   │   ├── editor/
│   │   │   │   ├── canvas/              (NEW - Phase 5F)
│   │   │   │   │   ├── LightOverlay.test.ts (NEW - Phase 5G)
│   │   │   │   │   ├── LightOverlay.ts  (NEW - Phase 5G)
│   │   │   │   │   ├── WallOverlay.test.ts (NEW - Phase 5F)
│   │   │   │   │   └── WallOverlay.ts   (NEW - Phase 5F)
│   │   │   │   ├── components/          (NEW - Phase 5A)
│   │   │   │   │   ├── AssetLibrary.module.css (NEW - Phase 5A)
│   │   │   │   │   ├── AssetLibrary.tsx (NEW - Phase 5A)
│   │   │   │   │   ├── AssetUploadZone.module.css (NEW - Phase 5A)
│   │   │   │   │   ├── AssetUploadZone.tsx (NEW - Phase 5A)
│   │   │   │   │   ├── GridAlignmentModal.module.css
│   │   │   │   │   ├── GridAlignmentModal.tsx
│   │   │   │   │   ├── LayersPanel.module.css (NEW - Phase 5A)
│   │   │   │   │   ├── LayersPanel.test.tsx (MODIFIED - Phase 5F)
│   │   │   │   │   ├── LayersPanel.tsx  (NEW - Phase 5A)
│   │   │   │   │   ├── LightInspector.module.css (NEW - Phase 5G)
│   │   │   │   │   ├── LightInspector.tsx (NEW - Phase 5G)
│   │   │   │   │   ├── LightsSection.module.css (NEW - Phase 5G)
│   │   │   │   │   ├── LightsSection.test.tsx (NEW - Phase 5G)
│   │   │   │   │   ├── LightsSection.tsx (NEW - Phase 5G)
│   │   │   │   │   ├── SaveStatusIndicator.module.css (NEW - Phase 5H)
│   │   │   │   │   ├── SaveStatusIndicator.tsx (NEW - Phase 5H)
│   │   │   │   │   ├── SceneStrip.module.css (NEW - Phase 5H)
│   │   │   │   │   ├── SceneStrip.test.tsx (NEW - Phase 5H)
│   │   │   │   │   ├── SceneStrip.tsx   (NEW - Phase 5H)
│   │   │   │   │   ├── SmartSizingPrompt.module.css
│   │   │   │   │   ├── SmartSizingPrompt.tsx
│   │   │   │   │   ├── TileContextMenu.module.css
│   │   │   │   │   ├── TileContextMenu.tsx
│   │   │   │   │   ├── TileInspector.module.css
│   │   │   │   │   ├── TileInspector.test.tsx
│   │   │   │   │   ├── TileInspector.tsx
│   │   │   │   │   ├── WallInspector.module.css (NEW - Phase 5F)
│   │   │   │   │   ├── WallInspector.tsx (NEW - Phase 5F)
│   │   │   │   │   ├── WallsSection.module.css (NEW - Phase 5F)
│   │   │   │   │   ├── WallsSection.test.tsx (NEW - Phase 5F)
│   │   │   │   │   ├── WallsSection.tsx (NEW - Phase 5F)
│   │   │   │   │   ├── WallToolOverlay.module.css (NEW - Phase 5F)
│   │   │   │   │   ├── WallToolOverlay.test.tsx (NEW - Phase 5F)
│   │   │   │   │   └── WallToolOverlay.tsx (NEW - Phase 5F)
│   │   │   │   ├── hooks/               (NEW - Phase 5A)
│   │   │   │   │   ├── useEditors.ts    (NEW - Phase 5A)
│   │   │   │   │   ├── useLightEditor.test.ts (NEW - Phase 5G)
│   │   │   │   │   ├── useLightEditor.ts (NEW - Phase 5G)
│   │   │   │   │   ├── useLightSources.test.ts (NEW - Phase 5G)
│   │   │   │   │   ├── useLightSources.ts (NEW - Phase 5G)
│   │   │   │   │   ├── useSaveStatus.ts (NEW - Phase 5H)
│   │   │   │   │   ├── useSceneAtmosphere.test.ts (NEW - Phase 5G)
│   │   │   │   │   ├── useSceneAtmosphere.ts (NEW - Phase 5G)
│   │   │   │   │   ├── useScenes.test.ts (NEW - Phase 5H)
│   │   │   │   │   ├── useScenes.ts     (NEW - Phase 5H)
│   │   │   │   │   ├── useSceneThumbnail.test.ts (NEW - Phase 5H)
│   │   │   │   │   ├── useSceneThumbnail.ts (NEW - Phase 5H)
│   │   │   │   │   ├── useTileAssets.ts (NEW - Phase 5A)
│   │   │   │   │   ├── useTileDragDrop.test.ts
│   │   │   │   │   ├── useTileDragDrop.ts
│   │   │   │   │   ├── useTilePlacements.test.ts (MODIFIED - Phase 5H)
│   │   │   │   │   ├── useTilePlacements.ts (MODIFIED - Phase 5H)
│   │   │   │   │   ├── useUndoableCrud.test.ts
│   │   │   │   │   ├── useUndoableCrud.ts
│   │   │   │   │   ├── useUndoRedo.test.ts
│   │   │   │   │   ├── useUndoRedo.ts
│   │   │   │   │   ├── useWallEditor.ts (NEW - Phase 5F)
│   │   │   │   │   ├── useWallSegments.test.ts (NEW - Phase 5F)
│   │   │   │   │   └── useWallSegments.ts (NEW - Phase 5F)
│   │   │   │   ├── utils/
│   │   │   │   │   ├── grid-alignment.test.ts
│   │   │   │   │   ├── grid-alignment.ts
│   │   │   │   │   ├── light-placement.test.ts (NEW - Phase 5G)
│   │   │   │   │   ├── light-placement.ts (NEW - Phase 5G)
│   │   │   │   │   ├── resolve-display-scene.test.ts (NEW - Phase 5H)
│   │   │   │   │   ├── resolve-display-scene.ts (NEW - Phase 5H)
│   │   │   │   │   ├── save-tracker.test.ts (NEW - Phase 5H)
│   │   │   │   │   ├── save-tracker.ts  (NEW - Phase 5H)
│   │   │   │   │   ├── wall-geometry.test.ts (NEW - Phase 5F)
│   │   │   │   │   └── wall-geometry.ts (NEW - Phase 5F)
│   │   │   │   ├── EditorModeContext.test.tsx (NEW - Phase 5A)
│   │   │   │   └── EditorModeContext.tsx (NEW - Phase 5A)
│   │   │   ├── inventory/               (NEW - Phase 10)
│   │   │   │   ├── __tests__/           (NEW - Phase 10)
│   │   │   │   │   └── .gitkeep         (NEW - Phase 10)
│   │   │   │   ├── components/          (NEW - Phase 10)
│   │   │   │   │   └── index.ts         (NEW - Phase 10)
│   │   │   │   ├── hooks/               (NEW - Phase 10)
│   │   │   │   │   └── .gitkeep         (NEW - Phase 10)
│   │   │   │   ├── utils/               (NEW - Phase 10)
│   │   │   │   │   └── .gitkeep         (NEW - Phase 10)
│   │   │   │   └── types.ts             (NEW - Phase 10)
│   │   │   ├── play-area/
│   │   │   │   ├── canvas/
│   │   │   │   │   ├── doors/           (NEW - Phase PM3)
│   │   │   │   │   │   ├── DoorLayer.test.ts (NEW - Phase PM3)
│   │   │   │   │   │   └── DoorLayer.ts (NEW - Phase PM3)
│   │   │   │   │   ├── fog/             (NEW - Phase PM2)
│   │   │   │   │   │   ├── fog-mask-math.test.ts (NEW - Phase PM2)
│   │   │   │   │   │   ├── fog-mask-math.ts (NEW - Phase PM2)
│   │   │   │   │   │   ├── FogMaskService.test.ts (NEW - Phase PM2)
│   │   │   │   │   │   └── FogMaskService.ts (NEW - Phase PM2)
│   │   │   │   │   ├── lights/          (NEW - Phase PM4)
│   │   │   │   │   │   ├── light-animation.test.ts (NEW - Phase PM4)
│   │   │   │   │   │   ├── light-animation.ts (NEW - Phase PM4)
│   │   │   │   │   │   ├── LightLayer.test.ts (NEW - Phase PM4)
│   │   │   │   │   │   └── LightLayer.ts (NEW - Phase PM4)
│   │   │   │   │   ├── BackgroundLayer.ts (NEW - Phase 4A)
│   │   │   │   │   ├── CanvasManager.test.ts (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1)
│   │   │   │   │   ├── CanvasManager.ts (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1, Phase 4F.5)
│   │   │   │   │   ├── ForegroundLayer.pm2.test.ts (NEW - Phase PM2)
│   │   │   │   │   ├── ForegroundLayer.test.ts (MODIFIED - Phase PM3)
│   │   │   │   │   ├── ForegroundLayer.ts (NEW - Phase 4A)
│   │   │   │   │   ├── grid-utils.test.ts (NEW - Phase 4B)
│   │   │   │   │   ├── grid-utils.ts    (NEW - Phase 4B)
│   │   │   │   │   ├── map-clip.ts
│   │   │   │   │   ├── PlaygroundLayer.ts (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1, Phase 4C)
│   │   │   │   │   ├── selection-utils.test.ts
│   │   │   │   │   ├── selection-utils.ts
│   │   │   │   │   ├── TilePlacementSprite.test.ts
│   │   │   │   │   ├── TilePlacementSprite.ts
│   │   │   │   │   ├── TokenSprite.test.ts (NEW - Phase 4B, MODIFIED - Phase 4B.1, Phase 4G)
│   │   │   │   │   ├── TokenSprite.ts   (NEW - Phase 4B, MODIFIED - Phase 4B.1, Phase 4C)
│   │   │   │   │   ├── viewport-culling.test.ts (NEW - Phase 4A)
│   │   │   │   │   └── viewport-culling.ts (NEW - Phase 4A)
│   │   │   │   ├── components/
│   │   │   │   │   ├── CampaignToolbar.module.css
│   │   │   │   │   ├── CampaignToolbar.tsx
│   │   │   │   │   ├── CanvasToolbar.module.css (MODIFIED - Phase 4F.5)
│   │   │   │   │   ├── CanvasToolbar.test.tsx (MODIFIED - Phase 4F.5)
│   │   │   │   │   ├── CanvasToolbar.tsx (MODIFIED - Phase 4F.5)
│   │   │   │   │   ├── ChatPanel.module.css (MODIFIED - Phase 4A, Phase 4D, Phase 4E)
│   │   │   │   │   ├── ChatPanel.test.tsx (MODIFIED - Phase 4D, Phase 4E)
│   │   │   │   │   ├── ChatPanel.tsx    (MODIFIED - Phase 4A, Phase 4D, Phase 4E)
│   │   │   │   │   ├── DoorPopover.module.css
│   │   │   │   │   ├── DoorPopover.test.tsx
│   │   │   │   │   ├── DoorPopover.tsx
│   │   │   │   │   ├── FogSettingsPanel.module.css (NEW - Phase PM2)
│   │   │   │   │   ├── FogSettingsPanel.tsx (NEW - Phase PM2)
│   │   │   │   │   ├── TemporaryLightsPanel.module.css (NEW - Phase PM4)
│   │   │   │   │   ├── TemporaryLightsPanel.test.tsx (NEW - Phase PM4)
│   │   │   │   │   ├── TemporaryLightsPanel.tsx (NEW - Phase PM4)
│   │   │   │   │   ├── TokenHoverCard.module.css (MODIFIED - Phase 4B, Phase 4E)
│   │   │   │   │   ├── TokenHoverCard.test.tsx (NEW - Phase 4B, MODIFIED - Phase 4G)
│   │   │   │   │   ├── TokenHoverCard.tsx (MODIFIED - Phase 4B, Phase 4E, Phase 4G)
│   │   │   │   │   ├── TurnTracker.module.css
│   │   │   │   │   ├── TurnTracker.test.tsx (MODIFIED - Phase 4I)
│   │   │   │   │   └── TurnTracker.tsx
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useActiveScene.ts (NEW - Phase 4B)
│   │   │   │   │   ├── useCampaignRole.ts (NEW - Phase 4B)
│   │   │   │   │   ├── useCanvas.ts     (NEW - Phase 4A)
│   │   │   │   │   ├── useChatMessages.ts (NEW - Phase 4D)
│   │   │   │   │   ├── useDrawTool.test.ts
│   │   │   │   │   ├── useDrawTool.ts
│   │   │   │   │   ├── useFogConfig.test.ts (NEW - Phase PM2)
│   │   │   │   │   ├── useFogConfig.ts  (NEW - Phase PM2)
│   │   │   │   │   ├── useFogExploration.test.ts (NEW - Phase PM2)
│   │   │   │   │   ├── useFogExploration.ts (NEW - Phase PM2)
│   │   │   │   │   ├── useFogRegions.test.ts
│   │   │   │   │   ├── useFogRegions.ts
│   │   │   │   │   ├── useFogViewMode.test.ts
│   │   │   │   │   ├── useFogViewMode.ts
│   │   │   │   │   ├── useLineOfSight.test.ts (NEW - Phase PM3)
│   │   │   │   │   ├── useLineOfSight.ts (NEW - Phase PM3)
│   │   │   │   │   ├── useMeasureTool.test.ts
│   │   │   │   │   ├── useMeasureTool.ts
│   │   │   │   │   ├── useNpcDrop.test.ts (NEW - Phase 4F.5)
│   │   │   │   │   ├── useNpcDrop.ts    (NEW - Phase 4F.5)
│   │   │   │   │   ├── usePlayAreaLighting.test.ts (NEW - Phase PM4)
│   │   │   │   │   ├── usePlayAreaLighting.ts (NEW - Phase PM4)
│   │   │   │   │   ├── usePlayAreas.ts
│   │   │   │   │   ├── usePlayAreaSocket.test.ts (MODIFIED - Phase 4C, Phase 4D)
│   │   │   │   │   ├── usePlayAreaSocket.ts (MODIFIED - Phase 4C, Phase 4D, Phase 4E)
│   │   │   │   │   ├── useTemporaryLightDrop.ts (NEW - Phase PM4)
│   │   │   │   │   ├── useTokens.ts     (MODIFIED - Phase 4B, Phase 4C)
│   │   │   │   │   ├── useToolMode.test.ts
│   │   │   │   │   ├── useToolMode.ts
│   │   │   │   │   ├── vision-filter.test.ts
│   │   │   │   │   └── vision-filter.ts
│   │   │   │   ├── PlayArea.module.css  (NEW - Phase 4A)
│   │   │   │   └── PlayArea.tsx         (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1, Phase 4C, Phase 4D, Phase 4E, Phase 4F.5, Phase 9F)
│   │   │   ├── portal/
│   │   │   │   ├── Account.tsx          (NEW - Phase 2A)
│   │   │   │   ├── CampaignsPlaceholder.tsx (NEW - Phase 2A)
│   │   │   │   ├── CharactersPlaceholder.tsx (NEW - Phase 2A)
│   │   │   │   ├── Placeholder.module.css (NEW - Phase 2A)
│   │   │   │   ├── PortalLayout.module.css (NEW - Phase 2A)
│   │   │   │   ├── PortalLayout.test.tsx (NEW - Phase 2A, MODIFIED - Phase 4G)
│   │   │   │   ├── PortalLayout.tsx     (NEW - Phase 2A)
│   │   │   │   ├── Welcome.module.css   (NEW - Phase 2A)
│   │   │   │   ├── Welcome.test.tsx     (NEW - Phase 2A)
│   │   │   │   └── Welcome.tsx          (NEW - Phase 2A)
│   │   │   └── story/                   (NEW - Phase 7)
│   │   │       ├── components/          (NEW - Phase 7)
│   │   │       │   └── index.ts         (NEW - Phase 7)
│   │   │       ├── hooks/               (NEW - Phase 7)
│   │   │       │   └── .gitkeep         (NEW - Phase 7)
│   │   │       ├── utils/               (NEW - Phase 7)
│   │   │       │   └── .gitkeep         (NEW - Phase 7)
│   │   │       └── types.ts             (NEW - Phase 7)
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── ErrorBoundary.module.css (NEW - Phase 1A)
│   │   │   │   ├── ErrorBoundary.test.tsx (NEW - Phase 1A)
│   │   │   │   └── ErrorBoundary.tsx    (NEW - Phase 1A)
│   │   │   ├── context/
│   │   │   │   └── CampaignContext.tsx  (NEW - Phase 3C)
│   │   │   ├── hooks/
│   │   │   │   └── .gitkeep
│   │   │   ├── styles/
│   │   │   │   ├── global.css
│   │   │   │   └── variables.css
│   │   │   └── utils/
│   │   │       └── gsap-config.ts
│   │   ├── App.module.css
│   │   ├── App.tsx                      (MODIFIED - Phase 1A, Phase 2A, Phase 3A, Phase 4A, Phase 6A)
│   │   ├── main.tsx                     (MODIFIED - Phase 1A)
│   │   ├── test-setup.ts                (MODIFIED - Phase 1A, Phase 4D)
│   │   └── vite-env.d.ts
│   ├── index.html
│   ├── package.json                     (MODIFIED - Phase 1A, Phase 4A, Phase 4C, Phase 9F)
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts                   (MODIFIED - Phase 4H)
│   └── vitest.config.ts                 (MODIFIED - Phase 1A)
├── handoff/                             (NEW - Phase 5F)
│   └── vtt-snapshot-2026-10-07-00-07.zip (NEW - Phase 6C)
├── memories/                            (NEW - Phase 5A)
│   └── session/                         (NEW - Phase 5A)
│       ├── campaigns-3C-retro.md        (NEW - Phase 3C)
│       ├── characters-6B-retro.md       (NEW - Phase 6B)
│       ├── characters-6C-retro.md       (NEW - Phase 6C)
│       ├── characters-6D-retro.md       (NEW - Phase 6D)
│       ├── dice-9F-retro.md             (NEW - Phase 9F)
│       ├── editor-5A-retro.md           (NEW - Phase 5A)
│       ├── editor-5B-retro.md
│       ├── editor-5F-retro.md           (NEW - Phase 5F)
│       ├── editor-5G-retro.md           (NEW - Phase 5G)
│       ├── editor-5H-retro.md           (NEW - Phase 5H)
│       ├── play-area-PM3-retro.md       (NEW - Phase PM3)
│       └── play-area-PM4-retro.md       (NEW - Phase PM4)
├── scripts/
│   ├── archive-feature-docs.mjs
│   ├── docs-check.mjs
│   ├── filter-test-results.mjs
│   ├── package-apply.mjs                (NEW - Phase 5F)
│   ├── package-patch.mjs                (NEW - Phase PM1)
│   ├── patch-apply.mjs                  (NEW - Phase 5F)
│   ├── phase-context.mjs
│   ├── phase-scaffold.mjs
│   ├── phase-workflow.mjs               (MODIFIED - Phase 4H)
│   ├── ports.mjs
│   ├── project-graph.mjs                (MODIFIED - Phase 9)
│   ├── project-status.mjs
│   ├── run-compact-tests.mjs            (NEW - Phase 4H)
│   ├── scaffold-completion.mjs
│   ├── slug-context.mjs
│   ├── sync-architect.mjs
│   └── sync-tree.mjs
├── server/                              (NEW - Phase 0)
│   ├── prisma/
│   │   ├── migrations/
│   │   │   ├── 20260528011955_add_user_and_session_models/ (NEW - Phase 1A)
│   │   │   │   └── migration.sql        (NEW - Phase 1A)
│   │   │   ├── 20260529190754_add_campaign_models/ (NEW - Phase 3A)
│   │   │   │   └── migration.sql        (NEW - Phase 3A)
│   │   │   ├── 20260531023620_add_scene_and_token_models/ (NEW - Phase 4B)
│   │   │   │   └── migration.sql        (NEW - Phase 4B)
│   │   │   ├── 20260531233253_add_campaign_message_model/ (NEW - Phase 4D)
│   │   │   │   └── migration.sql        (NEW - Phase 4D)
│   │   │   ├── 20260601013628_add_fog_region_model/
│   │   │   │   └── migration.sql
│   │   │   ├── 20260605222500_add_character_model/ (NEW - Phase 6A)
│   │   │   │   └── migration.sql        (NEW - Phase 6A)
│   │   │   ├── 20260606170326_add_token_vision_radius/
│   │   │   │   └── migration.sql
│   │   │   ├── 20260607234211_add_npc_subtype_to_token/
│   │   │   │   └── migration.sql
│   │   │   ├── 20260611012535_add_tile_asset_model/ (NEW - Phase 5A)
│   │   │   │   └── migration.sql        (NEW - Phase 5A)
│   │   │   ├── 20260612183809_add_asset_source_and_nullable_campaign/
│   │   │   │   └── migration.sql
│   │   │   ├── 20260612221214_add_tile_placement_model/
│   │   │   │   └── migration.sql
│   │   │   ├── 20260831213724_add_player_color/
│   │   │   │   └── migration.sql
│   │   │   ├── 20260901000000_add_token_aura_fields/ (NEW - Phase 4I)
│   │   │   │   └── migration.sql        (NEW - Phase 4I)
│   │   │   ├── 20260904042202_add_fog_mask_config_and_exploration/ (NEW - Phase PM2)
│   │   │   │   └── migration.sql        (NEW - Phase PM2)
│   │   │   ├── 20260929145923_add_wall_segment_model/ (NEW - Phase 5F)
│   │   │   │   └── migration.sql        (NEW - Phase 5F)
│   │   │   ├── 20260929172522_add_light_source_model/ (NEW - Phase 5G)
│   │   │   │   └── migration.sql        (NEW - Phase 5G)
│   │   │   ├── 20260930002128_add_light_always_visible/
│   │   │   │   └── migration.sql
│   │   │   ├── 20261005225759_add_game_system_to_campaign/ (NEW - Phase 3C)
│   │   │   │   └── migration.sql        (NEW - Phase 3C)
│   │   │   ├── 20261006193044_add_character_token_model/ (NEW - Phase 6B)
│   │   │   │   └── migration.sql        (NEW - Phase 6B)
│   │   │   ├── 20261006203004_character_templates_nullable_campaign/ (NEW - Phase 6B)
│   │   │   │   └── migration.sql        (NEW - Phase 6B)
│   │   │   ├── 20261007191112_add_character_skills_and_attacks/ (NEW - Phase 6C)
│   │   │   │   └── migration.sql        (NEW - Phase 6C)
│   │   │   ├── 20261008201928_add_character_spells_and_slots/ (NEW - Phase 6D)
│   │   │   │   └── migration.sql        (NEW - Phase 6D)
│   │   │   ├── 20261009163210_add_scene_library_fields/ (NEW - Phase 5H)
│   │   │   │   └── migration.sql        (NEW - Phase 5H)
│   │   │   └── migration_lock.toml      (NEW - Phase 1A)
│   │   ├── reset-canvas.ts
│   │   ├── schema.prisma                (MODIFIED - Phase 1A, Phase 3A, Phase 4B, Phase 4D, Phase 6A)
│   │   └── seed.ts                      (MODIFIED - Phase 1A, Phase 3A, Phase 4B, Phase 4G, Phase 6A)
│   ├── src/
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   │   ├── auth.middleware.ts   (NEW - Phase 1A)
│   │   │   │   ├── auth.routes.test.ts  (NEW - Phase 1A)
│   │   │   │   ├── auth.routes.ts       (NEW - Phase 1A)
│   │   │   │   ├── auth.service.ts      (NEW - Phase 1A)
│   │   │   │   ├── dev.routes.test.ts   (NEW - Phase 1A)
│   │   │   │   └── dev.routes.ts        (NEW - Phase 1A)
│   │   │   ├── bestiary/                (NEW - Phase 8)
│   │   │   │   ├── bestiary.routes.ts   (NEW - Phase 8)
│   │   │   │   ├── bestiary.service.ts  (NEW - Phase 8)
│   │   │   │   └── bestiary.types.ts    (NEW - Phase 8)
│   │   │   ├── campaigns/
│   │   │   │   ├── campaigns.middleware.ts (NEW - Phase 3A)
│   │   │   │   ├── campaigns.routes.test.ts (MODIFIED - Phase 3A, Phase 4C, Phase 4G)
│   │   │   │   ├── campaigns.routes.ts  (NEW - Phase 3A, MODIFIED - Phase 4G)
│   │   │   │   └── campaigns.service.ts (NEW - Phase 3A, MODIFIED - Phase 4G)
│   │   │   ├── characters/
│   │   │   │   ├── character-tokens.routes.test.ts (NEW - Phase 6B)
│   │   │   │   ├── character-tokens.routes.ts (NEW - Phase 6B)
│   │   │   │   ├── character-tokens.service.ts (NEW - Phase 6B)
│   │   │   │   ├── characters.routes.test.ts (NEW - Phase 6A)
│   │   │   │   ├── characters.routes.ts (NEW - Phase 6A)
│   │   │   │   └── characters.service.ts (NEW - Phase 6A)
│   │   │   ├── dice/                    (NEW - Phase 9)
│   │   │   │   ├── dice.routes.ts       (NEW - Phase 9)
│   │   │   │   ├── dice.service.test.ts (NEW - Phase 9F)
│   │   │   │   ├── dice.service.ts      (NEW - Phase 9F)
│   │   │   │   ├── dice.socket.test.ts  (NEW - Phase 9F)
│   │   │   │   ├── dice.socket.ts       (NEW - Phase 9F)
│   │   │   │   └── dice.types.ts        (NEW - Phase 9)
│   │   │   ├── editor/
│   │   │   │   ├── editor.routes.test.ts (NEW - Phase 5A)
│   │   │   │   ├── editor.routes.ts     (NEW - Phase 5A)
│   │   │   │   ├── editor.service.ts    (NEW - Phase 5A)
│   │   │   │   ├── lights.routes.test.ts (NEW - Phase 5G)
│   │   │   │   ├── lights.routes.ts     (NEW - Phase 5G)
│   │   │   │   ├── lights.service.ts    (NEW - Phase 5G)
│   │   │   │   ├── scenes.routes.test.ts (NEW - Phase 5H)
│   │   │   │   ├── scenes.routes.ts     (NEW - Phase 5H)
│   │   │   │   ├── scenes.service.ts    (NEW - Phase 5H)
│   │   │   │   ├── walls.routes.test.ts (NEW - Phase 5F)
│   │   │   │   ├── walls.routes.ts      (NEW - Phase 5F)
│   │   │   │   └── walls.service.ts     (NEW - Phase 5F)
│   │   │   ├── inventory/               (NEW - Phase 10)
│   │   │   │   ├── __tests__/           (NEW - Phase 10)
│   │   │   │   │   └── .gitkeep         (NEW - Phase 10)
│   │   │   │   ├── inventory.routes.ts  (NEW - Phase 10)
│   │   │   │   ├── inventory.service.ts (NEW - Phase 10)
│   │   │   │   └── inventory.types.ts   (NEW - Phase 10)
│   │   │   ├── play-area/
│   │   │   │   ├── doors.service.ts     (NEW - Phase PM3)
│   │   │   │   ├── fog-config.routes.test.ts (NEW - Phase PM2)
│   │   │   │   ├── fog-config.service.test.ts (NEW - Phase PM2)
│   │   │   │   ├── fog-config.service.ts (NEW - Phase PM2)
│   │   │   │   ├── fog-exploration.service.test.ts (NEW - Phase PM2)
│   │   │   │   ├── fog-exploration.service.ts (NEW - Phase PM2)
│   │   │   │   ├── fog-exploration.sync.test.ts (NEW - Phase PM2)
│   │   │   │   ├── fog.routes.test.ts
│   │   │   │   ├── fog.routes.ts        (MODIFIED - Phase PM2)
│   │   │   │   ├── fog.service.ts
│   │   │   │   ├── initiative.service.test.ts
│   │   │   │   ├── initiative.service.ts
│   │   │   │   ├── lighting.routes.ts   (NEW - Phase PM4)
│   │   │   │   ├── lighting.service.ts  (NEW - Phase PM4)
│   │   │   │   ├── lighting.test.ts     (NEW - Phase PM4)
│   │   │   │   ├── lights.socket.ts     (NEW - Phase PM4)
│   │   │   │   ├── line-of-sight.test.ts (NEW - Phase PM3)
│   │   │   │   ├── line-of-sight.ts     (NEW - Phase PM3)
│   │   │   │   ├── messages.routes.test.ts (NEW - Phase 4D)
│   │   │   │   ├── messages.routes.ts   (NEW - Phase 4D)
│   │   │   │   ├── play-area.routes.test.ts (MODIFIED - Phase 4I)
│   │   │   │   ├── play-area.routes.ts
│   │   │   │   ├── play-area.service.ts
│   │   │   │   ├── play-area.socket.test.ts (MODIFIED - Phase 4C, Phase 4D)
│   │   │   │   ├── play-area.socket.ts  (MODIFIED - Phase 4C, Phase 4D, Phase 4E, Phase 9F)
│   │   │   │   ├── room-regions.test.ts
│   │   │   │   ├── room-regions.ts
│   │   │   │   ├── temporary-lights.store.test.ts (NEW - Phase PM4)
│   │   │   │   ├── temporary-lights.store.ts (NEW - Phase PM4)
│   │   │   │   ├── tokens.routes.test.ts (MODIFIED - Phase 4B, Phase 4C, Phase 4G)
│   │   │   │   ├── tokens.routes.ts     (MODIFIED - Phase 4B, Phase 4C, Phase 4G)
│   │   │   │   ├── tokens.service.ts    (NEW - Phase 4B, MODIFIED - Phase 4G)
│   │   │   │   ├── vision.scheduler.test.ts (NEW - Phase PM3)
│   │   │   │   ├── vision.scheduler.ts  (NEW - Phase PM3)
│   │   │   │   ├── vision.service.test.ts (MODIFIED - Phase PM3)
│   │   │   │   ├── vision.service.ts    (MODIFIED - Phase 4F.1)
│   │   │   │   ├── vision.socket.test.ts (NEW - Phase PM3)
│   │   │   │   └── vision.socket.ts     (NEW - Phase PM3)
│   │   │   └── story/                   (NEW - Phase 7)
│   │   │       ├── story.routes.ts      (NEW - Phase 7)
│   │   │       ├── story.service.ts     (NEW - Phase 7)
│   │   │       └── story.types.ts       (NEW - Phase 7)
│   │   ├── shared/
│   │   │   ├── db/
│   │   │   │   └── prisma.ts
│   │   │   ├── middleware/
│   │   │   │   ├── error-handler.ts
│   │   │   │   └── session.ts           (NEW - Phase 1A)
│   │   │   ├── socket/
│   │   │   │   ├── index.ts             (NEW - Phase 4C, MODIFIED - Phase 9F)
│   │   │   │   └── io-instance.ts       (NEW - Phase 4C)
│   │   │   ├── sync/                    (NEW - Phase 6B)
│   │   │   │   └── character-token-sync.ts (NEW - Phase 6B)
│   │   │   ├── test-utils/              (NEW - Phase 6B)
│   │   │   │   └── login.ts             (NEW - Phase 6B)
│   │   │   ├── types/
│   │   │   │   ├── express.d.ts         (NEW - Phase 3A)
│   │   │   │   ├── session.d.ts         (NEW - Phase 1A)
│   │   │   │   └── sharp.d.ts           (NEW - Phase 5A)
│   │   │   └── utils/
│   │   │       ├── async-handler.ts
│   │   │       ├── env.ts
│   │   │       └── password.ts          (NEW - Phase 1A)
│   │   ├── app.ts                       (MODIFIED - Phase 1A, Phase 3A, Phase 4B, Phase 4C, Phase 4D, Phase 6A)
│   │   └── test-setup.ts                (NEW - Phase 4C)
│   ├── uploads/                         (NEW - Phase 5A)
│   │   ├── thumbnails/                  (NEW - Phase 5A)
│   │   │   ├── scene-thumb_05a3f670-6695-4118-b478-060b67f8fc63_1791565164892.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_09acfb4f-92cd-4ab9-9c5a-e102ee766ba2_1791566173809.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_125fe4ca-93b1-4231-8f8e-3dd29f9008fd_1791563804183.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_14622cce-4eca-43a0-91e4-49db0c3213cf_1791565000083.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_2d442594-99ca-468e-913f-6c774dbbaf2d_1791565063912.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_35aad9cc-0afb-4172-882c-36299d14d55b_1791565000349.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_4da8927d-899f-4008-9a41-43dcad9f6900_1791565063651.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_5d6d69ab-4b9b-4591-9448-0f5c1ad3acab_1791565079094.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_623fbbc5-5193-4015-89f0-a056c29771f9_1791569081449.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_6aa9ff03-ac17-4a94-a261-143b560d7cc9_1791565079344.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_738f0ced-8379-49a5-bdfe-d13840a50855_1791573663886.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_880d049e-0c55-445a-a4a8-3480235b2a1a_1791565071463.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_a37544fc-dc35-4900-a708-9ddce93eb2a6_1791566174083.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_bb398f04-e504-4427-a18d-a12c66d7171b_1791565164618.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_c1deeea2-edb3-4913-b07a-c8b46399bdbc_1791563803952.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_d97944c0-3969-4b8a-846a-bb751fbf386b_1791573663562.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_e0d3c8ee-c2fe-4184-a4aa-d1d9dde12b2b_1791565071184.webp (NEW - Phase 5H)
│   │   │   ├── scene-thumb_ee6a95e5-a2ab-4cc6-98f5-6a5e024b27a9_1791564975809.webp (NEW - Phase 5H)
│   │   │   └── scene-thumb_fccfbbf5-44ed-4739-9971-3009a46c30f7_1791564975517.webp (NEW - Phase 5H)
│   │   └── assets                       (NEW - Phase 5A)
│   ├── .env
│   ├── .env.example
│   ├── package.json                     (MODIFIED - Phase 1A, Phase 4C)
│   ├── tsconfig.json                    (MODIFIED - Phase 5A)
│   └── vitest.config.ts                 (MODIFIED - Phase 3B, Phase 4C)
├── shared/                              (NEW - Phase 0)
│   ├── src/
│   │   ├── constants/
│   │   │   ├── auth.ts                  (NEW - Phase 1A)
│   │   │   ├── bestiary.ts              (NEW - Phase 8)
│   │   │   ├── campaigns.ts             (NEW - Phase 3A)
│   │   │   ├── characters.test.ts       (NEW - Phase 6A)
│   │   │   ├── characters.ts            (NEW - Phase 6A)
│   │   │   ├── dice.ts                  (NEW - Phase 9, MODIFIED - Phase 9F)
│   │   │   ├── editor.ts                (NEW - Phase 5A)
│   │   │   ├── game-systems.test.ts     (NEW - Phase 3C)
│   │   │   ├── game-systems.ts          (NEW - Phase 3C)
│   │   │   ├── index.ts                 (MODIFIED - Phase 1A, Phase 3A, Phase 4A, Phase 6A, Phase 7, Phase 8, Phase 9, Phase 10)
│   │   │   ├── inventory.ts             (NEW - Phase 10)
│   │   │   ├── play-area.ts             (MODIFIED - Phase 4A, Phase 4B, Phase 4C, Phase 4D, Phase 4E, Phase 9F)
│   │   │   └── story.ts                 (NEW - Phase 7)
│   │   ├── types/
│   │   │   ├── auth.ts                  (NEW - Phase 1A)
│   │   │   ├── bestiary.ts              (NEW - Phase 8)
│   │   │   ├── campaigns.ts             (MODIFIED - Phase 3A, Phase 3B)
│   │   │   ├── characters.ts            (NEW - Phase 6A)
│   │   │   ├── dice.ts                  (NEW - Phase 9, MODIFIED - Phase 9F)
│   │   │   ├── editor.ts                (NEW - Phase 5A)
│   │   │   ├── index.ts                 (MODIFIED - Phase 1A, Phase 3A, Phase 4A, Phase 6A, Phase 7, Phase 8, Phase 9, Phase 10)
│   │   │   ├── inventory.ts             (NEW - Phase 10)
│   │   │   ├── play-area.ts             (MODIFIED - Phase 4A, Phase 4B, Phase 4C, Phase 4D, Phase 4E, Phase 9F)
│   │   │   └── story.ts                 (NEW - Phase 7)
│   │   ├── validators/
│   │   │   ├── auth.ts                  (NEW - Phase 1A)
│   │   │   ├── bestiary.ts              (NEW - Phase 8)
│   │   │   ├── campaigns.test.ts        (NEW - Phase 3C)
│   │   │   ├── campaigns.ts             (MODIFIED - Phase 3A, Phase 3B)
│   │   │   ├── characters.ts            (NEW - Phase 6A)
│   │   │   ├── dice.ts                  (NEW - Phase 9, MODIFIED - Phase 9F)
│   │   │   ├── editor.test.ts           (NEW - Phase 5A)
│   │   │   ├── editor.ts                (NEW - Phase 5A)
│   │   │   ├── index.ts                 (MODIFIED - Phase 1A, Phase 3A, Phase 4B, Phase 6A, Phase 7, Phase 8, Phase 9, Phase 10)
│   │   │   ├── inventory.ts             (NEW - Phase 10)
│   │   │   ├── play-area.test.ts        (MODIFIED - Phase 4H)
│   │   │   ├── play-area.ts             (MODIFIED - Phase 4B, Phase 4C, Phase 4D, Phase 4E, Phase 9F)
│   │   │   └── story.ts                 (NEW - Phase 7)
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   └── vitest.config.ts
├── uploads/                             (NEW - Phase 5F)
│   ├── assets                           (NEW - Phase 5F)
│   └── thumbnails                       (NEW - Phase 5F)
├── .copilotignore
├── .DS_Store                            (NEW - Phase 5F)
├── .gitignore                           (NEW - Phase 0)
├── .prettierrc                          (NEW - Phase 0)
├── eslint.config.js                     (NEW - Phase 0)
├── package.json                         (NEW - Phase 0)
├── README.md
├── vitest.config.ts                     (MODIFIED - Phase 0, Phase 4C)
└── vitest.workspace.ts                  (NEW - Phase 0)
```
