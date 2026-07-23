import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { DevUserSwitcher } from './features/auth/DevUserSwitcher';
import { Login } from './features/auth/Login';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { useDevAutoLogin } from './features/auth/useDevAutoLogin';
import { CampaignDetail } from './features/campaigns/CampaignDetail';
import { CampaignList } from './features/campaigns/CampaignList';
import { CharacterCreate } from './features/characters/CharacterCreate';
import { CharacterList } from './features/characters/CharacterList';
import { CharacterSheet } from './features/characters/CharacterSheet';
import { PlayArea } from './features/play-area/PlayArea';
import { Account } from './features/portal/Account';
import { CharactersPlaceholder } from './features/portal/CharactersPlaceholder';
import { PortalLayout } from './features/portal/PortalLayout';
import { Welcome } from './features/portal/Welcome';
import { ErrorBoundary } from './shared/components/ErrorBoundary';

function AppContent(): ReactElement {
  // Auto-login in development mode
  useDevAutoLogin();
  const { user } = useAuth();

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/play/:campaignId"
          element={
            <ProtectedRoute>
              <PlayArea key={user?.id} />
            </ProtectedRoute>
          }
        />
        <Route
          element={
            <ProtectedRoute>
              <PortalLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/campaigns" element={<CampaignList />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/campaigns/:id/characters" element={<CharacterList />} />
          <Route path="/campaigns/:id/characters/new" element={<CharacterCreate />} />
          <Route path="/campaigns/:id/characters/:charId" element={<CharacterSheet />} />
          <Route path="/characters" element={<CharactersPlaceholder />} />
          <Route path="/account" element={<Account />} />
        </Route>
        <Route path="/" element={<Navigate to="/welcome" replace />} />
      </Routes>

      {/* Dev tools - only visible in development */}
      <DevUserSwitcher />
    </>
  );
}

export function App(): ReactElement {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
