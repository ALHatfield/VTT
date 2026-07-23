import { render, screen } from '@testing-library/react';
import type { AuthUser } from '@vtt/shared';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { AuthProvider } from '../auth/AuthContext';
import { PortalLayout } from './PortalLayout';

function renderPortalLayout(user: AuthUser | null = null): void {
  // Mock fetch for auth check
  global.fetch = (async (url: string) => {
    if (url === '/api/auth/me') {
      if (user) {
        return {
          ok: true,
          json: async () => ({ user }),
        } as Response;
      }
      return { ok: false } as Response;
    }
    return { ok: false } as Response;
  }) as typeof global.fetch;

  render(
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<PortalLayout />}>
            <Route path="welcome" element={<div>Welcome Content</div>} />
            <Route path="campaigns" element={<div>Campaigns Content</div>} />
            <Route path="characters" element={<div>Characters Content</div>} />
            <Route path="account" element={<div>Account Content</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>,
  );
}

const mockUser: AuthUser = {
  id: '1',
  email: 'test@example.com',
  username: 'TestUser',
  createdAt: new Date('2026-05-01'),
};

describe('PortalLayout Component', () => {
  it('renders VTT branding in top bar', async () => {
    window.history.pushState({}, '', '/welcome');
    renderPortalLayout(mockUser);

    expect(await screen.findByText('VTT')).toBeInTheDocument();
  });

  it('displays user greeting with username', async () => {
    window.history.pushState({}, '', '/welcome');
    renderPortalLayout(mockUser);

    expect(await screen.findByText(/welcome TestUser/i)).toBeInTheDocument();
  });

  it('displays user avatar with first initial', async () => {
    window.history.pushState({}, '', '/welcome');
    renderPortalLayout(mockUser);

    expect(await screen.findByText('T')).toBeInTheDocument();
  });

  it('displays fallback greeting when user has no username', async () => {
    const userWithoutUsername: AuthUser = {
      ...mockUser,
      username: '',
    };

    window.history.pushState({}, '', '/welcome');
    renderPortalLayout(userWithoutUsername);

    expect(await screen.findByText(/welcome Adventurer/i)).toBeInTheDocument();
  });

  it('renders all navigation links', async () => {
    window.history.pushState({}, '', '/welcome');
    renderPortalLayout(mockUser);

    expect(await screen.findByRole('link', { name: /news/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /campaigns/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /character sheets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /account settings/i })).toBeInTheDocument();
  });

  it('highlights active navigation link', async () => {
    window.history.pushState({}, '', '/welcome');
    renderPortalLayout(mockUser);

    const newsLink = await screen.findByRole('link', { name: /news/i });
    expect(newsLink.className).toContain('navLinkActive');
  });

  it('renders outlet content for matched route', async () => {
    window.history.pushState({}, '', '/welcome');
    renderPortalLayout(mockUser);

    expect(await screen.findByText('Welcome Content')).toBeInTheDocument();
  });

  it('navigates to campaigns route', async () => {
    window.history.pushState({}, '', '/campaigns');
    renderPortalLayout(mockUser);

    expect(await screen.findByText('Campaigns Content')).toBeInTheDocument();

    const campaignsLink = screen.getByRole('link', { name: /campaigns/i });
    expect(campaignsLink.className).toContain('navLinkActive');
  });

  it('navigates to characters route', async () => {
    window.history.pushState({}, '', '/characters');
    renderPortalLayout(mockUser);

    expect(await screen.findByText('Characters Content')).toBeInTheDocument();

    const charactersLink = screen.getByRole('link', { name: /character sheets/i });
    expect(charactersLink.className).toContain('navLinkActive');
  });

  it('navigates to account route', async () => {
    window.history.pushState({}, '', '/account');
    renderPortalLayout(mockUser);

    expect(await screen.findByText('Account Content')).toBeInTheDocument();

    const accountLink = screen.getByRole('link', { name: /account settings/i });
    expect(accountLink.className).toContain('navLinkActive');
  });
});
