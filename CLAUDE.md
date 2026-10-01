# CLAUDE.md

Typstiz: static web app, a typing race where the player types Typst math source matching a
rendered target. Spec: `spec.md`. Plan and milestone status: `PLAN.md` (keep its checkboxes current).

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm test` (Vitest; engine and generator suites load the real typst.ts WASM from node_modules)
- `npm run typecheck` (`tsc -b`, three projects: app, node config, tests)
- `npm run lint` (oxlint)

Package manager is npm (pnpm is not installed).

## Architecture

- `src/engines/` `MathEngine` interface; `typst/TypstEngine.ts` wraps typst.ts 0.7.0 (compile to
  vector artifact, then `renderSvg`); `latex/KatexEngine.ts` wraps KaTeX 0.18.10 (HTML output,
  key from `latex/normalize.ts`). Game code must only use `MathEngine` via `engines/registry.ts`.
  `RenderResult.format` (`svg` | `html`) tells `MathView` how to size the markup.
- `src/generator/` seeded (mulberry32) template generator. Templates in `templates/bank.ts`
  hold a `typst` and a `latex` source and use `{slot}` placeholders; every template is
  compile-tested with both engines.
- `src/game/` `store.ts` (Zustand state machine), `metrics.ts`, pure `scoring.ts`, all constants
  in `scoring.config.ts`.
- `src/storage/` `ScoreRepository` interface + `LocalScoreRepository` (versioned `RunRecord`).
- `src/ui/` React screens. `GameScreen` keys `ItemBoard` by target so per-item state resets by remount.

## Gotchas

- typst.ts pins: `@myriaddreamin/typst.ts`, `-web-compiler`, `-renderer` all exactly 0.7.0. The API
  changes across versions; re-verify on upgrade.
- With `diagnostics: 'none'`, `compile()` **throws** on errors; the engine maps that to `null`.
- Renderer SVG contains `<foreignObject class="tsel">` text overlays that are only hidden by its
  own CSS; `normalize.ts` strips them (and the CSS) for display and for the comparison key.
- Typst emits no warning for missing fonts; the engine's self-check counts glyph outlines instead.
- Unbalanced `(` compiles fine in Typst math; don't assume it's an error.
- KaTeX raw HTML differs for equivalent sources (`x^{2}` adds a wrapper span); always compare
  `normalizeKatex` keys. With `trust: false` KaTeX does not throw on `\href` etc., it renders
  them in `errorColor`; the engine treats the sentinel color as an error.
- Slot values are sampled once and spelled per language; `accept`/`derive`/`distinct` and the
  degeneracy guards see Typst spellings. Never change the RNG calls in `sampleSlot`: a test pins
  the Typst sequences of existing seeds.
- LaTeX templates: slot arguments use double braces (`\sqrt{{a}}`); `\mathbb{R}` in a template
  with a slot `R` would be substituted (use `\mathbb R`). Tested.
- Window keydown listeners must ignore `e.defaultPrevented`: a keydown that ends a screen can reach
  `window` after the next screen has mounted its own listener.
- Project conventions (from user prefs): file header comment, doc comments on every function,
  lots of `console.info` logging with a `[area]` prefix.
