import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { App } from './App';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './app/theme';
import { WorldProvider } from './three/WorldProvider';
import { ToastProvider, ConfirmProvider } from './components/overlay';
import { AuthProvider } from './auth/AuthProvider';
import { ApiError } from './api/errors';
import { config } from './config';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // Reads already retry once inside call(); don't stack more retries on a slow Apps Script.
      retry: (n, e) => n < 1 && !(e instanceof ApiError && ['SESSION_EXPIRED', 'FORBIDDEN', 'APP_ERROR', 'UNKNOWN_FUNCTION'].includes(e.code)),
      refetchOnWindowFocus: true,
      staleTime: 20_000
    },
    mutations: { retry: false }
  }
});

const Router = config.router === 'hash' ? HashRouter : BrowserRouter;
const basename = config.router === 'hash' ? undefined : config.basePath.replace(/\/$/, '') || undefined;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ThemeProvider>
          <Tooltip.Provider delayDuration={300}>
            <ToastProvider>
              <ConfirmProvider>
                <Router basename={basename}>
                  <AuthProvider>
                    <WorldProvider>
                      <App />
                    </WorldProvider>
                  </AuthProvider>
                </Router>
              </ConfirmProvider>
            </ToastProvider>
          </Tooltip.Provider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD && !config.mock) {
  window.addEventListener('load', () => { navigator.serviceWorker.register(config.basePath + 'sw.js').catch(() => {}); });
}
