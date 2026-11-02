import { describe, expect, it } from 'vitest';
import { selectionActionsPlacement, toolbarLayout } from './layout';

describe('toolbarLayout', () => {
  it('follows the spec breakpoints', () => {
    expect(toolbarLayout(1100)).toBe('full');
    expect(toolbarLayout(1099)).toBe('compact');
    expect(toolbarLayout(760)).toBe('compact');
    expect(toolbarLayout(759)).toBe('narrow');
    expect(toolbarLayout(520)).toBe('narrow');
  });
});

describe('toolbarLayout with a measured overflow', () => {
  it('stays compact until the width where the full bar overflowed is passed', () => {
    expect(toolbarLayout(1200, 1340)).toBe('compact');
    expect(toolbarLayout(1340, 1340)).toBe('full');
    expect(toolbarLayout(900, 1340)).toBe('compact');
  });

  it('never goes full below 1 100 px', () => {
    expect(toolbarLayout(1050, 1000)).toBe('compact');
  });
});

describe('selectionActionsPlacement', () => {
  it('keeps the actions in the bar unless the bar is narrow', () => {
    expect(selectionActionsPlacement('full')).toBe('bar');
    expect(selectionActionsPlacement('compact')).toBe('bar');
    expect(selectionActionsPlacement('narrow')).toBe('menu');
  });
});
