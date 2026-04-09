import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './Router';
import './styles.css';
import { AuthProvider } from './contexts/AuthContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { cleanupLegacyWebViewState, initAndroidApp } from './utils/platform';

// Initialize Android-specific features (no-op on web)
void cleanupLegacyWebViewState();
initAndroidApp();
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <FamilyProvider>
          <SubscriptionProvider>
            <AppRouter />
          </SubscriptionProvider>
        </FamilyProvider>
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);
