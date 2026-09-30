/**
 * Game domain types: settings, per-item records and the persisted run record (spec §10.1).
 *
 * `RunRecord` is versioned (`schemaVersion: 1`) and stores the seed plus raw per-item metrics, so a
 * future server can regenerate the targets and recompute the score.
 */
import type { LanguageId } from '../engines/types';
import type { Difficulty } from '../generator/generate';
import type { Tier } from '../generator/types';

export type Mode = 'timed' | 'zen';
export type TimedDuration = 30 | 60 | 120 | 180 | 300 | 600;

export type GameSettings = {
  language: LanguageId;
  mode: Mode;
  difficulty: Difficulty;
  durationSec: TimedDuration;
  /** Empty string means "generate a random seed at start". */
  seed: string;
};

/** Raw metrics for one expression (spec §8.1). Enough to recompute the score. */
export type ItemRecord = {
  index: number;
  tier: Tier;
  templateId: string;
  source: string;
  timeMs: number;
  keystrokes: number;
  deletions: number;
  failedCompiles: number;
  /** Hints revealed for this item; absent in runs stored before hints existed (read as 0). */
  hints?: number;
  skipped: boolean;
  targetSourceLength: number;
  score: number;
};

export type RunRecord = {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  language: LanguageId;
  mode: Mode;
  durationSec?: number;
  difficulty: Difficulty;
  seed: string;
  score: number;
  items: ItemRecord[];
  appVersion: string;
};
