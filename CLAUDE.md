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
  vector artifact, then `renderSvg`). Game code must only use `MathEngine` via `engines/registry.ts`.
- `src/generator/` seeded (mulberry32) template generator. Templates in `templates/typst.ts`
  use `{slot}` placeholders; every template is compile-tested.
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
- Window keydown listeners must ignore `e.defaultPrevented`: a keydown that ends a screen can reach
  `window` after the next screen has mounted its own listener.
- Project conventions (from user prefs): file header comment, doc comments on every function,
  lots of `console.info` logging with a `[area]` prefix.
