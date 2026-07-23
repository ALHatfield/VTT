import type { PointerEvent, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';

import type {
  ChatReceivedPayload,
  FogHiddenPayload,
  FogRevealedPayload,
  FogVertex,
  MapData,
  TileAsset,
  TokenCreatedPayload,
  TokenDeletedPayload,
  TokenMovedPayload,
  TokenUpdatedPayload,
  TokenVisionReveal,
  TokenVisionSyncPayload,
} from '@vtt/shared';
import { DEFAULT_GRID_ALPHA, DEFAULT_GRID_CELL_SIZE, DEFAULT_GRID_COLOR } from '@vtt/shared';

import { useAuth } from '../auth/AuthContext';
import { AssetLibrary } from '../editor/components/AssetLibrary';
import { LayersPanel } from '../editor/components/LayersPanel';
import { SmartSizingPrompt } from '../editor/components/SmartSizingPrompt';
import { TileContextMenu } from '../editor/components/TileContextMenu';
import { EditorModeProvider, useEditorMode } from '../editor/EditorModeContext';
import { useTileAssets } from '../editor/hooks/useTileAssets';
import { useTileDragDrop } from '../editor/hooks/useTileDragDrop';
import { useTilePlacements } from '../editor/hooks/useTilePlacements';
import { ChatPanel } from './components/ChatPanel';
import { DiceRollerButton } from './components/DiceRollerButton';
import { PlayAreaToolbar, type FogToolMode } from './components/PlayAreaToolbar';
import { TokenHoverCard } from './components/TokenHoverCard';
import { useActiveScene } from './hooks/useActiveScene';
import { useCampaignRole } from './hooks/useCampaignRole';
import { useCanvas } from './hooks/useCanvas';
import { useChatMessages } from './hooks/useChatMessages';
import { useFogRegions } from './hooks/useFogRegions';
import { usePlayAreaSocket } from './hooks/usePlayAreaSocket';
import { useTokens } from './hooks/useTokens';
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
    selectedTilePlacementId,
    setSelectedTilePlacementId,
  } = useEditorMode();

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const { canvasManager, isReady } = useCanvas(containerRef);

  const { scene, isLoading: sceneLoading } = useActiveScene(campaignId);
  const { role } = useCampaignRole(campaignId);
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

  // Build assets lookup map for CanvasManager
  const assetsMap = useMemo((): Map<string, TileAsset> => {
    const map = new Map<string, TileAsset>();
    for (const asset of assets) map.set(asset.id, asset);
    return map;
  }, [assets]);

  const { emitTokenMove, emitChatSend, emitDiceRoll, emitFogReveal, emitFogHide, isConnected } =
    usePlayAreaSocket({
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
      onVisionSync: useCallback((payload: TokenVisionSyncPayload) => {
        setVisionReveals(payload.reveals);
      }, []),
      onReconnect: useCallback(() => {
        refresh();
        refreshFog();
        setVisionReveals([]);
      }, [refresh, refreshFog]),
    });

  const [hoveredToken, setHoveredToken] = useState<HoverState | null>(null);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [fogMode, setFogMode] = useState<FogToolMode>('off');
  const [visionReveals, setVisionReveals] = useState<TokenVisionReveal[]>([]);

  const isFogToolEnabled = role === 'dm';
  const isFogDrawingActive = isFogToolEnabled && fogMode !== 'off';

  const isDrawingFogRef = useRef(false);
  const fogDrawStartRef = useRef<FogVertex | null>(null);

  // selectedTokenId ref for stable closures in canvasManager callbacks
  const selectedTokenIdRef = useRef<string | null>(null);
  selectedTokenIdRef.current = selectedTokenId;

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
      const prev = selectedTokenIdRef.current;
      const next = prev === tokenId ? null : tokenId;
      canvasManager.setTokenSelected(next, prev);
      setSelectedTokenId(next);
    };

    canvasManager.onBackgroundClick = (): void => {
      const current = selectedTokenIdRef.current;
      if (current) {
        canvasManager.setTokenSelected(null, current);
        setSelectedTokenId(null);
        setHoveredToken(null);
      }
    };

    canvasManager.onTokenDragStart = (): void => {
      // Clear hover card and deselect any selected token when drag begins (PP behavior)
      setHoveredToken(null);
      const current = selectedTokenIdRef.current;
      if (current) {
        canvasManager.setTokenSelected(null, current);
        setSelectedTokenId(null);
      }
    };
  }, [canvasManager, moveToken, emitTokenMove]);

  // Sync token list to canvas whenever tokens or user/role changes
  useEffect(() => {
    if (!canvasManager || !isReady || !user || !role) return;
    canvasManager.setTokens(tokens, user.id, role);
  }, [canvasManager, isReady, tokens, user, role]);

  // Editor mode: sync tile placements to canvas
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager
      .setTilePlacements(placements, assetsMap, editorMode === 'editor')
      .catch((err: unknown) => {
        console.error('[PlayArea] Failed to sync tile placements:', err);
      });
  }, [canvasManager, isReady, placements, assetsMap, editorMode]);

  // Editor mode: toggle tile interactivity when mode changes
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setEditorMode(editorMode === 'editor');
  }, [canvasManager, isReady, editorMode]);

  // Editor mode: register tile event callbacks
  useEffect(() => {
    if (!canvasManager) return;

    canvasManager.onTileMoveEnd = (placementId, x, y): void => {
      updatePlacement(placementId, { x, y });
    };

    canvasManager.onTileSelect = (placementId): void => {
      setSelectedTilePlacementId(placementId);
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
      setSelectedTilePlacementId(null);
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
    setSelectedTilePlacementId,
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
    canvasManager.setFogRegions(fogRegions, role !== 'dm');
  }, [canvasManager, isReady, fogRegions, role]);

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setTokenVisionReveals(visionReveals);
  }, [canvasManager, isReady, visionReveals]);

  // Attach wheel listener as non-passive so preventDefault() works for zoom
  useEffect(() => {
    if (!canvasManager) return;
    const pixiCanvas = canvasManager.canvas;

    const handleWheel = (e: globalThis.WheelEvent): void => {
      e.preventDefault();
      const rect = pixiCanvas.getBoundingClientRect();
      canvasManager.zoom(-e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
    };

    pixiCanvas.addEventListener('wheel', handleWheel, { passive: false });
    return (): void => pixiCanvas.removeEventListener('wheel', handleWheel);
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

  const handleFogModeChange = useCallback(
    (mode: FogToolMode): void => {
      setFogMode(mode);
      if (mode === 'off') {
        isDrawingFogRef.current = false;
        fogDrawStartRef.current = null;
        canvasManager?.setFogBrushPreview(null);
      }
    },
    [canvasManager],
  );

  const handleFogPointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>): void => {
      if (!isFogDrawingActive || !canvasManager) return;
      isDrawingFogRef.current = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const start = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      fogDrawStartRef.current = start;
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
      if (!start) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const end = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const vertices = toRectangleVertices(start, end);
      canvasManager.setFogBrushPreview(null);

      const width = Math.abs(vertices[1].x - vertices[0].x);
      const height = Math.abs(vertices[3].y - vertices[0].y);
      if (width < 8 || height < 8) return;

      if (fogMode === 'reveal') {
        emitFogReveal(scene.id, vertices);
      } else if (fogMode === 'hide') {
        emitFogHide(scene.id, vertices);
      }
    },
    [canvasManager, emitFogHide, emitFogReveal, fogMode, isFogDrawingActive, scene?.id],
  );

  // Asset drag-drop onto the canvas (editor mode only)
  const { handleDragOver: handleCanvasDragOver, handleDrop: handleCanvasDrop } = useTileDragDrop({
    canvasManager,
    isEditorMode: editorMode === 'editor',
  });

  return (
    <div className={styles.layout}>
      <PlayAreaToolbar
        canUseFogTools={isFogToolEnabled}
        fogMode={fogMode}
        onFogModeChange={handleFogModeChange}
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
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
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
                setSelectedTilePlacementId(null);
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
          <ChatPanel
            messages={chatMessages}
            isLoading={chatLoading}
            isConnected={isConnected}
            onSend={emitChatSend}
            onDiceRoll={emitDiceRoll}
          />
        )}
        {/* Editor mode: layers panel right of canvas */}
        {editorMode === 'editor' && <LayersPanel />}
      </div>
    </div>
  );
}
