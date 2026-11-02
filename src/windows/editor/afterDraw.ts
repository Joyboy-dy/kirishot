import type { AfterDraw } from '@/lib/ipc';
import type { ToolId } from './tools/catalog';

/** What follows a new annotation: `null` keeps the tool, or the selection with the new shape. */
export function afterDrawing(
  setting: AfterDraw,
  id: string,
): { tool: ToolId; selected: string[] } | null {
  return setting === 'select' ? { tool: 'select', selected: [id] } : null;
}
