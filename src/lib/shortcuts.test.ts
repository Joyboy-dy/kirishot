import { describe, expect, it } from 'vitest';
import { TOOLS } from '@/windows/editor/tools/catalog';
import { EDITOR_SHORTCUTS, SELECTION_SHORTCUTS } from './shortcuts';

describe('shortcut lists', () => {
  it('the selection screen has its four groups, in order', () => {
    expect(SELECTION_SHORTCUTS.map((g) => g.title)).toEqual([
      'Sélection',
      'Modes',
      'Loupe et couleur',
      'Valider',
    ]);
  });

  it('the editor lists every tool key exactly once', () => {
    const tools = EDITOR_SHORTCUTS.find((g) => g.title === 'Outils')!;
    for (const tool of TOOLS) {
      expect(tools.entries.filter((e) => e.keys.join('+') === tool.key)).toHaveLength(1);
    }
    expect(tools.entries).toHaveLength(TOOLS.length);
  });

  it('the editor groups are Outils, Édition, Vue and Fichier', () => {
    expect(EDITOR_SHORTCUTS.map((g) => g.title)).toEqual(['Outils', 'Édition', 'Vue', 'Fichier']);
  });
});
