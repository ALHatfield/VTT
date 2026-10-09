// useLightEditor — Phase 5G
// Wires light data, the Pixi LightOverlay, palette drops, and the Lights tab UI state.
import type { DragEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { LightEmitterType, LightSource, LightSourceCreatePayload } from '@vtt/shared';

import type { CanvasManager } from '../../play-area/canvas/CanvasManager';
import { LightOverlay } from '../canvas/LightOverlay';
import type { LightsSectionProps } from '../components/LightsSection';
import type { LightPoint } from '../utils/light-placement';
import {
    LIGHT_DRAG_MIME,
    findLightAt,
    parseLightPresetDrag,
    snapLightPoint,
} from '../utils/light-placement';
import { useLightSources } from './useLightSources';
import { useSceneAtmosphere } from './useSceneAtmosphere';
import { useUndoableCrud } from './useUndoableCrud';
import type { UndoHistory } from './useUndoRedo';

/** Screen-pixel grab radius around a light marker. */
const LIGHT_HIT_RADIUS_PX = 10;
/** Screen pixels the pointer must travel before a press becomes a drag. */
const LIGHT_DRAG_THRESHOLD_PX = 4;

interface LightDrag {
  lightId: string;
  startClientX: number;
  startClientY: number;
  /** Grab point relative to the light centre, in world pixels. */
  offset: LightPoint;
  point: LightPoint;
  moved: boolean;
}

interface UseLightEditorOptions {
  campaignId: string | undefined;
  sceneId: string | undefined;
  canvasManager: CanvasManager | null;
  isReady: boolean;
  isEditorMode: boolean;
  isDm: boolean;
  cellSize: number;
  history: UndoHistory;
}

interface UseLightEditorReturn {
  /** Props for the LayersPanel lights tab; null for non-DMs. */
  sectionProps: LightsSectionProps | null;
  handleDragOver: (e: DragEvent<HTMLElement>) => void;
  handleDrop: (e: DragEvent<HTMLElement>) => void;
  refreshLights: () => Promise<void>;
}

function toLightCreatePayload({
  emitterType,
  x,
  y,
  radius,
  color,
  intensity,
  falloff,
  animationMode,
  alwaysVisible,
}: LightSource): LightSourceCreatePayload {
  return { emitterType, x, y, radius, color, intensity, falloff, animationMode, alwaysVisible };
}

export function useLightEditor({
  campaignId,
  sceneId,
  canvasManager,
  isReady,
  isEditorMode,
  isDm,
  cellSize,
  history,
}: UseLightEditorOptions): UseLightEditorReturn {
  const sources = useLightSources(campaignId, sceneId, isDm);
  const { lights, error, refresh } = sources;
  const {
    create: createLight,
    update: updateLight,
    remove: deleteLight,
  } = useUndoableCrud({
    history,
    items: lights,
    kind: 'light',
    create: sources.createLight,
    update: sources.updateLight,
    remove: sources.deleteLight,
    toCreatePayload: toLightCreatePayload,
  });
  const atmosphere = useSceneAtmosphere(campaignId, sceneId, isDm);

  const [selectedLightId, setSelectedLightId] = useState<string | null>(null);
  const [lightsVisible, setLightsVisible] = useState(true);
  const overlayRef = useRef<LightOverlay | null>(null);

  const isAuthoring = isEditorMode && isDm;
  const activeSelectedId = lights.some((l) => l.id === selectedLightId) ? selectedLightId : null;

  // Mount the overlay on the Foreground layer for the lifetime of the canvas
  useEffect(() => {
    if (!canvasManager || !isReady) return;
    const overlay = new LightOverlay();
    canvasManager.foregroundLayer.addChild(overlay);
    overlayRef.current = overlay;
    return () => {
      overlayRef.current = null;
      // The canvas may already have torn down the stage (and this overlay with it)
      if (!overlay.destroyed) {
        overlay.removeFromParent();
        overlay.destroy({ children: true });
      }
    };
  }, [canvasManager, isReady]);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.visible = isAuthoring && lightsVisible;
    overlay.setLights(lights, activeSelectedId, cellSize);
  }, [isAuthoring, lightsVisible, lights, activeSelectedId, cellSize, canvasManager, isReady]);

  useEffect(() => {
    if (!isAuthoring) setSelectedLightId(null);
  }, [isAuthoring]);

  // Read by the drag listeners without re-binding them mid-drag
  const lightsRef = useRef(lights);
  lightsRef.current = lights;
  const updateLightRef = useRef(updateLight);
  updateLightRef.current = updateLight;

  // Drag existing lights on the canvas. Capture on the canvas container so Pixi never
  // sees the press (no marquee); tool overlays above the canvas still take precedence.
  useEffect(() => {
    if (!canvasManager || !isReady || !isAuthoring || !lightsVisible) return;
    const container = canvasManager.canvas.parentElement;
    if (!container) return;
    let drag: LightDrag | null = null;

    const toWorld = (clientX: number, clientY: number): LightPoint => {
      const rect = canvasManager.canvas.getBoundingClientRect();
      return canvasManager.screenToWorld(clientX - rect.left, clientY - rect.top);
    };

    const drawLights = (preview: LightDrag | null): void => {
      const current = lightsRef.current;
      overlayRef.current?.setLights(
        preview
          ? current.map((l) => (l.id === preview.lightId ? { ...l, ...preview.point } : l))
          : current,
        preview?.lightId ?? null,
        cellSize,
      );
    };

    const handleMove = (e: PointerEvent): void => {
      if (!drag) return;
      const travel = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY);
      if (!drag.moved && travel < LIGHT_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      const world = toWorld(e.clientX, e.clientY);
      drag.point = snapLightPoint(
        { x: world.x - drag.offset.x, y: world.y - drag.offset.y },
        cellSize,
        e.altKey,
      );
      drawLights(drag);
    };

    const endDrag = (commit: boolean): void => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleCancel);
      const finished = drag;
      drag = null;
      if (!finished?.moved) return;
      if (commit) updateLightRef.current(finished.lightId, finished.point);
      else drawLights(null);
    };
    const handleUp = (): void => endDrag(true);
    const handleCancel = (): void => endDrag(false);

    const handleDown = (e: PointerEvent): void => {
      if (e.button !== 0 || drag) return;
      const world = toWorld(e.clientX, e.clientY);
      const edge = toWorld(e.clientX + LIGHT_HIT_RADIUS_PX, e.clientY);
      const light = findLightAt(lightsRef.current, world, edge.x - world.x);
      if (!light) return;
      e.preventDefault();
      e.stopPropagation();
      setSelectedLightId(light.id);
      drag = {
        lightId: light.id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        offset: { x: world.x - light.x, y: world.y - light.y },
        point: { x: light.x, y: light.y },
        moved: false,
      };
      window.addEventListener('pointermove', handleMove);
      window.addEventListener('pointerup', handleUp);
      window.addEventListener('pointercancel', handleCancel);
    };

    container.addEventListener('pointerdown', handleDown, true);
    return () => {
      container.removeEventListener('pointerdown', handleDown, true);
      endDrag(false);
    };
  }, [canvasManager, isReady, isAuthoring, lightsVisible, cellSize]);

  const placeLight = useCallback(
    (emitterType: LightEmitterType, point: LightPoint, bypassSnap: boolean): void => {
      const { x, y } = snapLightPoint(point, cellSize, bypassSnap);
      setLightsVisible(true);
      void createLight({ emitterType, x, y }).then((created) => {
        if (created) setSelectedLightId(created.id);
      });
    },
    [cellSize, createLight],
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isAuthoring || !e.dataTransfer.types.includes(LIGHT_DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    [isAuthoring],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>): void => {
      if (!isAuthoring || !canvasManager) return;
      const emitterType = parseLightPresetDrag(e.dataTransfer.getData(LIGHT_DRAG_MIME));
      if (!emitterType) return;
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      const world = canvasManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      placeLight(emitterType, world, e.altKey);
    },
    [isAuthoring, canvasManager, placeLight],
  );

  const handleAddPreset = useCallback(
    (emitterType: LightEmitterType): void => {
      if (!isAuthoring || !canvasManager) return;
      const view = canvasManager.getViewportBounds();
      placeLight(emitterType, { x: view.x + view.width / 2, y: view.y + view.height / 2 }, false);
    },
    [isAuthoring, canvasManager, placeLight],
  );

  const handleDeleteLight = useCallback(
    (lightId: string): void => {
      if (lightId === selectedLightId) setSelectedLightId(null);
      void deleteLight(lightId);
    },
    [deleteLight, selectedLightId],
  );

  const toggleVisibility = useCallback((): void => setLightsVisible((v) => !v), []);

  const { weatherPreset, setWeatherPreset } = atmosphere;
  const sectionError = error ?? atmosphere.error;

  const sectionProps = useMemo(
    (): LightsSectionProps | null =>
      isDm
        ? {
            lights,
            selectedLightId: activeSelectedId,
            lightsVisible,
            error: sectionError,
            weatherPreset,
            onToggleVisibility: toggleVisibility,
            onAddPreset: handleAddPreset,
            onSelectLight: setSelectedLightId,
            onDeleteLight: handleDeleteLight,
            onUpdateLight: updateLight,
            onWeatherPresetChange: (preset) => void setWeatherPreset(preset),
          }
        : null,
    [
      isDm,
      lights,
      activeSelectedId,
      lightsVisible,
      sectionError,
      weatherPreset,
      toggleVisibility,
      handleAddPreset,
      handleDeleteLight,
      updateLight,
      setWeatherPreset,
    ],
  );

  return { sectionProps, handleDragOver, handleDrop, refreshLights: refresh };
}
