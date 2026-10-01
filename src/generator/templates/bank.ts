/**
 * Expression templates, grouped by tier (spec §7.2), one source per language.
 *
 * Each template holds a `typst` and a `latex` source for the same mathematics. Slot values are
 * substituted into `{slot}` placeholders (spelled per language, see `generate.ts`). Every template
 * is exercised by the compile tests in `generate.test.ts` for both engines, so a typo here fails
 * CI instead of shipping an unrenderable target.
 *
 * Authoring rules:
 * - Wrap substituted values in parentheses (Typst) or braces (LaTeX) when they could be
 *   multi-character in a subscript/superscript (`x^(12)` vs `x^12` render differently).
 * - Integer exponents start at 2 to avoid `x^1`.
 * - LaTeX: a command argument must never be a bare slot name (`\mathbb{R}` in a template with a
 *   slot `R` would be substituted); use double braces for slot arguments (`\sqrt{{a}}`). A test
 *   enforces this.
 * - LaTeX sources are written with `String.raw` (`L`) so backslashes read as typed.
 * - Keep the Typst source unchanged when editing LaTeX: it drives the generator guards and the
 *   Typst sequence of every stored seed.
 */
import type { SlotSpec, Template } from '../types';

/** LaTeX source literal: backslashes are kept as typed. */
const L = String.raw;

// Shared slot specs keep templates short and consistent.
const v: SlotSpec = { kind: 'var' };
const g: SlotSpec = { kind: 'greek' };
const fn: SlotSpec = { kind: 'fn' };
const idx: SlotSpec = { kind: 'index' };
const pow: SlotSpec = { kind: 'int', min: 2, max: 9 };
const digit: SlotSpec = { kind: 'int', min: 2, max: 9 };
const small: SlotSpec = { kind: 'int', min: 1, max: 9 };
const rel: SlotSpec = {
  kind: 'choice',
  options: ['=', '<', '>', { typst: '<=', latex: L`\le` }, { typst: '>=', latex: L`\ge` }, { typst: '!=', latex: L`\ne` }],
};
const infinity = { typst: 'infinity', latex: L`\infty` };
const upper: SlotSpec = { kind: 'choice', options: ['n', 'N', 'm', infinity] };
const SET: SlotSpec = { kind: 'choice', options: ['A', 'B', 'C', 'X', 'Y'] };
const accent: SlotSpec = {
  kind: 'choice',
  options: [
    { typst: 'hat', latex: L`\hat` },
    { typst: 'tilde', latex: L`\tilde` },
    { typst: 'dot', latex: L`\dot` },
    { typst: 'arrow', latex: L`\vec` },
    { typst: 'macron', latex: L`\bar` },
  ],
};

