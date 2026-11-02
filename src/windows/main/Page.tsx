import type { ReactNode } from 'react';

/** A page of the main window: its title, an optional toolbar, then its content. */
export function Page(p: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center justify-between gap-4 px-10 pb-6 pt-8">
        <h1 className="m-0 text-[26px] font-semibold tracking-tight">{p.title}</h1>
        {p.actions}
      </header>
      <div className="flex flex-col gap-8 px-10 pb-10">{p.children}</div>
    </main>
  );
}
