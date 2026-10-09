// useLineOfSight — Phase PM3
// Holds the server's role-gated LOS polygons + doors for the active scene and pushes them to
// the canvas. Polygons only apply to reveals the viewer already has (see resolveActiveVision).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
    DoorState,
    DoorToggledPayload,
    VisibilityPolygon,
    VisionUpdatedPayload,
} from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';

interface UseLineOfSightOptions {
  campaignId: string | undefined;
  sceneId: string | undefined;
  canvasManager: CanvasManager | null;
  isReady: boolean;
  /** DMs and players may select and toggle doors; observers may not. */
  canToggleDoors: boolean;
  /** DM "player view" preview: drop areas the party cannot see (e.g. lights behind walls). */
  partyViewOnly: boolean;
  /** DM view: every light glows regardless of party sight. */
  canSeeAllLights: boolean;
  /** Players and the DM player-view preview: enemies out of party sight are not drawn. */
  hideUnseenEnemies: boolean;
}

interface UseLineOfSightReturn {
  /** Lights whose glow the viewer may see; null means every light (DM view). */
  visibleLightIds: ReadonlySet<string> | null;
  /** Enemy tokens the viewer may see; null means every enemy (DM view). */
  visibleEnemyTokenIds: ReadonlySet<string> | null;
  handleVisionUpdated: (payload: VisionUpdatedPayload) => void;
  /**
   * Apply polygons buffered from the last `vision:updated`. Call in the same handler that
   * applies the matching token vision sync so reveals and polygons render together —
   * otherwise a moved reveal could briefly draw as a full circle through walls.
   */
  applyPendingPolygons: () => void;
  handleDoorToggled: (payload: DoorToggledPayload) => void;
  /** The selected door, or null when none is selected or it is no longer visible. */
  selectedDoor: DoorState | null;
  /** Select a door, or deselect it when it is already selected. */
  handleDoorClick: (wallId: string) => void;
  clearDoorSelection: () => void;
  reset: () => void;
}

interface SceneScoped<T> {
  sceneId: string | null;
  items: T[];
}

const NONE: never[] = [];
const EMPTY: SceneScoped<never> = { sceneId: null, items: NONE };

export function useLineOfSight({
  campaignId,
  sceneId,
  canvasManager,
  isReady,
  canToggleDoors,
  partyViewOnly,
  canSeeAllLights,
  hideUnseenEnemies,
}: UseLineOfSightOptions): UseLineOfSightReturn {
  // Stored with their scene so a payload that arrives before the scene loads is kept,
  // while a previous scene's geometry is never drawn on the current one.
  const [polygons, setPolygons] = useState<SceneScoped<VisibilityPolygon>>(EMPTY);
  const [doors, setDoors] = useState<SceneScoped<DoorState>>(EMPTY);
  const [seenEnemies, setSeenEnemies] = useState<SceneScoped<string>>(EMPTY);
  const [selectedDoorId, setSelectedDoorId] = useState<string | null>(null);
  const pendingRef = useRef<{
    polygons: SceneScoped<VisibilityPolygon>;
    seenEnemies: SceneScoped<string>;
  } | null>(null);

  const reset = useCallback((): void => {
    pendingRef.current = null;
    setPolygons(EMPTY);
    setDoors(EMPTY);
    setSeenEnemies(EMPTY);
    setSelectedDoorId(null);
  }, []);

  useEffect(() => {
    reset();
  }, [campaignId, reset]);

  const handleVisionUpdated = useCallback(
    (payload: VisionUpdatedPayload): void => {
      if (payload.campaignId !== campaignId) return;
      pendingRef.current = {
        polygons: { sceneId: payload.sceneId, items: payload.polygons },
        seenEnemies: { sceneId: payload.sceneId, items: payload.visibleEnemyTokenIds },
      };
      setDoors({ sceneId: payload.sceneId, items: payload.doors });
    },
    [campaignId],
  );

  const applyPendingPolygons = useCallback((): void => {
    const pending = pendingRef.current;
    if (pending === null) return;
    pendingRef.current = null;
    setPolygons(pending.polygons);
    // Keep the previous state when unchanged so the canvas doesn't refresh every token
    setSeenEnemies((prev) =>
      prev.sceneId === pending.seenEnemies.sceneId &&
      prev.items.length === pending.seenEnemies.items.length &&
      prev.items.every((id, i) => id === pending.seenEnemies.items[i])
        ? prev
        : pending.seenEnemies,
    );
  }, []);

  // Instant marker feedback; the follow-up vision:updated carries the recomputed polygons
  const handleDoorToggled = useCallback(
    (payload: DoorToggledPayload): void => {
      if (payload.campaignId !== campaignId) return;
      setDoors((prev) =>
        prev.sceneId !== payload.sceneId
          ? prev
          : {
              ...prev,
              items: prev.items.map((door) =>
                door.id === payload.wallId ? { ...door, isOpen: payload.isOpen } : door,
              ),
            },
      );
    },
    [campaignId],
  );

  const scenePolygons = useMemo((): VisibilityPolygon[] => {
    if (polygons.sceneId !== sceneId) return NONE;
    return partyViewOnly ? polygons.items.filter((p) => p.partyVisible) : polygons.items;
  }, [polygons, sceneId, partyViewOnly]);
  const sceneDoors = doors.sceneId === sceneId ? doors.items : NONE;

  const handleDoorClick = useCallback((wallId: string): void => {
    setSelectedDoorId((prev) => (prev === wallId ? null : wallId));
  }, []);

  const clearDoorSelection = useCallback((): void => {
    setSelectedDoorId(null);
  }, []);

  // Derived so a door that leaves the viewer's list (scene change, lost sight) deselects itself
  const selectedDoor = useMemo(
    (): DoorState | null =>
      canToggleDoors ? (sceneDoors.find((door) => door.id === selectedDoorId) ?? null) : null,
    [canToggleDoors, sceneDoors, selectedDoorId],
  );

  // Forget a vanished door so it doesn't reselect itself when it comes back into view
  useEffect(() => {
    if (selectedDoorId !== null && selectedDoor === null) setSelectedDoorId(null);
  }, [selectedDoorId, selectedDoor]);

  // Players only receive party-visible lights, so the lit set doubles as the glow filter.
  const visibleLightIds = useMemo(
    (): ReadonlySet<string> | null =>
      canSeeAllLights
        ? null
        : new Set(scenePolygons.filter((p) => p.source === 'light').map((p) => p.emitterId)),
    [canSeeAllLights, scenePolygons],
  );

  // Fails closed: until this scene's sight data arrives, no enemy is drawn.
  const visibleEnemyTokenIds = useMemo(
    (): ReadonlySet<string> | null =>
      hideUnseenEnemies
        ? new Set(seenEnemies.sceneId === sceneId ? seenEnemies.items : NONE)
        : null,
    [hideUnseenEnemies, seenEnemies, sceneId],
  );

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setVisibilityPolygons(scenePolygons);
  }, [canvasManager, isReady, scenePolygons]);

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setDoors(sceneDoors, canToggleDoors);
  }, [canvasManager, isReady, sceneDoors, canToggleDoors]);

  useEffect(() => {
    if (!canvasManager || !isReady) return;
    canvasManager.setSelectedDoor(selectedDoor?.id ?? null);
  }, [canvasManager, isReady, selectedDoor]);

  return {
    visibleLightIds,
    visibleEnemyTokenIds,
    handleVisionUpdated,
    applyPendingPolygons,
    handleDoorToggled,
    selectedDoor,
    handleDoorClick,
    clearDoorSelection,
    reset,
  };
}
