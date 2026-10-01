/**
 * Seeded expression generator.
 *
 * Given (seed, difficulty) it yields a deterministic sequence of expressions: the i-th expression
 * of a run depends only on the seed, the difficulty and the template bank, never on player
 * actions. That makes runs reproducible and lets a server regenerate targets later.
 *
 * Guards (spec §7.1): generic degeneracy regexes (`x^1`, `frac(1, 1)`, `1/1`), per-template
 * `accept`/`distinct` rules, and no back-to-back repeats. Rejected samples are retried with the
 * same RNG stream, so determinism is preserved.
 *
 * Every expression carries a source for every language. Guards run on the Typst spelling; since
 * templates are parallel, a rejected sample is rejected for all languages, and the RNG stream
 * (hence the sequence) is the same whichever language is played.
 */
import type { LanguageId } from '../engines/types';
import { createRng, type Rng } from './rng';
import { TEMPLATES } from './templates/bank';
import type { Expression, SlotSpec, SlotValues, Template, Tier } from './types';

/** A sampled slot value, spelled per language. */
type Spelled = Record<LanguageId, string>;

export type Difficulty = Tier | 'random';

/** Pools for symbolic slot kinds. `e`, `i`, `d` are excluded: they read as constants/operators. */
const POOLS = {
  var: ['x', 'y', 'z', 't', 'u', 'v', 'w', 's', 'r', 'p', 'q'],
  greek: ['alpha', 'beta', 'gamma', 'delta', 'theta', 'lambda', 'mu', 'sigma', 'phi', 'omega', 'rho', 'tau'],
  fn: ['sin', 'cos', 'tan', 'ln', 'log', 'exp'],
  index: ['i', 'j', 'k'],
} as const;

export type GeneratorConfig = {
  /** Tier weights used by `random` difficulty (spec default 40/40/20). */
  randomMix: Record<Tier, number>;
  /** Target source length guidelines per tier (spec §7.2), exposed as config; used in tests. */
  lengthGuide: Record<Tier, [number, number]>;
  /** Max resampling attempts before accepting a sample anyway (prevents infinite loops). */
  maxAttempts: number;
};

export const GENERATOR_CONFIG: GeneratorConfig = {
  randomMix: { easy: 40, medium: 40, hard: 20 },
  lengthGuide: { easy: [5, 15], medium: [15, 35], hard: [30, 80] },
  maxAttempts: 50,
};

/**
 * Degenerate patterns that should never appear in a target. Exported so tests check the exact
 * same rules.
 */
export const DEGENERATE = [
  // x^1 or x^(1). The lookbehind exempts an upper limit that follows a lower one
  // (`integral_0^1`, `sum_(i=0)^1`), where 1 is a bound, not an exponent.
  /(?<!_(?:\w+|\([^)]*\)))\^\(?1\)?(?![\d.])/,
  /frac\(1, ?1\)/,
  /(?<![\d.])1\/1(?![\d.])/,
];

/** Pool kinds whose LaTeX spelling is a control word (`alpha` → `\alpha`, `sin` → `\sin`). */
const LATEX_COMMAND_POOLS: ReadonlySet<keyof typeof POOLS> = new Set(['greek', 'fn']);

/** @returns the same text for every language */
function everywhere(text: string): Spelled {
  return { typst: text, latex: text };
}

/**
 * Sample one slot value. Makes exactly the same RNG calls as when only Typst existed, so Typst
 * sequences for a given seed are unchanged.
 * @param rng - RNG stream
 * @param spec - slot spec
 * @returns value as source text, per language
 */
function sampleSlot(rng: Rng, spec: SlotSpec): Spelled {
  switch (spec.kind) {
    case 'int': {
      // Rejection sampling over a small range; `exclude` is expected to be tiny.
      for (;;) {
        const n = rng.int(spec.min, spec.max);
        if (!spec.exclude?.includes(n)) return everywhere(String(n));
      }
    }
    case 'choice': {
      const option = rng.pick(spec.options);
      return typeof option === 'string' ? everywhere(option) : option;
    }
    default: {
      const value = rng.pick(POOLS[spec.kind]);
      return { typst: value, latex: LATEX_COMMAND_POOLS.has(spec.kind) ? `\\${value}` : value };
    }
  }
}

