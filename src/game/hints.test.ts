/** Tests for symbol hints: token extraction, filtering and dictionary coverage of the bank. */
import { describe, expect, it } from 'vitest';
import { createGenerator } from '../generator/generate';
import { availableHints, HINTS, PLAIN, tokenize } from './hints';
import { LATEX_HINTS, LATEX_PLAIN, tokenizeLatex, typedLatexToken } from './hints.latex';

describe('tokenize', () => {
  it('finds words, dotted names and operators; skips variables, strings and numbers', () => {
    expect(tokenize('ceil(log_2 x) plus.minus 3 -> y "if" x')).toEqual(['ceil', 'log', 'plus.minus', '->']);
  });

  it('dedupes in order of first appearance', () => {
    expect(tokenize('sqrt(a) + sqrt(b) + ceil(c)')).toEqual(['sqrt', 'ceil']);
  });
});

describe('availableHints', () => {
  it('lists dictionary tokens in order, without plain functions', () => {
    expect(availableHints('ceil(log_2 x) <= alpha', '', []).map((h) => h.token)).toEqual(['ceil', '<=', 'alpha']);
  });

  it('skips revealed tokens and tokens the player already typed', () => {
    expect(availableHints('ceil(x) <= alpha', 'ceil(x)', ['<=']).map((h) => h.token)).toEqual(['alpha']);
  });
});

describe('dictionary coverage', () => {
  it('every multi-letter token of the generated bank has a hint or is deliberately plain', () => {
    const missing = new Set<string>();
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      // Many samples so every template is instantiated with several slot values.
      const gen = createGenerator('hints-coverage', difficulty);
      for (let i = 0; i < 300; i++) {
        for (const token of tokenize(gen.next().source.typst ?? '')) {
          if (!(token in HINTS) && !PLAIN.has(token)) missing.add(token);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});

describe('LaTeX hints', () => {
  it('tokenizes control words, control symbols and environments', () => {
    expect(tokenizeLatex(String.raw`\left\lfloor \frac{x}{2} \right\rfloor \, \| \begin{cases} a \\ b \end{cases}`)).toEqual([
      '\\left', '\\lfloor', '\\frac', '\\right', '\\rfloor', '\\,', '\\|', '\\begin{cases}', '\\\\', '\\end',
    ]);
  });

  it('a typed control word only counts when it ends there', () => {
    expect(typedLatexToken(String.raw`\int_0^1`, '\\in')).toBe(false);
    expect(typedLatexToken(String.raw`x \in A`, '\\in')).toBe(true);
    expect(typedLatexToken(String.raw`\in_`, '\\in')).toBe(true);
  });

  it('availableHints dispatches on the language', () => {
    const src = String.raw`\lceil \log_2 x \rceil \le \alpha`;
    expect(availableHints(src, String.raw`\lceil`, [], 'latex').map((h) => h.token)).toEqual(['\\log', '\\rceil', '\\le', '\\alpha']);
  });

  it('every command of the generated LaTeX bank has a hint or is deliberately plain', () => {
    const missing = new Set<string>();
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const gen = createGenerator('hints-coverage', difficulty);
      for (let i = 0; i < 300; i++) {
        for (const token of tokenizeLatex(gen.next().source.latex)) {
          if (!(token in LATEX_HINTS) && !LATEX_PLAIN.has(token)) missing.add(token);
        }
      }
    }
    expect([...missing]).toEqual([]);
  });
});
