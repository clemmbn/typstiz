/**
 * Symbol hints for LaTeX mode: "use `\lceil` for ⌈".
 *
 * Same model as the Typst hints in `hints.ts`: tokens of the target's LaTeX source that appear in
 * `LATEX_HINTS` can be revealed. In LaTeX every symbol is a backslash command, so tokens are
 * control words (`\alpha`), control symbols (`\{`, `\|`, `\,`, `\\`) and environments
 * (`\begin{cases}`). `\end` needs no hint: it follows from the matching `\begin`.
 *
 * `hints.test.ts` fails when a template introduces a command missing from this dictionary.
 */
import type { HintInfo } from './hints';

export const LATEX_HINTS: Record<string, HintInfo> = {
  // Operators and relations
  '\\to': { shows: '→' },
  '\\Rightarrow': { shows: '⇒', note: 'implies' },
  '\\le': { shows: '≤' },
  '\\ge': { shows: '≥' },
  '\\ne': { shows: '≠' },
  '\\pm': { shows: '±' },
  '\\cdot': { shows: '⋅', note: 'multiplication dot' },
  '\\times': { shows: '×' },
  '\\approx': { shows: '≈' },
  '\\equiv': { shows: '≡' },
  '\\pmod': { shows: '(mod n)', note: '\\pmod{n}' },
  '\\mid': { shows: '∣', note: 'divides' },
  '\\in': { shows: '∈' },
  '\\forall': { shows: '∀' },
  '\\exists': { shows: '∃' },
  '\\quad': { shows: '␣␣', note: 'wide horizontal space' },
  '\\,': { shows: '␣', note: 'thin space, e.g. before dx' },
  // Sets
  '\\mathbb': { shows: 'ℝ', note: 'blackboard bold, e.g. \\mathbb{Z} gives ℤ' },
  '\\cap': { shows: '∩' },
  '\\cup': { shows: '∪' },
  '\\subseteq': { shows: '⊆' },
  '\\emptyset': { shows: '∅' },
  '\\{': { shows: '{', note: 'literal brace; plain { } only group' },
  '\\}': { shows: '}' },
  // Calculus and big operators
  '\\sum': { shows: '∑' },
  '\\prod': { shows: '∏' },
  '\\int': { shows: '∫' },
  '\\iint': { shows: '∬' },
  '\\lim': { shows: 'lim', note: 'limit, bounds go in _{...}' },
  '\\partial': { shows: '∂' },
  '\\nabla': { shows: '∇' },
  '\\infty': { shows: '∞' },
  // Fractions, roots, delimiters and layout
  '\\frac': { shows: 'a/b', note: '\\frac{num}{den}' },
  '\\sqrt': { shows: '√', note: '\\sqrt[n]{x} for the n-th root' },
  '\\binom': { shows: '(ⁿₖ)', note: 'binomial coefficient, \\binom{n}{k}' },
  '\\lfloor': { shows: '⌊' },
  '\\rfloor': { shows: '⌋' },
  '\\lceil': { shows: '⌈' },
  '\\rceil': { shows: '⌉' },
  '\\|': { shows: '‖', note: 'norm bars' },
  '\\left': { shows: '( ⋯ )', note: 'auto-sized delimiter, pair it with \\right' },
  '\\right': { shows: '( ⋯ )', note: 'closes \\left' },
  '\\begin{cases}': { shows: '{', note: 'piecewise: rows split by \\\\, columns by &' },
  '\\begin{pmatrix}': { shows: '( )', note: 'matrix: rows split by \\\\, columns by &' },
  '\\begin{aligned}': { shows: 'aligned lines', note: 'align on &, new line with \\\\' },
  '\\\\': { shows: '↵', note: 'new row or line' },
  '\\text': { shows: 'text', note: 'upright words, e.g. \\text{if }' },
  '\\operatorname': { shows: 'sgn', note: 'upright operator name, \\operatorname{sgn}' },
  // Function names: upright, with a backslash
  '\\sin': { shows: 'sin', note: 'upright function name' },
  '\\cos': { shows: 'cos', note: 'upright function name' },
  '\\tan': { shows: 'tan', note: 'upright function name' },
  '\\ln': { shows: 'ln', note: 'upright function name' },
  '\\log': { shows: 'log', note: 'upright function name' },
  '\\exp': { shows: 'exp', note: 'upright function name' },
  '\\det': { shows: 'det', note: 'upright function name' },
  // Styles and accents
  '\\mathbf': { shows: '𝐱', note: 'bold' },
  '\\mathcal': { shows: '𝓛', note: 'calligraphic' },
  '\\overline': { shows: 'x̄', note: 'bar over the argument' },
  '\\bar': { shows: 'x̄', note: 'short bar accent' },
  '\\hat': { shows: 'x̂' },
  '\\tilde': { shows: 'x̃' },
  '\\dot': { shows: 'ẋ', note: 'dot accent' },
  '\\vec': { shows: 'x⃗', note: 'vector arrow' },
  '\\cdots': { shows: '⋯' },
  '\\vdots': { shows: '⋮' },
  '\\ddots': { shows: '⋱' },
  // Greek
  '\\alpha': { shows: 'α' },
  '\\beta': { shows: 'β' },
  '\\gamma': { shows: 'γ' },
  '\\delta': { shows: 'δ' },
  '\\varepsilon': { shows: 'ε' },
  '\\theta': { shows: 'θ' },
  '\\lambda': { shows: 'λ' },
  '\\mu': { shows: 'μ' },
  '\\pi': { shows: 'π' },
  '\\rho': { shows: 'ρ' },
  '\\sigma': { shows: 'σ' },
  '\\tau': { shows: 'τ' },
  '\\phi': { shows: 'ϕ' },
  '\\varphi': { shows: 'φ' },
  '\\psi': { shows: 'ψ' },
  '\\omega': { shows: 'ω' },
};

/** Commands that intentionally get no hint. */
export const LATEX_PLAIN: ReadonlySet<string> = new Set(['\\end']);

/**
 * Extract the commands of a LaTeX source that could need a hint.
 * @param source - LaTeX source
 * @returns tokens in order of first appearance, without duplicates
 */
export function tokenizeLatex(source: string): string[] {
  const found = source.match(/\\begin\{[A-Za-z*]+\}|\\[A-Za-z]+|\\[{}|,\\]/g) ?? [];
  return [...new Set(found)];
}

/**
 * Whether the player's input already contains a token. Control words must end at a non-letter,
 * so typing `\int` does not count as knowing `\in`.
 * @param typed - player input
 * @param token - LaTeX token
 * @returns true when `typed` contains the token as a whole command
 */
export function typedLatexToken(typed: string, token: string): boolean {
  if (!/[A-Za-z]$/.test(token)) return typed.includes(token);
  const escaped = token.replace(/[\\{}*|]/g, (c) => `\\${c}`);
  return new RegExp(`${escaped}(?![A-Za-z])`).test(typed);
}
