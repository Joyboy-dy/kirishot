import { describe, expect, it } from 'vitest';
import type { Settings } from '@/lib/ipc';

// The defaults of `settings.json` (Rust `defaults_match_spec`). `satisfies Settings` makes a new
// Rust field fail the typecheck here, so it cannot be added without being classified below.
const DEFAULTS = {
  version: 1,
  save: { folder: null, format: 'png', nameTemplate: 'Kirishot {date} à {heure}', counter: 1 },
  afterCapture: {
    autoAction: 'saveAndCopy',
    thumbnail: true,
    thumbnailSeconds: 6,
    alwaysOpenEditor: false,
  },
  capture: {
    magnifier: true,
    sound: true,
    flash: true,
    includeCursor: false,
    trayTimerSeconds: 3,
    commitOnRelease: false,
    mode: 'region',
    toolbarPosition: 'top',
    startMode: 'region',
  },
  shortcuts: {
    region: 'Super+Shift+S',
    regionAlt: 'PrintScreen',
    fullscreen: 'Shift+PrintScreen',
    ocr: 'Ctrl+PrintScreen',
    repeatRegion: null,
    openHistory: null,
  },
  history: { retentionDays: 30 },
  system: { launchAtStartup: true, language: 'auto', theme: 'system', checkUpdates: true },
  editor: { recentColors: [], confirmClose: true, afterDraw: 'keep' },
  onboardingDone: false,
} satisfies Settings;

/** Settings the user changes in the app (Réglages, Raccourcis, the editor's colour picker). */
const EDITABLE = [
  'save.folder',
  'save.format',
  'save.nameTemplate',
  'afterCapture.autoAction',
  'afterCapture.thumbnail',
  'afterCapture.thumbnailSeconds',
  'afterCapture.alwaysOpenEditor',
  'capture.magnifier',
  'capture.sound',
  'capture.flash',
  'capture.includeCursor',
  'capture.commitOnRelease',
  'capture.toolbarPosition',
  'capture.startMode',
  'shortcuts.region',
  'shortcuts.regionAlt',
  'shortcuts.fullscreen',
  'history.retentionDays',
  'system.launchAtStartup',
  'system.theme',
  'editor.recentColors',
  'editor.confirmClose',
  'editor.afterDraw',
];

/** Settings knowingly not shown, each with its reason (spec J3 § 4.4). */
const HIDDEN = [
  'version', // the file format, not a preference
  'save.counter', // kept by Rust, read by the {n} token
  'capture.mode', // the last mode used, remembered by the selection screen
  'capture.trayTimerSeconds', // no timer before J4
  'shortcuts.ocr', // no OCR before J4
  'shortcuts.repeatRegion', // no « dernière zone » before J4
  'shortcuts.openHistory', // the main window opens from the tray
  'system.language', // no English translation yet
  'system.checkUpdates', // no updates before the first release
  'onboardingDone', // no first-run dialog yet
];

function leaves(value: unknown, path: string[] = []): string[] {
  if (value && typeof value === 'object' && !Array.isArray(value))
    return Object.entries(value).flatMap(([k, v]) => leaves(v, [...path, k]));
  return [path.join('.')];
}

describe('settings audit', () => {
  it('every settings field is editable or knowingly hidden', () => {
    const unclassified = leaves(DEFAULTS).filter(
      (k) => !EDITABLE.includes(k) && !HIDDEN.includes(k),
    );
    expect(unclassified).toEqual([]);
  });

  it('no field is both editable and hidden, and none is listed twice', () => {
    const all = [...EDITABLE, ...HIDDEN];
    expect(new Set(all).size).toBe(all.length);
    expect(all.filter((k) => !leaves(DEFAULTS).includes(k))).toEqual([]);
  });
});
