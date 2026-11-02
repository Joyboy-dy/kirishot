/** How long the pointer rests on a control before its tip shows (then the next ones at once). */
export const TIP_DELAY_MS = 600;

/**
 * Lets a tooltip open on a hover or a keyboard focus, never on a focus the program moved: a menu
 * focusing its first item when it opens, or giving the focus back to its trigger when it closes.
 */
export function tipGate() {
  let silent = false;
  return {
    /** The trigger got the focus; `visible` is `:focus-visible` (the keyboard moved it). */
    focus(visible: boolean) {
      silent = !visible;
    },
    /** The pointer moves over the trigger. */
    pointer() {
      silent = false;
    },
    /** Whether a requested open state may be applied. */
    allow(open: boolean) {
      return !open || !silent;
    },
  };
}
