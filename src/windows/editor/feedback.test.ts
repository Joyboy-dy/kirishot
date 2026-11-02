import { describe, expect, it } from 'vitest';
import { buttonView, closeAfterCopy, FEEDBACK, messageVisible } from './feedback';

describe('feedback', () => {
  it('keeps the spec timings', () => {
    expect(FEEDBACK).toEqual({
      spinnerAfterMs: 300,
      checkMs: 1500,
      closeDelayMs: 400,
      messageMs: 4000,
    });
  });

  it('a busy button shows its icon, then a spinner after 300 ms', () => {
    expect(buttonView({ phase: 'busy', since: 1000 }, 1299)).toBe('icon');
    expect(buttonView({ phase: 'busy', since: 1000 }, 1300)).toBe('spinner');
  });

  it('a done button shows a check for 1.5 s', () => {
    expect(buttonView({ phase: 'done', since: 1000 }, 1000)).toBe('check');
    expect(buttonView({ phase: 'done', since: 1000 }, 2499)).toBe('check');
    expect(buttonView({ phase: 'done', since: 1000 }, 2500)).toBe('icon');
  });

  it('an idle button shows its icon', () => {
    expect(buttonView({ phase: 'idle', since: 0 }, 99999)).toBe('icon');
  });

  it('a success message fades after 4 s, an error stays', () => {
    expect(messageVisible({ error: false, at: 1000 }, 4999)).toBe(true);
    expect(messageVisible({ error: false, at: 1000 }, 5000)).toBe(false);
    expect(messageVisible({ error: true, at: 1000 }, 61000)).toBe(true);
    expect(messageVisible(null, 0)).toBe(false);
  });
});

describe('closeAfterCopy', () => {
  it('closes only if the editor still shows the capture that was copied', () => {
    expect(closeAfterCopy('cap-1', 'cap-1')).toBe(true);
    expect(closeAfterCopy('cap-1', 'cap-2')).toBe(false);
    expect(closeAfterCopy('cap-1', null)).toBe(false);
  });
});
