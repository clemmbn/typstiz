/**
 * Results screen: score, new-best badge, raw stats (spec §8.2) and the per-item list.
 * Keys: Enter or R = restart with the same settings, S = stats, Esc = back to start (or to stats
 * when the recap was opened from there).
 */
import { useEffect } from 'react';
import { useGame } from '../game/store';
import type { ItemRecord } from '../game/types';
import { LANGUAGE_NAMES } from './docs';

export function ResultsScreen() {
  const run = useGame((s) => s.lastRun)!;
  const isBest = useGame((s) => s.lastRunIsBest);
  const fromStats = useGame((s) => s.resultsFrom) === 'stats';
  const { startRun, goTo } = useGame.getState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const k = e.key.toLowerCase();
      if (k === 'enter' || k === 'r') {
        e.preventDefault();
        void startRun();
      } else if (k === 's') goTo('stats');
      else if (k === 'escape') goTo(fromStats ? 'stats' : 'start');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startRun, goTo, fromStats]);

  const stats = summarize(run.items);

  return (
    <main className="results">
      <p className="results-mode">
        {LANGUAGE_NAMES[run.language]} · {run.mode === 'timed' ? `${run.durationSec} s timed` : 'zen'} · {run.difficulty} · seed{' '}
        <code>{run.seed}</code>
      </p>
      <p className="big-score">{run.score.toFixed(0)}</p>
      {isBest && <p className="badge">new best</p>}
      {run.mode === 'zen' && <p className="muted">Zen runs are ranked in their own bucket.</p>}

      <dl className="stat-grid">
        <Stat label="solved" value={String(stats.solved)} />
        <Stat label="skipped" value={String(stats.skipped)} />
        <Stat label="avg time" value={stats.avgMs === null ? '–' : `${(stats.avgMs / 1000).toFixed(1)} s`} />
        <Stat label="accuracy" value={stats.accuracy === null ? '–' : `${Math.round(stats.accuracy * 100)}%`} />
      </dl>

      {run.items.length > 0 && (
        <table className="items">
          <thead>
            <tr><th>#</th><th>source</th><th>tier</th><th>time</th><th>del</th><th>err</th><th>hints</th><th>score</th></tr>
          </thead>
          <tbody>
            {run.items.map((item) => (
              <tr key={item.index} className={rowClass(item, stats)}>
                <td>{item.index + 1}</td>
                <td><code>{item.source}</code></td>
                <td>{item.tier}</td>
                <td>{item.skipped ? 'skip' : `${(item.timeMs / 1000).toFixed(1)} s`}</td>
                <td>{item.deletions}</td>
                <td>{item.failedCompiles}</td>
                <td>{item.hints ?? 0}</td>
                <td>{item.score.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="controls">
        <button type="button" className="primary" onClick={() => void startRun()}>Again <kbd>Enter</kbd></button>
        <button type="button" onClick={() => goTo('stats')}>Stats <kbd>S</kbd></button>
        <button type="button" onClick={() => goTo(fromStats ? 'stats' : 'start')}>
          {fromStats ? 'Back' : 'Menu'} <kbd>Esc</kbd>
        </button>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

type Summary = {
  solved: number;
  skipped: number;
  avgMs: number | null;
  /** 1 − deletions / keystrokes, clamped to [0, 1]; null with no keystrokes. */
  accuracy: number | null;
  bestIndex: number | null;
  worstIndex: number | null;
};

/**
 * Raw stats for the results screen.
 * @param items - run items
 * @returns aggregated stats; best/worst are by score among solved items
 */
function summarize(items: ItemRecord[]): Summary {
  const solved = items.filter((i) => !i.skipped);
  const keystrokes = items.reduce((s, i) => s + i.keystrokes, 0);
  const deletions = items.reduce((s, i) => s + i.deletions, 0);
  const byScore = [...solved].sort((a, b) => b.score - a.score);
  return {
    solved: solved.length,
    skipped: items.length - solved.length,
    avgMs: solved.length ? solved.reduce((s, i) => s + i.timeMs, 0) / solved.length : null,
    accuracy: keystrokes ? Math.max(0, Math.min(1, 1 - deletions / keystrokes)) : null,
    bestIndex: byScore.length > 1 ? byScore[0].index : null,
    worstIndex: byScore.length > 1 ? byScore[byScore.length - 1].index : null,
  };
}

function rowClass(item: ItemRecord, s: Summary): string {
  if (item.index === s.bestIndex) return 'best';
  if (item.index === s.worstIndex) return 'worst';
  return item.skipped ? 'skipped' : '';
}
