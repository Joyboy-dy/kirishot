// Every in-app shortcut, in one place: the « ? » sheet of the selection screen, the editor's
// tooltips and the Raccourcis page all read these lists (spec J3 § 4.3).
import { t } from '@/i18n';
import { TOOLS } from '@/windows/editor/tools/catalog';

export type ShortcutEntry = { keys: string[]; label: string };
export type ShortcutGroup = { title: string; entries: ShortcutEntry[] };

export const SELECTION_SHORTCUTS: ShortcutGroup[] = [
  {
    title: t('sheet.selection'),
    entries: [
      { keys: ['Glisser'], label: t('sheet.drag') },
      { keys: ['Maj'], label: t('sheet.shift') },
      { keys: ['Alt'], label: t('sheet.alt') },
      { keys: ['Espace'], label: t('sheet.space') },
      { keys: ['←', '↑', '→', '↓'], label: t('sheet.arrows') },
    ],
  },
  {
    title: t('sheet.modes'),
    entries: [
      { keys: ['R'], label: t('sheet.region') },
      { keys: ['W'], label: t('sheet.window') },
      { keys: ['F'], label: t('sheet.fullscreen') },
    ],
  },
  {
    title: t('sheet.magnifier'),
    entries: [
      { keys: ['M'], label: t('sheet.loupe') },
      { keys: ['C'], label: t('sheet.color') },
    ],
  },
  {
    title: t('sheet.validate'),
    entries: [
      { keys: ['Entrée'], label: t('sheet.enter') },
      { keys: ['Ctrl', 'C'], label: t('sheet.copy') },
      { keys: ['Échap'], label: t('sheet.escape') },
      { keys: ['?'], label: t('sheet.help') },
    ],
  },
];

export const EDITOR_SHORTCUTS: ShortcutGroup[] = [
  {
    title: t('keys.editor.tools'),
    entries: TOOLS.map((tool) => ({ keys: [tool.key], label: tool.label })),
  },
  {
    title: t('keys.editor.edit'),
    entries: [
      { keys: ['Ctrl', 'Z'], label: t('editor.undo') },
      { keys: ['Ctrl', 'Y'], label: t('editor.redo') },
      { keys: ['Ctrl', 'D'], label: t('keys.editor.duplicate') },
      { keys: ['Ctrl', 'A'], label: t('keys.editor.selectAll') },
      { keys: ['Suppr'], label: t('editor.delete') },
      { keys: ['Ctrl', ']'], label: t('editor.front') },
      { keys: ['Ctrl', '['], label: t('editor.back') },
      { keys: ['←', '↑', '→', '↓'], label: t('keys.editor.nudge') },
      { keys: ['1', '2', '3', '4'], label: t('keys.editor.size') },
    ],
  },
  {
    title: t('keys.editor.view'),
    entries: [
      { keys: ['Espace', 'Glisser'], label: t('keys.editor.pan') },
      { keys: ['Ctrl', 'Molette'], label: t('keys.editor.zoom') },
      { keys: ['Ctrl', '0'], label: t('editor.fit') },
      { keys: ['Ctrl', '1'], label: t('keys.editor.actualSize') },
    ],
  },
  {
    title: t('keys.editor.file'),
    entries: [
      { keys: ['Ctrl', 'C'], label: t('editor.copy') },
      { keys: ['Ctrl', 'S'], label: t('editor.save') },
      { keys: ['Ctrl', 'Maj', 'S'], label: t('keys.editor.saveAs') },
      { keys: ['Ctrl', 'Entrée'], label: t('editor.copyAndClose') },
      { keys: ['F2'], label: t('editor.rename') },
      { keys: ['Échap'], label: t('keys.editor.escape') },
    ],
  },
];
