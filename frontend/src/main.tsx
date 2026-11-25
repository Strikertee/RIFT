import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource-variable/space-grotesk';
import './index.css';
import App from './App';
import { ToastProvider } from './state/ToastContext';
import { AppProvider } from './state/AppContext';
import { ToastViewport } from './components/ui';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <AppProvider>
        <App />
        <ToastViewport />
      </AppProvider>
    </ToastProvider>
  </React.StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
