import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { TipProvider } from '@/components/ui/Tip';
import { Overlay } from './Overlay';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider>
      <Overlay />
    </TipProvider>
  </StrictMode>,
);
