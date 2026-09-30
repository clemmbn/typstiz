/**
 * Generator tests: determinism, guards, tier mix, and spec §7.1 "every generated expression
 * compiles" against the real Typst engine.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getNodeTypstEngine } from '../test/nodeTypstEngine';
import type { TypstEngine } from '../engines/typst/TypstEngine';
import { createGenerator, fill, GENERATOR_CONFIG, type Difficulty } from './generate';
import { TEMPLATES } from './templates/typst';
import type { Tier } from './types';

/** Take the first `n` typst sources of a generator. */
function take(seed: string, difficulty: Difficulty, n: number): string[] {
  const gen = createGenerator(seed, difficulty);
  return Array.from({ length: n }, () => gen.next().source.typst!);
}

describe('generator determinism and guards', () => {
  it('same seed and settings give the same sequence', () => {
    expect(take('abc', 'random', 200)).toEqual(take('abc', 'random', 200));
  });

  it('different seeds give different sequences', () => {
    expect(take('abc', 'medium', 20)).not.toEqual(take('abd', 'medium', 20));
  });

  it('never repeats an expression back to back', () => {
    for (const d of ['easy', 'medium', 'hard', 'random'] as const) {
      const seq = take('repeat-' + d, d, 2000);
      for (let i = 1; i < seq.length; i++) expect(seq[i]).not.toBe(seq[i - 1]);
    }
  });

  it('never emits degenerate forms or unfilled placeholders', () => {
    const byId = new Map(TEMPLATES.map((t) => [t.id, t]));
    const gen = createGenerator('degenerate', 'random');
    for (let i = 0; i < 5000; i++) {
      const expr = gen.next();
      const src = expr.source.typst!;
      expect(src).not.toMatch(/\^\(?1\)?(?![\d.])/);
      expect(src).not.toMatch(/frac\(1, ?1\)/);
      // Literal braces are allowed; a leftover `{name}` where name is one of this template's
      // slots means substitution failed.
      const slots = new Set(Object.keys(byId.get(expr.templateId)!.slots));
      for (const m of src.matchAll(/\{(\w+)\}/g)) expect(slots.has(m[1]), `${m[0]} in ${src}`).toBe(false);
    }
  });

  it('random difficulty roughly follows the 40/40/20 mix', () => {
    const gen = createGenerator('mix', 'random');
    const counts: Record<Tier, number> = { easy: 0, medium: 0, hard: 0 };
    for (let i = 0; i < 10_000; i++) counts[gen.next().tier]++;
    expect(counts.easy / 10_000).toBeCloseTo(0.4, 1);
    expect(counts.medium / 10_000).toBeCloseTo(0.4, 1);
    expect(counts.hard / 10_000).toBeCloseTo(0.2, 1);
  });

  it('fill leaves unknown braces untouched', () => {
    expect(fill('{ {v} in RR }', { v: 'x' })).toBe('{ x in RR }');
  });

  it('average source length per tier sits near the configured guideline', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      const lens = take('len-' + tier, tier, 2000).map((s) => s.length);
      const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
      const [min, max] = GENERATOR_CONFIG.lengthGuide[tier];
      console.info(`[generator] ${tier}: avg length ${avg.toFixed(1)} (guide ${min}-${max})`);
      // Guideline only: allow slack, but catch a tier drifting into another tier's range.
      expect(avg).toBeGreaterThanOrEqual(min * 0.7);
      expect(avg).toBeLessThanOrEqual(max * 1.3);
    }
  });
});

describe('every generated expression compiles', () => {
  let engine: TypstEngine;
  beforeAll(async () => {
    engine = await getNodeTypstEngine();
  }, 30_000);

  it.each(['easy', 'medium', 'hard'] as const)('%s tier: 3000 expressions across 30 seeds', async (tier) => {
    const failures = new Set<string>();
    for (let s = 0; s < 30; s++) {
      for (const src of take(`compile-${tier}-${s}`, tier, 100)) {
        if (!(await engine.render(src))) failures.add(src);
      }
    }
    expect([...failures]).toEqual([]);
  }, 120_000);
});
