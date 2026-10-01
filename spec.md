# Math Typing Race: Product and Technical Spec

## 1. Summary

A fast, static web app. The screen shows a rendered math expression. The player types the source (Typst first, LaTeX later) that reproduces it exactly, as fast as possible. The app compiles the player's input live in the browser and detects when the rendered output matches the target.

No backend in v1. The architecture must make a global leaderboard easy to add later.

## 2. Goals and non-goals

**Goals**
- Fast to load, fast to compile, zero perceived latency while typing.
- Typst mode in v1, with an architecture where adding LaTeX mode is a self-contained task.
- Deterministic, seedable expression generation.
- Scoring formula isolated in one file so it can be tuned easily.
- Deployable as a static site (Cloudflare Pages, Vercel, Netlify or similar).

**Non-goals for v1**
- Accounts, backend, global leaderboard (design for it, do not build it).
- LaTeX mode (design for it, do not build it).
- Mobile-first UX (must not break on mobile, but desktop keyboard is the target).
- Rich code editor features (plain textarea is enough in v1).

## 3. Stack (Claude Code to finalize, recommended defaults)

- Vite + TypeScript, static build output.
- UI framework: Tanstack Start (or React or Svelte if Claude Code has a strong reason). Keep the state model simple; a small store (Zustand or equivalent) is fine.
- Styling: Tailwind or plain CSS modules. Minimal, clean, dark and light theme.
- Typst: `typst.ts` (WASM compiler running in the browser). Check current docs for import paths and WASM loading, the API has changed across versions.
- LaTeX (later): KaTeX.
- Tests: Vitest for logic (generator, normalization, scoring).
- Run heavy compilation off the main thread if typing latency suffers (Web Worker).

## 4. Game modes

Two orthogonal choices at game start: **mode** and **difficulty**.

### 4.1 Modes

| Mode | Behavior |
|---|---|
| **Timed run** | Global countdown (selectable: 30 s, 60 s, 120 s, 180 s, 300 s; default 60 s). As many expressions as possible. Run ends when the clock hits zero. |
| **Zen** | No global clock, no pressure. Player quits whenever they want. Per-expression time and score are still tracked, but the run is not eligible for best-score records (or is recorded in a separate bucket). |

### 4.2 Difficulty

`easy`, `medium`, `hard`, `random`. `random` samples each expression's tier from a weighted mix (default 40 / 40 / 20).

### 4.3 Language

`typst` in v1. The setting exists in the data model and UI state from day one (a disabled "LaTeX (soon)" option is fine).

## 5. Core game loop

1. Start screen: pick mode, difficulty, options (timed duration). Optional seed input (for reproducible runs).
2. Countdown 3, 2, 1. In timed mode the global clock starts at "go".
3. An expression is shown, rendered as SVG, centered and large.
4. The input field is focused automatically. **The per-expression timer starts on the first keystroke.**
5. On input (debounced, about 30 to 60 ms, tune for feel), compile the player's source.
6. If the compiled output is equivalent to the target, the expression is solved: record metrics, compute score, show a brief non-blocking success flash, auto-advance to the next expression. No Enter key required.
7. Timed mode: when the clock reaches zero, stop, show the results screen. A compile in flight at the buzzer is discarded.
8. Zen mode: an explicit "End session" button leads to the results screen.

Other controls:
- **Skip** (key: `Tab` or `Ctrl+Enter`, choose one): next expression, scores 0 for that item, counts as a skip in stats. Timed mode may apply a small time penalty (configurable, default 0).
- **Live preview**: always on, cannot be disabled. Shows the render of the player's current input under the target.
- Pasting is disabled in the input (block `paste` and drop events). Autocorrect, autocapitalize and spellcheck off.

## 6. Answer verification

Correctness is defined by **rendered equivalence, not source equality**. `a/b` and `frac(a, b)` are both correct if they render identically.

### 6.1 Typst pipeline

- Both target and player input are wrapped in the same prelude and compiled with the same settings:

```typst
#set page(width: auto, height: auto, margin: 6pt)
#set text(font: "New Computer Modern Math")   // verify the exact family name registered in typst.ts
$ <source> $
```

- Display math (`$ ... $` with spaces) is the default. Decide once and keep it consistent between the target and player renders.
- Compile to SVG. Normalize before comparing: collapse whitespace, strip generated ids and `href="#..."` references. If the SVG still differs across identical inputs, fall back to comparing a canonical form of glyph and position data, then, as a last resort, rasterize both to canvas and compare pixels.
- **Acceptance test:** compile the same source twice and different-but-equivalent sources (`x^2` vs `x^(2)`, `a/b` vs `frac(a,b)`), assert the normalized SVGs are equal. Compile two truly different sources, assert they differ. This test must exist and run in CI.
- Compile errors while typing are normal. They produce "no match" and no visible error spam. Show a subtle inline error indicator only after the input has been idle for a moment.

