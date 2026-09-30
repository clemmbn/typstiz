/**
 * Per-language UI metadata: display name and reference documentation link.
 *
 * Kept in one place so the start screen and the game screen always agree. Deliberately a single
 * doc link per language: the docs are a fallback, not a feature to browse.
 */
import type { LanguageId } from '../engines/types';

/** One doc entry: label shown in the UI and the URL opened in a new tab. */
export type DocLink = { label: string; url: string };

/** Docs per language. 'latex' is rendered by KaTeX, so its docs list what KaTeX supports. */
export const DOCS: Record<LanguageId, DocLink> = {
  typst: { label: 'Typst math docs', url: 'https://typst.app/docs/reference/math/' },
  latex: { label: 'KaTeX docs', url: 'https://katex.org/docs/supported.html' },
};

/** Name shown in the UI; the LaTeX engine is KaTeX, a LaTeX math subset. */
export const LANGUAGE_NAMES: Record<LanguageId, string> = {
  typst: 'Typst',
  latex: 'LaTeX',
};

/**
 * @param language - the selected math language
 * @returns the doc link for that language
 */
export function docFor(language: LanguageId): DocLink {
  return DOCS[language];
}
