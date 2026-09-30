/**
 * Persistence contract for runs and best scores (spec §10.1).
 *
 * Game code depends only on this interface. v1 ships `LocalScoreRepository` (localStorage);
 * a future `RemoteScoreRepository` (leaderboard) implements the same methods.
 * All methods are async so a network-backed implementation fits without changes.
 */
import type { RunRecord } from '../game/types';

/** Best scores are bucketed by (language, mode, difficulty, durationSec). */
export type BucketKey = string;

/**
 * Build the bucket key of a run. Zen runs have no duration, so they land in their own buckets.
 * @param run - run (or the subset of fields that define its bucket)
 * @returns stable string key
 */
export function bucketKey(run: Pick<RunRecord, 'language' | 'mode' | 'difficulty' | 'durationSec'>): BucketKey {
  return [run.language, run.mode, run.difficulty, run.mode === 'timed' ? run.durationSec : '-'].join('|');
}

export interface ScoreRepository {
  /** Persist a finished run. Resolves with whether it set a new best for its bucket. */
  saveRun(run: RunRecord): Promise<{ isNewBest: boolean }>;
  /** All stored runs, newest first. */
  listRuns(): Promise<RunRecord[]>;
  /** Best run per bucket. */
  bestByBucket(): Promise<Map<BucketKey, RunRecord>>;
}
