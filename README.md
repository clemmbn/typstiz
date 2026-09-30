# Typstiz

A math typing race. A rendered expression appears; type the [Typst](https://typst.app) source that
reproduces it, as fast as possible. Answers are checked by **rendered equivalence**: `a/b` and
`frac(a, b)` both count.

Everything runs in the browser (typst.ts WASM compiler); there is no backend.

- Product spec: [spec.md](spec.md)
- Implementation plan and status: [PLAN.md](PLAN.md)

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest, including the real-WASM equivalence and generator compile suites
npm run typecheck
npm run lint
npm run build      # static bundle in dist/
```

## Deploy

`npm run build` outputs a fully static site in `dist/` that works from any path (`base: './'`).

| Host | Settings |
|---|---|
| Cloudflare Pages | Build command `npm run build`, output `dist`. Cache headers come from `public/_headers`. |
| Netlify | Same as above; `_headers` is honored. |
| Vercel | Framework preset "Vite"; cache headers come from `vercel.json`. |

Notes:
- The Typst compiler WASM is ~28 MB (~11 MB gzipped). It has a content-hashed URL and is served
  with `immutable` caching, so it downloads once. It loads in parallel with the start screen.
- The host must serve `.wasm` as `application/wasm` (all three above do) for streaming compilation.
- Fonts (New Computer Modern, from `typst/typst-assets` v0.13.1) are self-hosted in `public/fonts/`
  so every player renders with identical glyphs. The engine self-checks fonts at startup and
  shows an error instead of silently comparing broken renders.
