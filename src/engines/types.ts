/**
 * Math engine contract.
 *
 * The game only ever talks to a `MathEngine`; it never imports Typst or KaTeX directly.
 * Adding a new language means implementing this interface and adding the matching template field.
 *
 * Constraint: `render` must be deterministic. Two sources that look the same must produce results
 * for which `equivalent` returns true, otherwise answer checking silently breaks.
 */

export type LanguageId = 'typst' | 'latex';

/** Output of a successful render. */
export type RenderResult = {
  /** Markup that can be injected into the DOM for display. */
  markup: string;
  /** What `markup` is: a standalone SVG (Typst) or KaTeX HTML. Decides how the view scales it. */
  format: 'svg' | 'html';
  /** Canonical comparison key: two renders are equivalent iff their keys are equal. */
  key: string;
};

export interface MathEngine {
  id: LanguageId;
  /** Load WASM and fonts, warm up, run self-checks. Rejects loudly if the engine is unusable. */
  init(): Promise<void>;
  /** Render a math source. Resolves to null on compile error (never throws for bad input). */
  render(source: string): Promise<RenderResult | null>;
  /** True when both renders are visually identical. */
  equivalent(a: RenderResult, b: RenderResult): boolean;
}
