// useTileAssets — Phase 5A
// Fetches and manages tile assets for a campaign
import { useCallback, useEffect, useState } from 'react';

import type { AssetCategory, TileAsset } from '@vtt/shared';

interface UseTileAssetsReturn {
  assets: TileAsset[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
  uploadAsset: (file: File, category: AssetCategory) => Promise<TileAsset>;
  deleteAsset: (assetId: string) => Promise<void>;
}

export function useTileAssets(
  campaignId: string | undefined,
  category?: AssetCategory,
): UseTileAssetsReturn {
  const [assets, setAssets] = useState<TileAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssets = useCallback(async (): Promise<void> => {
    if (!campaignId) return;
    setIsLoading(true);
    setError(null);
    try {
      const url = `/api/campaigns/${campaignId}/assets${category ? `?category=${category}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { data: TileAsset[] };
      setAssets(body.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load assets';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, category]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  const uploadAsset = useCallback(
    async (file: File, assetCategory: AssetCategory): Promise<TileAsset> => {
      if (!campaignId) throw new Error('No campaign ID');

      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', assetCategory);

      const res = await fetch(`/api/campaigns/${campaignId}/assets`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        throw new Error(body.error?.message ?? `Upload failed: HTTP ${res.status}`);
      }

      const body = (await res.json()) as { data: TileAsset };
      const newAsset = body.data;
      // Only prepend to local list if it matches the active category filter
      if (!category || newAsset.category === category) {
        setAssets((prev) => [newAsset, ...prev]);
      }
      return newAsset;
    },
    [campaignId],
  );

  const deleteAsset = useCallback(
    async (assetId: string): Promise<void> => {
      if (!campaignId) throw new Error('No campaign ID');

      const res = await fetch(`/api/campaigns/${campaignId}/assets/${assetId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok && res.status !== 404) {
        throw new Error(`Delete failed: HTTP ${res.status}`);
      }

      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    },
    [campaignId],
  );

  return { assets, isLoading, error, refresh: fetchAssets, uploadAsset, deleteAsset };
}
