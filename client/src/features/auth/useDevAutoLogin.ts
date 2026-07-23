import { useEffect } from 'react';
import { useAuth } from './AuthContext';

const DEV_AUTO_LOGIN_EMAIL = 'testdm@email.com';
const DEV_AUTO_LOGIN_USER_ID = 'dm-seed-user-001';

/**
 * Dev-only hook that automatically logs in as the test DM user
 * Skips the login page in development for faster iteration
 * Only runs once on app mount, only in development mode
 */
export function useDevAutoLogin(): void {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    // Only run in development
    if (import.meta.env.PROD) {
      return;
    }

    // Only auto-login if not already authenticated and not loading
    if (isAuthenticated || isLoading) {
      return;
    }

    const autoLogin = async (): Promise<void> => {
      try {
        const response = await fetch('/api/dev/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ userId: DEV_AUTO_LOGIN_USER_ID }),
        });

        if (response.ok) {
          const data = await response.json();
          login(data.user);
          console.log(
            `🔓 Dev auto-login: ${DEV_AUTO_LOGIN_EMAIL} (disable in production)`,
          );
        }
      } catch (err) {
        console.warn('[Dev Auto-Login] Failed:', err);
      }
    };

    autoLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount
}
