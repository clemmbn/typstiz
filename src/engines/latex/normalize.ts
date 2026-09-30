/**
 * Comparison key for KaTeX renders.
 *
 * KaTeX's HTML output is deterministic, but grouping braces leave traces that are invisible on
 * screen: `x^{2}` wraps the `2` in an extra `<span class="mord mtight">` that `x^2` does not have.
 * Without normalization, `x^2` and `x^{2}` would not match (see PLAN.md, LaTeX probe).
 *
 * The key is a canonical re-serialization of the markup:
 * - Atom-type classes (`mord`, `mbin`, ...) and `mtight` are dropped. KaTeX uses them while
 *   building (spacing is emitted as explicit `mspace` spans), and katex.css has no rule for them,
 *   so they never affect what is drawn.
 * - A `<span>` left with no attributes is unwrapped (replaced by its children): an inline span
 *   with no class and no style is layout-neutral. Exception: spans whose parent or grandparent
 *   is targeted by a child combinator in katex.css (`.vlist > span > span`, `.mfrac > span > span`,
 *   ...), where removing a level would change which elements the rule matches.
 * - Adjacent text-only spans with identical attributes and no style are merged: KaTeX joins `ab`
 *   into one span but keeps `{a}{b}` as two.
 * - `aria-hidden` is dropped and attributes are sorted.
 *
 * Constraint: this relies on KaTeX's markup shape (only `<span>`, `<svg>`, `<path>`, `<line>`,
 * `<img>`, double-quoted attributes, escaped text). The KaTeX version is pinned; re-verify with
 * `KatexEngine.test.ts` on upgrade.
 */

type Element = { tag: string; attrs: Record<string, string>; children: Node[] };
type Node = Element | string;

/** Classes with no CSS rule in katex.css; they only carry build-time semantics. */
const INERT_CLASSES: ReadonlySet<string> = new Set([
  'mord', 'mbin', 'mrel', 'mopen', 'mclose', 'mpunct', 'minner', 'mop', 'mtight',
]);

/** Classes used on the left side of a `>` combinator in katex.css (see file header). */
const STRUCTURAL_CLASSES: ReadonlySet<string> = new Set([
  'vlist', 'mfrac', 'delim-size1', 'delim-size4', 'clap', 'llap', 'katex-inner',
]);

/** Void or self-closed elements KaTeX emits. */
const VOID_TAGS: ReadonlySet<string> = new Set(['img', 'br']);

/**
 * Parse KaTeX markup into a tree. Not a general HTML parser: it relies on KaTeX's regular output.
 * @param markup - KaTeX HTML
 * @returns root node list
 * @throws Error on unbalanced tags (would mean KaTeX changed its output format)
 */
function parse(markup: string): Node[] {
  const root: Element = { tag: '#root', attrs: {}, children: [] };
  const stack: Element[] = [root];
  for (const m of markup.matchAll(/<(\/?)([a-zA-Z]+)((?:\s+[^\s=>/]+="[^"]*")*)\s*(\/?)>|[^<]+/g)) {
    const parent = stack[stack.length - 1];
    if (m[2] === undefined) {
      parent.children.push(m[0]);
      continue;
    }
    const [, closing, tag, rawAttrs, selfClosing] = m;
    if (closing) {
      const open = stack.pop();
      if (!open || open.tag !== tag) throw new Error(`KaTeX markup: unexpected </${tag}>`);
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(/([^\s=>/]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    const el: Element = { tag, attrs, children: [] };
    parent.children.push(el);
    if (!selfClosing && !VOID_TAGS.has(tag)) stack.push(el);
  }
  if (stack.length !== 1) throw new Error('KaTeX markup: unclosed tags');
  return root.children;
}

/** @returns the class list of an element */
function classesOf(el: Element | null): string[] {
  return el?.attrs.class?.split(/\s+/).filter(Boolean) ?? [];
}

/** @returns true when a `>` rule in katex.css keys off this element */
function isStructural(el: Element | null): boolean {
  return classesOf(el).some((c) => STRUCTURAL_CLASSES.has(c));
}

/**
 * Canonicalize one node list (see file header for the rules).
 * @param nodes - children to canonicalize
 * @param parent - their parent element (null at the root)
 * @param grandparent - the parent's parent (null near the root)
 * @returns canonical nodes
 */
function canonical(nodes: Node[], parent: Element | null, grandparent: Element | null): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    if (typeof node === 'string') {
      out.push(node);
      continue;
    }
    const attrs = { ...node.attrs };
    delete attrs['aria-hidden'];
    const classes = classesOf(node).filter((c) => !INERT_CLASSES.has(c));
    if (classes.length > 0) attrs.class = classes.sort().join(' ');
    else delete attrs.class;
    const unwrap = node.tag === 'span' && Object.keys(attrs).length === 0 && !isStructural(parent) && !isStructural(grandparent);
    if (unwrap) {
      // Children take the unwrapped span's place, so their parent is still `parent`.
      out.push(...canonical(node.children, parent, grandparent));
      continue;
    }
    const el: Element = { tag: node.tag, attrs, children: [] };
    el.children = canonical(node.children, el, parent);
    out.push(el);
  }
  return mergeTextRuns(out);
}

/**
 * Merge adjacent text-only spans with identical attributes: KaTeX joins `ab` into one span but
 * keeps `{a}{b}` as two, with the same rendering. Spans with a `style` are never merged, since it
 * can carry a per-glyph margin (italic correction) that merging would drop.
 * @param nodes - canonical siblings
 * @returns siblings with mergeable runs joined
 */
function mergeTextRuns(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (isPlainTextSpan(node) && isPlainTextSpan(prev) && serializeAttrs(prev) === serializeAttrs(node)) {
      prev.children = [prev.children.join('') + node.children.join('')];
    } else {
      out.push(node);
    }
  }
  return out;
}

/** @returns true for a `<span>` without style whose children are all text */
function isPlainTextSpan(node: Node | undefined): node is Element {
  return typeof node === 'object' && node.tag === 'span' && !('style' in node.attrs) && node.children.every((c) => typeof c === 'string');
}

/** @returns attributes serialized in sorted order */
function serializeAttrs(el: Element): string {
  return Object.keys(el.attrs).sort().map((n) => ` ${n}="${el.attrs[n]}"`).join('');
}

/**
 * Serialize canonical nodes.
 * @param nodes - canonical nodes
 * @returns markup string
 */
function serialize(nodes: Node[]): string {
  return nodes.map((n) => (typeof n === 'string' ? n : `<${n.tag}${serializeAttrs(n)}>${serialize(n.children)}</${n.tag}>`)).join('');
}

/**
 * Build the comparison key of a KaTeX render.
 * @param markup - HTML from `katex.renderToString` (output: 'html')
 * @returns canonical string; equal keys mean identical rendering
 */
export function normalizeKatex(markup: string): string {
  return serialize(canonical(parse(markup), null, null));
}
