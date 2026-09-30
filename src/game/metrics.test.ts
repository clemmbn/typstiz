/** Unit tests for the per-expression metrics tracker. */
import { describe, expect, it } from 'vitest';
import { diffEdit, ItemMetricsTracker } from './metrics';

describe('diffEdit', () => {
  it.each([
    ['', 'x', 1, 0],
    ['x', 'x^', 1, 0],
    ['x^2', 'x^', 0, 1],
    ['frac(a, b)', 'frac(a b)', 0, 1],
    ['abcdef', 'af', 0, 4], // selection delete
    ['abc', 'aXc', 1, 1], // replace by typing over selection
    ['aaa', 'aa', 0, 1], // repeated chars
    ['', '', 0, 0],
  ])('%j → %j: +%i −%i', (prev, next, inserted, removed) => {
    expect(diffEdit(prev, next)).toEqual({ inserted, removed });
  });
});

describe('ItemMetricsTracker', () => {
  it('counts hints and starts the clock on the first one', () => {
    const t = new ItemMetricsTracker();
    t.onHint(1000);
    t.onHint(2000);
    expect(t.hints).toBe(2);
    expect(t.startedAt).toBe(1000);
  });

  it('starts the timer on the first keystroke', () => {
    const t = new ItemMetricsTracker();
    expect(t.elapsed(500)).toBe(0);
    t.onInput('', 'x', 1000);
    expect(t.elapsed(3500)).toBe(2500);
  });

  it('counts keystrokes and deleted characters', () => {
    const t = new ItemMetricsTracker();
    t.onInput('', 'a', 0);
    t.onInput('a', 'ab', 1);
    t.onInput('ab', 'abc', 2);
    t.onInput('abc', 'a', 3); // selection delete of 2 chars
    expect(t.keystrokes).toBe(3);
    expect(t.deletions).toBe(2);
  });

  it('counts each settled broken value once, ignores empty and ok values', () => {
    const t = new ItemMetricsTracker();
    t.onSettled('frac(a', false);
    t.onSettled('frac(a', false);
    t.onSettled('', false);
    t.onSettled('x', true);
    t.onSettled('frac(', false);
    expect(t.failedCompiles).toBe(2);
  });
});
