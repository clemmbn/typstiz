/** Unit tests for the pure scoring functions. */
import { describe, expect, it } from 'vitest';
import { scoreItem, scoreRun, type ItemMetrics } from './scoring';
import { SCORING_CONFIG, type ScoringConfig } from './scoring.config';

const base: ItemMetrics = {
  tier: 'easy',
  timeMs: 4000,
  deletions: 0,
  failedCompiles: 0,
  previewOn: false,
  skipped: false,
  targetSourceLength: 10,
};

// Round numbers make hand-computed expectations easy to read.
const cfg: ScoringConfig = { ...SCORING_CONFIG, tierBase: { easy: 10, medium: 20, hard: 30 }, lengthBonus: 1, parPerChar: 400, speedCap: 3, deletionPenalty: 0.5, failedCompilePenalty: 1, previewMultiplier: 0.8 };

describe('scoreItem', () => {
  it('matches the formula at par time', () => {
    // base = 10 + 10 = 20, par = 4000 ms, speed = 1
    expect(scoreItem(base, cfg)).toBe(20);
  });

  it('faster is better, capped at speedCap', () => {
    expect(scoreItem({ ...base, timeMs: 2000 }, cfg)).toBe(40);
    expect(scoreItem({ ...base, timeMs: 10 }, cfg)).toBe(60);
  });

  it('slower is worse', () => {
    expect(scoreItem({ ...base, timeMs: 8000 }, cfg)).toBe(10);
  });

  it('applies small penalties', () => {
    // 20 - 0.5*4 - 1*2 = 16
    expect(scoreItem({ ...base, deletions: 4, failedCompiles: 2 }, cfg)).toBe(16);
  });

  it('applies the preview multiplier', () => {
    expect(scoreItem({ ...base, previewOn: true }, cfg)).toBe(16);
  });

  it('never goes negative', () => {
    expect(scoreItem({ ...base, timeMs: 1e9, deletions: 1000 }, cfg)).toBe(0);
  });

  it('skipped items score 0', () => {
    expect(scoreItem({ ...base, skipped: true, timeMs: 1 }, cfg)).toBe(0);
  });

  it('handles timeMs = 0 without Infinity', () => {
    expect(scoreItem({ ...base, timeMs: 0 }, cfg)).toBe(60);
  });

  it('is pure: same input, same output', () => {
    expect(scoreItem(base)).toBe(scoreItem({ ...base }));
  });
});

describe('scoreRun', () => {
  it('sums item scores', () => {
    expect(scoreRun([base, { ...base, timeMs: 2000 }, { ...base, skipped: true }], cfg)).toBe(60);
  });
  it('empty run scores 0', () => {
    expect(scoreRun([], cfg)).toBe(0);
  });
});
