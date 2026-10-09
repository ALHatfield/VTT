import type { Campaign, CampaignPlayer, GameSystem, GameSystemRules } from '@vtt/shared';
import { DEFAULT_GAME_SYSTEM, getGameSystemRules } from '@vtt/shared';
import type { ReactElement, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useParams } from 'react-router-dom';

/** Campaign detail shape served by GET /api/campaigns/:id */
export interface CampaignDetailData extends Campaign {
  members: CampaignPlayer[];
}

interface CampaignContextValue {
  campaignId: string;
  campaign: CampaignDetailData | null;
  /** Falls back to the default system while the campaign is loading */
  gameSystem: GameSystem;
  /** Rules implementation for the campaign's game system */
  rules: GameSystemRules;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

const CampaignContext = createContext<CampaignContextValue | null>(null);

interface CampaignProviderProps {
  campaignId: string;
  children: ReactNode;
}

export function CampaignProvider({ campaignId, children }: CampaignProviderProps): ReactElement {
  const [campaign, setCampaign] = useState<CampaignDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchCampaign(): Promise<void> {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, {
          credentials: 'include',
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error?.message ?? 'Failed to load campaign');
        }

        if (!cancelled) {
          setCampaign(body.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load campaign');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchCampaign();

    return () => {
      cancelled = true;
    };
  }, [campaignId, tick]);

  const value = useMemo<CampaignContextValue>(() => {
    const gameSystem = campaign?.gameSystem ?? DEFAULT_GAME_SYSTEM;
    return {
      campaignId,
      campaign,
      gameSystem,
      rules: getGameSystemRules(gameSystem),
      isLoading,
      error,
      refresh,
    };
  }, [campaignId, campaign, isLoading, error, refresh]);

  return <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>;
}

/** Read the current campaign scope — must be used inside a CampaignProvider */
export function useCampaign(): CampaignContextValue {
  const context = useContext(CampaignContext);
  if (!context) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
}

interface CampaignScopeProps {
  /** Route param that carries the campaign id (defaults to "id") */
  paramName?: 'id' | 'campaignId';
}

/** Layout route that wraps child routes in a CampaignProvider */
export function CampaignScope({ paramName = 'id' }: CampaignScopeProps): ReactElement {
  const params = useParams();
  const campaignId = params[paramName];

  if (!campaignId) {
    throw new Error(`CampaignScope: missing route param "${paramName}"`);
  }

  return (
    <CampaignProvider campaignId={campaignId}>
      <Outlet />
    </CampaignProvider>
  );
}
