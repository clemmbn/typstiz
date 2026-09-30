/**
 * Typst document prelude shared by the target and the player's input.
 *
 * Both sides MUST go through `wrapSource` with identical settings, otherwise equivalent sources
 * could render differently. Display math (`$ ... $` with spaces) is used everywhere.
 */

/** Page and font setup; `fill: none` keeps the page transparent so themes can recolor it. */
export const TYPST_PRELUDE = [
  '#set page(width: auto, height: auto, margin: 6pt, fill: none)',
  '#set text(font: "New Computer Modern Math")',
].join('\n');

/**
 * Wrap a math source into a full Typst document.
 * @param source - player or template math source (without dollar signs)
 * @returns full document text
 */
export function wrapSource(source: string): string {
  // Newlines around the source keep a trailing `//` comment from swallowing the closing `$`.
  return `${TYPST_PRELUDE}\n$ ${source}\n$`;
}
