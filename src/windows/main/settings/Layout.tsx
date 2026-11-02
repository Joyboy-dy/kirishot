import type { ReactNode } from 'react';

/** A titled group of setting rows. */
export function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-[13px] font-semibold" style={{ color: 'var(--k-text-2)' }}>
        {props.title}
      </h2>
      <div
        className="flex flex-col rounded-xl"
        style={{ background: 'var(--k-surface)', border: '1px solid var(--k-border)' }}
      >
        {props.children}
      </div>
    </section>
  );
}

export function Row(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between gap-6 px-5 py-4"
      style={{ borderTop: '1px solid var(--k-border)', marginTop: -1 }}
    >
      <div className="flex flex-col gap-1">
        <span className="text-[14px] font-medium">{props.label}</span>
        {props.hint && (
          <span className="text-[12.5px]" style={{ color: 'var(--k-text-3)' }}>
            {props.hint}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{props.children}</div>
    </div>
  );
}
