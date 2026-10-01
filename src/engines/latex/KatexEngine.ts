/**
 * LaTeX implementation of `MathEngine`, backed by KaTeX (pinned, see package.json).
 *
 * Pipeline: source → katex.renderToString (display mode, HTML output) → markup; the comparison key
 * is the markup canonicalized by `normalizeKatex`.
 *
 * Constraints:
 * - Rendering is synchronous and pure JS, so there is no queue (unlike TypstEngine's WASM state).
 * - Browser-only setup (stylesheet, fonts) is injected, so the same class runs in Vitest.
 * - `trust: false`: `\href`, `\includegraphics`, `\htmlClass`... are refused. KaTeX renders refused
 *   commands in `errorColor` instead of throwing, so a sentinel color marks them as errors.
 * - `strict: 'ignore'`: Unicode input (typing `α` directly) is accepted, like Typst accepts `×`.
 */
import katex, { type KatexOptions } from 'katex';
import type { MathEngine, RenderResult } from '../types';
import { normalizeKatex } from './normalize';

/** Loads what the browser needs to display KaTeX output (stylesheet, fonts). */
export type KatexSetup = () => Promise<void>;

/** Unusual color used only to detect KaTeX's "rendered as error" fallback. */
const ERROR_SENTINEL = '#ff00fe';
const LOG = '[latex-engine]';

/** Options shared by target and player input; both sides MUST use the same ones. */
const OPTIONS: KatexOptions = {
  displayMode: true,
  output: 'html',
  throwOnError: true,
  errorColor: ERROR_SENTINEL,
  strict: 'ignore',
  trust: false,
  // Keeps `\rule{999em}{1em}`-style input from producing a page-sized layout.
  maxSize: 20,
};

export class KatexEngine implements MathEngine {
  readonly id = 'latex' as const;
  private initPromise: Promise<void> | null = null;
  private readonly setup: KatexSetup;

  /**
   * @param setup - browser-side loader for the stylesheet and fonts; defaults to a no-op (tests)
   */
  constructor(setup: KatexSetup = async () => {}) {
    this.setup = setup;
  }

  /**
   * Load the stylesheet and fonts, then run the self-check. Idempotent: concurrent callers share
   * the same promise.
   * @throws Error when setup fails or the self-check fails
   */
  init(): Promise<void> {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const t0 = performance.now();
    console.info(`${LOG} init: loading stylesheet and fonts`);
    await this.setup();
    this.selfCheck();
    console.info(`${LOG} init: done in ${Math.round(performance.now() - t0)} ms`);
  }

  /**
   * Check the answer-checking pipeline end to end: a reference renders, and two spellings of the
   * same expression produce the same key. If the normalization ever stops matching KaTeX's
   * output, every answer would silently be rejected; failing loudly here is better.
   * @throws Error when the reference does not render or the equivalence check fails
   */
  private selfCheck(): void {
    const a = this.renderNow('x^2 + \\frac{a}{b}');
    const b = this.renderNow('x^{2}+\\frac a b');
    if (!a || !b) throw new Error('KaTeX self-check failed: reference expression did not render');
    if (!this.equivalent(a, b)) throw new Error('KaTeX self-check failed: equivalent sources compare different');
    console.info(`${LOG} self-check: ok (key ${a.key.length} chars)`);
  }

  /**
   * Render a LaTeX math source.
   * @param source - LaTeX math source (without `$`)
   * @returns render result, or null on parse error or refused command
   */
  render(source: string): Promise<RenderResult | null> {
    return Promise.resolve(this.renderNow(source));
  }

  private renderNow(source: string): RenderResult | null {
    let markup: string;
    try {
      markup = katex.renderToString(source, OPTIONS);
    } catch {
      // Parse errors are expected while the player is mid-typing; they map to null.
      return null;
    }
    if (markup.includes(`color:${ERROR_SENTINEL}`)) return null;
    return { markup, format: 'html', key: normalizeKatex(markup) };
  }

  /**
   * @param a - first render
   * @param b - second render
   * @returns true when both canonical keys are identical
   */
  equivalent(a: RenderResult, b: RenderResult): boolean {
    return a.key === b.key;
  }
}
