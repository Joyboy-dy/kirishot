import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { TipProvider } from '@/components/ui/Tip';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider>
      <App />
    </TipProvider>
  </StrictMode>,
);
