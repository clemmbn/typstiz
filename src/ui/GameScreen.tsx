/**
 * Game screen: HUD (clock, solved, score, item timer), target, input, live preview.
 *
 * Split in two:
 * - `GameScreen` holds run-level UI (HUD, buzzer timer, success flash).
 * - `ItemBoard` holds per-expression state and is keyed by the target, so a new target remounts
 *   it with fresh input, tracker and timers (no manual reset logic).
 *
 * ItemBoard behavior:
 * - Debounced compile (DEBOUNCE_MS) of the latest input; stale results are dropped by sequence
 *   number so an old compile can never overwrite a newer preview or trigger a false match.
 * - Settle check (SETTLE_MS idle): counts a failed compile once and shows the subtle error hint.
 * - Match detection: a render equivalent to the target solves the item; item time is measured
 *   at the *input event* that produced the matching value, so debounce latency isn't charged.
 *
 * Hints: Shift+Tab (or the button) reveals the next symbol hint for the target, costing
 * `hintPenalty` points each; revealed hints stay on screen until the item ends. The first hint
 * also starts the item timer, so reading hints before typing is not free thinking time.
 *
 * Keys: Tab = skip, Shift+Tab = hint, Esc = end session (zen) / quit (timed).
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { getEngine } from '../engines/registry';
import type { RenderResult } from '../engines/types';
import { availableHints, type Hint } from '../game/hints';
import { ItemMetricsTracker } from '../game/metrics';
import { SCORING_CONFIG } from '../game/scoring.config';
import { registerItemProbe, useGame, type ItemOutcome, type Target } from '../game/store';
import type { GameSettings } from '../game/types';
import { InputField } from './InputField';
import { MathView } from './MathView';

/** Input → compile debounce. Compiles take ~1 ms, so this is only about not thrashing. */
const DEBOUNCE_MS = 40;
/** Idle time after which an input state is "settled" (spec §8.1). */
const SETTLE_MS = 400;
/** Display scale shared by target and preview so they compare visually. */
const MATH_SCALE = 3;

export function GameScreen() {
  const run = useGame((s) => s.run)!;
  const { endRun } = useGame.getState();
  const now = useNow();
  const [flashKey, setFlashKey] = useState(0);
  const [itemStartedAt, setItemStartedAt] = useState<number | null>(null);

  // Timed mode: end the run exactly at the buzzer, independent of the display refresh rate.
  useEffect(() => {
    if (run.endsAt === null) return;
    const id = window.setTimeout(() => void endRun(), Math.max(0, run.endsAt - performance.now()));
    return () => clearTimeout(id);
  }, [run.endsAt, endRun]);

  const solved = run.items.filter((i) => !i.skipped).length;
  const score = run.items.reduce((s, i) => s + i.score, 0);
  const clockMs = run.endsAt !== null ? Math.max(0, run.endsAt - now) : now - (run.startedAt ?? now);
  const itemMs = itemStartedAt === null ? 0 : Math.max(0, now - itemStartedAt);
  const lowTime = run.endsAt !== null && clockMs < 10_000;

  return (
    <main className="game">
      <div className="hud">
        <HudCell label={run.endsAt !== null ? 'time left' : 'elapsed'} value={formatClock(clockMs)} warn={lowTime} />
        <HudCell label="solved" value={String(solved)} />
        <HudCell label="score" value={score.toFixed(0)} />
        <HudCell label="this one" value={`${(itemMs / 1000).toFixed(1)}s`} />
      </div>

      <section className="stage" aria-label="Target">
        <span className={`tier tier-${run.target.expr.tier}`}>{run.target.expr.tier}</span>
        <div key={flashKey} className={flashKey > 0 ? 'target flash' : 'target'}>
          <MathView render={run.target.render} scale={MATH_SCALE} label="Target expression" />
        </div>
      </section>

      <ItemBoard
        key={`${run.seed}:${run.target.expr.index}`}
        target={run.target}
        settings={run.settings}
        onStarted={setItemStartedAt}
        onSolved={() => setFlashKey((k) => k + 1)}
      />
    </main>
  );
}

