import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { TipProvider } from '@/components/ui/Tip';
import { followTheme } from '@/lib/theme';
import { App } from './App';

followTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider>
      <App />
    </TipProvider>
  </StrictMode>,
);
