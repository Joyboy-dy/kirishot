import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { shortcutAria } from '@/lib/a11y';
import { TIP_DELAY_MS, tipGate } from '@/lib/tipGate';
import { Kbd } from './Kbd';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

type Side = 'top' | 'bottom' | 'left' | 'right';

/** Where tips go by default: under the bar, above the items of a menu that opens downward. */
const TipSide = createContext<Side>('bottom');

export function TipSideProvider({ side, children }: { side: Side; children: ReactNode }) {
  return <TipSide.Provider value={side}>{children}</TipSide.Provider>;
}

type Props = {
  label: string;
  /** Shown as keycaps and announced through `aria-keyshortcuts`. */
  keys?: string[];
  side?: Side;
  children: ReactElement;
};

/** A tooltip with the shortcut of its control. Its trigger gets the label as accessible name. */
export function Tip({ label, keys, side, children }: Props) {
  const fallback = useContext(TipSide);
  const gate = useRef(tipGate()).current;
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={(next) => gate.allow(next) && setOpen(next)}>
      <TooltipTrigger
        asChild
        aria-label={label}
        aria-keyshortcuts={keys ? shortcutAria(keys) : undefined}
        onFocus={(e) => gate.focus(e.currentTarget.matches(':focus-visible'))}
        onPointerMove={() => gate.pointer()}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side ?? fallback} sideOffset={6}>
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
    <TooltipProvider delayDuration={TIP_DELAY_MS} skipDelayDuration={300}>
      {children}
    </TooltipProvider>
  );
}
