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
│   │   ├── project-manager.agent.md
│   │   └── security.agent.md
│   ├── instructions/
│   │   ├── api-routes.instructions.md
│   │   ├── canvas.instructions.md
│   │   ├── coding-standards.instructions.md
│   │   ├── database.instructions.md
│   │   ├── feature-auth.instructions.md
│   │   ├── feature-campaigns.instructions.md
│   │   ├── feature-characters.instructions.md
│   │   ├── feature-editor.instructions.md
│   │   ├── feature-play-area.instructions.md
│   │   ├── feature-portal.instructions.md (NEW - Phase 2A)
│   │   ├── gsap-animations.instructions.md
│   │   ├── react-components.instructions.md
│   │   └── websocket-events.instructions.md
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
│   ├── .DS_Store
│   └── copilot-instructions.md
├── .project/
│   ├── .archive/
│   │   ├── complete/
│   │   │   ├── auth-1A.md
│   │   │   ├── campaigns-3A.md
│   │   │   ├── campaigns-3B.md
│   │   │   ├── characters-6A.md         (NEW - Phase 6A)
│   │   │   ├── editor-5A.1.md
│   │   │   ├── editor-5A.md             (NEW - Phase 5A)
│   │   │   ├── editor-5B.md
│   │   │   ├── editor-5C.md
│   │   │   ├── editor-5E.md
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
│   │   │   ├── play-area-PM2.md         (NEW - Phase PM2)
│   │   │   ├── portal-2A.md
│   │   │   └── README.md
│   │   └── features/
│   │       ├── auth/
│   │       │   └── phase-1A.md
│   │       ├── campaigns/
│   │       │   ├── phase-3A.md
│   │       │   └── phase-3B.md
│   │       ├── characters/              (NEW - Phase 6A)
│   │       │   └── phase-6A.md          (NEW - Phase 6A)
│   │       ├── editor/                  (NEW - Phase 5A)
│   │       │   ├── phase-5A.1.md
│   │       │   ├── phase-5A.md          (NEW - Phase 5A)
│   │       │   ├── phase-5C.md
│   │       │   └── phase-5E.md
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
│   │       │   └── phase-PM2.md         (NEW - Phase PM2)
│   │       ├── portal/
│   │       │   └── phase-2A.md
│   │       └── README.md
│   ├── features/
│   │   ├── auth.md                      (MODIFIED - Phase 1A)
│   │   ├── campaigns.md                 (MODIFIED - Phase 3A, Phase 3B)
│   │   ├── characters.md
│   │   ├── editor.md
│   │   ├── play-area.md                 (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1, Phase 4C, Phase 4D, Phase 4E)
│   │   └── portal.md                    (MODIFIED - Phase 2A)
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
│   ├── qa
│   └── roadmap.md                       (MODIFIED - Phase 0, Phase 1A, Phase 2A, Phase 3A, Phase 3B, Phase 4A, Phase 4B, Phase 4B.1, Phase 4C, Phase 4D, Phase 4E)
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
│   │   │   ├── campaigns/
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useCampaignActions.ts (NEW - Phase 3A)
│   │   │   │   │   ├── useCampaignDetail.ts (MODIFIED - Phase 3A, Phase 3B)
│   │   │   │   │   ├── useCampaigns.ts  (NEW - Phase 3A)
│   │   │   │   │   └── useMemberActions.ts (NEW - Phase 3B)
│   │   │   │   ├── CampaignDetail.module.css (MODIFIED - Phase 3A, Phase 3B)
│   │   │   │   ├── CampaignDetail.tsx   (MODIFIED - Phase 3A, Phase 3B)
│   │   │   │   ├── CampaignForm.module.css (NEW - Phase 3A)
│   │   │   │   ├── CampaignForm.tsx     (NEW - Phase 3A)
│   │   │   │   ├── CampaignList.module.css (NEW - Phase 3A)
│   │   │   │   └── CampaignList.tsx     (MODIFIED - Phase 3A, Phase 4A)
│   │   │   ├── characters/
│   │   │   │   ├── hooks/
│   │   │   │   │   ├── useCharacterActions.ts (NEW - Phase 6A)
│   │   │   │   │   ├── useCharacterDetail.ts (NEW - Phase 6A)
│   │   │   │   │   └── useCharacters.ts (NEW - Phase 6A)
│   │   │   │   ├── CharacterCreate.module.css (NEW - Phase 6A)
│   │   │   │   ├── CharacterCreate.tsx  (NEW - Phase 6A)
│   │   │   │   ├── CharacterList.module.css (NEW - Phase 6A)
│   │   │   │   ├── CharacterList.tsx    (NEW - Phase 6A)
│   │   │   │   ├── CharacterSheet.module.css (NEW - Phase 6A)
│   │   │   │   ├── CharacterSheet.tsx   (NEW - Phase 6A)
│   │   │   │   └── utils.ts             (NEW - Phase 6A)
│   │   │   ├── editor/
│   │   │   │   ├── components/          (NEW - Phase 5A)
│   │   │   │   │   ├── AssetLibrary.module.css (NEW - Phase 5A)
│   │   │   │   │   ├── AssetLibrary.tsx (NEW - Phase 5A)
│   │   │   │   │   ├── AssetUploadZone.module.css (NEW - Phase 5A)
│   │   │   │   │   ├── AssetUploadZone.tsx (NEW - Phase 5A)
│   │   │   │   │   ├── GridAlignmentModal.module.css
│   │   │   │   │   ├── GridAlignmentModal.tsx
│   │   │   │   │   ├── LayersPanel.module.css (NEW - Phase 5A)
│   │   │   │   │   ├── LayersPanel.test.tsx
│   │   │   │   │   ├── LayersPanel.tsx  (NEW - Phase 5A)
│   │   │   │   │   ├── SmartSizingPrompt.module.css
│   │   │   │   │   ├── SmartSizingPrompt.tsx
│   │   │   │   │   ├── TileContextMenu.module.css
│   │   │   │   │   ├── TileContextMenu.tsx
│   │   │   │   │   ├── TileInspector.module.css
│   │   │   │   │   ├── TileInspector.test.tsx
│   │   │   │   │   └── TileInspector.tsx
│   │   │   │   ├── hooks/               (NEW - Phase 5A)
│   │   │   │   │   ├── useEditors.ts    (NEW - Phase 5A)
│   │   │   │   │   ├── useTileAssets.ts (NEW - Phase 5A)
│   │   │   │   │   ├── useTileDragDrop.test.ts
│   │   │   │   │   ├── useTileDragDrop.ts
│   │   │   │   │   ├── useTilePlacements.test.ts
│   │   │   │   │   ├── useTilePlacements.ts
│   │   │   │   │   ├── useUndoRedo.test.ts
│   │   │   │   │   └── useUndoRedo.ts
│   │   │   │   ├── utils/
│   │   │   │   │   ├── grid-alignment.test.ts
│   │   │   │   │   └── grid-alignment.ts
│   │   │   │   ├── EditorModeContext.test.tsx (NEW - Phase 5A)
│   │   │   │   └── EditorModeContext.tsx (NEW - Phase 5A)
│   │   │   ├── play-area/
│   │   │   │   ├── canvas/
│   │   │   │   │   ├── fog/             (NEW - Phase PM2)
│   │   │   │   │   │   ├── fog-mask-math.test.ts (NEW - Phase PM2)
│   │   │   │   │   │   ├── fog-mask-math.ts (NEW - Phase PM2)
│   │   │   │   │   │   ├── FogMaskService.test.ts (NEW - Phase PM2)
│   │   │   │   │   │   └── FogMaskService.ts (NEW - Phase PM2)
│   │   │   │   │   ├── BackgroundLayer.ts (NEW - Phase 4A)
│   │   │   │   │   ├── CanvasManager.test.ts (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1)
│   │   │   │   │   ├── CanvasManager.ts (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1, Phase 4F.5)
│   │   │   │   │   ├── ForegroundLayer.pm2.test.ts (NEW - Phase PM2)
│   │   │   │   │   ├── ForegroundLayer.test.ts
│   │   │   │   │   ├── ForegroundLayer.ts (NEW - Phase 4A)
│   │   │   │   │   ├── grid-utils.test.ts (NEW - Phase 4B)
│   │   │   │   │   ├── grid-utils.ts    (NEW - Phase 4B)
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
│   │   │   │   │   ├── DiceRollerButton.module.css (MODIFIED - Phase 4A, Phase 4E)
│   │   │   │   │   ├── DiceRollerButton.tsx (MODIFIED - Phase 4A, Phase 4E)
│   │   │   │   │   ├── FogSettingsPanel.module.css (NEW - Phase PM2)
│   │   │   │   │   ├── FogSettingsPanel.tsx (NEW - Phase PM2)
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
│   │   │   │   │   ├── useMeasureTool.test.ts
│   │   │   │   │   ├── useMeasureTool.ts
│   │   │   │   │   ├── useNpcDrop.test.ts (NEW - Phase 4F.5)
│   │   │   │   │   ├── useNpcDrop.ts    (NEW - Phase 4F.5)
│   │   │   │   │   ├── usePlayAreas.ts
│   │   │   │   │   ├── usePlayAreaSocket.test.ts (MODIFIED - Phase 4C, Phase 4D)
│   │   │   │   │   ├── usePlayAreaSocket.ts (MODIFIED - Phase 4C, Phase 4D, Phase 4E)
│   │   │   │   │   ├── useTokens.ts     (MODIFIED - Phase 4B, Phase 4C)
│   │   │   │   │   ├── useToolMode.test.ts
│   │   │   │   │   ├── useToolMode.ts
│   │   │   │   │   ├── vision-filter.test.ts
│   │   │   │   │   └── vision-filter.ts
│   │   │   │   ├── PlayArea.module.css  (NEW - Phase 4A)
│   │   │   │   └── PlayArea.tsx         (MODIFIED - Phase 4A, Phase 4B, Phase 4B.1, Phase 4C, Phase 4D, Phase 4E, Phase 4F.5)
│   │   │   └── portal/
│   │   │       ├── Account.tsx          (NEW - Phase 2A)
│   │   │       ├── CampaignsPlaceholder.tsx (NEW - Phase 2A)
│   │   │       ├── CharactersPlaceholder.tsx (NEW - Phase 2A)
│   │   │       ├── Placeholder.module.css (NEW - Phase 2A)
│   │   │       ├── PortalLayout.module.css (NEW - Phase 2A)
│   │   │       ├── PortalLayout.test.tsx (NEW - Phase 2A, MODIFIED - Phase 4G)
│   │   │       ├── PortalLayout.tsx     (NEW - Phase 2A)
│   │   │       ├── Welcome.module.css   (NEW - Phase 2A)
│   │   │       ├── Welcome.test.tsx     (NEW - Phase 2A)
│   │   │       └── Welcome.tsx          (NEW - Phase 2A)
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── ErrorBoundary.module.css (NEW - Phase 1A)
│   │   │   │   ├── ErrorBoundary.test.tsx (NEW - Phase 1A)
│   │   │   │   └── ErrorBoundary.tsx    (NEW - Phase 1A)
│   │   │   ├── context/
│   │   │   │   └── .gitkeep
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
│   ├── .DS_Store
│   ├── index.html
│   ├── package.json                     (MODIFIED - Phase 1A, Phase 4A, Phase 4C)
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts                   (MODIFIED - Phase 4H)
│   └── vitest.config.ts                 (MODIFIED - Phase 1A)
├── memories/                            (NEW - Phase 5A)
│   └── session/                         (NEW - Phase 5A)
│       ├── editor-5A-retro.md           (NEW - Phase 5A)
│       ├── editor-5B-retro.md
│       ├── editor-5C-retro.md
│       ├── editor-5E-retro.md
│       ├── play-area-4F.3-retro.md
│       ├── play-area-4F.4-retro.md
│       ├── play-area-4F.5-retro.md
│       ├── play-area-4H-retro.md
│       ├── play-area-4I-retro.md        (NEW - Phase 4I)
│       ├── play-area-4J-retro.md
│       ├── play-area-4K-retro.md
│       └── play-area-PM2-retro.md       (NEW - Phase PM2)
├── scripts/
│   ├── archive-feature-docs.mjs
│   ├── docs-check.mjs
│   ├── filter-test-results.mjs
│   ├── phase-context.mjs
│   ├── phase-scaffold.mjs
│   ├── phase-workflow.mjs               (MODIFIED - Phase 4H)
│   ├── ports.mjs
│   ├── project-graph.mjs
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
│   │   │   ├── campaigns/
│   │   │   │   ├── campaigns.middleware.ts (NEW - Phase 3A)
│   │   │   │   ├── campaigns.routes.test.ts (MODIFIED - Phase 3A, Phase 4C, Phase 4G)
│   │   │   │   ├── campaigns.routes.ts  (NEW - Phase 3A, MODIFIED - Phase 4G)
│   │   │   │   └── campaigns.service.ts (NEW - Phase 3A, MODIFIED - Phase 4G)
│   │   │   ├── characters/
│   │   │   │   ├── characters.routes.test.ts (NEW - Phase 6A)
│   │   │   │   ├── characters.routes.ts (NEW - Phase 6A)
│   │   │   │   └── characters.service.ts (NEW - Phase 6A)
│   │   │   ├── editor/
│   │   │   │   ├── editor.routes.test.ts (NEW - Phase 5A)
│   │   │   │   ├── editor.routes.ts     (NEW - Phase 5A)
│   │   │   │   └── editor.service.ts    (NEW - Phase 5A)
│   │   │   └── play-area/
│   │   │       ├── dice.service.test.ts (NEW - Phase 4E)
│   │   │       ├── dice.service.ts      (NEW - Phase 4E)
│   │   │       ├── fog-config.routes.test.ts (NEW - Phase PM2)
│   │   │       ├── fog-config.service.test.ts (NEW - Phase PM2)
│   │   │       ├── fog-config.service.ts (NEW - Phase PM2)
│   │   │       ├── fog-exploration.service.test.ts (NEW - Phase PM2)
│   │   │       ├── fog-exploration.service.ts (NEW - Phase PM2)
│   │   │       ├── fog-exploration.sync.test.ts (NEW - Phase PM2)
│   │   │       ├── fog.routes.test.ts
│   │   │       ├── fog.routes.ts        (MODIFIED - Phase PM2)
│   │   │       ├── fog.service.ts
│   │   │       ├── initiative.service.test.ts
│   │   │       ├── initiative.service.ts
│   │   │       ├── messages.routes.test.ts (NEW - Phase 4D)
│   │   │       ├── messages.routes.ts   (NEW - Phase 4D)
│   │   │       ├── play-area.routes.test.ts (MODIFIED - Phase 4I)
│   │   │       ├── play-area.routes.ts
│   │   │       ├── play-area.service.ts
│   │   │       ├── play-area.socket.test.ts (MODIFIED - Phase 4C, Phase 4D)
│   │   │       ├── play-area.socket.ts  (MODIFIED - Phase 4C, Phase 4D, Phase 4E)
│   │   │       ├── tokens.routes.test.ts (MODIFIED - Phase 4B, Phase 4C, Phase 4G)
│   │   │       ├── tokens.routes.ts     (MODIFIED - Phase 4B, Phase 4C, Phase 4G)
│   │   │       ├── tokens.service.ts    (NEW - Phase 4B, MODIFIED - Phase 4G)
│   │   │       ├── vision.service.test.ts
│   │   │       └── vision.service.ts    (MODIFIED - Phase 4F.1)
│   │   ├── shared/
│   │   │   ├── db/
│   │   │   │   └── prisma.ts
│   │   │   ├── middleware/
│   │   │   │   ├── error-handler.ts
│   │   │   │   └── session.ts           (NEW - Phase 1A)
│   │   │   ├── socket/
│   │   │   │   ├── index.ts             (NEW - Phase 4C)
│   │   │   │   └── io-instance.ts       (NEW - Phase 4C)
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
│   │   ├── assets                       (NEW - Phase 5A)
│   │   └── thumbnails                   (NEW - Phase 5A)
│   ├── .DS_Store
│   ├── .env
│   ├── .env.example
│   ├── .env.local
│   ├── package.json                     (MODIFIED - Phase 1A, Phase 4C)
│   ├── tsconfig.json                    (MODIFIED - Phase 5A)
│   └── vitest.config.ts                 (MODIFIED - Phase 3B, Phase 4C)
├── shared/                              (NEW - Phase 0)
│   ├── src/
│   │   ├── constants/
│   │   │   ├── auth.ts                  (NEW - Phase 1A)
│   │   │   ├── campaigns.ts             (NEW - Phase 3A)
│   │   │   ├── characters.test.ts       (NEW - Phase 6A)
│   │   │   ├── characters.ts            (NEW - Phase 6A)
│   │   │   ├── editor.ts                (NEW - Phase 5A)
│   │   │   ├── index.ts                 (MODIFIED - Phase 1A, Phase 3A, Phase 4A, Phase 6A)
│   │   │   └── play-area.ts             (MODIFIED - Phase 4A, Phase 4B, Phase 4C, Phase 4D, Phase 4E)
│   │   ├── types/
│   │   │   ├── auth.ts                  (NEW - Phase 1A)
│   │   │   ├── campaigns.ts             (MODIFIED - Phase 3A, Phase 3B)
│   │   │   ├── characters.ts            (NEW - Phase 6A)
│   │   │   ├── editor.ts                (NEW - Phase 5A)
│   │   │   ├── index.ts                 (MODIFIED - Phase 1A, Phase 3A, Phase 4A, Phase 6A)
│   │   │   └── play-area.ts             (MODIFIED - Phase 4A, Phase 4B, Phase 4C, Phase 4D, Phase 4E)
│   │   ├── validators/
│   │   │   ├── auth.ts                  (NEW - Phase 1A)
│   │   │   ├── campaigns.ts             (MODIFIED - Phase 3A, Phase 3B)
│   │   │   ├── characters.ts            (NEW - Phase 6A)
│   │   │   ├── editor.test.ts           (NEW - Phase 5A)
│   │   │   ├── editor.ts                (NEW - Phase 5A)
│   │   │   ├── index.ts                 (MODIFIED - Phase 1A, Phase 3A, Phase 4B, Phase 6A)
│   │   │   ├── play-area.test.ts        (MODIFIED - Phase 4H)
│   │   │   └── play-area.ts             (MODIFIED - Phase 4B, Phase 4C, Phase 4D, Phase 4E)
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.tsbuildinfo
│   └── vitest.config.ts
├── uploads/                             (NEW - Phase 5A)
│   ├── assets                           (NEW - Phase 5A)
│   └── thumbnails                       (NEW - Phase 5A)
├── .copilotignore
├── .DS_Store
├── .gitignore                           (NEW - Phase 0)
├── .prettierrc                          (NEW - Phase 0)
├── eslint.config.js                     (NEW - Phase 0)
├── package.json                         (NEW - Phase 0)
├── README.md
├── vitest.config.ts                     (MODIFIED - Phase 0, Phase 4C)
└── vitest.workspace.ts                  (NEW - Phase 0)
```
