/**
 * localStorage-backed `ScoreRepository`.
 *
 * Stores all runs under one versioned key. Records with an unknown `schemaVersion` are ignored
 * on read (not deleted), so a future migration can still find them. The `Storage` object is
 * injectable for tests and for environments where localStorage throws (private mode).
 */
import type { RunRecord } from '../game/types';
import { bucketKey, type BucketKey, type ScoreRepository } from './ScoreRepository';

const STORAGE_KEY = 'typstiz.runs.v1';
/** Cap on stored runs; oldest runs are dropped first, bests are always kept. */
const MAX_RUNS = 500;

export class LocalScoreRepository implements ScoreRepository {
  private readonly storage: Storage | null;

  /**
   * @param storage - Storage implementation, defaults to window.localStorage when available
   */
  constructor(storage: Storage | null = safeLocalStorage()) {
    this.storage = storage;
  }

  async saveRun(run: RunRecord): Promise<{ isNewBest: boolean }> {
    const runs = this.read();
    const previousBest = bestOf(runs.filter((r) => bucketKey(r) === bucketKey(run)));
    const isNewBest = !previousBest || run.score > previousBest.score;
    runs.unshift(run);
    this.write(this.trim(runs));
    console.info('[scores] saved run', { id: run.id, score: run.score, bucket: bucketKey(run), isNewBest });
    return { isNewBest };
  }

  async listRuns(): Promise<RunRecord[]> {
    return this.read();
  }

  async bestByBucket(): Promise<Map<BucketKey, RunRecord>> {
    const best = new Map<BucketKey, RunRecord>();
    for (const run of this.read()) {
      const key = bucketKey(run);
      const current = best.get(key);
      if (!current || run.score > current.score) best.set(key, run);
    }
    return best;
  }

  /** @returns stored runs with a known schema version; [] on missing or corrupt data */
  private read(): RunRecord[] {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((r): r is RunRecord => r?.schemaVersion === 1);
    } catch (err) {
      console.warn('[scores] could not read runs, starting empty', err);
      return [];
    }
  }

  private write(runs: RunRecord[]): void {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(runs));
    } catch (err) {
      // Quota exceeded or storage disabled: the game still works, the run just isn't kept.
      console.warn('[scores] could not persist runs', err);
    }
  }

  /**
   * Drop the oldest runs beyond MAX_RUNS while keeping every bucket's best.
   * @param runs - newest-first runs
   */
  private trim(runs: RunRecord[]): RunRecord[] {
    if (runs.length <= MAX_RUNS) return runs;
    const bestIds = new Set<string>();
    const best = new Map<BucketKey, RunRecord>();
    for (const r of runs) {
      const cur = best.get(bucketKey(r));
      if (!cur || r.score > cur.score) best.set(bucketKey(r), r);
    }
    for (const r of best.values()) bestIds.add(r.id);
    return runs.filter((r, i) => i < MAX_RUNS || bestIds.has(r.id));
  }
}

function bestOf(runs: RunRecord[]): RunRecord | undefined {
  return runs.reduce<RunRecord | undefined>((best, r) => (!best || r.score > best.score ? r : best), undefined);
}

/** @returns window.localStorage, or null when unavailable or blocked */
function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
