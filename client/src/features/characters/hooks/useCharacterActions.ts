import type { Character, CharacterCreatePayload, CharacterUpdatePayload } from '@vtt/shared';
import { useCallback } from 'react';

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'Request failed');
  }

  return body;
}

interface UseCharacterActionsResult {
  createCharacter: (campaignId: string, payload: CharacterCreatePayload) => Promise<Character>;
  updateCharacter: (
    campaignId: string,
    characterId: string,
    payload: CharacterUpdatePayload,
  ) => Promise<Character>;
  updateHp: (campaignId: string, characterId: string, hp: number) => Promise<Character>;
  deleteCharacter: (campaignId: string, characterId: string) => Promise<void>;
}

export function useCharacterActions(): UseCharacterActionsResult {
  const createCharacter = useCallback(
    async (campaignId: string, payload: CharacterCreatePayload): Promise<Character> => {
      const body = await apiFetch<{ data: Character }>(
        `/api/campaigns/${campaignId}/characters`,
        { method: 'POST', body: JSON.stringify(payload) },
      );
      return body.data;
    },
    [],
  );

  const updateCharacter = useCallback(
    async (
      campaignId: string,
      characterId: string,
      payload: CharacterUpdatePayload,
    ): Promise<Character> => {
      const body = await apiFetch<{ data: Character }>(
        `/api/campaigns/${campaignId}/characters/${characterId}`,
        { method: 'PUT', body: JSON.stringify(payload) },
      );
      return body.data;
    },
    [],
  );

  const updateHp = useCallback(
    async (campaignId: string, characterId: string, hp: number): Promise<Character> => {
      const body = await apiFetch<{ data: Character }>(
        `/api/campaigns/${campaignId}/characters/${characterId}/hp`,
        { method: 'PATCH', body: JSON.stringify({ hp }) },
      );
      return body.data;
    },
    [],
  );

  const deleteCharacter = useCallback(
    async (campaignId: string, characterId: string): Promise<void> => {
      await apiFetch(`/api/campaigns/${campaignId}/characters/${characterId}`, {
        method: 'DELETE',
      });
    },
    [],
  );

  return { createCharacter, updateCharacter, updateHp, deleteCharacter };
}
