import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { hydrateWatchlistFromUrl } from './lib/watchlist.ts';
import './index.css';

// Import a shared ?watchlist=… link (if this browser has no watchlist yet) before first render.
hydrateWatchlistFromUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