export const EASY: Template[] = [
  { id: 'e-pow-sum', tier: 'easy', slots: { v, w: v, p: pow, q: pow }, distinct: ['v', 'w'], typst: '{v}^{p} + {w}^{q}', latex: L`{v}^{p} + {w}^{q}` },
  { id: 'e-linear', tier: 'easy', slots: { a: digit, v, b: small, c: { kind: 'int', min: 10, max: 99 } }, typst: '{a}{v} + {b} = {c}', latex: L`{a}{v} + {b} = {c}` },
  { id: 'e-subs', tier: 'easy', slots: { v, i: small, j: small }, distinct: ['i', 'j'], typst: '{v}_{i} + {v}_{j}', latex: L`{v}_{i} + {v}_{j}` },
  { id: 'e-greek-frac', tier: 'easy', slots: { g, a: small, b: digit }, distinct: ['a', 'b'], typst: '{g} = {a}/{b}', latex: L`{g} = \frac{{a}}{{b}}` },
  { id: 'e-sqrt', tier: 'easy', slots: { v, w: v }, distinct: ['v', 'w'], typst: 'sqrt({v}^2 + {w}^2)', latex: L`\sqrt{{v}^2 + {w}^2}` },
  { id: 'e-fn-rel', tier: 'easy', slots: { fn, v, r: rel, a: small }, typst: '{fn}({v}) {r} {a}', latex: L`{fn}({v}) {r} {a}` },
  { id: 'e-greek-pow', tier: 'easy', slots: { g, p: pow, r: rel, a: small }, typst: '{g}^{p} {r} {a}', latex: L`{g}^{p} {r} {a}` },
  { id: 'e-exp', tier: 'easy', slots: { a: digit, v }, typst: 'e^({a}{v})', latex: L`e^{{a}{v}}` },
  { id: 'e-fracs', tier: 'easy', slots: { a: small, b: digit, c: small, d: digit }, accept: (s) => s.a !== s.b && s.c !== s.d, typst: '{a}/{b} + {c}/{d}', latex: L`\frac{{a}}{{b}} + \frac{{c}}{{d}}` },
  { id: 'e-log', tier: 'easy', slots: { b: digit, v }, typst: 'log_{b} {v}', latex: L`\log_{b} {v}` },
  { id: 'e-greek-sub', tier: 'easy', slots: { g, i: idx, r: rel, h: g }, distinct: ['g', 'h'], typst: '{g}_{i} {r} {h}', latex: L`{g}_{i} {r} {h}` },
  { id: 'e-pm', tier: 'easy', slots: { v, a: digit }, typst: '{v} = plus.minus {a}', latex: L`{v} = \pm {a}` },
  { id: 'e-dot', tier: 'easy', slots: { v, w: v, a: digit }, distinct: ['v', 'w'], typst: '{v} dot {w} = {a}', latex: L`{v} \cdot {w} = {a}` },
  { id: 'e-mc2', tier: 'easy', slots: {}, typst: 'E = m c^2', latex: L`E = mc^2` },
  { id: 'e-trig-id', tier: 'easy', slots: { g }, typst: 'sin^2 {g} + cos^2 {g} = 1', latex: L`\sin^2 {g} + \cos^2 {g} = 1` },
  { id: 'e-quad', tier: 'easy', slots: { v, a: digit, b: digit }, typst: '{v}^2 - {a}{v} + {b}', latex: L`{v}^2 - {a}{v} + {b}` },
  { id: 'e-floor', tier: 'easy', slots: { v, a: digit, b: small }, typst: 'floor({v}/{a}) = {b}', latex: L`\left\lfloor \frac{{v}}{{a}} \right\rfloor = {b}` },
  { id: 'e-ceil-log', tier: 'easy', slots: { b: digit, v }, typst: 'ceil(log_{b} {v})', latex: L`\lceil \log_{b} {v} \rceil` },
  { id: 'e-conj', tier: 'easy', slots: { z: { kind: 'choice', options: ['z', 'w'] } }, typst: '{z} overline({z}) = |{z}|^2', latex: L`{z} \overline{{z}} = |{z}|^2` },
  // `r` is derived so the congruence is actually true.
  {
    id: 'e-mod', tier: 'easy', slots: { a: { kind: 'int', min: 10, max: 99 }, n: digit },
    typst: '{a} equiv {r} mod {n}',
    latex: L`{a} \equiv {r} \pmod{{n}}`,
    derive: (s) => ({ r: String(Number(s.a) % Number(s.n)) }),
  },
  { id: 'e-fact', tier: 'easy', slots: { n: { kind: 'choice', options: ['n', 'k', 'm'] } }, typst: '{n}! = {n} dot ({n}-1)!', latex: L`{n}! = {n} \cdot ({n}-1)!` },
  // Perfect squares are rejected: `sqrt(16) approx 4.00` would be silly.
  {
    id: 'e-sqrt-approx', tier: 'easy', slots: { a: { kind: 'int', min: 2, max: 99 } },
    accept: (s) => !Number.isInteger(Math.sqrt(Number(s.a))),
    typst: 'sqrt({a}) approx {val}',
    latex: L`\sqrt{{a}} \approx {val}`,
    derive: (s) => ({ val: Math.sqrt(Number(s.a)).toFixed(2) }),
  },
];

