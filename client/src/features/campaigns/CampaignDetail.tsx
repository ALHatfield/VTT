import type { Campaign, CampaignPlayer, CampaignUpdatePayload } from '@vtt/shared';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import styles from './CampaignDetail.module.css';
import { CampaignForm } from './CampaignForm';
import { useCampaignActions } from './hooks/useCampaignActions';
import { useCampaignDetail } from './hooks/useCampaignDetail';
import { useMemberActions } from './hooks/useMemberActions';

export function CampaignDetail(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { campaign, isLoading, error, refresh } = useCampaignDetail(id!);
  const { updateCampaign, deleteCampaign } = useCampaignActions();
  const { inviteMember, removeMember, leaveCampaign } = useMemberActions();

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'player' | 'observer'>('player');
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  const isDm = campaign?.role === 'dm';

  async function handleUpdate(payload: Campaign | CampaignUpdatePayload): Promise<void> {
    await updateCampaign(id!, payload as CampaignUpdatePayload);
    setIsEditing(false);
  }

  async function handleDelete(): Promise<void> {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      await deleteCampaign(id!);
      navigate('/campaigns');
    } catch {
      setIsDeleting(false);
    }
  }

  async function handleInvite(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setInviteError(null);
    setIsInviting(true);
    try {
      await inviteMember(id!, inviteEmail, inviteRole);
      setInviteEmail('');
      refresh();
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemoveMember(member: CampaignPlayer): Promise<void> {
    if (!confirm(`Remove ${member.username} from the campaign?`)) return;
    setRemoveError(null);
    setRemovingUserId(member.userId);
    try {
      await removeMember(id!, member.userId);
      refresh();
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setRemovingUserId(null);
    }
  }

  async function handleLeave(): Promise<void> {
    if (!confirm('Leave this campaign? You will lose access immediately.')) return;
    setLeaveError(null);
    setIsLeaving(true);
    try {
      await leaveCampaign(id!);
      navigate('/campaigns');
    } catch (err) {
      setLeaveError(err instanceof Error ? err.message : 'Failed to leave campaign');
      setIsLeaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className={styles.page}>
        <p className={styles.statusText}>Loading campaign…</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className={styles.page}>
        <p className={styles.errorText}>{error ?? 'Campaign not found'}</p>
        <button type="button" className={styles.backButton} onClick={() => navigate('/campaigns')}>
          ← Back to Campaigns
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={styles.page}>
        <CampaignForm
          existing={campaign}
          onSubmit={handleUpdate}
          onCancel={() => setIsEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/campaigns')}>
          ← Campaigns
        </button>
        {isDm && (
          <div className={styles.dmActions}>
            <button
              type="button"
              className={styles.editButton}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting…' : 'Delete Campaign'}
            </button>
          </div>
        )}
      </div>

      <div className={styles.titleRow}>
        <h1 className={styles.title}>{campaign.name}</h1>
        <span className={`${styles.roleBadge} ${styles[`role_${campaign.role}`]}`}>
          {campaign.role.toUpperCase()}
        </span>
      </div>

      {campaign.description && (
        <p className={styles.description}>{campaign.description}</p>
      )}

      <section className={styles.membersSection}>
        <h2 className={styles.sectionTitle}>Members</h2>
        {removeError && <p className={styles.inviteError}>{removeError}</p>}
        <div className={styles.memberList}>
          {campaign.members.map((member) => (
            <div key={member.id} className={styles.memberRow}>
              <span className={styles.memberName}>{member.username}</span>
              <span className={`${styles.memberRole} ${styles[`role_${member.role}`]}`}>
                {member.role.toUpperCase()}
              </span>
              {isDm && member.role !== 'dm' && (
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveMember(member)}
                  disabled={removingUserId === member.userId}
                >
                  {removingUserId === member.userId ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
          ))}
        </div>

        {isDm && (
          <form className={styles.inviteForm} onSubmit={handleInvite}>
            <h3 className={styles.inviteTitle}>Invite Member</h3>
            {inviteError && <p className={styles.inviteError}>{inviteError}</p>}
            <div className={styles.inviteFields}>
              <input
                type="email"
                className={styles.inviteInput}
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
              <select
                className={styles.inviteSelect}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'player' | 'observer')}
              >
                <option value="player">Player</option>
                <option value="observer">Observer</option>
              </select>
              <button type="submit" className={styles.inviteButton} disabled={isInviting}>
                {isInviting ? 'Inviting…' : 'Invite'}
              </button>
            </div>
          </form>
        )}

        {!isDm && (
          <div className={styles.leaveSection}>
            {leaveError && <p className={styles.inviteError}>{leaveError}</p>}
            <button
              type="button"
              className={styles.leaveButton}
              onClick={handleLeave}
              disabled={isLeaving}
            >
              {isLeaving ? 'Leaving…' : 'Leave Campaign'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
