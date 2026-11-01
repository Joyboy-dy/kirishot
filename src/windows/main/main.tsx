import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/tokens.css';
import { Logo } from '@/components/brand/Logo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="flex h-screen items-center justify-center gap-3 bg-background text-foreground">
      <Logo size={40} />
      <span className="text-3xl font-semibold tracking-tight">kirishot</span>
    </main>
  </StrictMode>,
);
