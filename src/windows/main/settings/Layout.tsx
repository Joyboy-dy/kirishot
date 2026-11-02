import type { ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

/** A titled group of setting rows: title, 16 px, then the card (spec J3 § 4.4). */
export function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
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

export function Row(props: {
  label: string;
  hint?: string;
  /** The hint is an error message. */
  error?: boolean;
  children: ReactNode;
}) {
  return (
    // Lines only between rows: the first row would draw a straight line over the card's rounded top.
    <div className="flex min-h-[64px] items-center justify-between gap-6 border-t border-[var(--k-border)] px-5 py-4 first:border-t-0">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-[14px] font-medium">{props.label}</span>
        {props.hint && (
          <span
            className="text-[12.5px]"
            style={{ color: props.error ? 'var(--k-danger)' : 'var(--k-text-3)' }}
          >
            {props.hint}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{props.children}</div>
    </div>
  );
}

export function SwitchRow(props: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange(on: boolean): void;
}) {
  return (
    <Row label={props.label} hint={props.hint}>
      <Switch checked={props.checked} onCheckedChange={props.onChange} aria-label={props.label} />
    </Row>
  );
}

const ITEM =
  'px-3 data-[state=on]:border-[var(--k-accent)] data-[state=on]:bg-[var(--k-accent-soft)] data-[state=on]:text-[var(--k-accent-text)]';

/** A row of mutually exclusive choices. */
export function Choice<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  disabled?: boolean;
  label: string;
  onChange(value: T): void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={props.value}
      disabled={props.disabled}
      aria-label={props.label}
      onValueChange={(v) => {
        if (v) props.onChange(v as T);
      }}
    >
      {props.options.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className={ITEM}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
