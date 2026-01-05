import './polyfills.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';
import { QueryClientProvider } from '@tanstack/react-query';
import queryClient from './services/queryClient';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// Simple global runtime error logger to help track unexpected crashes/blank screens
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('error', (event) => {
      try {
        // eslint-disable-next-line no-console
        console.error('[GlobalError]', {
          message: event.message,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        });
      } catch {}
    });
    window.addEventListener('unhandledrejection', (event) => {
      try {
        // eslint-disable-next-line no-console
        console.error('[GlobalUnhandledRejection]', {
          reason: event.reason,
        });
      } catch {}
    });
  } catch {}
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
      <App />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>,
)