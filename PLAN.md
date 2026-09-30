# Typstiz: Implementation Plan

Companion to [spec.md](spec.md). This file records the concrete stack decisions, findings from the
de-risking probe, and the milestone checklist. Update the checkboxes as work lands.

## 0. Findings from the de-risking probe (2026-09-30)

Probed `@myriaddreamin/typst.ts@0.7.0` in Node with the real WASM binaries:

| Check | Result |
|---|---|
| Same source compiled twice | Byte-identical SVG |
| `x^2` vs `x^(2)`, `a/b` vs `frac(a,b)`, `sum_(k=1)^n` vs `sum_(k=1)^(n)`, `alpha + beta` vs `alpha+beta` | Byte-identical SVG |
| `x^2` vs `x^3` | Different SVG |
| Compile + render latency (warm) | ~0.2 to 1.5 ms per expression |
| Compiler + renderer init (Node, local WASM) | ~50 ms |
| Unknown font family | **No diagnostic emitted**, so a font self-check must be done another way |

Consequences:
- Raw SVG comparison already works. We still apply a light normalization (strip `<style>`, whitespace,
  ids) as defense in depth; pixel comparison is not needed.
- Compiling on the main thread is fine for latency. A Web Worker is deferred unless WASM
  instantiation (28 MB uncompressed compiler) visibly janks the start screen.
- Fonts: disable typst.ts default remote font assets, self-host NewCM fonts from
  `typst/typst-assets@v0.13.1` in `public/fonts/`. Self-check at startup: render a reference
  expression and assert it contains glyph outlines and has the expected width.

API shape (0.7.0): `createTypstCompiler()` → `compile({ mainFilePath, diagnostics })` returns a
vector artifact → `createTypstRenderer().renderSvg({ artifactContent })` returns an SVG string.
Both `init({ getModule, beforeBuild })` accept a WASM loader, which lets the same engine run in the
browser (URL fetch) and in Vitest (fs read).

## 1. Stack decisions

| Area | Choice | Why |
|---|---|---|
| Build | Vite + TypeScript, static output | Spec default |
| UI | React 19 + Zustand | TanStack Start is SSR/full-stack oriented; a static SPA with 4 screens doesn't need a router or server functions. Screen switching is a store field. |
| Styling | Plain CSS with CSS custom properties (one stylesheet) | Tiny UI surface; tokens make dark/light trivial; no Tailwind build step |
| Typst | `@myriaddreamin/typst.ts` 0.7.0 + web compiler + renderer, versions pinned exactly | Verified API above |
| Fonts | NewCM (math) self-hosted; JetBrains Mono for UI via Google Fonts | Spec 6.3 |
| Tests | Vitest (node env), engine tests use real WASM | Spec 6.1 acceptance test |
| Package manager | npm (pnpm is not installed on this machine) | |
| Skip key | `Tab` | One key, reachable without moving hands; `Ctrl+Enter` kept free |

## 2. Architecture (as in spec §10)

```
src/
  engines/types.ts              MathEngine interface, RenderResult
  engines/typst/                TypstEngine, prelude, normalize, font self-check
  engines/latex/                KatexEngine, normalize (HTML comparison key), browser CSS/fonts
  generator/rng.ts              mulberry32 + string seed hashing
  generator/slots.ts            slot specs and sampling
  generator/templates/bank.ts   templates per tier, one `typst` and one `latex` source each
  generator/generate.ts         seeded sequence generator with degeneracy guards
  game/hints.ts, hints.latex.ts symbol hint dictionaries per language
  game/types.ts                 settings, item records, run record
  game/metrics.ts               per-expression tracker (keystrokes, deletions via diffs, settled errors)
  game/scoring.config.ts        all tunable constants
  game/scoring.ts               pure scoring function
  game/store.ts                 Zustand session state machine
  storage/ScoreRepository.ts    interface
  storage/LocalScoreRepository.ts
  ui/                           App, StartScreen, GameScreen, ResultsScreen, StatsScreen,
                                MathView, InputField, ThemeToggle
```

## 3. Milestones

### M1 Skeleton
- [x] Vite + React + TS project, Vitest, oxlint, git init
- [x] `MathEngine` interface
- [x] `TypstEngine` (compile → SVG, normalization, font self-check)
- [x] Fonts in `public/fonts/`, WASM loaded via Vite `?url`
- [x] Equivalence acceptance test (spec 6.1) passing