### 6.2 Optional strict variant (backlog)

Source-string match after whitespace normalization, as an alternative rule set.

### 6.3 Fonts

Use New Computer Modern for math and JetBrains Mono for app text. Verify that `typst.ts` loads the font assets, otherwise math renders with a fallback and the comparison becomes meaningless. Preload fonts and warm up the compiler on page load (compile a trivial expression) so the first real compile is fast. Show a small loading state until the compiler is ready.

## 7. Expression generation

### 7.1 Requirements

- Seedable PRNG (e.g. mulberry32). Same seed and settings must yield the same sequence of expressions. This enables reproducible runs, a future daily challenge and future server-side score validation.
- Expressions are defined by **templates with typed slots**, not a flat hard-coded list. A small curated bank is still useful as a fallback and for testing.
- The template format must hold **one entry per language** so LaTeX can be added without touching the generator logic:

```ts
type Template = {
  id: string;
  tier: 'easy' | 'medium' | 'hard';
  slots: Record<string, SlotSpec>;          // e.g. n: int(2..9), a: int(1..9), v: var
  typst: string;                            // "sum_(k=1)^{n} k^{p} = ..."
  latex?: string;                           // filled in when LaTeX mode is built
};
```

- Guard against degenerate outputs (e.g. `x^1`, `frac(1, 1)`, duplicates of the previous expression). Never repeat an expression back to back.
- Every generated expression must compile successfully. Add a unit test that generates several thousand expressions per tier across many seeds and compiles them all.

### 7.2 Tier guidelines

| Tier | Content |
|---|---|
| Easy | Single-level constructs: exponents, subscripts, simple fractions, basic operators (`+ - = <= >=`), Greek letters, simple functions (`sin`, `sqrt`) |
| Medium | Nested constructs: sums and products with limits, integrals with bounds and `dif x`, binomials, absolute values and norms, roots with index, accents, `cases` |
| Hard | Multi-line and structured: matrices (`mat(...)`), aligned equations, nested fractions, big operators with stacked limits, mixed accents and styling (`bold`, `cal`, `bb`), long chains |

Tune length so that Easy is roughly 5 to 15 source characters, Medium 15 to 35, Hard 30 to 80. These are guidelines, expose them as config.

Example problems from existing LaTeX problem sets live in `assets/latex-problems-*.json`.

## 8. Metrics and scoring

### 8.1 Metrics captured per expression

- `timeMs`: first keystroke to match.
- `keystrokes`: total input events that inserted characters.
- `deletions`: number of characters removed (compute from input diffs, so held-down backspace and selection deletes are counted correctly).
- `failedCompiles`: number of compile errors observed after an input state has **settled** (idle for about 400 ms). Do not count every transient error while typing.
- `skipped`: boolean.
- `targetSourceLength`: length of the reference source (used to normalize difficulty).

### 8.2 Score formula (v1 proposal, TBD, must be easy to change)

All constants live in a single `scoring.config.ts`. Suggested shape:

```
base       = tierBase[tier] + lengthBonus * targetSourceLength
speed      = clamp(parTime / timeMs, 0, speedCap)        // time has the highest weight
             where parTime = parPerChar * targetSourceLength
penalty    = deletionPenalty * deletions + failedCompilePenalty * failedCompiles
itemScore  = max(0, base * speed - penalty)
```

- Time carries the largest weight by design. Penalties are intentionally small.
- Skipped items score 0.
- Run score is the sum of item scores in timed mode.
- Also display raw stats on the results screen: solved count, average time, accuracy (deletions / keystrokes), best and worst item.
- The scoring function is **pure** and unit tested, and takes only recorded metrics as input, so it can be re-run server-side later.

## 9. UI / UX

- Single-page app, three screens: **Start**, **Game**, **Results**. Plus a small **Stats / Best scores** view.
- Game screen layout: target (large, centered) on top, input below, preview under the input, HUD with timer, solved count and running score.
- The target and preview render on the same background with the same scale so they can be visually compared.
- Input is a monospace textarea (single line by default, grows for multi-line expressions such as matrices). Keep the door open for CodeMirror later, behind a small `InputField` component.
- Keyboard-first: the whole game must be playable without the mouse after starting.
- Restart with one key from the results screen.
- Respect `prefers-color-scheme`, provide a manual toggle.
- Accessibility: visible focus states, sufficient contrast, timer not the only signal of state.

