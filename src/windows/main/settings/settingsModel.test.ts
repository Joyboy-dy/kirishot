import { describe, expect, it } from 'vitest';
import { insertToken, SETTINGS_TABS } from './settingsModel';

describe('settings page', () => {
  it('has four tabs, in order', () => {
    expect(SETTINGS_TABS).toEqual(['general', 'capture', 'afterCapture', 'history']);
  });

  it('inserts a token at the caret', () => {
    expect(insertToken('Kirishot ', 9, '{date}')).toEqual({ value: 'Kirishot {date}', caret: 15 });
    expect(insertToken('A  B', 2, '{n}')).toEqual({ value: 'A {n} B', caret: 5 });
  });
});
