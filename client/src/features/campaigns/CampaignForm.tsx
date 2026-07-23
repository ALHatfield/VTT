import type { Campaign, CampaignCreatePayload, CampaignUpdatePayload } from '@vtt/shared';
import type { FormEvent, ReactElement } from 'react';
import { useState } from 'react';

import styles from './CampaignForm.module.css';

interface CampaignFormProps {
  /** Existing campaign to edit — omit for create mode */
  existing?: Campaign;
  onSubmit: (payload: CampaignCreatePayload | CampaignUpdatePayload) => Promise<void>;
  onCancel: () => void;
}

export function CampaignForm({ existing, onSubmit, onCancel }: CampaignFormProps): ReactElement {
  const [name, setName] = useState(existing?.name ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = Boolean(existing);

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Campaign name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        // In edit mode, empty description sends null to clear the field.
        // In create mode, empty description is omitted (undefined).
        description: isEditMode
          ? description.trim() || null
          : description.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.title}>{isEditMode ? 'Edit Campaign' : 'New Campaign'}</h2>

      {error && <p className={styles.errorMsg} role="alert">{error}</p>}

      <div className={styles.field}>
        <label htmlFor="campaign-name" className={styles.label}>
          Campaign Name <span className={styles.required}>*</span>
        </label>
        <input
          id="campaign-name"
          type="text"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g. Dragon's Lair"
          disabled={isSubmitting}
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="campaign-description" className={styles.label}>
          Description <span className={styles.optional}>(optional)</span>
        </label>
        <textarea
          id="campaign-description"
          className={styles.textarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          placeholder="Briefly describe the campaign…"
          rows={4}
          disabled={isSubmitting}
        />
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.cancelButton}
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isEditMode ? 'Save Changes' : 'Create Campaign'}
        </button>
      </div>
    </form>
  );
}
