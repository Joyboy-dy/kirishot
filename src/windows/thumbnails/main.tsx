import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { TipProvider } from '@/components/ui/Tip';
import { ThumbnailStack } from './ThumbnailStack';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider>
      <ThumbnailStack />
    </TipProvider>
  </StrictMode>,
);
