import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { TipProvider } from '@/components/ui/Tip';
import { followTheme } from '@/lib/theme';
import { Editor } from './Editor';

followTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TipProvider>
      <Editor />
    </TipProvider>
  </StrictMode>,
);
