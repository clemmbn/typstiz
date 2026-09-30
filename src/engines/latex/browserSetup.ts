/**
 * Browser setup for `KatexEngine`: stylesheet and fonts.
 *
 * Importing the stylesheet here (not in the engine) keeps the engine runnable in Vitest. Vite
 * bundles katex.min.css and its woff2 fonts as hashed assets in the LaTeX chunk, so nothing
 * KaTeX-related is downloaded unless the player picks LaTeX (spec §11).
 */
import 'katex/dist/katex.min.css';

/**
 * Faces the targets use most (text, math italic, big operators and delimiters, blackboard bold).
 * Others (calligraphic, bold, ...) load on first use; browsers fetch @font-face files lazily.
 */
const CORE_FACES = [
  '1em KaTeX_Main',
  'italic 1em KaTeX_Math',
  '1em KaTeX_Size1',
  '1em KaTeX_Size2',
  '1em KaTeX_AMS',
];

/**
 * Load the core KaTeX fonts before the first target is shown, so it never flashes in a fallback
 * font. The comparison key does not depend on fonts; this is display-only.
 * @throws Error when a font fails to load or its @font-face is missing (stylesheet not applied)
 */
export async function loadKatexAssets(): Promise<void> {
  const loaded = await Promise.all(CORE_FACES.map((face) => document.fonts.load(face)));
  const missing = CORE_FACES.filter((_, i) => loaded[i].length === 0);
  if (missing.length > 0) throw new Error(`KaTeX fonts not available: ${missing.join(', ')}`);
  console.info(`[latex-engine] ${CORE_FACES.length} font faces loaded`);
}
