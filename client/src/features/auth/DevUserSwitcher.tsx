import type { AuthUser } from '@vtt/shared';
import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import styles from './DevUserSwitcher.module.css';

export function DevUserSwitcher(): JSX.Element | null {
  const { user, login, logout } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show in development mode
  if (import.meta.env.PROD) {
    return null;
  }

  // Fetch dev users on mount
  useEffect(() => {
    fetchDevUsers();
  }, []);

  const fetchDevUsers = async (): Promise<void> => {
    try {
      const response = await fetch('/api/dev/users', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dev users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError((err as Error).message);
      console.error('[DevUserSwitcher] Failed to fetch users:', err);
    }
  };

  const handleSwitchUser = async (userId: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/dev/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to switch user');
      }

      const data = await response.json();
      login(data.user);

      setIsOpen(false);
    } catch (err) {
      setError((err as Error).message);
      console.error('[DevUserSwitcher] Failed to switch user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await logout();
      setIsOpen(false);
    } catch (err) {
      setError((err as Error).message);
      console.error('[DevUserSwitcher] Failed to sign out:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Toggle Button */}
      <button
        className={styles.toggle}
        onClick={() => setIsOpen(!isOpen)}
        title="Dev Mode: Switch Users"
      >
        👤
      </button>

      {/* Floating Panel */}
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.header}>
            <h3>Dev User Switcher</h3>
            <button
              className={styles.closeButton}
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.current}>
            <strong>Current User:</strong> {user?.email || 'Not logged in'}
          </div>

          <div className={styles.list}>
            {loading ? (
              <p className={styles.loading}>Loading users...</p>
            ) : users.length === 0 ? (
              <p className={styles.empty}>No users available</p>
            ) : (
              users.map((devUser) => (
                <button
                  key={devUser.id}
                  className={`${styles.userItem} ${
                    user?.id === devUser.id ? styles.active : ''
                  }`}
                  onClick={() => handleSwitchUser(devUser.id)}
                  disabled={loading}
                >
                  <span className={styles.email}>{devUser.email}</span>
                  <span className={styles.username}>@{devUser.username}</span>
                  {user?.id === devUser.id && (
                    <span className={styles.checkmark}>✓</span>
                  )}
                </button>
              ))
            )}
          </div>

          <button
            className={styles.signOutButton}
            onClick={handleSignOut}
            disabled={loading}
          >
            🚪 Sign Out
          </button>

          <div className={styles.info}>
            <small>💡 Click any user to switch perspective</small>
          </div>
        </div>
      )}
    </>
  );
}