## 10. Architecture

```
src/
  engines/
    types.ts            // MathEngine interface
    typst/              // typst.ts wrapper, prelude, normalization
    latex/              // (later) KaTeX wrapper, same interface
  generator/
    rng.ts              // seedable PRNG
    templates/          // per tier, per language
    generate.ts
  game/
    state.ts            // session state machine
    metrics.ts          // per-expression tracking
    scoring.ts
    scoring.config.ts
  storage/
    ScoreRepository.ts  // interface
    LocalScoreRepository.ts
  ui/                   // screens and components
```

Key interface:

```ts
interface MathEngine {
  id: 'typst' | 'latex';
  init(): Promise<void>;                              // load WASM/fonts, warm up
  render(source: string): Promise<RenderResult | null>; // null on compile error
  equivalent(a: RenderResult, b: RenderResult): boolean;
}
```

The game logic depends only on `MathEngine`, never on Typst specifics. LaTeX mode later means implementing this interface with KaTeX (normalized HTML or MathML output as the comparison key) and adding `latex` fields to templates.

### 10.1 Persistence and leaderboard readiness

- `ScoreRepository` interface with a `LocalScoreRepository` (localStorage) implementation. A future `RemoteScoreRepository` must slot in without touching game code.
- Stored run record (versioned schema, `schemaVersion: 1`):

```ts
type RunRecord = {
  schemaVersion: 1;
  id: string;
  createdAt: string;            // ISO
  language: 'typst' | 'latex';
  mode: 'timed' | 'zen';
  durationSec?: number;         // timed only
  difficulty: 'easy' | 'medium' | 'hard' | 'random';
  seed: string;
  score: number;
  items: ItemRecord[];          // per-expression raw metrics, enough to recompute the score
  appVersion: string;
};
```

- Because the seed and per-item metrics are stored, a future server can regenerate the expressions and recompute the score. Note that a client-side-only score is trivially forgeable; the leaderboard phase will need server-side validation. Do not over-engineer this in v1, just keep the data model compatible.
- Best scores are bucketed by `(language, mode, difficulty, durationSec)`.

## 11. Performance requirements

- Compiler warm-up on load, with a clear ready state.
- Perceived input-to-preview latency under about 100 ms for typical expressions after warm-up.
- Lazy-load anything not needed for the current language (the LaTeX engine especially).
- Cache WASM and font assets with long-lived, hashed URLs.
- Production bundle: keep the initial JS small; WASM and fonts load in parallel with the start screen.

## 12. Milestones

1. **Skeleton:** Vite project, `MathEngine` interface, Typst engine wrapper rendering a hard-coded expression, fonts verified. Equivalence acceptance tests (section 6.1) passing.
2. **Core loop:** input, live compile, match detection, timer, auto-advance, live preview (always on).
3. **Generator:** seedable RNG, templates for the three tiers, generation and compile test suite, `random` mix.
4. **Modes and scoring:** timed and zen modes, metrics capture, scoring module with tests, results screen.
5. **Persistence:** `ScoreRepository` with the localStorage implementation, best scores view.
6. **Polish and deploy:** themes, keyboard flow, loading states, static deploy config and deploy notes.
7. **(Later)** LaTeX mode via KaTeX. **(Later)** Remote leaderboard.

## 13. Acceptance criteria for v1

- Typing any Typst source that renders identically to the target completes the item, regardless of source differences.
- Timer starts on the first keystroke and stops on match.
- Timed run ends exactly when the clock hits zero and produces a results screen.
- Same seed and settings produce the same expression sequence.
- Every generated expression compiles.
- Scores are computed by a pure function from recorded metrics, covered by unit tests.
- Runs and best scores persist across reloads via `ScoreRepository`.
- `pnpm build` (or npm equivalent) produces a static bundle that works when served from any static host.

## 14. Risks and open questions

- **SVG determinism:** if equivalent sources produce different SVG (ids, ordering), the normalization strategy must be strengthened. Resolve in milestone 1 before building anything else.
- **typst.ts API drift:** verify current version and loading model against its docs, pin the version.
- **Font loading:** if New Computer Modern is not picked up, comparisons silently break. Add a startup self-check that fails loudly.
- **Scoring balance:** all constants are provisional. Plan a tuning pass after playtesting.
- **Hard tier length:** long multi-line expressions may need a multi-line input and a different par time model.

## 15. Your role
You can look at https://github.com/JaidenRatti/type-latex and https://github.com/akshayravikumar/TeXnique for inspiration. The architecture and structural decisions here are not fixed. If you find a better way to do something (eg scoring method found in one github repo), feel free to ask me for confirmation and incorporate it.
