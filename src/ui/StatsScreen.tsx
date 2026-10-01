/**
 * Stats view: best score per bucket (language, mode, difficulty, duration) and recent runs.
 * Reads through `ScoreRepository`, so it will show remote data unchanged once that exists.
 */
import { useEffect, useState } from 'react';
import { repository, useGame } from '../game/store';
import type { RunRecord } from '../game/types';
import { LANGUAGE_NAMES } from './docs';

export function StatsScreen() {
  const { goTo, viewRun } = useGame.getState();
  const [best, setBest] = useState<RunRecord[] | null>(null);
  const [recent, setRecent] = useState<RunRecord[]>([]);

  useEffect(() => {
    void (async () => {
      const [bestMap, runs] = await Promise.all([repository.bestByBucket(), repository.listRuns()]);
      setBest([...bestMap.values()].sort(compareBuckets));
      setRecent(runs.slice(0, 15));
    })();
    const onKey = (e: KeyboardEvent) => !e.defaultPrevented && e.key === 'Escape' && goTo('start');
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo]);

  /** Compact icon button that re-opens the end-of-run recap for a stored run. */
  const recapButton = (r: RunRecord) => (
    <button type="button" className="link" title="Show recap" aria-label="Show recap" onClick={() => viewRun(r)}>
      →
    </button>
  );

  return (
    <main className="stats">
      <h2>Best scores</h2>
      {best === null ? null : best.length === 0 ? (
        <p className="muted">No runs yet. Play one!</p>
      ) : (
        <table className="items">
          <thead><tr><th>mode</th><th>difficulty</th><th>language</th><th>score</th><th>solved</th><th>date</th><th></th></tr></thead>
          <tbody>
            {best.map((r) => (
              <tr key={r.id}>
                <td>{modeLabel(r)}</td>
                <td>{r.difficulty}</td>
                <td>{LANGUAGE_NAMES[r.language]}</td>
                <td>{r.score.toFixed(0)}</td>
                <td>{r.items.filter((i) => !i.skipped).length}</td>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>{recapButton(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {recent.length > 0 && (
        <>
          <h2>Recent runs</h2>
          <table className="items">
            <thead><tr><th>mode</th><th>difficulty</th><th>language</th><th>score</th><th>seed</th><th>when</th><th></th></tr></thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{modeLabel(r)}</td>
                  <td>{r.difficulty}</td>
                  <td>{LANGUAGE_NAMES[r.language]}</td>
                  <td>{r.score.toFixed(0)}</td>
                  <td><code>{r.seed}</code></td>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{recapButton(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="controls">
        <button type="button" className="primary" onClick={() => goTo('start')}>Back <kbd>Esc</kbd></button>
      </div>
    </main>
  );
}

function modeLabel(r: RunRecord): string {
  return r.mode === 'timed' ? `timed ${r.durationSec}s` : 'zen';
}

/** Order buckets: Typst before LaTeX, timed before zen, then by duration, then difficulty. */
function compareBuckets(a: RunRecord, b: RunRecord): number {
  const order = ['easy', 'medium', 'hard', 'random'];
  const languages = ['typst', 'latex'];
  return (
    languages.indexOf(a.language) - languages.indexOf(b.language) ||
    a.mode.localeCompare(b.mode) ||
    (a.durationSec ?? 0) - (b.durationSec ?? 0) ||
    order.indexOf(a.difficulty) - order.indexOf(b.difficulty)
  );
}
