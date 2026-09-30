/**
 * Session state machine (Zustand).
 *
 * Screens: start → countdown → game → results (→ start | countdown), plus a stats view.
 * The store owns the run: seed, generator, current target, recorded items and the global clock.
 * Per-keystroke state (input value, metrics tracker, debounce timers) stays in GameScreen, which
 * reports finished items through `solve` / `skip`.
 *
 * Constraints:
 * - The game only talks to `MathEngine` via the registry, never to Typst directly.
 * - Timed runs end exactly at `endsAt`; `solve` calls arriving after the buzzer are discarded
 *   (a compile in flight at the buzzer does not count).
 */
import { create } from 'zustand';
import { getEngine } from '../engines/registry';
import type { MathEngine, RenderResult } from '../engines/types';
import { createGenerator, type ExpressionGenerator } from '../generator/generate';
import { randomSeed } from '../generator/rng';
import type { Expression } from '../generator/types';
import { LocalScoreRepository } from '../storage/LocalScoreRepository';
import type { ScoreRepository } from '../storage/ScoreRepository';
import { scoreItem, scoreRun } from './scoring';
import { SCORING_CONFIG } from './scoring.config';
import { loadSettings, saveSettings } from './settings';
import type { GameSettings, ItemRecord, RunRecord } from './types';

export type Screen = 'start' | 'countdown' | 'game' | 'results' | 'stats';
export type EngineStatus = 'loading' | 'ready' | 'error';

/** Current target: the generated expression plus its reference render. */
export type Target = { expr: Expression; render: RenderResult };

/** Metrics the game screen reports when an item ends. */
export type ItemOutcome = {
  timeMs: number;
  keystrokes: number;
  deletions: number;
  failedCompiles: number;
};

type RunState = {
  settings: GameSettings;
  seed: string;
  generator: ExpressionGenerator;
  target: Target;
  items: ItemRecord[];
  /** performance.now() when play started (after the countdown); null during the countdown. */
  startedAt: number | null;
  /** Timed mode only: performance.now() at which the run ends. */
  endsAt: number | null;
  /** Timestamp at which the run ended; null while running. */
  endedAt: number | null;
};

type GameStore = {
  screen: Screen;
  engineStatus: EngineStatus;
  engineError: string | null;
  settings: GameSettings;
  run: RunState | null;
  lastRun: RunRecord | null;
  lastRunIsBest: boolean;

  initEngine(): Promise<void>;
  updateSettings(patch: Partial<GameSettings>): void;
  startRun(): Promise<void>;
  beginPlay(): void;
  solve(outcome: ItemOutcome): void;
  skip(outcome: ItemOutcome): void;
  endRun(): Promise<void>;
  abandonRun(): void;
  goTo(screen: 'start' | 'stats'): void;
};

const LOG = '[game]';
export const repository: ScoreRepository = new LocalScoreRepository();

/**
 * Generate the next expression and render it. Expressions that fail to compile are skipped with
 * a loud warning; the compile test suite should make this unreachable.
 * @param engine - ready engine
 * @param generator - run's generator
 * @returns next target
 */
async function nextTarget(engine: MathEngine, generator: ExpressionGenerator): Promise<Target> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const expr = generator.next();
    const render = await engine.render(expr.source[engine.id] ?? '');
    if (render) return { expr, render };
    console.error(`${LOG} generated target failed to compile, skipping`, expr);
  }
  throw new Error('Could not generate a compilable expression');
}

/**
 * Build the persisted item record for the current target.
 * @param run - active run
 * @param outcome - metrics from the game screen
 * @param skipped - whether the item was skipped
 */
function toItemRecord(run: RunState, outcome: ItemOutcome, skipped: boolean): ItemRecord {
  const { expr } = run.target;
  const source = expr.source[run.settings.language] ?? '';
  const metrics = {
    ...outcome,
    tier: expr.tier,
    skipped,
    targetSourceLength: source.length,
  };
  return { ...metrics, index: expr.index, templateId: expr.templateId, source, score: scoreItem(metrics) };
}

