/**
 * Generator tests: determinism, guards, tier mix, and spec §7.1 "every generated expression
 * compiles" against the real Typst and KaTeX engines.
 */
import { createHash } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { getNodeTypstEngine } from '../test/nodeTypstEngine';
import { KatexEngine } from '../engines/latex/KatexEngine';
import type { MathEngine } from '../engines/types';
import { createGenerator, DEGENERATE, fill, GENERATOR_CONFIG, type Difficulty } from './generate';
import { TEMPLATES } from './templates/bank';
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
      for (const re of DEGENERATE) expect(src).not.toMatch(re);
      // Literal braces are allowed; a leftover `{name}` where name is one of this template's
      // slots means substitution failed.
      const slots = new Set(Object.keys(byId.get(expr.templateId)!.slots));
      for (const m of src.matchAll(/\{(\w+)\}/g)) expect(slots.has(m[1]), `${m[0]} in ${src}`).toBe(false);
    }
  });

  it('flags exponent 1 but not an upper limit of 1', () => {
    const isDegenerate = (src: string) => DEGENERATE.some((re) => re.test(src));
    for (const src of ['x^1', 'x^(1)', 'e^1 + y']) expect(isDegenerate(src), src).toBe(true);
    for (const src of ['integral_0^1 x dif x', 'integral_(-1)^1 x', 'sum_(i=0)^1 i', 'x^12', 'x^1.5'])
      expect(isDegenerate(src), src).toBe(false);
  });

  it('m-integral can use 1 as its upper limit', () => {
    const gen = createGenerator('upper-one', 'medium');
    const hits = Array.from({ length: 3000 }, () => gen.next()).filter(
      (e) => e.templateId === 'm-integral' && /\^1 /.test(e.source.typst!),
    );
    expect(hits.length).toBeGreaterThan(0);
  });

  it('random difficulty roughly follows the 40/40/20 mix', () => {
    const gen = createGenerator('mix', 'random');
    const counts: Record<Tier, number> = { easy: 0, medium: 0, hard: 0 };
    for (let i = 0; i < 10_000; i++) counts[gen.next().tier]++;
    expect(counts.easy / 10_000).toBeCloseTo(0.4, 1);
    expect(counts.medium / 10_000).toBeCloseTo(0.4, 1);
    expect(counts.hard / 10_000).toBeCloseTo(0.2, 1);
  });

  it('Typst sequences for a seed are unchanged by LaTeX support', () => {
    // Fingerprints recorded before LaTeX mode existed: stored runs keep replaying the same targets.
    const expected = {
      easy: '2c5ab5e5d65c85604c425f236db231a0c3961c8e8e891b9f3c38baf96c54f7c8',
      medium: '919b58bb1f611def719609ef19857e13f404123667daba14c474db7705b7cf14',
      hard: '8cb39803c537544cf63a2ba2faf5f0622d6d4f653a05407ae286921f37a125be',
      random: '1d81c08aa24977f57fc25c108c3ff8dd4dd0c0ecaa6f1282a49cdb331ab2a069',
    };
    for (const [d, hash] of Object.entries(expected)) {
      const gen = createGenerator('baseline-' + d, d as Difficulty);
      const lines = Array.from({ length: 2000 }, () => {
        const e = gen.next();
        return `${e.index}|${e.tier}|${e.templateId}|${e.source.typst}`;
      });
      expect(createHash('sha256').update(lines.join('\n')).digest('hex'), d).toBe(hash);
    }
  });

  it('every expression has a source in every language', () => {
    const gen = createGenerator('latex-fill', 'random');
    for (let i = 0; i < 3000; i++) expect(gen.next().source.latex).toBeTruthy();
  });

  it('LaTeX and Typst sources of a template use the same placeholders', () => {
    for (const t of TEMPLATES) {
      // Derived slot names come from running `derive` on a dummy sample.
      const dummy = Object.fromEntries(Object.keys(t.slots).map((k) => [k, '2']));
      const known = new Set([...Object.keys(t.slots), ...Object.keys(t.derive?.(dummy) ?? {})]);
      const used = (src: string) => [...new Set([...src.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).filter((n) => known.has(n)))].sort();
      expect(used(t.latex), t.id).toEqual(used(t.typst));
    }
  });

  it('LaTeX templates never use a bare slot name as a command argument', () => {
    // `\mathbb{R}` with a slot `R` would be substituted; slot arguments must be `{{R}}`.
    for (const t of TEMPLATES) {
      for (const m of t.latex.matchAll(/\\[A-Za-z]+\{(\w+)\}/g)) {
        expect(m[1] in t.slots, `${t.id}: ${m[0]}`).toBe(false);
      }
    }
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

describe.each([
  ['typst', () => getNodeTypstEngine()],
  ['latex', async () => new KatexEngine()],
] as const)('every generated expression compiles (%s)', (language, load) => {
  let engine: MathEngine;
  beforeAll(async () => {
    engine = await load();
    await engine.init();
  }, 30_000);

  it.each(['easy', 'medium', 'hard'] as const)('%s tier: 3000 expressions across 30 seeds', async (tier) => {
    const failures = new Set<string>();
    for (let s = 0; s < 30; s++) {
      const gen = createGenerator(`compile-${tier}-${s}`, tier);
      for (let i = 0; i < 100; i++) {
        const src = gen.next().source[language];
        if (!(await engine.render(src))) failures.add(src);
      }
    }
    expect([...failures]).toEqual([]);
  }, 120_000);
});
