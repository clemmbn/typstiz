/**
 * SVG normalization for Typst renders.
 *
 * The probe (see PLAN.md §0) showed typst.ts 0.7.0 already emits byte-identical SVG for equivalent
 * sources. This normalization is defense in depth against future versions adding generated ids or
 * cosmetic differences: it strips the embedded stylesheet/scripts and the text-selection overlays,
 * collapses whitespace, and renames ids to their order of appearance so the key only depends on
 * geometry.
 */

/**
 * Remove the parts of the renderer output we never display: the stylesheet, scripts, and the
 * `<foreignObject class="tsel">` text-selection overlays. The overlays hold the glyph text as
 * HTML and are only invisible thanks to the stylesheet; without it they draw on top of the math.
 * @param svg - raw SVG
 * @returns SVG with only geometry left
 */
function stripNonGeometry(svg: string): string {
  return svg
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, '');
}

/**
 * Build the comparison key from a raw SVG string.
 * @param svg - raw SVG from the typst.ts renderer
 * @returns canonical string; equal keys mean equal renders
 */
export function normalizeSvg(svg: string): string {
  // Non-geometry parts are boilerplate or duplicates of the glyphs; drop them so the key is
  // small and only reflects what the player sees.
  const out = canonicalizeIds(stripNonGeometry(svg));
  return out.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
}

/**
 * Rename every `id="..."` to a sequential id and rewrite its references (`href="#..."`,
 * `url(#...)`), so arbitrary generated ids (hashes, counters) cannot cause false mismatches.
 * @param svg - SVG markup
 * @returns SVG with ids renamed to i0, i1, ... in order of first definition
 */
function canonicalizeIds(svg: string): string {
  const mapping = new Map<string, string>();
  for (const match of svg.matchAll(/\sid="([^"]+)"/g)) {
    if (!mapping.has(match[1])) mapping.set(match[1], `i${mapping.size}`);
  }
  if (mapping.size === 0) return svg;
  return svg
    .replace(/(\sid=")([^"]+)(")/g, (_, a, id, b) => a + (mapping.get(id) ?? id) + b)
    .replace(/(href=")#([^"]+)(")/g, (_, a, id, b) => `${a}#${mapping.get(id) ?? id}${b}`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${mapping.get(id) ?? id})`);
}

/**
 * Prepare an SVG for display: drop the renderer's stylesheet (its global rules such as `svg`,
 * `.tsel` would leak into the page), scripts and text-selection overlays.
 * @param svg - raw SVG
 * @returns SVG safe to inject with innerHTML
 */
export function svgForDisplay(svg: string): string {
  return stripNonGeometry(svg);
}
