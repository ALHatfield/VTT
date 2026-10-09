// resolve-display-scene — Phase 5H
// Decides which scene the canvas and editor hooks operate on. In editor mode
// the DM edits the selected library scene; play mode always follows the
// campaign's active scene.
import type { SceneSummary } from '@vtt/shared';

/** The minimal scene shape the canvas needs — satisfied by both Scene and SceneSummary. */
export interface DisplayScene {
  id: string;
  campaignId: string;
  name: string;
  imageUrl: string | null;
  width: number;
  height: number;
  cellSize: number;
  isActive: boolean;
}

export interface ResolveDisplaySceneOptions {
  isEditorMode: boolean;
  isDm: boolean;
  scenes: readonly SceneSummary[];
  editedSceneId: string | null;
  activeScene: DisplayScene | null;
}

export function resolveDisplayScene({
  isEditorMode,
  isDm,
  scenes,
  editedSceneId,
  activeScene,
}: ResolveDisplaySceneOptions): DisplayScene | null {
  if (!isEditorMode || !isDm) return activeScene;
  const edited = editedSceneId ? scenes.find((s) => s.id === editedSceneId) : undefined;
  return edited ?? activeScene;
}
