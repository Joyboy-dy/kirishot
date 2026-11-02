import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { TipProvider } from '@/components/ui/Tip';
import { Editor } from './Editor';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider>
      <Editor />
    </TipProvider>
  </StrictMode>,
);
