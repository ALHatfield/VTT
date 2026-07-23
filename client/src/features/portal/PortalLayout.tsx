import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';
import styles from './PortalLayout.module.css';

const NAV_ITEMS = [
  { to: '/welcome', label: 'News' },
  { to: '/campaigns', label: 'Campaigns' },
  { to: '/characters', label: 'Character Sheets' },
  { to: '/account', label: 'Account Settings' },
] as const;

export function PortalLayout(): ReactElement {
  const { user } = useAuth();

  const initials = user?.username
    ? user.username.charAt(0).toUpperCase()
    : '?';

  return (
    <div className={styles.layout}>
      <header className={styles.topBar}>
        <span className={styles.logo}>VTT</span>
        <div className={styles.userGreeting}>
          <span>welcome {user?.username ?? 'Adventurer'}</span>
          <div className={styles.avatar} aria-label={`User avatar: ${user?.username ?? 'Guest'}`}>{initials}</div>
        </div>
      </header>

      <nav className={styles.sidebar}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