export const MEDIUM: Template[] = [
  { id: 'm-sum-pow', tier: 'medium', slots: { i: idx, n: upper, p: pow }, typst: 'sum_({i}=1)^{n} {i}^{p}', latex: L`\sum_{{i}=1}^{{n}} {i}^{p}` },
  { id: 'm-sum-frac', tier: 'medium', slots: { i: idx, n: upper, p: pow }, typst: 'sum_({i}=1)^{n} 1/{i}^{p}', latex: L`\sum_{{i}=1}^{{n}} \frac{1}{{i}^{p}}` },
  { id: 'm-prod', tier: 'medium', slots: { i: idx, n: upper, v, a: digit }, typst: 'product_({i}=1)^{n} ({v}_{i} + {a})', latex: L`\prod_{{i}=1}^{{n}} ({v}_{i} + {a})` },
  {
    id: 'm-integral', tier: 'medium',
    slots: {
      lo: { kind: 'choice', options: ['0', '1', { typst: '(-1)', latex: '{-1}' }, { typst: '(-infinity)', latex: L`{-\infty}` }] },
      hi: { kind: 'choice', options: ['1', '2', { typst: 'pi', latex: L`\pi` }, infinity] },
      v, p: pow,
    },
    typst: 'integral_{lo}^{hi} {v}^{p} dif {v}',
    latex: L`\int_{lo}^{hi} {v}^{p} \,d{v}`,
  },
  { id: 'm-integral-exp', tier: 'medium', slots: { v, a: digit }, typst: 'integral_0^infinity e^(-{a}{v}) dif {v}', latex: L`\int_0^\infty e^{-{a}{v}} \,d{v}` },
  {
    id: 'm-binom', tier: 'medium',
    slots: { n: { kind: 'choice', options: ['n', 'N', 'm'] }, k: { kind: 'choice', options: ['k', 'j', 'r'] } },
    typst: 'binom({n}, {k}) = {n}!/({k}!({n}-{k})!)',
    latex: L`\binom{{n}}{{k}} = \frac{{n}!}{{k}!({n}-{k})!}`,
  },
  { id: 'm-abs', tier: 'medium', slots: { v, a: digit, g }, typst: '|{v} - {a}| < {g}', latex: L`|{v} - {a}| < {g}` },
  { id: 'm-norm', tier: 'medium', slots: { v, w: v }, distinct: ['v', 'w'], typst: 'norm({v} + {w}) <= norm({v}) + norm({w})', latex: L`\|{v} + {w}\| \le \|{v}\| + \|{w}\|` },
  { id: 'm-root', tier: 'medium', slots: { n: { kind: 'int', min: 3, max: 9 }, v, p: pow }, accept: (s) => s.n !== s.p, typst: 'root({n}, {v}^{p}) = {v}^({p}/{n})', latex: L`\sqrt[{n}]{{v}^{p}} = {v}^{\frac{{p}}{{n}}}` },
  {
    id: 'm-accents', tier: 'medium',
    slots: { acc1: accent, acc2: accent, v, w: v },
    distinct: ['v', 'w', 'acc1', 'acc2'],
    typst: '{acc1}({v}) + {acc2}({w}) = 0',
    latex: L`{acc1}{{v}} + {acc2}{{w}} = 0`,
  },
  { id: 'm-cases-abs', tier: 'medium', slots: { v }, typst: '|{v}| = cases({v} "if" {v} >= 0, -{v} "if" {v} < 0)', latex: L`|{v}| = \begin{cases} {v} & \text{if } {v} \ge 0 \\ -{v} & \text{if } {v} < 0 \end{cases}` },
  { id: 'm-limit', tier: 'medium', slots: { v, L: { kind: 'choice', options: ['0', infinity] }, fn }, typst: 'lim_({v} -> {L}) {fn}({v})/{v}', latex: L`\lim_{{v} \to {L}} \frac{{fn}({v})}{{v}}` },
  { id: 'm-deriv', tier: 'medium', slots: { v, w: v, p: pow }, distinct: ['v', 'w'], typst: '(dif {w})/(dif {v}) = {p} {v}^({p}-1)', latex: L`\frac{d{w}}{d{v}} = {p} {v}^{{p}-1}` },
  {
    id: 'm-partial', tier: 'medium',
    slots: { f: { kind: 'choice', options: ['f', 'u', { typst: 'phi', latex: L`\phi` }, { typst: 'psi', latex: L`\psi` }] }, v, w: v },
    distinct: ['v', 'w'],
    typst: '(partial^2 {f})/(partial {v} partial {w})',
    latex: L`\frac{\partial^2 {f}}{\partial {v} \partial {w}}`,
  },
  { id: 'm-euler', tier: 'medium', slots: { g }, typst: 'e^(i {g}) = cos {g} + i sin {g}', latex: L`e^{i {g}} = \cos {g} + i \sin {g}` },
  { id: 'm-set', tier: 'medium', slots: { v, a: digit }, typst: '{ {v} in RR : |{v}| < {a} }', latex: L`\{ {v} \in \mathbb{R} : |{v}| < {a} \}` },
  { id: 'm-quadratic', tier: 'medium', slots: { v }, typst: '{v} = (-b plus.minus sqrt(b^2 - 4a c))/(2a)', latex: L`{v} = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}` },
  { id: 'm-set-ops', tier: 'medium', slots: { A: SET, B: SET }, distinct: ['A', 'B'], typst: '{A} sect {B} subset.eq {A} union {B}', latex: L`{A} \cap {B} \subseteq {A} \cup {B}` },
  { id: 'm-complement', tier: 'medium', slots: { A: SET }, typst: '{A} sect overline({A}) = emptyset', latex: L`{A} \cap \overline{{A}} = \emptyset` },
  { id: 'm-recurrence', tier: 'medium', slots: { T: { kind: 'choice', options: ['T', 'C', 'W'] }, a: digit, b: digit }, typst: '{T}(n) = {a} {T}(n/{b}) + O(n log n)', latex: L`{T}(n) = {a} {T}(n/{b}) + O(n \log n)` },
  {
    id: 'm-det2', tier: 'medium', slots: { a: small, b: small, c: small, d: small },
    typst: 'det mat({a}, {b}; {c}, {d}) = {det}',
    latex: L`\det \begin{pmatrix} {a} & {b} \\ {c} & {d} \end{pmatrix} = {det}`,
    derive: (s) => ({ det: String(Number(s.a) * Number(s.d) - Number(s.b) * Number(s.c)) }),
  },
  { id: 'm-divisor-sum', tier: 'medium', slots: { d: { kind: 'choice', options: ['d', 'k'] } }, typst: 'sum_({d} divides n) phi({d}) = n', latex: L`\sum_{{d} \mid n} \varphi({d}) = n` },
  { id: 'm-curl', tier: 'medium', slots: { F: { kind: 'choice', options: ['E', 'B', 'F', 'v'] } }, typst: 'nabla times bold({F}) = bold(0)', latex: L`\nabla \times \mathbf{{F}} = \mathbf{0}` },
  { id: 'm-dot-sum', tier: 'medium', slots: { i: idx, v, w: v }, distinct: ['v', 'w'], typst: 'arrow({v}) dot arrow({w}) = sum_({i}=1)^n {v}_{i} {w}_{i}', latex: L`\vec{{v}} \cdot \vec{{w}} = \sum_{{i}=1}^n {v}_{i} {w}_{i}` },
  { id: 'm-fermat', tier: 'medium', slots: { a: digit }, typst: '{a}^(p-1) equiv 1 mod p', latex: L`{a}^{p-1} \equiv 1 \pmod{p}` },
];

