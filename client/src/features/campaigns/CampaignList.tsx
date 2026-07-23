import type { Campaign, CampaignCreatePayload, CampaignUpdatePayload } from '@vtt/shared';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CampaignForm } from './CampaignForm';
import styles from './CampaignList.module.css';
import { useCampaigns } from './hooks/useCampaigns';

function roleBadgeClass(role: Campaign['role']): string {
  if (role === 'dm') return styles.roleDm;
  if (role === 'player') return styles.rolePlayer;
  return styles.roleObserver;
}

export function CampaignList(): ReactElement {
  const navigate = useNavigate();
  const { campaigns, isLoading, error, createCampaign } = useCampaigns();
  const [showCreateForm, setShowCreateForm] = useState(false);

  async function handleCreate(payload: CampaignCreatePayload | CampaignUpdatePayload): Promise<void> {
    const campaign = await createCampaign(payload as CampaignCreatePayload);
    setShowCreateForm(false);
    navigate(`/campaigns/${campaign.id}`);
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.statusText}>Loading campaigns…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className={styles.page}>
        <CampaignForm onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Campaigns</h2>
        <button
          type="button"
          className={styles.createButton}
          onClick={() => setShowCreateForm(true)}
        >
          + New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>You have no campaigns yet.</p>
          <button
            type="button"
            className={styles.createButton}
            onClick={() => setShowCreateForm(true)}
          >
            Create your first campaign
          </button>
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {campaigns.map((campaign) => (
            <div key={campaign.id} className={styles.card}>
              <div className={styles.cardTop}>
                <h3 className={styles.cardTitle}>{campaign.name}</h3>
                <span className={`${styles.roleBadge} ${roleBadgeClass(campaign.role)}`}>
                  {campaign.role.toUpperCase()}
                </span>
              </div>
              {campaign.description && (
                <p className={styles.cardDescription}>{campaign.description}</p>
              )}
              <div className={styles.cardFooter}>
                <button
                  type="button"
                  className={styles.detailButton}
                  onClick={() => navigate(`/play/${campaign.id}`)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className={styles.settingsButton}
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  Settings
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
