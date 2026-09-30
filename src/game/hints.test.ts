/** Tests for symbol hints: token extraction, filtering and dictionary coverage of the bank. */
import { describe, expect, it } from 'vitest';
import { createGenerator } from '../generator/generate';
import { availableHints, HINTS, PLAIN, tokenize } from './hints';

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
