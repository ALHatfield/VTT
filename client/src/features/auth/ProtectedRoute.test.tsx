import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthProvider } from './AuthContext';
import { ProtectedRoute } from './ProtectedRoute';

function renderProtectedRoute(isAuthenticated = false): void {
  // Mock fetch for auth check
  global.fetch = (async (url: string) => {
    if (url === '/api/auth/me') {
      if (isAuthenticated) {
        return {
          ok: true,
          json: async () => ({
            user: {
              id: '1',
              email: 'test@example.com',
              username: 'Test',
              createdAt: new Date(),
            },
          }),
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
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('ProtectedRoute Component', () => {
  it('redirects to login when not authenticated', async () => {
    window.history.pushState({}, '', '/protected');
    renderProtectedRoute(false);

    await waitFor(() => {
      expect(screen.getByText(/login page/i)).toBeInTheDocument();
    });
  });

  it('shows protected content when authenticated', async () => {
    window.history.pushState({}, '', '/protected');
    renderProtectedRoute(true);

    await waitFor(() => {
      expect(screen.getByText(/protected content/i)).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    window.history.pushState({}, '', '/protected');
    renderProtectedRoute(false);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
