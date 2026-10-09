import type { ReactElement } from 'react';
import { useState } from 'react';

import type { CampaignPlayer, Character, CharacterToken } from '@vtt/shared';
import { TOKEN_IMAGE_OPTIONS } from '@vtt/shared';

import styles from './MemberLinkControls.module.css';

interface MemberLinkControlsProps {
  member: CampaignPlayer;
  isDm: boolean;
  /** All campaign members — used to label character owners in the DM view */
  members: CampaignPlayer[];
  characters: Character[];
  links: CharacterToken[];
  onUnlink: (linkId: string) => Promise<void>;
  onAssign: (characterId: string, userId: string) => Promise<void>;
  onSetPortrait: (characterId: string, url: string) => Promise<void>;
}

/**
 * Inline character controls for one campaign member row.
 *
 * Selecting a character assigns it to the member and auto-links it to their
 * player token on the server — the token is implied, so there is no separate
 * token picker. Selecting "no character" unlinks. Templates clone on assign.
 */
export function MemberLinkControls({
  member,
  isDm,
  members,
  characters,
  links,
  onUnlink,
  onAssign,
  onSetPortrait,
}: MemberLinkControlsProps): ReactElement {
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const linkByCharacter = new Map(links.map((l) => [l.characterId, l]));

  const ownedCharacters = characters.filter((c) => c.userId === member.userId);
  const character: Character | undefined =
    ownedCharacters.find((c) => linkByCharacter.has(c.id)) ?? ownedCharacters[0];
  const existingLink = character ? linkByCharacter.get(character.id) : undefined;

  const characterOptions = isDm
    ? characters
    : characters.filter((c) => c.userId === member.userId || c.campaignId === null);

  async function handleCharacterChange(charId: string): Promise<void> {
    setActionError(null);
    try {
      if (charId === '') {
        if (existingLink) await onUnlink(existingLink.id);
        return;
      }
      // Assignment auto-links the member's player token server-side
      await onAssign(charId, member.userId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign character');
    }
  }

  async function handlePortraitPick(url: string): Promise<void> {
    if (!character) return;
    setActionError(null);
    setIsPickerOpen(false);
    try {
      await onSetPortrait(character.id, url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to set token image');
    }
  }

  return (
    <div className={styles.controls}>
      <select
        className={styles.select}
        value={character?.id ?? ''}
        onChange={(e) => handleCharacterChange(e.target.value)}
        aria-label={`Select character for ${member.username}`}
      >
        <option value="">— No character —</option>
        {characterOptions.map((c) => {
          const owner = members.find((m) => m.userId === c.userId);
          let suffix = '';
          if (c.campaignId === null) {
            suffix = ' (template)';
          } else if (isDm && owner && owner.userId !== member.userId) {
            suffix = ` (${owner.username})`;
          }
          return (
            <option key={c.id} value={c.id}>
              {c.name}
              {suffix}
            </option>
          );
        })}
      </select>

      <div className={styles.imageWrap}>
        <button
          type="button"
          className={styles.portraitButton}
          disabled={!character || character.campaignId === null}
          title={
            character?.campaignId === null
              ? 'Link a token first to customize this template'
              : 'Choose token image'
          }
          onClick={() => setIsPickerOpen(!isPickerOpen)}
          aria-label={`Choose token image for ${member.username}`}
        >
          {character?.portraitUrl ? (
            <img src={character.portraitUrl} alt="" className={styles.portraitThumb} />
          ) : (
            <span className={styles.portraitPlaceholder}>＋</span>
          )}
        </button>
        {isPickerOpen && character && (
          <div className={styles.imagePicker} role="listbox" aria-label="Token images">
            {TOKEN_IMAGE_OPTIONS.map((url) => (
              <button
                key={url}
                type="button"
                className={styles.imageOption}
                onClick={() => handlePortraitPick(url)}
                aria-label={`Token image ${url}`}
              >
                <img src={url} alt="" className={styles.portraitThumb} />
              </button>
            ))}
          </div>
        )}
      </div>

      {character && existingLink && (
        <span className={styles.linkedBadge} title="Linked to this player's token">
          ● linked
        </span>
      )}

      {actionError && (
        <span className={styles.errorText} role="alert">
          {actionError}
        </span>
      )}
    </div>
  );
}
