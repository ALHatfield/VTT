// Door state service — Phase PM3
// Play-area may only flip `isOpen` on existing doors; all other wall edits belong to the editor.
import { prisma } from '../../shared/db/prisma.js';

export interface DoorRecord {
  id: string;
  isOpen: boolean;
}

/** Find a door segment on the scene; null when missing or the wall is not a door. */
export async function findDoor(
  campaignId: string,
  sceneId: string,
  wallId: string,
): Promise<DoorRecord | null> {
  return prisma.wallSegment.findFirst({
    where: { id: wallId, campaignId, sceneId, isDoor: true },
    select: { id: true, isOpen: true },
  });
}

/**
 * Flip a door's open state. The update is conditional on the state we read so two
 * simultaneous toggles cannot both "open" the same door. Returns null when the door
 * vanished or changed underneath us.
 */
export async function toggleDoor(door: DoorRecord): Promise<boolean | null> {
  const isOpen = !door.isOpen;
  const { count } = await prisma.wallSegment.updateMany({
    where: { id: door.id, isDoor: true, isOpen: door.isOpen },
    data: { isOpen },
  });
  return count > 0 ? isOpen : null;
}
