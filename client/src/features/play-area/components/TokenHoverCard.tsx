import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { ReactElement, RefObject } from 'react';
import { useRef, useState } from 'react';

import type { AuraCondition, AuraType, Token, TokenUpdatePayload } from '@vtt/shared';
import {
  AURA_RADIUS_MAX,
  CONDITION_AURA_COLORS,
  PRESET_AURA_TEMPLATES,
  VISION_RADIUS_MAX,
} from '@vtt/shared';

import styles from './TokenHoverCard.module.css';

/** Approximate rendered dimensions used for clamping (matches CSS min-width + padding). */
const CARD_W = 180;
const CARD_H = 175;
const CARD_OFFSET = 14;

type PointerDirection = 'left' | 'right' | 'up' | 'down';

const DIRECTION_CLASSES: Record<PointerDirection, string> = {
  left: styles.pointerLeft,
  right: styles.pointerRight,
  up: styles.pointerUp,
  down: styles.pointerDown,
};

const TOKEN_TYPE_LABELS: Record<string, string> = {
  player: 'Player',
  npc: 'NPC',
  monster: 'Monster',
  misc: 'Misc',
};

const AURA_TYPE_LABELS: Record<AuraType, string> = {
  presence: 'Presence',
  turn: 'Turn',
  condition: 'Condition',
};

const AURA_CONDITION_LABELS: Record<AuraCondition, string> = {
  stunned: 'Stunned',
  poisoned: 'Poisoned',
  blessed: 'Blessed',
};

interface TokenHoverCardProps {
  token: Token;
  canvasX: number;
  canvasY: number;
  isSelected: boolean;
  canEditHP: boolean;
  /** Whether the DM can edit the token's vision radius. */
  canEditVisionRadius?: boolean;
  /** Whether the viewer can use quick-roll buttons. False for observers. Defaults to true. */
  canRoll?: boolean;
  onClose: () => void;
  onHPChange: (tokenId: string, hp: number) => void;
  onVisionRadiusChange?: (tokenId: string, radius: number) => void;
  onAuraChange?: (tokenId: string, payload: TokenUpdatePayload) => void;
  onQuickRoll?: (formula: string) => void;
  canvasWrapperRef: RefObject<HTMLDivElement>;
}