### M2 Core loop
- [x] `InputField` (paste/drop blocked, autocorrect off, grows for multi-line)
- [x] Debounced live compile (~40 ms), match detection, auto-advance, success flash
- [x] Per-expression timer starting on first keystroke
- [x] Live preview (always on; toggle and score multiplier removed)

### M3 Generator
- [x] mulberry32 RNG seeded from a string
- [x] Slot types: int range, variable, greek, function, index, choice
- [x] Templates for easy / medium / hard; `random` tier mix 40/40/20
- [x] Guards: no `x^1`, no `frac(1,1)`, no back-to-back repeats
- [x] Tests: determinism; thousands of expressions per tier all compile

### M4 Modes and scoring
- [x] Timed (30/60/120 s) and zen modes, 3-2-1 countdown
- [x] Skip (Tab), optional time penalty
- [x] Symbol hints (Shift+Tab / button): `game/hints.ts`, `hintPenalty` points each, `hints` stored per item
- [x] Metrics capture (keystrokes, deletions from diffs, settled failed compiles)
- [x] `scoring.config.ts` + pure `scoreItem` / `scoreRun` with tests
- [x] Results screen with raw stats, restart with one key

### M5 Persistence
- [x] `ScoreRepository` + `LocalScoreRepository` (schemaVersion 1)
- [x] Best scores bucketed by (language, mode, difficulty, durationSec); zen separate
- [x] Stats / best scores view

### M6 Polish and deploy
- [x] Dark/light theme with `prefers-color-scheme` + manual toggle
- [x] Loading state until the engine is ready, loud failure if self-check fails
- [x] Keyboard-only flow end to end
- [x] Static deploy notes (Cloudflare Pages / Netlify / Vercel), long-cache headers for hashed assets
- [x] Docker image (nginx, precompressed assets) for Coolify, CD job in CI triggering the Coolify deploy webhook

### M7 LaTeX mode (KaTeX)
- [x] `KatexEngine` behind `MathEngine`: display mode, HTML output, `trust: false`, refused
      commands (rendered in `errorColor` instead of throwing) mapped to compile errors
- [x] Comparison key: canonical KaTeX HTML (inert atom classes dropped, bare wrapper spans from
      `{...}` groups unwrapped except under `>`-combinator parents, adjacent plain text spans
      merged), so `x^2` ≡ `x^{2}`, `\frac ab` ≡ `\frac{a}{b}`, `{a}{b}` ≡ `ab`
- [x] Self-check at init (reference renders, two spellings compare equal); fonts preloaded in the
      browser so targets never flash in a fallback font
- [x] Lazy loading: KaTeX JS, CSS and fonts only load when LaTeX is selected; a returning LaTeX
      player never downloads the Typst WASM
- [x] `latex` source on every template; slot values spelled per language; same RNG stream, so a
      seed gives the same mathematics in both languages and Typst sequences are unchanged
      (fingerprint test)
- [x] Compile test of the generated LaTeX bank; placeholder parity test; `\cmd{slot}` guard
- [x] LaTeX hint dictionary with coverage test
- [x] UI: language picker enabled, engine reloads on switch, language shown in results and stats,
      KaTeX sized to match Typst glyphs and shrunk to fit narrow screens
- [ ] Playtest: LaTeX sources are longer than Typst ones, so the length-based par time and bonus
      are more generous per expression. Scores are bucketed per language, so this only matters for
      tuning, not fairness.

### Later
- Remote leaderboard (`RemoteScoreRepository`, server-side recompute from seed + metrics)
- Strict source-match rule set (spec 6.2)

### Remaining before calling v1 done
- [ ] Playtest pass: tune `scoring.config.ts`, template lengths, and hard-tier par time
- [x] CI workflow running `npm test` (`.github/workflows/ci.yml`)
- [ ] Measure WASM instantiation on a cold, throttled load; move the engine to a Web Worker if the
      start screen janks
- [ ] Convert a curated subset of `assets/latex-problems-*.txt` to Typst as a fallback bank

## 4. Open questions for the owner

- All scoring constants are provisional, to tune after playtesting.
- Item time starts at the first input event. An IME or autocomplete that inserts several characters
  in one event can make `timeMs` near 0 (speed capped at 3x). Acceptable for v1; a server-side
  plausibility check (min ms per char) belongs to the leaderboard phase.
- Compiler WASM is ~11 MB gzipped. First visit on a slow connection will show the loading state
  for a while; later visits hit the immutable cache.
- `assets/latex-problems-*.txt` are LaTeX; they can seed a curated fallback bank once converted to Typst.
