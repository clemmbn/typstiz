/**
 * Engine registry: one lazily created `MathEngine` per language.
 *
 * Engines are loaded with dynamic `import()` so a language's code and WASM are only fetched when
 * needed (spec §11): a Typst player never downloads KaTeX, and a LaTeX player never downloads the
 * Typst WASM unless they switch languages.
 */
import type { LanguageId, MathEngine } from './types';

const engines = new Map<LanguageId, Promise<MathEngine>>();

/**
 * Get (and on first call, load and initialize) the engine for a language.
 * @param language - engine id
 * @returns initialized engine; rejects if loading or the self-check fails
 */
export function getEngine(language: LanguageId): Promise<MathEngine> {
  let engine = engines.get(language);
  if (!engine) {
    engine = loadEngine(language);
    // Drop failed loads so a retry can start from scratch.
    engine.catch(() => engines.delete(language));
    engines.set(language, engine);
  }
  return engine;
}

async function loadEngine(language: LanguageId): Promise<MathEngine> {
  switch (language) {
    case 'typst': {
      const [{ TypstEngine }, { browserTypstAssets }] = await Promise.all([
        import('./typst/TypstEngine'),
        import('./typst/browserAssets'),
      ]);
      const engine = new TypstEngine(browserTypstAssets);
      await engine.init();
      return engine;
    }
    case 'latex': {
      const [{ KatexEngine }, { loadKatexAssets }] = await Promise.all([
        import('./latex/KatexEngine'),
        import('./latex/browserSetup'),
      ]);
      const engine = new KatexEngine(loadKatexAssets);
      await engine.init();
      return engine;
    }
  }
}
