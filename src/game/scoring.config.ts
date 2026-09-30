/**
 * Every tunable scoring constant lives here (spec §8.2). All values are provisional and meant
 * to be tuned after playtesting; nothing else in the codebase hardcodes scoring numbers.
 */
import type { Tier } from '../generator/types';

export type ScoringConfig = {
  /** Flat points per tier before the speed multiplier. */
  tierBase: Record<Tier, number>;
  /** Extra base points per character of the reference source. */
  lengthBonus: number;
  /** Expected milliseconds per reference character; par time = parPerChar × length. */
  parPerChar: number;
  /** Upper bound on the speed multiplier so tiny times can't explode the score. */
  speedCap: number;
  /** Points removed per deleted character. Kept small by design. */
  deletionPenalty: number;
  /** Points removed per settled compile error. Kept small by design. */
  failedCompilePenalty: number;
  /** Score multiplier when live preview is on (preview makes it easier). */
  previewMultiplier: number;
  /** Seconds removed from the timed-mode clock per skip (spec default 0). */
  skipTimePenaltySec: number;
};

export const SCORING_CONFIG: ScoringConfig = {
  tierBase: { easy: 10, medium: 20, hard: 35 },
  lengthBonus: 1,
  parPerChar: 400,
  speedCap: 3,
  deletionPenalty: 0.5,
  failedCompilePenalty: 1,
  previewMultiplier: 0.8,
  skipTimePenaltySec: 0,
};
