import type { ReactNode } from 'react';
import { Tip } from '@/components/ui/Tip';
import type { Block, Fill, Stroke, TextStyle } from '@/editor/document';
import { PALETTE, type SizeStep } from '@/editor/style';
import { t, type MessageKey } from '@/i18n';
import type { Option, StylePatch } from './tools/options';

/** The settings a drawing starts with; every option of the table has a value. */
export type Style = Required<StylePatch>;

type ControlsProps = {
  options: Option[];
  /** What the controls show as active; a missing value shows nothing active. */
  value: StylePatch;
  onChange(patch: StylePatch): void;
  /** Leave the colours out (shown elsewhere, as a swatch). */
  withoutColor?: boolean;
};

function Chip(p: {
  label: string;
  keys?: string[];
  active?: boolean;
  onClick(): void;
  children: ReactNode;
}) {
  return (
    <Tip label={p.label} keys={p.keys}>
      <button
        type="button"
        aria-label={p.label}
        aria-pressed={p.active}
        onClick={p.onClick}
        className="k-press flex h-8 min-w-8 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border-0 px-1.5 text-[12px] hover:bg-white/10"
        style={
          p.active
            ? { background: 'var(--k-accent-soft)', color: 'var(--k-accent-text)' }
            : { background: 'transparent', color: 'var(--k-text)' }
        }
      >
        {p.children}
      </button>
    </Tip>
  );
}

const Divider = () => (
  <span className="mx-1 h-5 w-px shrink-0" style={{ background: 'var(--k-border)' }} />
);

const DASHES: { dash: Stroke['dash']; sample: string }[] = [
  { dash: 'solid', sample: '───' },
  { dash: 'dashed', sample: '- - -' },
  { dash: 'dotted', sample: '···' },
];
const FILLS: Fill['kind'][] = ['none', 'translucent', 'solid'];
const TEXT_STYLES: TextStyle[] = ['plain', 'pill', 'outline'];
const STRENGTHS: Block[] = [8, 16, 28];

/** One colour dot. */
export function ColorDot(p: { color: string; active: boolean; onClick(): void; small?: boolean }) {
  const size = p.small ? 'h-5 w-5' : 'h-6 w-6';
  return (
    <Tip label={t('editor.color', { color: p.color })}>
      <button
        type="button"
        aria-label={t('editor.color', { color: p.color })}
        aria-pressed={p.active}
        onClick={p.onClick}
        className={`k-press ${size} shrink-0 rounded-full border-0 p-0`}
        style={{
          background: p.color,
          boxShadow: p.active
            ? '0 0 0 2px var(--k-surface), 0 0 0 4px var(--k-accent)'
            : 'inset 0 0 0 1px rgba(255, 255, 255, 0.25)',
        }}
      />
    </Tip>
  );
}

export function Palette(p: { value?: string; onChange(color: string): void; small?: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {PALETTE.map((color) => (
        <ColorDot
          key={color}
          color={color}
          small={p.small}
          active={p.value === color}
          onClick={() => p.onChange(color)}
        />
      ))}
    </div>
  );
}

/**
 * The controls of the options in `options`, in the table's order (spec J2.1 § 3.1). Shared by
 * the top bar, the « Style » menu and the selection bubble.
 */
export function StyleControls({ options, value, onChange, withoutColor }: ControlsProps) {
  const groups: ReactNode[] = [];
  const has = (o: Option) => options.includes(o);

  if (has('color') && !withoutColor)
    groups.push(
      <Palette key="color" value={value.color} small onChange={(color) => onChange({ color })} />,
    );
  if (has('size'))
    groups.push(
      <div key="size" className="flex shrink-0 items-center">
        {([1, 2, 3, 4] as SizeStep[]).map((size) => (
          <Chip
            key={size}
            label={t(`editor.size.${size}` as MessageKey)}
            keys={[String(size)]}
            active={value.size === size}
            onClick={() => onChange({ size })}
          >
            <span
              className="rounded-full"
              style={{ width: 4 + size * 3, height: 4 + size * 3, background: 'currentColor' }}
            />
          </Chip>
        ))}
      </div>,
    );
  if (has('dash'))
    groups.push(
      <div key="dash" className="flex shrink-0 items-center">
        {DASHES.map((d) => (
          <Chip
            key={d.dash}
            label={t(`editor.dash.${d.dash}` as MessageKey)}
            active={value.dash === d.dash}
            onClick={() => onChange({ dash: d.dash })}
          >
            <span className="font-mono">{d.sample}</span>
          </Chip>
        ))}
      </div>,
    );
  if (has('fill'))
    groups.push(
      <div key="fill" className="flex shrink-0 items-center">
        {FILLS.map((kind) => (
          <Chip
            key={kind}
            label={t(`editor.fill.${kind}` as MessageKey)}
            active={value.fill === kind}
            onClick={() => onChange({ fill: kind })}
          >
            <span
              className="h-4 w-4 rounded-[4px]"
              style={{
                border: '2px solid currentColor',
                background: kind === 'none' ? 'transparent' : 'currentColor',
                opacity: kind === 'translucent' ? 0.45 : 1,
              }}
            />
          </Chip>
        ))}
      </div>,
    );
  if (has('shadow'))
    groups.push(
      <Chip
        key="shadow"
        label={t('editor.shadow')}
        active={value.shadow === true}
        onClick={() => onChange({ shadow: !value.shadow })}
      >
        <span
          className="h-4 w-4 rounded-[4px]"
          style={{ background: 'currentColor', boxShadow: '2px 3px 0 rgba(0,0,0,0.55)' }}
        />
      </Chip>,
    );
  if (has('opacity'))
    groups.push(
      <label
        key="opacity"
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-1 text-[12px]"
        style={{ color: 'var(--k-text-2)' }}
      >
        {t('editor.opacity')}
        <input
          type="range"
          min={10}
          max={100}
          step={5}
          value={Math.round((value.opacity ?? 1) * 100)}
          onChange={(e) => onChange({ opacity: Number(e.target.value) / 100 })}
          aria-label={t('editor.opacity')}
          className="w-20 accent-[var(--k-accent)]"
        />
      </label>,
    );
  if (has('textStyle'))
    groups.push(
      <div key="textStyle" className="flex shrink-0 items-center">
        {TEXT_STYLES.map((s) => (
          <Chip
            key={s}
            label={t(`editor.textStyle.${s}` as MessageKey)}
            active={value.textStyle === s}
            onClick={() => onChange({ textStyle: s })}
          >
            {t(`editor.textStyle.${s}` as MessageKey)}
          </Chip>
        ))}
      </div>,
    );
  if (has('strength'))
    groups.push(
      <div key="strength" className="flex shrink-0 items-center">
        {STRENGTHS.map((b) => (
          <Chip
            key={b}
            label={t(`editor.strength.${b}` as MessageKey)}
            active={value.strength === b}
            onClick={() => onChange({ strength: b })}
          >
            {t(`editor.strength.${b}` as MessageKey)}
          </Chip>
        ))}
      </div>,
    );

  return (
    <>
      {groups.map((g, i) => (
        <span key={i} className="contents">
          {i > 0 && <Divider />}
          {g}
        </span>
      ))}
    </>
  );
}
