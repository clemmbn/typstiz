/**
 * Spec §6.1 acceptance test for LaTeX mode: rendered equivalence, not source equality.
 * Runs against the real KaTeX build; the stylesheet/font setup is browser-only and not needed for
 * the comparison key.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { KatexEngine } from './KatexEngine';
import { normalizeKatex } from './normalize';

const engine = new KatexEngine();
beforeAll(() => engine.init());

/** Render both sources and compare. Fails the test if either does not render. */
async function same(a: string, b: string): Promise<boolean> {
  const [ra, rb] = [await engine.render(a), await engine.render(b)];
  expect(ra, `"${a}" should render`).not.toBeNull();
  expect(rb, `"${b}" should render`).not.toBeNull();
  return engine.equivalent(ra!, rb!);
}

describe('KatexEngine equivalence', () => {
  it('same source rendered twice is equal', async () => {
    expect(await same('x^2 + y_1', 'x^2 + y_1')).toBe(true);
  });

  it.each([
    ['x^2', 'x^{2}'],
    ['x_1', 'x_{1}'],
    ['\\frac{a}{b}', '\\frac ab'],
    ['\\frac{a}{b}', '\\dfrac{a}{b}'],
    ['\\sum_{k=1}^n k', '\\sum_{k=1}^{n} k'],
    ['\\sum_{k=1}^n k', '\\sum\\limits_{k=1}^{n} k'],
    ['\\alpha + \\beta', '\\alpha+\\beta'],
    ['ab', 'a b'],
    ['{a}{b}', 'ab'],
    ['\\le', '\\leq'],
    ['\\ne', '\\neq'],
    ['\\to', '\\rightarrow'],
    ['\\{x\\}', '\\lbrace x \\rbrace'],
    ['\\mathbb{R}', '\\R'],
    ['e^{i\\pi}', 'e^{i \\pi}'],
    ['\\sqrt{x^2}', '\\sqrt{x^{2}}'],
    ['\\frac{1}{x^{2}}', '\\frac1{x^2}'],
    ['\\int_0^1 x \\,dx', '\\int_{0}^{1} x\\, dx'],
  ])('equivalent sources render equal: %s ≡ %s', async (a, b) => {
    expect(await same(a, b)).toBe(true);
  });

  it.each([
    ['x^2', 'x^3'],
    ['\\frac{a}{b}', '\\frac{b}{a}'],
    ['\\alpha', '\\beta'],
    ['x_1', 'x^1'],
    ['\\sin x', 'sin x'],
    ['(\\frac{1}{2})', '\\left(\\frac{1}{2}\\right)'],
    ['\\mathrm{d}x', 'dx'],
    ['a-b', '{-}b'],
  ])('different sources render differently: %s ≠ %s', async (a, b) => {
    expect(await same(a, b)).toBe(false);
  });

  it('returns null on parse errors instead of throwing', async () => {
    expect(await engine.render('\\frac{a}{')).toBeNull();
    expect(await engine.render('\\notacommand')).toBeNull();
    expect(await engine.render('x^')).toBeNull();
  });

  it('treats commands refused by trust: false as errors', async () => {
    expect(await engine.render('\\href{https://example.com}{x}')).toBeNull();
    expect(await engine.render('\\htmlClass{a}{x}')).toBeNull();
  });

  it('result is independent of what was rendered before', async () => {
    const first = await engine.render('x^2');
    await engine.render('\\def\\foo{y}\\foo');
    await engine.render('\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}');
    const again = await engine.render('x^2');
    expect(engine.equivalent(first!, again!)).toBe(true);
    // Macros must not leak between renders.
    expect(await engine.render('\\foo')).toBeNull();
  });

  it('returns HTML markup for display', async () => {
    const r = await engine.render('x^2');
    expect(r!.format).toBe('html');
    expect(r!.markup).toContain('class="katex');
  });
});

describe('normalizeKatex', () => {
  it('drops inert classes and unwraps bare spans', () => {
    expect(normalizeKatex('<span class="mord"><span class="mord mathnormal">x</span></span>')).toBe(
      '<span class="mathnormal">x</span>',
    );
  });

  it('keeps bare spans under structural parents', () => {
    const markup = '<span class="vlist"><span style="top:-3em;"><span class="mord">x</span></span></span>';
    expect(normalizeKatex(markup)).toBe('<span class="vlist"><span style="top:-3em;"><span>x</span></span></span>');
  });

  it('keeps svg geometry', () => {
    expect(normalizeKatex('<svg width="1em"><path d="M0 0"/></svg>')).toBe('<svg width="1em"><path d="M0 0"></path></svg>');
  });

  it('throws on unbalanced markup', () => {
    expect(() => normalizeKatex('<span>x')).toThrow();
  });
});
