/** Tests for the localStorage score repository, using an in-memory Storage. */
import { describe, expect, it } from 'vitest';
import type { RunRecord } from '../game/types';
import { LocalScoreRepository } from './LocalScoreRepository';
import { bucketKey } from './ScoreRepository';

/** Minimal in-memory Storage implementation. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

let n = 0;
function run(partial: Partial<RunRecord>): RunRecord {
  return {
    schemaVersion: 1, id: `r${n++}`, createdAt: new Date(0).toISOString(), language: 'typst', mode: 'timed',
    durationSec: 60, difficulty: 'easy', seed: 's', previewOn: true, score: 0, items: [], appVersion: 'test', ...partial,
  };
}

describe('LocalScoreRepository', () => {
  it('persists runs across instances (reload)', async () => {
    const storage = memoryStorage();
    await new LocalScoreRepository(storage).saveRun(run({ score: 10 }));
    expect(await new LocalScoreRepository(storage).listRuns()).toHaveLength(1);
  });

  it('tracks best score per bucket', async () => {
    const repo = new LocalScoreRepository(memoryStorage());
    expect((await repo.saveRun(run({ score: 10 }))).isNewBest).toBe(true);
    expect((await repo.saveRun(run({ score: 5 }))).isNewBest).toBe(false);
    expect((await repo.saveRun(run({ score: 5, durationSec: 30 }))).isNewBest).toBe(true);
    expect((await repo.saveRun(run({ score: 1, mode: 'zen', durationSec: undefined }))).isNewBest).toBe(true);
    const best = await repo.bestByBucket();
    expect(best.size).toBe(3);
    expect(best.get(bucketKey(run({})))?.score).toBe(10);
  });

  it('ignores corrupt data and unknown schema versions', async () => {
    const storage = memoryStorage();
    storage.setItem('typstiz.runs.v1', '{not json');
    expect(await new LocalScoreRepository(storage).listRuns()).toEqual([]);
    storage.setItem('typstiz.runs.v1', JSON.stringify([{ schemaVersion: 99 }]));
    expect(await new LocalScoreRepository(storage).listRuns()).toEqual([]);
  });

  it('works without storage at all', async () => {
    const repo = new LocalScoreRepository(null);
    await repo.saveRun(run({ score: 3 }));
    expect(await repo.listRuns()).toEqual([]);
  });
});