/** @returns true when the run can still accept item results */
function isLive(run: RunState | null): run is RunState {
  if (!run || run.startedAt === null || run.endedAt !== null) return false;
  return run.endsAt === null || performance.now() < run.endsAt;
}

export const useGame = create<GameStore>((set, get) => {
  /**
   * Record an item and move to the next target.
   * @param outcome - reported metrics
   * @param skipped - skip vs solve
   */
  async function finishItem(outcome: ItemOutcome, skipped: boolean): Promise<void> {
    const run = get().run;
    if (!isLive(run)) {
      console.info(`${LOG} item result discarded: run not live (buzzer or ended)`);
      return;
    }
    const item = toItemRecord(run, outcome, skipped);
    console.info(`${LOG} item ${skipped ? 'skipped' : 'solved'}`, item);
    const engine = await getEngine(run.settings.language);
    const target = await nextTarget(engine, run.generator);
    // Skip penalty shortens the timed clock (config default 0).
    const penaltyMs = skipped && run.endsAt !== null ? SCORING_CONFIG.skipTimePenaltySec * 1000 : 0;
    const latest = get().run;
    if (latest !== run || !isLive(latest)) return;
    set({
      run: {
        ...run,
        items: [...run.items, item],
        target,
        endsAt: run.endsAt === null ? null : run.endsAt - penaltyMs,
      },
    });
  }

  return {
    screen: 'start',
    engineStatus: 'loading',
    engineError: null,
    settings: loadSettings(),
    run: null,
    lastRun: null,
    lastRunIsBest: false,

    async initEngine() {
      const { language } = get().settings;
      set({ engineStatus: 'loading', engineError: null });
      try {
        await getEngine(language);
        console.info(`${LOG} engine ready: ${language}`);
        set({ engineStatus: 'ready' });
      } catch (err) {
        console.error(`${LOG} engine failed to load`, err);
        set({ engineStatus: 'error', engineError: err instanceof Error ? err.message : String(err) });
      }
    },

    updateSettings(patch) {
      const settings = { ...get().settings, ...patch };
      saveSettings(settings);
      set({ settings });
    },

    async startRun() {
      const settings = get().settings;
      const seed = settings.seed.trim() || randomSeed();
      console.info(`${LOG} starting run`, { ...settings, seed });
      const engine = await getEngine(settings.language);
      const generator = createGenerator(seed, settings.difficulty);
      const target = await nextTarget(engine, generator);
      set({
        screen: 'countdown',
        run: { settings, seed, generator, target, items: [], startedAt: null, endsAt: null, endedAt: null },
      });
    },

    beginPlay() {
      const run = get().run;
      if (!run) return;
      const now = performance.now();
      const endsAt = run.settings.mode === 'timed' ? now + run.settings.durationSec * 1000 : null;
      console.info(`${LOG} go!`, { endsAt });
      set({ screen: 'game', run: { ...run, startedAt: now, endsAt } });
    },

    solve: (outcome) => void finishItem(outcome, false),
    skip: (outcome) => void finishItem(outcome, true),

    async endRun() {
      const run = get().run;
      if (!run || run.endedAt !== null) return;
      const endedAt = performance.now();
      set({ run: { ...run, endedAt } });
      const { settings } = run;
      const record: RunRecord = {
        schemaVersion: 1,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        language: settings.language,
        mode: settings.mode,
        durationSec: settings.mode === 'timed' ? settings.durationSec : undefined,
        difficulty: settings.difficulty,
        seed: run.seed,
        score: scoreRun(run.items),
        items: run.items,
        appVersion: __APP_VERSION__,
      };
      console.info(`${LOG} run ended`, { score: record.score, items: record.items.length });
      // Empty runs (quit immediately) are shown but not stored, so they can't pollute stats.
      const { isNewBest } = record.items.length > 0 ? await repository.saveRun(record) : { isNewBest: false };
      set({ screen: 'results', lastRun: record, lastRunIsBest: isNewBest });
    },

    abandonRun() {
      console.info(`${LOG} run abandoned`);
      set({ run: null, screen: 'start' });
    },

    goTo(screen) {
      set({ screen, run: null });
    },
  };
});
