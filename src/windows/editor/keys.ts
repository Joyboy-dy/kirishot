// The editor's keyboard shortcuts (spec J2 § 4.2), as data for the editor to act on.
import type { SizeStep } from '@/editor/style';
import { TOOLS, type ToolId } from './tools/catalog';

export type EditorAction =
  | { type: 'tool'; tool: ToolId }
  | { type: 'size'; step: SizeStep }
  | { type: 'nudge'; dx: number; dy: number }
  | {
      type:
        | 'undo'
        | 'redo'
        | 'duplicate'
        | 'selectAll'
        | 'copy'
        | 'save'
        | 'saveAs'
        | 'copyAndClose'
        | 'delete'
        | 'escape'
        | 'front'
        | 'back';
    };

type KeyInput = {
  key: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  editingText: boolean;
  /** Already handled by a control (`defaultPrevented`): Échap that closes a menu, for one. */
  handled?: boolean;
};

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function keyAction(e: KeyInput): EditorAction | null {
  // While a text is edited, every key belongs to it; Échap and a click outside end the edit.
  if (e.editingText || e.handled) return null;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.ctrl) {
    if (key === 'z') return { type: e.shift ? 'redo' : 'undo' };
    if (key === 'y') return { type: 'redo' };
    if (key === 'd') return { type: 'duplicate' };
    if (key === 'a') return { type: 'selectAll' };
    if (key === 'c') return { type: 'copy' };
    if (key === 's') return { type: e.shift ? 'saveAs' : 'save' };
    if (key === 'Enter') return { type: 'copyAndClose' };
    if (key === ']') return { type: 'front' };
    if (key === '[') return { type: 'back' };
    return null;
  }
  if (e.alt) return null;
  if (key in ARROWS) {
    const [dx, dy] = ARROWS[key];
    const by = e.shift ? 10 : 1;
    return { type: 'nudge', dx: dx * by, dy: dy * by };
  }
  if (key === 'Delete' || key === 'Backspace') return { type: 'delete' };
  if (key === 'Escape') return { type: 'escape' };
  if (['1', '2', '3', '4'].includes(key)) return { type: 'size', step: Number(key) as SizeStep };
  const tool = TOOLS.find((t) => t.key.toLowerCase() === key);
  return tool ? { type: 'tool', tool: tool.id } : null;
}
