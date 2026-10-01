/**
 * Symbol hints: "use `ceil` for ⌈ ⌉" (a learning aid that costs score, see `hintPenalty`).
 *
 * A hint is derived from the target's Typst source: every word/operator token found in the
 * `HINTS` dictionary can be revealed. Plain letters, digits and slot values need no hint, and
 * common function names (`sin`, `log`, ...) are listed in `PLAIN` so the coverage test can tell
 * "deliberately unhinted" from "forgot to add".
 *
 * Trade-off: the dictionary is keyed by token, not by template, so new templates get hints for
 * free as long as they reuse known tokens; `hints.test.ts` fails when one introduces a new token.
 *
 * LaTeX mode uses its own dictionary and tokenizer (`hints.latex.ts`); `availableHints` dispatches
 * on the language.
 */
import type { LanguageId } from '../engines/types';
import { LATEX_HINTS, tokenizeLatex, typedLatexToken } from './hints.latex';

/** One dictionary entry: what the token renders as, plus an optional plain-words description. */
export type HintInfo = { shows: string; note?: string };

/** A hint ready for display. */
export type Hint = { token: string; shows: string; note?: string };

export const HINTS: Record<string, HintInfo> = {
  // Operators and relations
  '->': { shows: '→' },
  '=>': { shows: '⇒', note: 'implies' },
  '<=': { shows: '≤' },
  '>=': { shows: '≥' },
  '!=': { shows: '≠' },
  'plus.minus': { shows: '±' },
  dot: { shows: '⋅', note: 'multiplication dot' },
  times: { shows: '×' },
  approx: { shows: '≈' },
  equiv: { shows: '≡' },
  divides: { shows: '∣' },
  in: { shows: '∈' },
  forall: { shows: '∀' },
  exists: { shows: '∃' },
  quad: { shows: '␣␣', note: 'wide horizontal space' },
  // Sets
  RR: { shows: 'ℝ' },
  bb: { shows: '𝔹', note: 'blackboard bold, e.g. bb(Z) gives ℤ' },
  sect: { shows: '∩' },
  union: { shows: '∪' },
  'subset.eq': { shows: '⊆' },
  emptyset: { shows: '∅' },
  // Calculus and big operators
  sum: { shows: '∑' },
  product: { shows: '∏' },
  integral: { shows: '∫' },
  'integral.double': { shows: '∬' },
  dif: { shows: 'd', note: 'upright differential' },
  partial: { shows: '∂' },
  nabla: { shows: '∇' },
  infinity: { shows: '∞' },
  // Delimiters, roots and layout
  sqrt: { shows: '√' },
  root: { shows: 'ⁿ√', note: 'root(n, x) is the n-th root' },
  floor: { shows: '⌊ ⌋' },
  ceil: { shows: '⌈ ⌉' },
  norm: { shows: '‖ ‖' },
  binom: { shows: '(ⁿₖ)', note: 'binomial coefficient' },
  cases: { shows: '{', note: 'piecewise definition, cases(a "if" b, c "if" d)' },
  mat: { shows: '[ ]', note: 'matrix, rows separated by ;' },
  vec: { shows: 'column vector' },
  op: { shows: 'operator', note: 'op("sgn") sets a word upright like sin' },
  // Styles and accents
  bold: { shows: '𝐱', note: 'bold' },
  cal: { shows: '𝓛', note: 'calligraphic' },
  overline: { shows: 'x̄', note: 'bar over the argument' },
  hat: { shows: 'x̂' },
  tilde: { shows: 'x̃' },
  arrow: { shows: 'x⃗', note: 'vector arrow' },
  macron: { shows: 'x̄' },
  'dots.h': { shows: '⋯' },
  'dots.v': { shows: '⋮' },
  'dots.down': { shows: '⋱' },
  // Greek
  alpha: { shows: 'α' },
  beta: { shows: 'β' },
  gamma: { shows: 'γ' },
  delta: { shows: 'δ' },
  epsilon: { shows: 'ε' },
  theta: { shows: 'θ' },
  lambda: { shows: 'λ' },
  mu: { shows: 'μ' },
  pi: { shows: 'π' },
  rho: { shows: 'ρ' },
  sigma: { shows: 'σ' },
  tau: { shows: 'τ' },
  phi: { shows: 'φ' },
  psi: { shows: 'ψ' },
  omega: { shows: 'ω' },
};

/** Multi-letter tokens that intentionally get no hint (operators typed exactly as they read). */
export const PLAIN: ReadonlySet<string> = new Set(['sin', 'cos', 'tan', 'ln', 'log', 'exp', 'lim', 'det', 'mod']);

/**
 * Extract the words and operators of a Typst source that could need a hint.
 * Quoted strings are dropped first (`"if"` is text, not math), and single letters are never
 * tokens: they are variables.
 * @param source - Typst source
 * @returns tokens in order of first appearance, without duplicates
 */
export function tokenize(source: string): string[] {
  const cleaned = source.replace(/"[^"]*"/g, ' ');
  const found = cleaned.match(/[A-Za-z][A-Za-z]+(?:\.[A-Za-z]+)*|->|=>|<=|>=|!=/g) ?? [];
  return [...new Set(found)];
}

/**
 * Hints that could still be revealed for a target.
 * @param source - target source in `language`
 * @param typed - what the player has typed so far; tokens already present are skipped, since
 *   the player evidently knows them
 * @param revealed - tokens whose hint is already on screen
 * @param language - language of `source` (LaTeX hints live in `hints.latex.ts`)
 * @returns unrevealed hints in order of appearance in the target
 */
export function availableHints(source: string, typed: string, revealed: readonly string[], language: LanguageId = 'typst'): Hint[] {
  if (language === 'latex') {
    return tokenizeLatex(source)
      .filter((token) => token in LATEX_HINTS && !revealed.includes(token) && !typedLatexToken(typed, token))
      .map((token) => ({ token, ...LATEX_HINTS[token] }));
  }
  return tokenize(source)
    .filter((token) => token in HINTS && !revealed.includes(token) && !typed.includes(token))
    .map((token) => ({ token, ...HINTS[token] }));
}