export function TokenHoverCard({
  token,
  canvasX,
  canvasY,
  isSelected,
  canEditHP,
  canEditVisionRadius = false,
  canRoll = true,
  onClose,
  onHPChange,
  onVisionRadiusChange,
  onAuraChange,
  onQuickRoll,
  canvasWrapperRef,
}: TokenHoverCardProps): ReactElement {
  const cardRef = useRef<HTMLDivElement>(null);
  const [editingHP, setEditingHP] = useState<string | null>(null);
  const [editingVisionRadius, setEditingVisionRadius] = useState<string | null>(null);

  useGSAP(
    () => {
      gsap.from(cardRef.current, { y: -8, opacity: 0, duration: 0.2, ease: 'power2.out' });
    },
    { scope: cardRef },
  );

  // Compute card position and pointer direction
  const wrapperW = canvasWrapperRef.current?.clientWidth ?? 800;
  const wrapperH = canvasWrapperRef.current?.clientHeight ?? 600;

  // Try horizontal placement first (left/right of token)
  let cardLeft: number;
  let cardTop: number;
  let direction: PointerDirection;

  const fitsRight = canvasX + CARD_OFFSET + CARD_W <= wrapperW - 8;
  const fitsLeft = canvasX - CARD_OFFSET - CARD_W >= 8;

  if (fitsRight) {
    cardLeft = canvasX + CARD_OFFSET;
    cardTop = Math.max(8, Math.min(canvasY - CARD_H / 2, wrapperH - CARD_H - 8));
    direction = 'left';
  } else if (fitsLeft) {
    cardLeft = canvasX - CARD_OFFSET - CARD_W;
    cardTop = Math.max(8, Math.min(canvasY - CARD_H / 2, wrapperH - CARD_H - 8));
    direction = 'right';
  } else {
    // No horizontal space — stack vertically based on canvas half
    cardLeft = Math.max(8, Math.min(canvasX - CARD_W / 2, wrapperW - CARD_W - 8));
    const inTopHalf = canvasY < wrapperH / 2;
    if (inTopHalf) {
      cardTop = canvasY + CARD_OFFSET;
      direction = 'up';
    } else {
      cardTop = canvasY - CARD_OFFSET - CARD_H;
      direction = 'down';
    }
  }

  // HP bar calculations
  const hasHP = token.hp !== null && token.maxHp !== null && (token.maxHp ?? 0) > 0;
  const hpPercent = hasHP
    ? Math.max(0, Math.min(100, ((token.hp ?? 0) / (token.maxHp ?? 1)) * 100))
    : 0;

  let hpFillClass = styles.healthy;
  if (hasHP) {
    if (hpPercent === 0) hpFillClass = styles.dead;
    else if (hpPercent < 25) hpFillClass = styles.critical;
    else if (hpPercent < 75) hpFillClass = styles.wounded;
  }

  function commitHPEdit(): void {
    if (editingHP === null) return;
    const value = parseInt(editingHP, 10);
    if (!isNaN(value) && value >= 0) {
      onHPChange(token.id, value);
    }
    setEditingHP(null);
  }

  function commitVisionRadiusEdit(): void {
    if (editingVisionRadius === null) return;
    const value = parseInt(editingVisionRadius, 10);
    if (!isNaN(value) && value >= 0) {
      onVisionRadiusChange?.(token.id, value);
    }
    setEditingVisionRadius(null);
  }

  function updateAura(payload: TokenUpdatePayload): void {
    onAuraChange?.(token.id, payload);
  }

  const canEdit = canEditHP && isSelected;

  return (
    <div
      ref={cardRef}
      className={`${styles.card} ${DIRECTION_CLASSES[direction]} ${isSelected ? styles.selected : styles.hover}`}
      style={{ left: `${cardLeft}px`, top: `${cardTop}px` }}
    >
      {isSelected && (
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          ×
        </button>
      )}

      <div className={styles.tokenHeader}>
        <div className={styles.tokenAvatar}>
          {token.iconUrl ? (
            <img
              className={styles.tokenAvatarImage}
              src={token.iconUrl}
              alt={token.name}
              draggable={false}
            />
          ) : (
            <div
              className={styles.tokenAvatarFallback}
              style={{ background: token.color }}
              aria-hidden="true"
            />
          )}
        </div>
        <div className={styles.tokenInfo}>
          <div className={styles.name}>{token.name}</div>
          <div className={styles.typeLine}>
            <span className={styles.typeBadge}>{TOKEN_TYPE_LABELS[token.type] ?? token.type}</span>
            {token.type === 'npc' && token.npcSubtype && (
              <span
                className={`${styles.typeBadge} ${
                  token.npcSubtype === 'ally' ? styles.typeBadgeAlly : styles.typeBadgeEnemy
                }`}
              >
                {token.npcSubtype === 'ally' ? 'Ally' : 'Enemy'}
              </span>
            )}
            {token.type === 'player' && token.ownerName && (
              <span className={styles.ownerName}>{token.ownerName}</span>
            )}
          </div>
        </div>
      </div>

      {hasHP && (
        <div className={styles.hpSection}>
          <div className={styles.hpBar}>
            <div className={`${styles.hpFill} ${hpFillClass}`} style={{ width: `${hpPercent}%` }} />
          </div>
          <div className={styles.hpRow}>
            {canEdit && editingHP !== null ? (
              <input
                className={styles.hpInput}
                type="number"
                min={0}
                max={token.maxHp ?? undefined}
                value={editingHP}
                autoFocus
                onChange={(e) => setEditingHP(e.target.value)}
                onBlur={commitHPEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitHPEdit();
                  if (e.key === 'Escape') setEditingHP(null);
                }}
              />
            ) : (
              <span
                className={`${styles.hpValue}${canEdit ? ` ${styles.hpEditable}` : ''}`}
                onClick={canEdit ? () => setEditingHP(String(token.hp ?? 0)) : undefined}
                title={canEdit ? 'Click to edit HP' : undefined}
              >
                {token.hp}
              </span>
            )}
            <span className={styles.hpMax}> / {token.maxHp}</span>
          </div>
        </div>
      )}

      {token.ac !== null && (
        <div className={styles.statRow}>
          <span className={styles.statLabel}>AC</span>
          <span className={styles.statValue}>{token.ac}</span>
        </div>
      )}

      {canEditVisionRadius && isSelected && (
        <div className={styles.statRow}>
          <span className={styles.statLabel}>Vision</span>
          {editingVisionRadius !== null ? (
            <input
              className={styles.hpInput}
              type="number"
              min={0}
              max={VISION_RADIUS_MAX}
              value={editingVisionRadius}
              autoFocus
              onChange={(e) => setEditingVisionRadius(e.target.value)}
              onBlur={commitVisionRadiusEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitVisionRadiusEdit();
                if (e.key === 'Escape') setEditingVisionRadius(null);
              }}
            />
          ) : (
            <span
              className={`${styles.statValue} ${styles.hpEditable}`}
              onClick={() => setEditingVisionRadius(String(token.visionRadius))}
              title="Click to edit vision radius (grid cells)"
            >
              {token.visionRadius}
            </span>
          )}
        </div>
      )}

      {canEditVisionRadius && isSelected && (
        <div className={styles.auraSection}>
          <div className={styles.auraHeader}>
            <span className={styles.statLabel}>Aura</span>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={token.auraVisible}
                onChange={(e) =>
                  updateAura({
                    auraVisible: e.target.checked,
                    auraRadius: token.auraRadius ?? 2,
                    auraColor: token.auraColor ?? PRESET_AURA_TEMPLATES.auraOfProtection.color,
                    auraType: token.auraType ?? 'presence',
                  })
                }
              />
              <span>On</span>
            </label>
          </div>
          <div className={styles.presetRow}>
            {Object.entries(PRESET_AURA_TEMPLATES).map(([key, preset]) => (
              <button
                key={key}
                className={styles.presetButton}
                type="button"
                onClick={() =>
                  updateAura({
                    auraVisible: true,
                    auraRadius: preset.radius,
                    auraColor: preset.color,
                    auraType: preset.type,
                    auraCondition: null,
                  })
                }
              >
                {key === 'auraOfProtection'
                  ? 'Protection'
                  : key === 'healingAura'
                    ? 'Healing'
                    : 'Danger'}
              </button>
            ))}
          </div>
          <div className={styles.auraGrid}>
            <label className={styles.fieldLabel}>
              <span>Radius</span>
              <input
                className={styles.compactInput}
                type="number"
                min={0}
                max={AURA_RADIUS_MAX}
                value={token.auraRadius ?? 0}
                onChange={(e) => updateAura({ auraRadius: parseInt(e.target.value, 10) || 0 })}
              />
            </label>
            <label className={styles.fieldLabel}>
              <span>Color</span>
              <input
                className={styles.colorInput}
                type="color"
                value={token.auraColor ?? PRESET_AURA_TEMPLATES.auraOfProtection.color}
                onChange={(e) => updateAura({ auraColor: e.target.value })}
              />
            </label>
            <label className={styles.fieldLabel}>
              <span>Type</span>
              <select
                className={styles.compactSelect}
                value={token.auraType ?? 'presence'}
                onChange={(e) =>
                  updateAura({
                    auraType: e.target.value as AuraType,
                    auraCondition:
                      e.target.value === 'condition' ? (token.auraCondition ?? 'stunned') : null,
                    auraColor:
                      e.target.value === 'condition'
                        ? CONDITION_AURA_COLORS[token.auraCondition ?? 'stunned']
                        : token.auraColor,
                  })
                }
              >
                {Object.entries(AURA_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {token.auraType === 'condition' && (
              <label className={styles.fieldLabel}>
                <span>Status</span>
                <select
                  className={styles.compactSelect}
                  value={token.auraCondition ?? 'stunned'}
                  onChange={(e) => {
                    const condition = e.target.value as AuraCondition;
                    updateAura({
                      auraCondition: condition,
                      auraColor: CONDITION_AURA_COLORS[condition],
                    });
                  }}
                >
                  {Object.entries(AURA_CONDITION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}

      {isSelected && canRoll && (
        <div className={styles.quickRolls}>
          <button
            className={styles.rollButton}
            onClick={() => onQuickRoll?.('d20')}
            disabled={!onQuickRoll}
            title="Roll to attack (d20)"
          >
            Attack
          </button>
          <button
            className={styles.rollButton}
            onClick={() => onQuickRoll?.('d6')}
            disabled={!onQuickRoll}
            title="Roll damage (d6)"
          >
            Damage
          </button>
        </div>
      )}
    </div>
  );
}
