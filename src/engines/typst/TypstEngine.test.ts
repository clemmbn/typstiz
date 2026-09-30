/**
 * Spec §6.1 acceptance test: rendered equivalence, not source equality.
 * Runs against the real WASM compiler and self-hosted fonts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getNodeTypstEngine } from '../../test/nodeTypstEngine';
import type { TypstEngine } from './TypstEngine';

let engine: TypstEngine;
beforeAll(async () => {
  engine = await getNodeTypstEngine();
}, 30_000);

/** Render both sources and compare. Fails the test if either does not compile. */
async function same(a: string, b: string): Promise<boolean> {
  const [ra, rb] = [await engine.render(a), await engine.render(b)];
  expect(ra, `"${a}" should compile`).not.toBeNull();
  expect(rb, `"${b}" should compile`).not.toBeNull();
  return engine.equivalent(ra!, rb!);
}

describe('TypstEngine equivalence', () => {
  it('same source compiled twice is equal', async () => {
    expect(await same('x^2 + y_1', 'x^2 + y_1')).toBe(true);
  });

  it.each([
    ['x^2', 'x^(2)'],
    ['a/b', 'frac(a,b)'],
    ['a/b', 'frac(a, b)'],
    ['sum_(k=1)^n k', 'sum_(k=1)^(n) k'],
    ['alpha + beta', 'alpha+beta'],
    ['x times y', 'x × y'],
  ])('equivalent sources render equal: %s ≡ %s', async (a, b) => {
    expect(await same(a, b)).toBe(true);
  });

  it.each([
    ['x^2', 'x^3'],
    ['a/b', 'b/a'],
    ['alpha', 'beta'],
    ['x_1', 'x^1'],
  ])('different sources render differently: %s ≠ %s', async (a, b) => {
    expect(await same(a, b)).toBe(false);
  });

  it('result is independent of what was compiled before', async () => {
    const first = await engine.render('x^2');
    await engine.render('mat(1, 2; 3, 4)');
    const again = await engine.render('x^2');
    expect(engine.equivalent(first!, again!)).toBe(true);
  });

  it('returns null on compile error instead of throwing', async () => {
    expect(await engine.render('frac(a,')).toBeNull();
    expect(await engine.render('#panic("x")')).toBeNull();
  });

  it('concurrent renders do not interleave', async () => {
    const [a, b] = await Promise.all([engine.render('x^2'), engine.render('y^3')]);
    const [a2, b2] = [await engine.render('x^2'), await engine.render('y^3')];
    expect(a!.key).toBe(a2!.key);
    expect(b!.key).toBe(b2!.key);
  });
});