/**
 * Substitute `{slot}` placeholders. Unknown names are left untouched so literal braces survive.
 * @param source - template source
 * @param values - slot values
 * @returns concrete source
 */
export function fill(source: string, values: SlotValues): string {
  return source.replace(/\{(\w+)\}/g, (whole, name: string) => values[name] ?? whole);
}

/**
 * Sample slot values and render one template in every language.
 * @param rng - RNG stream
 * @param t - template
 * @returns concrete sources, or null when the sample violates a guard
 */
function instantiate(rng: Rng, t: Template): Spelled | null {
  // `values` holds Typst spellings: guards, `accept` and `derive` are written against them.
  const values: SlotValues = {};
  const latexValues: SlotValues = {};
  for (const [name, spec] of Object.entries(t.slots)) {
    const v = sampleSlot(rng, spec);
    values[name] = v.typst;
    latexValues[name] = v.latex;
  }
  if (t.distinct) {
    const picked = t.distinct.map((n) => values[n]);
    if (new Set(picked).size !== picked.length) return null;
  }
  if (t.accept && !t.accept(values)) return null;
  const derived = t.derive?.(values);
  Object.assign(values, derived);
  Object.assign(latexValues, derived);
  const typst = fill(t.typst, values);
  if (DEGENERATE.some((re) => re.test(typst))) return null;
  return { typst, latex: fill(t.latex, latexValues) };
}

/**
 * Pick the tier for the next expression.
 * @param rng - RNG stream
 * @param difficulty - fixed tier or `random`
 * @param mix - weights for `random`
 */
function pickTier(rng: Rng, difficulty: Difficulty, mix: Record<Tier, number>): Tier {
  if (difficulty !== 'random') return difficulty;
  const total = mix.easy + mix.medium + mix.hard;
  let r = rng.next() * total;
  for (const tier of ['easy', 'medium', 'hard'] as const) {
    r -= mix[tier];
    if (r < 0) return tier;
  }
  return 'hard';
}

export type ExpressionGenerator = {
  next(): Expression;
};

/**
 * Create a deterministic generator.
 * @param seed - run seed
 * @param difficulty - tier or `random`
 * @param templates - template bank (injectable for tests)
 * @param config - generator config
 * @returns generator; `next()` returns the following expression in the sequence
 */
export function createGenerator(
  seed: string,
  difficulty: Difficulty,
  templates: Template[] = TEMPLATES,
  config: GeneratorConfig = GENERATOR_CONFIG,
): ExpressionGenerator {
  const rng = createRng(seed);
  const byTier: Record<Tier, Template[]> = { easy: [], medium: [], hard: [] };
  for (const t of templates) byTier[t.tier].push(t);
  let index = 0;
  let previous = '';

  return {
    next(): Expression {
      const tier = pickTier(rng, difficulty, config.randomMix);
      const pool = byTier[tier];
      let template = pool[0];
      let source: Spelled | null = null;
      // Last sample that passed the guards but repeated the previous expression; used only
      // if every attempt fails, which should never happen with a healthy bank.
      let fallback: Spelled | null = null;
      for (let attempt = 0; attempt < config.maxAttempts && source === null; attempt++) {
        template = rng.pick(pool);
        const candidate = instantiate(rng, template);
        if (candidate === null) continue;
        // Repeats are judged on the Typst spelling, the language-independent identity.
        if (candidate.typst === previous) fallback = candidate;
        else source = candidate;
      }
      if (source === null) {
        console.warn('[generator] guard attempts exhausted', { tier, index, fallback });
        if (fallback === null) throw new Error(`Generator could not produce a ${tier} expression`);
        source = fallback;
      }
      previous = source.typst;
      return { index: index++, tier, templateId: template.id, source };
    },
  };
}