type ItemBoardProps = {
  target: Target;
  settings: GameSettings;
  /** Called with the first-keystroke timestamp, or null when the item (re)starts. */
  onStarted(at: number | null): void;
  /** Called when the item is solved (for the success flash). */
  onSolved(): void;
};

type LatestInput = { value: string; time: number; seq: number };

function ItemBoard({ target, settings, onStarted, onSolved }: ItemBoardProps) {
  const { solve, skip, endRun, abandonRun } = useGame.getState();
  const [value, setValue] = useState('');
  const [preview, setPreview] = useState<RenderResult | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [revealed, setRevealed] = useState<Hint[]>([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tracker = useRef(new ItemMetricsTracker());
  const latest = useRef<LatestInput>({ value: '', time: 0, seq: 0 });
  const lastCompile = useRef<{ value: string; ok: boolean } | null>(null);
  const timers = useRef<{ debounce?: number; settle?: number }>({});
  const done = useRef(false);

  // Mount = new target: focus the input, reset the HUD item timer, clean up timers on unmount.
  useEffect(() => {
    inputRef.current?.focus();
    onStarted(null);
    console.info('[game-screen] new target', { index: target.expr.index, tier: target.expr.tier, template: target.expr.templateId });
    const t = timers.current;
    return () => {
      clearTimeout(t.debounce);
      clearTimeout(t.settle);
    };
  }, [target, onStarted]);

  /** Snapshot of the tracker as the store expects it. */
  const outcome = useCallback((timeMs: number): ItemOutcome => {
    const t = tracker.current;
    return { timeMs: Math.round(timeMs), keystrokes: t.keystrokes, deletions: t.deletions, failedCompiles: t.failedCompiles, hints: t.hints };
  }, []);

  /**
   * Compile the latest input if it is still the latest; detect a match.
   * @param seq - sequence number of the input that scheduled this compile
   */
  // Let the store capture this item if the run ends (buzzer / End session) before it is finished.
  // Untouched items (no keystrokes) are not reported: the player never started them.
  useEffect(() => {
    registerItemProbe(() => {
      const t = tracker.current;
      if (done.current || t.startedAt === null) return null;
      return outcome(t.elapsed(performance.now()));
    });
    return () => registerItemProbe(null);
  }, [outcome]);

  const compile = useCallback(async (seq: number) => {
    const input = latest.current;
    if (input.seq !== seq || done.current) return;
    const engine = await getEngine(settings.language);
    const t0 = performance.now();
    const render = await engine.render(input.value);
    // Drop stale results: newer input arrived or the item already ended.
    if (latest.current.seq !== seq || done.current) return;
    lastCompile.current = { value: input.value, ok: render !== null };
    if (!render) return;
    setPreview(render);
    if (!engine.equivalent(render, target.render)) return;
    done.current = true;
    const timeMs = input.time - (tracker.current.startedAt ?? input.time);
    console.info('[game-screen] match!', { timeMs, compileMs: +(performance.now() - t0).toFixed(1) });
    onSolved();
    solve(outcome(timeMs));
  }, [settings.language, target, solve, outcome, onSolved]);

  /**
   * After SETTLE_MS without input: count a failed compile and show the error hint.
   * @param seq - sequence number of the input that scheduled this check
   */
  const settle = useCallback((seq: number) => {
    const input = latest.current;
    const result = lastCompile.current;
    if (input.seq !== seq || result?.value !== input.value) return;
    tracker.current.onSettled(input.value, result.ok);
    if (!result.ok && input.value.trim() !== '') setInvalid(true);
  }, []);

  const onEdit = useCallback((prev: string, next: string, time: number) => {
    if (tracker.current.startedAt === null) onStarted(time);
    tracker.current.onInput(prev, next, time);
    setValue(next);
    setInvalid(false);
    const seq = latest.current.seq + 1;
    latest.current = { value: next, time, seq };
    clearTimeout(timers.current.debounce);
    clearTimeout(timers.current.settle);
    timers.current.debounce = window.setTimeout(() => void compile(seq), DEBOUNCE_MS);
    timers.current.settle = window.setTimeout(() => settle(seq), SETTLE_MS);
  }, [compile, settle, onStarted]);

  const doSkip = () => {
    if (done.current) return;
    done.current = true;
    console.info('[game-screen] skip');
    skip(outcome(tracker.current.elapsed(performance.now())));
  };

  /**
   * Reveal the next hint (Shift+Tab / button). Counts one hint against the item and starts the
   * item timer if the player has not typed yet. No-op once every hint is showing.
   */
  const doHint = () => {
    if (done.current) return;
    const next = availableHints(target.expr.source[settings.language] ?? '', value, revealed.map((h) => h.token))[0];
    if (!next) {
      console.info('[game-screen] hint requested but none left');
      return;
    }
    const now = performance.now();
    if (tracker.current.startedAt === null) onStarted(now);
    tracker.current.onHint(now);
    setRevealed((r) => [...r, next]);
    console.info('[game-screen] hint revealed', { token: next.token, hintsUsed: tracker.current.hints });
  };

  const hintsLeft = availableHints(target.expr.source[settings.language] ?? '', value, revealed.map((h) => h.token)).length;

  const quit = () => (settings.mode === 'zen' ? void endRun() : abandonRun());

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' && e.key !== 'Escape') return;
    // Stop the event here: endRun resolves in a microtask, so the results screen can mount and
    // register its own window keydown listener before this same event reaches window.
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Tab') (e.shiftKey ? doHint : doSkip)();
    else quit();
  };

  return (
    <>
      <InputField ref={inputRef} value={value} onEdit={onEdit} onKeyDown={onKeyDown} invalid={invalid} />
      {revealed.length > 0 && (
        <ul className="hints" aria-label="Hints">
          {revealed.map((h) => (
            <li key={h.token}>
              use <code>{h.token}</code> for <span className="hint-shows">{h.shows}</span>
              {h.note && <span className="muted"> ({h.note})</span>}
            </li>
          ))}
        </ul>
      )}

      <p className="input-status" aria-live="polite">
        {invalid ? 'does not compile yet' : ' '}
      </p>

      <section className="stage preview" aria-label="Live preview">
        <span className="stage-label">preview</span>
        <MathView render={preview} scale={MATH_SCALE} label="Preview of your input" />
      </section>

      <div className="controls">
        <button type="button" onClick={doSkip}>Skip <kbd>Tab</kbd></button>
        <button type="button" onClick={doHint} disabled={hintsLeft === 0} title={`Costs ${SCORING_CONFIG.hintPenalty} points`}>
          Hint <kbd>Shift+Tab</kbd>
        </button>
        <button type="button" onClick={quit}>
          {settings.mode === 'zen' ? 'End session' : 'Quit'} <kbd>Esc</kbd>
        </button>
      </div>
    </>
  );
}

function HudCell({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`hud-cell ${warn ? 'low' : ''}`}>
      <span className="hud-label">{label}</span>
      <span className="hud-value">{value}</span>
    </div>
  );
}

/**
 * Re-render at ~10 fps for the clocks. Uses rAF so hidden tabs don't burn CPU.
 * @returns current performance.now()
 */
function useNow(): number {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last >= 100) {
        last = t;
        setNow(performance.now());
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return now;
}

/**
 * @param ms - duration in ms
 * @returns m:ss.t
 */
function formatClock(ms: number): string {
  const totalTenths = Math.floor(ms / 100);
  const m = Math.floor(totalTenths / 600);
  const s = Math.floor((totalTenths % 600) / 10);
  return `${m}:${String(s).padStart(2, '0')}.${totalTenths % 10}`;
}
