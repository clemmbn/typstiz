/**
 * 3, 2, 1 countdown before play. Calls `beginPlay` at "go", which starts the global clock.
 * Esc cancels back to the start screen.
 */
import { useEffect, useState } from 'react';
import { useGame } from '../game/store';

const STEP_MS = 700;

export function Countdown() {
  const [n, setN] = useState(3);
  const { beginPlay, abandonRun } = useGame.getState();

  useEffect(() => {
    if (n === 0) {
      beginPlay();
      return;
    }
    const id = window.setTimeout(() => setN(n - 1), STEP_MS);
    return () => clearTimeout(id);
  }, [n, beginPlay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => !e.defaultPrevented && e.key === 'Escape' && abandonRun();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abandonRun]);

  return (
    <main className="countdown" aria-live="assertive">
      <span key={n} className="countdown-number">{n > 0 ? n : 'go'}</span>
    </main>
  );
}
