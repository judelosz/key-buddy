import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './index.css';

if (import.meta.env.DEV) {
  void import('./ui/devTest').then((m) => m.installDevTest());
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
