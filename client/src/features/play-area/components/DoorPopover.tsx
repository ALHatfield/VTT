// DoorPopover — floating Open/Close control anchored to the selected door.
// Follows the door through pans and zooms; E toggles, Escape deselects.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { DoorState, FogVertex } from '@vtt/shared';

import type { CanvasManager } from '../canvas/CanvasManager';

import styles from './DoorPopover.module.css';

export const DOOR_TOGGLE_KEY = 'e';

interface DoorPopoverProps {
  door: DoorState;
  canvasManager: CanvasManager;
  onToggle: () => void;
  onClose: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function DoorPopover({
  door,
  canvasManager,
  onToggle,
  onClose,
}: DoorPopoverProps): ReactElement {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<FogVertex>(() =>
    canvasManager.worldToScreen((door.x1 + door.x2) / 2, (door.y1 + door.y2) / 2),
  );

  useGSAP(
    () => {
      gsap.from(popoverRef.current, { opacity: 0, duration: 0.15, ease: 'power2.out' });
    },
    { scope: popoverRef },
  );

  useEffect(() => {
    const midX = (door.x1 + door.x2) / 2;
    const midY = (door.y1 + door.y2) / 2;
    const update = (): void => setAnchor(canvasManager.worldToScreen(midX, midY));
    update();
    canvasManager.onViewportChange = update;
    return (): void => {
      canvasManager.onViewportChange = undefined;
    };
  }, [canvasManager, door.x1, door.y1, door.x2, door.y2]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key.toLowerCase() === DOOR_TOGGLE_KEY && !e.repeat) {
        e.preventDefault();
        onToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return (): void => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle, onClose]);

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={{ left: anchor.x, top: anchor.y }}
      role="dialog"
      aria-label="Door"
    >
      <span className={styles.state}>Door · {door.isOpen ? 'Open' : 'Closed'}</span>
      <button type="button" className={styles.toggle} onClick={onToggle}>
        {door.isOpen ? 'Close' : 'Open'}
        <kbd className={styles.key}>{DOOR_TOGGLE_KEY.toUpperCase()}</kbd>
      </button>
    </div>
  );
}