export const HARD: Template[] = [
  {
    id: 'h-mat-vec', tier: 'hard',
    slots: { a: small, b: small, c: small, d: small, v, w: v },
    distinct: ['v', 'w'],
    typst: 'mat({a}, {b}; {c}, {d}) vec({v}, {w}) = vec({a}{v} + {b}{w}, {c}{v} + {d}{w})',
    latex: L`\begin{pmatrix} {a} & {b} \\ {c} & {d} \end{pmatrix} \begin{pmatrix} {v} \\ {w} \end{pmatrix} = \begin{pmatrix} {a}{v} + {b}{w} \\ {c}{v} + {d}{w} \end{pmatrix}`,
  },
  {
    id: 'h-det3', tier: 'hard',
    slots: { a: small, b: small, c: small, d: small, e: small, f: small },
    typst: 'det mat({a}, {b}, 0; {c}, {d}, 0; {e}, {f}, 1) = {det}',
    latex: L`\det \begin{pmatrix} {a} & {b} & 0 \\ {c} & {d} & 0 \\ {e} & {f} & 1 \end{pmatrix} = {det}`,
    derive: (s) => ({ det: String(Number(s.a) * Number(s.d) - Number(s.b) * Number(s.c)) }),
  },
  {
    id: 'h-expand', tier: 'hard',
    slots: { fn: { kind: 'choice', options: ['f', 'g', 'h'] }, v, a: digit },
    typst: '{fn}({v}) &= ({v} + {a})^2 \\\n  &= {v}^2 + {twoA}{v} + {aSq}',
    latex: [L`\begin{aligned}`, L`{fn}({v}) &= ({v} + {a})^2 \\`, L`&= {v}^2 + {twoA}{v} + {aSq}`, L`\end{aligned}`].join('\n'),
    derive: (s) => ({ twoA: String(2 * Number(s.a)), aSq: String(Number(s.a) ** 2) }),
  },
  { id: 'h-cont-frac', tier: 'hard', slots: { v }, typst: '1/(1 + 1/(1 + 1/(1 + {v})))', latex: L`\frac{1}{1 + \frac{1}{1 + \frac{1}{1 + {v}}}}` },
  {
    id: 'h-frac-frac', tier: 'hard', slots: { a: small, b: digit, c: small, d: digit }, accept: (s) => s.a !== s.b && s.c !== s.d,
    typst: '({a}/{b})/({c}/{d}) = ({a} dot {d})/({b} dot {c})',
    latex: L`\frac{\frac{{a}}{{b}}}{\frac{{c}}{{d}}} = \frac{{a} \cdot {d}}{{b} \cdot {c}}`,
  },
  {
    id: 'h-double-sum', tier: 'hard', slots: { i: idx, j: idx, v }, distinct: ['i', 'j'],
    typst: 'sum_({i}=1)^n sum_({j}=1)^m {v}_({i} {j}) = sum_({j}=1)^m sum_({i}=1)^n {v}_({i} {j})',
    latex: L`\sum_{{i}=1}^n \sum_{{j}=1}^m {v}_{{i}{j}} = \sum_{{j}=1}^m \sum_{{i}=1}^n {v}_{{i}{j}}`,
  },
  { id: 'h-stacked-sum', tier: 'hard', slots: { i: idx, j: idx, v }, distinct: ['i', 'j'], typst: 'sum_(0 <= {i} < {j} <= n) {v}_{i} {v}_{j}', latex: L`\sum_{0 \le {i} < {j} \le n} {v}_{i} {v}_{j}` },
  { id: 'h-double-int', tier: 'hard', slots: { v, w: v }, distinct: ['v', 'w'], typst: 'integral.double_D f({v}, {w}) dif {v} dif {w}', latex: L`\iint_D f({v}, {w}) \,d{v} \,d{w}` },
  {
    id: 'h-cauchy', tier: 'hard', slots: { v, w: v, g }, distinct: ['v', 'w'],
    typst: 'bold({v}) dot bold({w}) = norm(bold({v})) norm(bold({w})) cos {g}',
    latex: L`\mathbf{{v}} \cdot \mathbf{{w}} = \|\mathbf{{v}}\| \|\mathbf{{w}}\| \cos {g}`,
  },
  {
    id: 'h-laplace', tier: 'hard', slots: { v: { kind: 'choice', options: ['t', 'x'] } },
    typst: 'cal(L){f}(s) = integral_0^infinity e^(-s {v}) f({v}) dif {v}',
    latex: L`\mathcal{L}\{f\}(s) = \int_0^\infty e^{-s{v}} f({v}) \,d{v}`,
  },
  {
    id: 'h-forall', tier: 'hard', slots: { v, w: v }, distinct: ['v', 'w'],
    typst: 'forall epsilon > 0, exists delta > 0 : |{v} - {w}| < delta => |f({v}) - f({w})| < epsilon',
    latex: L`\forall \varepsilon > 0, \exists \delta > 0 : |{v} - {w}| < \delta \Rightarrow |f({v}) - f({w})| < \varepsilon`,
  },
  {
    id: 'h-chain', tier: 'hard', slots: { v, w: v, a: small, b: digit, c: digit }, distinct: ['v', 'w'],
    accept: (s) => Number(s.a) < Number(s.b) && Number(s.b) < Number(s.c),
    typst: '{a} < {v} <= {b} < {w} <= {c} quad {v}, {w} in bb(Z)',
    latex: L`{a} < {v} \le {b} < {w} \le {c} \quad {v}, {w} \in \mathbb{Z}`,
  },
  {
    id: 'h-taylor', tier: 'hard', slots: { fn: { kind: 'choice', options: ['f', 'g'] }, v, a: { kind: 'choice', options: ['a', '0'] } },
    typst: '{fn}({v}) = sum_(n=0)^infinity ({fn}^((n))({a}))/(n!) ({v} - {a})^n',
    latex: L`{fn}({v}) = \sum_{n=0}^\infty \frac{{fn}^{(n)}({a})}{n!} ({v} - {a})^n`,
  },
  { id: 'h-gauss', tier: 'hard', slots: { v }, typst: 'integral_(-infinity)^infinity e^(-{v}^2) dif {v} = sqrt(pi)', latex: L`\int_{-\infty}^\infty e^{-{v}^2} \,d{v} = \sqrt{\pi}` },
  {
    id: 'h-sgn', tier: 'hard', slots: { v },
    typst: 'op("sgn")({v}) = cases(-1 & "if" {v} < 0, 0 & "if" {v} = 0, 1 & "if" {v} > 0)',
    latex: L`\operatorname{sgn}({v}) = \begin{cases} -1 & \text{if } {v} < 0 \\ 0 & \text{if } {v} = 0 \\ 1 & \text{if } {v} > 0 \end{cases}`,
  },
  {
    id: 'h-mat-dots', tier: 'hard', slots: { a: { kind: 'choice', options: ['a', 'b', 'c', 'x'] } },
    typst: 'mat({a}_(1 1), dots.h, {a}_(1 n); dots.v, dots.down, dots.v; {a}_(m 1), dots.h, {a}_(m n))',
    latex: L`\begin{pmatrix} {a}_{11} & \cdots & {a}_{1n} \\ \vdots & \ddots & \vdots \\ {a}_{m1} & \cdots & {a}_{mn} \end{pmatrix}`,
  },
  { id: 'h-var-int', tier: 'hard', slots: { v, w: v }, distinct: ['v', 'w'], typst: 'integral_0^a integral_0^{v} f({v}, {w}) dif {w} dif {v}', latex: L`\int_0^a \int_0^{v} f({v}, {w}) \,d{w} \,d{v}` },
  {
    id: 'h-diff-squares', tier: 'hard', slots: { v, a: digit },
    typst: '({v} + {a})({v} - {a}) &= {v}^2 - {a}{v} + {a}{v} - {aSq} \\\n  &= {v}^2 - {aSq}',
    latex: [L`\begin{aligned}`, L`({v} + {a})({v} - {a}) &= {v}^2 - {a}{v} + {a}{v} - {aSq} \\`, L`&= {v}^2 - {aSq}`, L`\end{aligned}`].join('\n'),
    derive: (s) => ({ aSq: String(Number(s.a) ** 2) }),
  },
  { id: 'h-geom', tier: 'hard', slots: { v }, typst: 'sum_(n=0)^infinity {v}^n = 1/(1 - {v}) quad |{v}| < 1', latex: L`\sum_{n=0}^\infty {v}^n = \frac{1}{1 - {v}} \quad |{v}| < 1` },
  { id: 'h-stirling', tier: 'hard', slots: {}, typst: 'lim_(n -> infinity) (n!)/(sqrt(2 pi n) (n/e)^n) = 1', latex: L`\lim_{n \to \infty} \frac{n!}{\sqrt{2 \pi n} \left(\frac{n}{e}\right)^n} = 1` },
  // `\mathbb R` without braces: `{R}` is a slot here (see authoring rules).
  {
    id: 'h-disk', tier: 'hard', slots: { v, w: v, R: { kind: 'choice', options: ['r', 'R', 'a'] } }, distinct: ['v', 'w', 'R'],
    typst: '{ ({v}, {w}) in RR^2 : {v}^2 + {w}^2 <= {R}^2 }',
    latex: L`\{ ({v}, {w}) \in \mathbb R^2 : {v}^2 + {w}^2 \le {R}^2 \}`,
  },
  {
    id: 'h-cauchy-sum', tier: 'hard', slots: { i: idx, v, w: v }, distinct: ['v', 'w'],
    typst: '(sum_({i}=1)^n {v}_{i} {w}_{i})^2 <= (sum_({i}=1)^n {v}_{i}^2)(sum_({i}=1)^n {w}_{i}^2)',
    latex: L`\left(\sum_{{i}=1}^n {v}_{i} {w}_{i}\right)^2 \le \left(\sum_{{i}=1}^n {v}_{i}^2\right) \left(\sum_{{i}=1}^n {w}_{i}^2\right)`,
  },
];

export const TEMPLATES: Template[] = [...EASY, ...MEDIUM, ...HARD];
