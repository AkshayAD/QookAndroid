import React from 'react';
import ReactDOM from 'react-dom/client';
import AppRouter from './Router';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { FamilyProvider } from './contexts/FamilyContext';
import { initAndroidApp } from './utils/platform';

// Initialize Android-specific features (no-op on web)
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
        <SubscriptionProvider>
          <FamilyProvider>
            <AppRouter />
          </FamilyProvider>
        </SubscriptionProvider>
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);