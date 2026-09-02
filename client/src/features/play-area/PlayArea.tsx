import type { DragEvent, PointerEvent, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import type {
  ChatReceivedPayload,
  DrawClearedPayload,
  DrawStrokeRelayedPayload,
  FogHiddenPayload,
  FogRegionDeletedPayload,
  FogRevealedPayload,
  FogVertex,
  InitiativeState,
  InitiativeUpdatedPayload,
  MapData,
  MeasureClearedPayload,
  MeasureRelayedPayload,
  TileAsset,
  TokenCreatedPayload,
  TokenDeletedPayload,
  TokenMovedPayload,
  TokenUpdatedPayload,
  TokenVisionReveal,
  TokenVisionSyncPayload,
} from '@vtt/shared';
import {
  DEFAULT_GRID_ALPHA,
  DEFAULT_GRID_CELL_SIZE,
  DEFAULT_GRID_COLOR,
  DRAW_DEFAULT_COLOR,
  DRAW_DEFAULT_WIDTH,
} from '@vtt/shared';

import { useAuth } from '../auth/AuthContext';
import { AssetLibrary } from '../editor/components/AssetLibrary';
import { GridAlignmentModal } from '../editor/components/GridAlignmentModal';
import { LayersPanel } from '../editor/components/LayersPanel';
import { SmartSizingPrompt } from '../editor/components/SmartSizingPrompt';
import { TileContextMenu } from '../editor/components/TileContextMenu';
import { EditorModeProvider, useEditorMode } from '../editor/EditorModeContext';
import { useTileAssets } from '../editor/hooks/useTileAssets';
import { useTileDragDrop } from '../editor/hooks/useTileDragDrop';
import { useTilePlacements } from '../editor/hooks/useTilePlacements';
import { CampaignToolbar } from './components/CampaignToolbar';
import type { DrawShapeKind } from './components/CanvasToolbar';
import { CanvasToolbar } from './components/CanvasToolbar';
import { ChatPanel } from './components/ChatPanel';
import { DiceRollerButton } from './components/DiceRollerButton';
import { TokenHoverCard } from './components/TokenHoverCard';
import { TurnTracker } from './components/TurnTracker';
import { useActiveScene } from './hooks/useActiveScene';
import { useCampaignRole } from './hooks/useCampaignRole';
import { useCanvas } from './hooks/useCanvas';
import { useChatMessages } from './hooks/useChatMessages';
import { useDrawTool } from './hooks/useDrawTool';
import { useFogRegions } from './hooks/useFogRegions';
import { useFogViewMode } from './hooks/useFogViewMode';
import { calcMeasureDistance, formatMeasureLabel, useMeasureTool } from './hooks/useMeasureTool';
import { useNpcDrop } from './hooks/useNpcDrop';
import { usePlayAreaSocket } from './hooks/usePlayAreaSocket';
import { useTokens } from './hooks/useTokens';
import { useToolMode } from './hooks/useToolMode';
import { filterVisionRevealsForFogPreview } from './hooks/vision-filter';
import styles from './PlayArea.module.css';

// Fallback map data used while the real scene is loading
const FALLBACK_MAP: Omit<MapData, 'campaignId'> = {
  id: 'loading',
  name: 'Loading…',
  imageUrl: null,
  width: 2048,
  height: 2048,
  gridConfig: {
    cellSize: DEFAULT_GRID_CELL_SIZE,
    visible: true,
    color: DEFAULT_GRID_COLOR,
    alpha: DEFAULT_GRID_ALPHA,
  },
};

interface HoverState {
  tokenId: string;
  canvasX: number;
  canvasY: number;
}

function toRectangleVertices(a: FogVertex, b: FogVertex): FogVertex[] {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x, b.x);
  const maxY = Math.max(a.y, b.y);

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

export function PlayArea(): ReactElement {
  return (
    <EditorModeProvider>
      <PlayAreaInner />
    </EditorModeProvider>
  );
}

function PlayAreaInner(): ReactElement {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user } = useAuth();
  const {
    mode: editorMode,
    toggleMode,
    selectedTilePlacementIds,
    setSelectedTilePlacementIds,
  } = useEditorMode();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { canvasManager, isReady } = useCanvas(containerRef);

  const { scene, isLoading: sceneLoading } = useActiveScene(campaignId);
  const { role, playerColor } = useCampaignRole(campaignId, user?.id);
  const {
    assets,
    isLoading: assetsLoading,
    error: assetsError,
    uploadAsset,
    deleteAsset,
  } = useTileAssets(campaignId);
  const {
    tokens,
    createToken,
    moveToken,
    updateTokenHp,
    updateToken,
    applyRemoteTokenMove,
    applyRemoteTokenUpdate,
    addRemoteToken,
    removeRemoteToken,
    refresh,
  } = useTokens(campaignId, scene?.id);
  const {
    regions: fogRegions,
    applyRemoteReveal,
    applyRemoteHide,
    applyRemoteDelete,
    refresh: refreshFog,
  } = useFogRegions(campaignId, scene?.id);
  const {
    messages: chatMessages,
    isLoading: chatLoading,
    addMessage,
  } = useChatMessages(campaignId);

  const { placements, createPlacement, updatePlacement, deletePlacement } = useTilePlacements(
    campaignId,
    scene?.id,
  );

  // Editor layer-panel state — hidden and locked tile IDs (client-side only; not persisted)
  const [hiddenTileIds, setHiddenTileIds] = useState<ReadonlySet<string>>(new Set());
  const [lockedTileIds, setLockedTileIds] = useState<ReadonlySet<string>>(new Set());

  // Placements visible on the canvas — hidden tiles are excluded
  const visiblePlacements = useMemo(
    () => placements.filter((p) => !hiddenTileIds.has(p.id)),
    [placements, hiddenTileIds],
  );
  // Context menu state for right-clicked tile placements
  const [tileContextMenu, setTileContextMenu] = useState<{
    placementId: string;
    screenX: number;
    screenY: number;
  } | null>(null);

  // SmartSizingPrompt state — only appears when dropping a background tile onto an empty background layer
  const [smartSizingAsset, setSmartSizingAsset] = useState<{
    assetId: string;
    width: number;
    height: number;
    x: number;
    y: number;
  } | null>(null);

  // GridAlignmentModal state — opened from TileContextMenu or TileInspector
  const [alignmentPlacementId, setAlignmentPlacementId] = useState<string | null>(null);

  // Build assets lookup map for CanvasManager
  const assetsMap = useMemo((): Map<string, TileAsset> => {
    const map = new Map<string, TileAsset>();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const {
    emitTokenMove,
    emitChatSend,
    emitDiceRoll,
    emitFogReveal,
    emitFogHide,
    emitFogRegionDelete,
    emitMeasureBroadcast,
    emitMeasureClear,
    emitDrawStroke,
    emitDrawClear,
    emitInitiativeStart,
    emitInitiativeAdvance,
    emitInitiativeEnd,
    emitInitiativeReorder,
    isConnected,
  } = usePlayAreaSocket({
    campaignId,
    onTokenMoved: useCallback(
      (payload: TokenMovedPayload) => {
        applyRemoteTokenMove(payload.tokenId, payload.x, payload.y);
      },
      [applyRemoteTokenMove],
    ),
    onTokenUpdated: useCallback(
      (payload: TokenUpdatedPayload) => {
        applyRemoteTokenUpdate(payload.token);
      },
      [applyRemoteTokenUpdate],
    ),
    onTokenCreated: useCallback(
      (payload: TokenCreatedPayload) => {
        addRemoteToken(payload.token);
      },
      [addRemoteToken],
    ),
    onTokenDeleted: useCallback(
      (payload: TokenDeletedPayload) => {
        removeRemoteToken(payload.tokenId);
      },
      [removeRemoteToken],
    ),
    onChatReceived: useCallback(
      (payload: ChatReceivedPayload) => {
        addMessage(payload.message);
      },
      [addMessage],
    ),
    onFogRevealed: useCallback(
      (payload: FogRevealedPayload) => {
        applyRemoteReveal(payload.region);
      },
      [applyRemoteReveal],
    ),
    onFogHidden: useCallback(
      (payload: FogHiddenPayload) => {
        applyRemoteHide(payload.removedRegionIds);
      },
      [applyRemoteHide],
    ),
    onFogRegionDeleted: useCallback(
      (payload: FogRegionDeletedPayload) => {
        applyRemoteDelete(payload.regionId);
      },
      [applyRemoteDelete],
    ),
    onVisionSync: useCallback((payload: TokenVisionSyncPayload) => {
      setVisionReveals(payload.reveals);
    }, []),
    onMeasureRelayed: useCallback(
      (payload: MeasureRelayedPayload) => {
        if (!canvasManager) return;
        const cellSize = scene?.cellSize ?? DEFAULT_GRID_CELL_SIZE;
        const dist = calcMeasureDistance(
          payload.startX,
          payload.startY,
          payload.endX,
          payload.endY,
          cellSize,
        );
        const label = formatMeasureLabel(dist);
        canvasManager.playgroundLayer.drawRemoteMeasureLine(
          payload.userId,
          payload.startX,
          payload.startY,
          payload.endX,
          payload.endY,
          payload.color,
          label,
        );
      },
      [canvasManager, scene?.cellSize],
    ),
    onMeasureCleared: useCallback(
      (payload: MeasureClearedPayload) => {
        canvasManager?.playgroundLayer.clearRemoteMeasureLine(payload.userId);
      },
      [canvasManager],
    ),
    onDrawStroked: useCallback(
      (payload: DrawStrokeRelayedPayload) => {
        if (!canvasManager) return;
        canvasManager.playgroundLayer.addOrUpdateDrawStroke(
          payload.userId,
          payload.strokeId,
          payload.points,
          payload.color,
          payload.width,
          payload.shapeType,
        );
      },
      [canvasManager],
    ),
    onDrawCleared: useCallback(
      (payload: DrawClearedPayload) => {
        if (!canvasManager) return;
        canvasManager.playgroundLayer.clearDrawings(payload.scope, payload.userId);
      },
      [canvasManager],
    ),
    onInitiativeUpdated: useCallback((payload: InitiativeUpdatedPayload) => {
      setInitiativeState(payload.state);
    }, []),
    onReconnect: useCallback(() => {
      refresh();
      refreshFog();
      setVisionReveals([]);
    }, [refresh, refreshFog]),
  });

  const [hoveredToken, setHoveredToken] = useState<HoverState | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [selectedTokenIds, setSelectedTokenIds] = useState<ReadonlySet<string>>(new Set());
  const [visionReveals, setVisionReveals] = useState<TokenVisionReveal[]>([]);
  const [initiativeState, setInitiativeState] = useState<InitiativeState | null>(null);

  useEffect(() => {
    setInitiativeState(null);
  }, [campaignId]);

  const { activeTool, setActiveTool } = useToolMode();
  const { fogViewMode, setFogViewMode } = useFogViewMode();

  const visibleVisionReveals = useMemo(
    (): TokenVisionReveal[] =>
      filterVisionRevealsForFogPreview({
        reveals: visionReveals,
        tokens,
        role,
        fogViewMode,
      }),
    [visionReveals, tokens, role, fogViewMode],
  );

  // Observer defaults to Pan tool once role loads
  useEffect(() => {
    if (role === 'observer') setActiveTool('pan');
  }, [role, setActiveTool]);

  // Measure tool state (Phase 4J)
  const [measurePrivate, setMeasurePrivate] = useState(false);
  const isMeasureActive = activeTool === 'measure';

  // Draw tool state (Phase 4K)
  const [drawShapeKind, setDrawShapeKind] = useState<DrawShapeKind>('freehand');
  const [drawStrokeColor, setDrawStrokeColor] = useState(DRAW_DEFAULT_COLOR);
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(DRAW_DEFAULT_WIDTH);
  const isDrawActive = activeTool === 'draw-freehand' || activeTool === 'draw-shape';

  const {
    handlePointerDown: measurePointerDown,
    handlePointerMove: measurePointerMove,
    handlePointerUp: measurePointerUp,
  } = useMeasureTool({
    canvasManager,
    cellSize: scene?.cellSize ?? DEFAULT_GRID_CELL_SIZE,
    playerColor,
    campaignId,
    isActive: isMeasureActive,
    isPrivate: measurePrivate,
    emitMeasureBroadcast,
    emitMeasureClear,
  });

  const {
    handlePointerDown: drawPointerDown,
    handlePointerMove: drawPointerMove,
    handlePointerUp: drawPointerUp,
  } = useDrawTool({
    canvasManager,
    userId: user?.id,
    campaignId,
    isActive: isDrawActive,
    shapeType: drawShapeKind,
    strokeColor: drawStrokeColor,
    strokeWidth: drawStrokeWidth,
    emitDrawStroke,
    emitDrawClear,
  });

  const isFogDrawingActive =
    role === 'dm' && (activeTool === 'fog-reveal' || activeTool === 'fog-hide');

  const isDrawingFogRef = useRef(false);
  const fogDrawStartRef = useRef<FogVertex | null>(null);
  const fogPointerDownScreenRef = useRef<{ x: number; y: number } | null>(null);

  // selectedTokenId ref for stable closures in canvasManager callbacks
  const selectedTokenIdRef = useRef<string | null>(null);
  selectedTokenIdRef.current = selectedTokenId;

  // selectedTokenIds ref for stable closures (rubber-band selection)
  const selectedTokenIdsRef = useRef<ReadonlySet<string>>(selectedTokenIds);
  selectedTokenIdsRef.current = selectedTokenIds;

  const clearMultiTokenSelection = useCallback((): void => {
    const previous = selectedTokenIdsRef.current;
    if (previous.size === 0) return;
    canvasManager?.setTokensSelected(new Set(), previous);
    setSelectedTokenIds(new Set());
  }, [canvasManager]);

  // Build MapData from the active scene (or use fallback while loading)
  const mapData = useMemo((): MapData => {
    if (!scene) {
      return { ...FALLBACK_MAP, campaignId: campaignId ?? '' };
    }
    return {
      id: scene.id,
      campaignId: scene.campaignId,
      name: scene.name,
      imageUrl: scene.imageUrl,
      width: scene.width,
      height: scene.height,
      gridConfig: {
        cellSize: scene.cellSize,
        visible: true,
        color: DEFAULT_GRID_COLOR,
        alpha: DEFAULT_GRID_ALPHA,
      },
    };
  }, [scene, campaignId]);

  // Load map into canvas when canvas is ready and scene is available
  useEffect(() => {
    if (!isReady || !canvasManager || sceneLoading) return;
    canvasManager.loadMap(mapData).catch((error: unknown) => {
      console.error('[PlayArea] Failed to load map:', error);
    });
  }, [isReady, canvasManager, mapData, sceneLoading]);

  // Register token move, hover, and click callbacks on the canvas manager
  useEffect(() => {
    if (!canvasManager) return;

    canvasManager.onTokenMove = (tokenId, x, y): void => {
      // Persist position via REST (optimistic update included),
      // then broadcast via Socket.IO only on success to avoid split-brain state
      moveToken(tokenId, x, y)
        .then(() => {
          emitTokenMove(tokenId, x, y);
        })
        .catch((err: unknown) => {
          console.error('[PlayArea] Token move failed:', err);
        });
    };

    canvasManager.onTokenHoverChange = (tokenId, entering, canvasX, canvasY): void => {
      // Suppress hover updates while a token is selected OR a drag is in progress (PP behavior)
      if (selectedTokenIdRef.current !== null || canvasManager.isDraggingToken) return;
      if (!entering) {
        setHoveredToken(null);
        return;
      }
      setHoveredToken({ tokenId, canvasX, canvasY });
    };

    canvasManager.onTokenClick = (tokenId): void => {
      clearMultiTokenSelection();
      const prev = selectedTokenIdRef.current;
      const next = prev === tokenId ? null : tokenId;
      canvasManager.setTokenSelected(next, prev);
      setSelectedTokenId(next);
      // Token selection is exclusive — deselect any highlighted tile.
      canvasManager.clearTileSelection();
    };

    canvasManager.onBackgroundClick = (): void => {
      clearMultiTokenSelection();
      const current = selectedTokenIdRef.current;
      if (current) {
        canvasManager.setTokenSelected(null, current);
        setSelectedTokenId(null);
        setHoveredToken(null);
      }
    };

    canvasManager.onTokenDragStart = (): void => {
      // Clear hover card and deselect any selected token when drag begins (PP behavior)
      clearMultiTokenSelection();
      setHoveredToken(null);
      const current = selectedTokenIdRef.current;
      if (current) {
        canvasManager.setTokenSelected(null, current);
        setSelectedTokenId(null);
      }
    };

    canvasManager.onTokensSelected = (tokenIds: string[]): void => {
      const next = new Set(tokenIds);
      const prev = selectedTokenIdsRef.current;
      canvasManager.setTokensSelected(next, prev);
      setSelectedTokenIds(next);
      // Clear single-token hover card when rubber-band selects multiple
      setSelectedTokenId(null);
      setHoveredToken(null);
    };
  }, [canvasManager, moveToken, emitTokenMove, clearMultiTokenSelection]);

  // Sync token list to canvas whenever tokens or user/role changes
  useEffect(() => {
    if (!canvasManager || !isReady || !user || !role) return;
    canvasManager.setTokens(tokens, user.id, role);
  }, [canvasManager, isReady, tokens, user, role]);

  // Editor mode: sync tile placements to canvas
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager
      .setTilePlacements(visiblePlacements, assetsMap, editorMode === 'editor')
      .catch((err: unknown) => {
        console.error('[PlayArea] Failed to sync tile placements:', err);
      });
  }, [canvasManager, isReady, visiblePlacements, assetsMap, editorMode]);

  // Editor mode: toggle tile interactivity when mode changes
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setEditorMode(editorMode === 'editor');
  }, [canvasManager, isReady, editorMode]);

  // Editor mode: sync locked tile state to canvas so locked sprites are non-interactive
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setLockedTilePlacements(lockedTileIds);
  }, [canvasManager, isReady, lockedTileIds]);

  // Editor mode: register tile event callbacks
  useEffect(() => {
    if (!canvasManager) return;

    canvasManager.onTileMoveEnd = (placementId, x, y): void => {
      updatePlacement(placementId, { x, y });
    };

    canvasManager.onSelectionChange = (ids): void => {
      setSelectedTilePlacementIds(ids);
      // Tile selection is exclusive — deselect any highlighted token.
      if (ids.size > 0) {
        const current = selectedTokenIdRef.current;
        if (current) {
          canvasManager.setTokenSelected(null, current);
          setSelectedTokenId(null);
        }
      }
    };

    canvasManager.onTilePlaced = (assetId, x, y, width, height, category): void => {
      const asset = assetsMap.get(assetId);

      // "Playground" assets are token art — create a Token (image portrait, grid-sized,
      // clickable for stats) instead of a decorative TilePlacement.
      if (category === 'playground' && asset) {
        const cellSize = scene?.cellSize ?? DEFAULT_GRID_CELL_SIZE;
        const gridX = Math.max(0, Math.round(x / cellSize));
        const gridY = Math.max(0, Math.round(y / cellSize));
        // Derive a token name from the asset filename (strip extension), capped to Prisma column length.
        const derivedName = asset.filename.replace(/\.[^.]+$/, '').slice(0, 60) || 'Token';
        void createToken({
          name: derivedName,
          type: 'misc',
          x: gridX,
          y: gridY,
          size: 1,
          iconUrl: asset.url,
        });
        return;
      }

      const isBg = category === 'background';
      const isEmpty = canvasManager.getBackgroundLayerTilePlacementCount() === 0;
      const isLarger =
        asset !== undefined &&
        (asset.width > (scene?.width ?? 2048) || asset.height > (scene?.height ?? 2048));

      if (isBg && isEmpty && isLarger && asset) {
        // Ask user before creating — SmartSizingPrompt will call createPlacement
        setSmartSizingAsset({ assetId, width: asset.width, height: asset.height, x, y });
        return;
      }

      void createPlacement({ assetId, x, y, width, height, rotation: 0, zIndex: 0, category });
    };

    canvasManager.onTileDelete = (placementId): void => {
      void deletePlacement(placementId);
      canvasManager.clearTileSelection();
    };

    canvasManager.onTileResizeEnd = (placementId, width, height): void => {
      updatePlacement(placementId, { width, height });
    };

    canvasManager.onTileRotate = (placementId, rotation): void => {
      updatePlacement(placementId, { rotation });
    };

    canvasManager.onTileContextMenu = (placementId, screenX, screenY): void => {
      setTileContextMenu({ placementId, screenX, screenY });
    };
  }, [
    canvasManager,
    assetsMap,
    scene,
    createPlacement,
    createToken,
    updatePlacement,
    deletePlacement,
    setSelectedTilePlacementIds,
  ]);

  // Re-measure canvas after editor/play mode toggle — sidebar panels appear/disappear,
  // changing the canvas wrapper width. Defer one rAF so React finishes painting first.
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    const id = requestAnimationFrame(() => {
      canvasManager.resize();
    });
    return (): void => cancelAnimationFrame(id);
  }, [canvasManager, isReady, editorMode]);

  useEffect(() => {
    if (!canvasManager || !isReady || !role) return;
    // DM sees player view when fogViewMode is 'player', otherwise sees DM debug view
    const obfuscate = role !== 'dm' || fogViewMode === 'player';
    canvasManager.setFogRegions(fogRegions, obfuscate);
  }, [canvasManager, isReady, fogRegions, role, fogViewMode]);

  // Sync active tool to canvas manager
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setToolMode(activeTool);
  }, [canvasManager, isReady, activeTool]);

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setTokenVisionReveals(visibleVisionReveals);
  }, [canvasManager, isReady, visibleVisionReveals]);

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setActiveTokenId(initiativeState?.activeTokenId ?? null);
  }, [canvasManager, isReady, initiativeState?.activeTokenId]);

  // Attach wheel listener on wrapper so it fires even when overlays are on top
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper || !canvasManager) return;

    const handleWheel = (e: globalThis.WheelEvent): void => {
      e.preventDefault();
      const rect = canvasManager.canvas.getBoundingClientRect();
      canvasManager.zoom(-e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return (): void => wrapper.removeEventListener('wheel', handleWheel);
  }, [canvasManager]);

  // Middle-mouse drag pans the canvas regardless of active tool/overlay.
  // Capture phase so we intercept before child overlays see the event.
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper || !canvasManager) return;

    const panState = { active: false, lastX: 0, lastY: 0 };

    const onPointerDown = (e: globalThis.PointerEvent): void => {
      if (e.button !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      panState.active = true;
      panState.lastX = e.clientX;
      panState.lastY = e.clientY;
      wrapper.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: globalThis.PointerEvent): void => {
      if (!panState.active) return;
      const dx = e.clientX - panState.lastX;
      const dy = e.clientY - panState.lastY;
      panState.lastX = e.clientX;
      panState.lastY = e.clientY;
      canvasManager.pan(dx, dy);
    };

    const onPointerUp = (e: globalThis.PointerEvent): void => {
      if (e.button === 1) panState.active = false;
    };

    const onPointerCancel = (): void => {
      panState.active = false;
    };

    wrapper.addEventListener('pointerdown', onPointerDown, true);
    wrapper.addEventListener('pointermove', onPointerMove);
    wrapper.addEventListener('pointerup', onPointerUp);
    wrapper.addEventListener('pointercancel', onPointerCancel);

    return (): void => {
      wrapper.removeEventListener('pointerdown', onPointerDown, true);
      wrapper.removeEventListener('pointermove', onPointerMove);
      wrapper.removeEventListener('pointerup', onPointerUp);
      wrapper.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [canvasManager]);

  const handleCloseCard = useCallback((): void => {
    setSelectedTokenId((prev) => {
      if (prev) canvasManager?.setTokenSelected(null, prev);
      return null;
    });
    setHoveredToken(null);
  }, [canvasManager]);

  const handleHPChange = useCallback(
    (tokenId: string, hp: number): void => {
      updateTokenHp(tokenId, hp).catch((err: unknown) => {
        console.error('[PlayArea] HP update failed:', err);
      });
    },
    [updateTokenHp],
  );

  const handleVisionRadiusChange = useCallback(
    (tokenId: string, radius: number): void => {
      if (!campaignId || !scene?.id) return;
      fetch(`/api/campaigns/${campaignId}/scenes/${scene.id}/tokens/${tokenId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visionRadius: radius }),
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((body: unknown) => {
              const msg =
                (body as { error?: { message?: string } }).error?.message ?? res.statusText;
              throw new Error(msg);
            });
          }
        })
        .catch((err: unknown) => {
          console.error('[PlayArea] Vision radius update failed:', err);
        });
    },
    [campaignId, scene?.id],
  );

  const handleAuraChange = useCallback(
    (tokenId: string, payload: Parameters<typeof updateToken>[1]): void => {
      updateToken(tokenId, payload).catch((err: unknown) => {
        console.error('[PlayArea] Aura update failed:', err);
      });
    },
    [updateToken],
  );

  // Clear fog drawing state when switching away from fog tools
  useEffect(() => {
    if (activeTool !== 'fog-reveal' && activeTool !== 'fog-hide') {
      isDrawingFogRef.current = false;
      fogDrawStartRef.current = null;
      canvasManager?.setFogBrushPreview(null);
    }
  }, [activeTool, canvasManager]);

  // Pan tool overlay handlers — left-click-drag pans when Pan tool is active
  const isPanToolActive = activeTool === 'pan' && editorMode === 'play';
  const panOverlayRef = useRef<{ lastX: number; lastY: number; active: boolean }>({
    lastX: 0,
    lastY: 0,
    active: false,
  });

  const handlePanOverlayPointerDown = useCallback((e: PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    panOverlayRef.current = { lastX: e.clientX, lastY: e.clientY, active: true };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePanOverlayPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!panOverlayRef.current.active || !canvasManager) return;
      const dx = e.clientX - panOverlayRef.current.lastX;
      const dy = e.clientY - panOverlayRef.current.lastY;
      panOverlayRef.current.lastX = e.clientX;
      panOverlayRef.current.lastY = e.clientY;
      canvasManager.pan(dx, dy);
    },
    [canvasManager],
  );

  const handlePanOverlayPointerUp = useCallback((): void => {
    panOverlayRef.current.active = false;
  }, []);

  const handleZoomIn = useCallback((): void => {
    if (!canvasManager) return;
    const canvas = canvasManager.canvas;
    const rect = canvas.getBoundingClientRect();
    canvasManager.zoom(1, rect.width / 2, rect.height / 2);
  }, [canvasManager]);

  const handleZoomOut = useCallback((): void => {
    if (!canvasManager) return;
    const canvas = canvasManager.canvas;
    const rect = canvas.getBoundingClientRect();
    canvasManager.zoom(-1, rect.width / 2, rect.height / 2);
  }, [canvasManager]);

  const handleFogPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!isFogDrawingActive || !canvasManager || e.button !== 0) return;
      isDrawingFogRef.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const start = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      fogDrawStartRef.current = start;
      fogPointerDownScreenRef.current = { x: e.clientX, y: e.clientY };
      e.currentTarget.setPointerCapture(e.pointerId);
      canvasManager.setFogBrushPreview(null);
    },
    [canvasManager, isFogDrawingActive],
  );

  const handleFogPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!isFogDrawingActive || !canvasManager || !isDrawingFogRef.current) return;
      const start = fogDrawStartRef.current;
      if (!start) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const current = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const vertices = toRectangleVertices(start, current);
      canvasManager.setFogBrushPreview(vertices);
    },
    [canvasManager, isFogDrawingActive],
  );

  const handleFogPointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!isFogDrawingActive || !canvasManager || !scene?.id) return;
      if (!isDrawingFogRef.current) return;

      isDrawingFogRef.current = false;
      const start = fogDrawStartRef.current;
      fogDrawStartRef.current = null;
      const screenStart = fogPointerDownScreenRef.current;
      fogPointerDownScreenRef.current = null;
      if (!start) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const end = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      canvasManager.setFogBrushPreview(null);

      // Click detection: pointer barely moved → delete the region under the cursor
      const dx = screenStart ? e.clientX - screenStart.x : 0;
      const dy = screenStart ? e.clientY - screenStart.y : 0;
      const FOG_CLICK_THRESHOLD_PX = 4;
      if (Math.abs(dx) <= FOG_CLICK_THRESHOLD_PX && Math.abs(dy) <= FOG_CLICK_THRESHOLD_PX) {
        const px = end.x;
        const py = end.y;
        // Find the topmost (most recently drawn) region containing the click point
        for (let i = fogRegions.length - 1; i >= 0; i--) {
          const region = fogRegions[i];
          const xs = region.vertices.map((v) => v.x);
          const ys = region.vertices.map((v) => v.y);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          if (px >= minX && px <= maxX && py >= minY && py <= maxY) {
            emitFogRegionDelete(scene.id, region.id);
            return;
          }
        }
        return;
      }

      const vertices = toRectangleVertices(start, end);
      const width = Math.abs(vertices[1].x - vertices[0].x);
      const height = Math.abs(vertices[3].y - vertices[0].y);
      if (width < 8 || height < 8) return;

      if (activeTool === 'fog-reveal') {
        emitFogReveal(scene.id, vertices);
      } else if (activeTool === 'fog-hide') {
        emitFogHide(scene.id, vertices);
      }
    },
    [
      activeTool,
      canvasManager,
      emitFogHide,
      emitFogRegionDelete,
      emitFogReveal,
      fogRegions,
      isFogDrawingActive,
      scene?.id,
    ],
  );

  // Measure tool overlay handlers (Phase 4J)
  const handleMeasurePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!canvasManager) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const world = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      e.currentTarget.setPointerCapture(e.pointerId);
      measurePointerDown(world.x, world.y);
    },
    [canvasManager, measurePointerDown],
  );

  const handleMeasurePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!canvasManager) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const world = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      measurePointerMove(world.x, world.y);
    },
    [canvasManager, measurePointerMove],
  );

  const handleMeasurePointerUp = useCallback((): void => {
    measurePointerUp();
  }, [measurePointerUp]);

  // Draw tool overlay handlers (Phase 4K)
  const handleDrawPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!canvasManager) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const world = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      e.currentTarget.setPointerCapture(e.pointerId);
      drawPointerDown(world.x, world.y);
    },
    [canvasManager, drawPointerDown],
  );

  const handleDrawPointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!canvasManager) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const world = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      drawPointerMove(world.x, world.y);
    },
    [canvasManager, drawPointerMove],
  );

  const handleDrawPointerUp = useCallback((): void => {
    drawPointerUp();
  }, [drawPointerUp]);

  const handleDrawClear = useCallback((): void => {
    if (!campaignId) return;
    const scope = role === 'dm' ? 'all' : 'own';
    // Clear local canvas immediately rather than waiting for the socket round-trip
    canvasManager?.playgroundLayer.clearDrawings(scope, user?.id ?? '');
    emitDrawClear({ campaignId, scope });
  }, [campaignId, role, canvasManager, user?.id, emitDrawClear]);

  // Asset drag-drop onto the canvas (editor mode only)
  const { handleDragOver: handleCanvasDragOver, handleDrop: handleCanvasDrop } = useTileDragDrop({
    canvasManager,
    isEditorMode: editorMode === 'editor',
  });

  // NPC token drag-drop onto the canvas (play mode, DM + npc-place tool active)
  const isNpcPlaceActive = activeTool === 'npc-place';
  const { handleDragOver: handleNpcDragOver, handleDrop: handleNpcDrop } = useNpcDrop({
    canvasManager,
    createToken,
    cellSize: scene?.cellSize ?? DEFAULT_GRID_CELL_SIZE,
    isActive: isNpcPlaceActive,
  });

  // Each handler guards on its own MIME type and active mode, so they are safe to
  // call in sequence — only the matching handler will call e.preventDefault().
  const handleCombinedDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      handleCanvasDragOver(e);
      handleNpcDragOver(e);
    },
    [handleCanvasDragOver, handleNpcDragOver],
  );

  const handleCombinedDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      handleCanvasDrop(e);
      handleNpcDrop(e);
    },
    [handleCanvasDrop, handleNpcDrop],
  );

  // -----------------------------------------------------------------------
  // Layer panel handlers
  // -----------------------------------------------------------------------

  const handleSelectTileFromPanel = useCallback(
    (id: string): void => {
      canvasManager?.setTileSelection(new Set([id]));
    },
    [canvasManager],
  );

  const handleToggleVisibility = useCallback((id: string): void => {
    setHiddenTileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleLock = useCallback((id: string): void => {
    setLockedTileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeleteTileFromPanel = useCallback(
    (id: string): void => {
      void deletePlacement(id);
      // clearTileSelection triggers onSelectionChange → setSelectedTilePlacementIds
      canvasManager?.clearTileSelection();
    },
    [deletePlacement, canvasManager],
  );

  const handleReorderTile = useCallback(
    (draggedTileId: string, targetTileId: string): void => {
      const src = placements.find((p) => p.id === draggedTileId);
      const tgt = placements.find((p) => p.id === targetTileId);
      if (!src || !tgt || src.category !== tgt.category) return;

      // Build the current panel order (z-index descending) for this category,
      // then insert the dragged tile before the target and reassign sequential
      // z-indexes. This handles the common case where tiles share a default
      // z-index of 0 (a simple swap would be a no-op).
      const sorted = placements
        .filter((p) => p.category === src.category)
        .slice()
        .sort((a, b) => b.zIndex - a.zIndex);

      const without = sorted.filter((p) => p.id !== draggedTileId);
      const insertAt = without.findIndex((p) => p.id === targetTileId);
      without.splice(insertAt >= 0 ? insertAt : without.length, 0, src);

      const maxZ = without.length;
      without.forEach((p, i) => {
        const newZ = maxZ - i;
        if (newZ !== p.zIndex) updatePlacement(p.id, { zIndex: newZ });
      });
    },
    [placements, updatePlacement],
  );

  const handleBatchDeleteSelected = useCallback(
    (ids: ReadonlySet<string>): void => {
      for (const id of ids) void deletePlacement(id);
      // clearTileSelection triggers onSelectionChange → setSelectedTilePlacementIds
      canvasManager?.clearTileSelection();
    },
    [deletePlacement, canvasManager],
  );

  return (
    <div className={styles.layout}>
      <CampaignToolbar
        editorMode={editorMode}
        canToggleEditor={role === 'dm'}
        onToggleEditor={toggleMode}
      />
      <div className={styles.body}>
        {/* Editor mode panels — left of canvas */}
        {editorMode === 'editor' && campaignId && (
          <AssetLibrary
            assets={assets}
            isLoading={assetsLoading}
            error={assetsError}
            isDm={role === 'dm'}
            onUpload={uploadAsset}
            onDelete={deleteAsset}
          />
        )}
        {/* Canvas toolbar — vertical strip docked left, play mode only */}
        {editorMode === 'play' && (
          <CanvasToolbar
            activeTool={activeTool}
            onToolChange={setActiveTool}
            role={role}
            measurePrivate={measurePrivate}
            onMeasurePrivateChange={setMeasurePrivate}
            fogViewMode={fogViewMode}
            onFogViewModeChange={setFogViewMode}
            drawShapeKind={drawShapeKind}
            onDrawShapeKindChange={setDrawShapeKind}
            drawStrokeColor={drawStrokeColor}
            onDrawStrokeColorChange={setDrawStrokeColor}
            drawStrokeWidth={drawStrokeWidth}
            onDrawStrokeWidthChange={setDrawStrokeWidth}
            onDrawClear={handleDrawClear}
          />
        )}
        {/* Canvas area */}
        <div ref={canvasWrapperRef} className={styles.canvasWrapper}>
          {!isReady && (
            <div className={styles.loading}>
              <span>Loading canvas…</span>
            </div>
          )}
          <div
            ref={containerRef}
            className={styles.canvas}
            onDragOver={handleCombinedDragOver}
            onDrop={handleCombinedDrop}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* Tile context menu — appears on right-click of a selected tile in editor mode */}
          {editorMode === 'editor' && tileContextMenu && (
            <TileContextMenu
              screenX={tileContextMenu.screenX}
              screenY={tileContextMenu.screenY}
              onRotate={(degrees) => {
                const current = placements.find((p) => p.id === tileContextMenu.placementId);
                const newRotation = ((current?.rotation ?? 0) + degrees) % 360;
                updatePlacement(tileContextMenu.placementId, { rotation: newRotation });
              }}
              onDelete={() => {
                void deletePlacement(tileContextMenu.placementId);
                canvasManager?.clearTileSelection();
              }}
              onDuplicate={() => {
                const src = placements.find((p) => p.id === tileContextMenu.placementId);
                if (!src) return;
                void createPlacement({
                  assetId: src.assetId,
                  x: src.x + (scene?.cellSize ?? 64),
                  y: src.y + (scene?.cellSize ?? 64),
                  width: src.width,
                  height: src.height,
                  rotation: src.rotation,
                  zIndex: src.zIndex,
                  category: src.category,
                });
              }}
              onAlignToGrid={() => {
                setAlignmentPlacementId(tileContextMenu.placementId);
                setTileContextMenu(null);
              }}
              onClose={() => setTileContextMenu(null)}
            />
          )}
          {/* Smart Sizing Prompt — appears when dropping a background image larger than the canvas */}
          {smartSizingAsset && (
            <SmartSizingPrompt
              imageWidth={smartSizingAsset.width}
              imageHeight={smartSizingAsset.height}
              onAccept={() => {
                const { assetId, x, y, width, height } = smartSizingAsset;
                setSmartSizingAsset(null);
                // TODO (Phase 5C): resize scene dimensions via API before placing
                void createPlacement({
                  assetId,
                  x,
                  y,
                  width,
                  height,
                  rotation: 0,
                  zIndex: 0,
                  category: 'background',
                });
              }}
              onDismiss={() => {
                const { assetId, x, y } = smartSizingAsset;
                setSmartSizingAsset(null);
                const asset = assetsMap.get(assetId);
                if (!asset) return;
                void createPlacement({
                  assetId,
                  x,
                  y,
                  width: asset.width,
                  height: asset.height,
                  rotation: 0,
                  zIndex: 0,
                  category: 'background',
                });
              }}
            />
          )}
          {isFogDrawingActive && editorMode === 'play' && (
            <div
              className={styles.fogDrawOverlay}
              onPointerDown={handleFogPointerDown}
              onPointerMove={handleFogPointerMove}
              onPointerUp={handleFogPointerUp}
            />
          )}
          {/* Pan tool overlay — captures left-click-drag for viewport panning */}
          {isPanToolActive && (
            <div
              className={styles.panOverlay}
              onPointerDown={handlePanOverlayPointerDown}
              onPointerMove={handlePanOverlayPointerMove}
              onPointerUp={handlePanOverlayPointerUp}
              onPointerCancel={handlePanOverlayPointerUp}
            />
          )}
          {/* Measure tool overlay — captures pointer events for measurement (Phase 4J) */}
          {isMeasureActive && editorMode === 'play' && (
            <div
              className={styles.measureOverlay}
              onPointerDown={handleMeasurePointerDown}
              onPointerMove={handleMeasurePointerMove}
              onPointerUp={handleMeasurePointerUp}
              onPointerCancel={handleMeasurePointerUp}
            />
          )}
          {/* Draw tool overlay — captures pointer events for drawing (Phase 4K) */}
          {isDrawActive && editorMode === 'play' && (
            <div
              className={styles.drawOverlay}
              onPointerDown={handleDrawPointerDown}
              onPointerMove={handleDrawPointerMove}
              onPointerUp={handleDrawPointerUp}
              onPointerCancel={handleDrawPointerUp}
            />
          )}
          {/* Zoom buttons — floating top-right of canvas, always visible in play mode */}
          {editorMode === 'play' && (
            <div className={styles.zoomButtons}>
              <button
                type="button"
                className={styles.zoomBtn}
                title="Zoom in"
                onClick={handleZoomIn}
              >
                +
              </button>
              <button
                type="button"
                className={styles.zoomBtn}
                title="Zoom out"
                onClick={handleZoomOut}
              >
                −
              </button>
            </div>
          )}
          {/* Token info card — shown on hover; stays pinned when selected */}
          {editorMode === 'play' &&
            hoveredToken &&
            (() => {
              const token = tokens.find((t) => t.id === hoveredToken.tokenId);
              if (!token) return null;
              return (
                <TokenHoverCard
                  token={token}
                  canvasX={hoveredToken.canvasX}
                  canvasY={hoveredToken.canvasY}
                  isSelected={selectedTokenId === token.id}
                  canEditHP={role === 'dm' || (role === 'player' && token.ownerId === user?.id)}
                  canEditVisionRadius={role === 'dm'}
                  onClose={handleCloseCard}
                  onHPChange={handleHPChange}
                  onVisionRadiusChange={handleVisionRadiusChange}
                  onAuraChange={handleAuraChange}
                  onQuickRoll={emitDiceRoll}
                  canvasWrapperRef={canvasWrapperRef}
                />
              );
            })()}
          {editorMode === 'play' && (
            <div className={styles.diceRollerAnchor}>
              <DiceRollerButton onRoll={emitDiceRoll} />
            </div>
          )}
        </div>
        {/* Play mode panels */}
        {editorMode === 'play' && (
          <aside className={styles.rightRail}>
            <TurnTracker
              initiativeState={initiativeState}
              tokens={tokens}
              selectedTokenIds={selectedTokenIds}
              role={role}
              isConnected={isConnected}
              onStart={emitInitiativeStart}
              onAdvance={emitInitiativeAdvance}
              onEnd={emitInitiativeEnd}
              onReorder={emitInitiativeReorder}
            />
            <ChatPanel
              messages={chatMessages}
              isLoading={chatLoading}
              isConnected={isConnected}
              onSend={emitChatSend}
              onDiceRoll={emitDiceRoll}
            />
          </aside>
        )}
        {/* Editor mode: layers panel right of canvas */}
        {editorMode === 'editor' && (
          <LayersPanel
            placements={placements}
            selectedTilePlacementIds={selectedTilePlacementIds}
            hiddenTileIds={hiddenTileIds}
            lockedTileIds={lockedTileIds}
            assets={assetsMap}
            canvasGridSize={scene?.cellSize ?? DEFAULT_GRID_CELL_SIZE}
            onSelectTile={handleSelectTileFromPanel}
            onToggleVisibility={handleToggleVisibility}
            onToggleLock={handleToggleLock}
            onDeleteTile={handleDeleteTileFromPanel}
            onReorderTile={handleReorderTile}
            onUpdateTile={updatePlacement}
            onDeleteSelectedTiles={handleBatchDeleteSelected}
            onAlignToGrid={setAlignmentPlacementId}
          />
        )}
      </div>
      {/* Grid Alignment Modal — opened from TileContextMenu or TileInspector "Align to Grid" */}
      {editorMode === 'editor' &&
        alignmentPlacementId &&
        (() => {
          const placement = placements.find((p) => p.id === alignmentPlacementId);
          const asset = placement ? assetsMap.get(placement.assetId) : undefined;
          if (!placement || !asset) return null;
          return (
            <GridAlignmentModal
              placement={placement}
              asset={asset}
              canvasGridSize={scene?.cellSize ?? DEFAULT_GRID_CELL_SIZE}
              onApply={(width, height) => {
                updatePlacement(alignmentPlacementId, { width, height });
                setAlignmentPlacementId(null);
              }}
              onClose={() => setAlignmentPlacementId(null)}
            />
          );
        })()}
    </div>
  );
}
