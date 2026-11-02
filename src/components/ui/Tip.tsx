import type { ReactElement } from 'react';
import { shortcutAria } from '@/lib/a11y';
import { Kbd } from './Kbd';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

type Props = {
  label: string;
  /** Shown as keycaps and announced through `aria-keyshortcuts`. */
  keys?: string[];
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactElement;
};

/** A tooltip with the shortcut of its control. Its trigger gets the label as accessible name. */
export function Tip({ label, keys, side = 'bottom', children }: Props) {
  return (
    <Tooltip>
      <TooltipTrigger
        asChild
        aria-label={label}
        aria-keyshortcuts={keys ? shortcutAria(keys) : undefined}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={6}>
        {label}
        {keys?.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/** One per window: after the first tooltip, moving to the next button shows its tip at once. */
export function TipProvider({ children }: { children: ReactElement }) {
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={300}>
      {children}
    </TooltipProvider>
  );
}
