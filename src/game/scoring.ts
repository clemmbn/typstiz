/**
 * Pure scoring functions (spec §8.2).
 *
 * Input is only recorded metrics, so the same code can run server-side later to validate a
 * submitted run. No clocks, no randomness, no globals besides the default config.
 */
import type { Tier } from '../generator/types';
import { SCORING_CONFIG, type ScoringConfig } from './scoring.config';

export type ItemMetrics = {
  tier: Tier;
  timeMs: number;
  deletions: number;
  failedCompiles: number;
  /** Hints revealed; absent on runs stored before hints existed. */
  hints?: number;
  skipped: boolean;
  targetSourceLength: number;
};

/**
 * Score one expression.
 *
 *   base    = tierBase[tier] + lengthBonus × length
 *   speed   = clamp(parTime / timeMs, 0, speedCap), parTime = parPerChar × length
 *   penalty = deletionPenalty × deletions + failedCompilePenalty × failedCompiles
 *             + hintPenalty × hints
 *   score   = max(0, base × speed − penalty), rounded to 1 decimal
 *
 * @param m - recorded metrics for the item
 * @param config - scoring constants (defaults to SCORING_CONFIG)
 * @returns non-negative item score; 0 for skipped items
 */
export function scoreItem(m: ItemMetrics, config: ScoringConfig = SCORING_CONFIG): number {
  if (m.skipped) return 0;
  const base = config.tierBase[m.tier] + config.lengthBonus * m.targetSourceLength;
  const parTime = config.parPerChar * m.targetSourceLength;
  // Guard timeMs=0 (theoretically impossible, but a zero division would give Infinity).
  const speed = clamp(parTime / Math.max(m.timeMs, 1), 0, config.speedCap);
  const penalty =
    config.deletionPenalty * m.deletions +
    config.failedCompilePenalty * m.failedCompiles +
    config.hintPenalty * (m.hints ?? 0);
  const raw = Math.max(0, base * speed - penalty);
  return Math.round(raw * 10) / 10;
}

/**
 * Score a whole run: sum of item scores.
 * @param items - metrics of every item in the run
 * @param config - scoring constants
 * @returns run score rounded to 1 decimal
 */
export function scoreRun(items: ItemMetrics[], config: ScoringConfig = SCORING_CONFIG): number {
  const total = items.reduce((sum, m) => sum + scoreItem(m, config), 0);
  return Math.round(total * 10) / 10;
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}
