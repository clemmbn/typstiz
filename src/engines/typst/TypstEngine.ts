/**
 * Typst implementation of `MathEngine`, backed by typst.ts 0.7.0 (WASM).
 *
 * Pipeline: source → wrapSource → compiler.compile (vector artifact) → renderer.renderSvg → SVG.
 *
 * Constraints:
 * - Asset loading is injected (`TypstAssets`) so the same class runs in the browser (fetch URLs)
 *   and in Vitest (read files from disk).
 * - Default remote font assets are disabled; only our self-hosted NewCM fonts are loaded, so every
 *   player gets the exact same glyphs. A self-check fails loudly if fonts didn't load.
 * - The WASM compiler holds one shared "main file"; calls are serialized through a promise queue
 *   so two overlapping renders can't overwrite each other's source between `addSource` and
 *   `compile`.
 */
import {
  createTypstCompiler,
  createTypstRenderer,
  initOptions,
  type TypstCompiler,
  type TypstRenderer,
} from '@myriaddreamin/typst.ts';
import type { MathEngine, RenderResult } from '../types';
import { normalizeSvg, svgForDisplay } from './normalize';
import { wrapSource } from './prelude';

/** Anything `getModule` accepts: URL string, bytes, Response, compiled module. */
type WasmRef = string | URL | BufferSource | Response | WebAssembly.Module;

export type TypstAssets = {
  compilerWasm: () => WasmRef | Promise<WasmRef>;
  rendererWasm: () => WasmRef | Promise<WasmRef>;
  /** Font files, as raw bytes. */
  fonts: () => Promise<Uint8Array[]>;
};

const MAIN_PATH = '/main.typ';
const LOG = '[typst-engine]';

export class TypstEngine implements MathEngine {
  readonly id = 'typst' as const;
  private compiler: TypstCompiler | null = null;
  private renderer: TypstRenderer | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private initPromise: Promise<void> | null = null;

  private readonly assets: TypstAssets;

  /**
   * @param assets - loaders for WASM binaries and font bytes
   */
  constructor(assets: TypstAssets) {
    this.assets = assets;
  }

  /**
   * Load compiler, renderer and fonts, then run the font self-check. Idempotent: concurrent
   * callers share the same promise.
   * @throws Error when WASM fails to load or the font self-check fails
   */
  init(): Promise<void> {
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    const t0 = performance.now();
    console.info(`${LOG} init: loading fonts and WASM`);
    const fonts = await this.assets.fonts();
    console.info(`${LOG} init: ${fonts.length} font files loaded`);

    const compiler = createTypstCompiler();
    const renderer = createTypstRenderer();
    // Compiler and renderer are independent WASM modules; load them in parallel.
    await Promise.all([
      compiler.init({
        getModule: this.assets.compilerWasm,
        beforeBuild: [initOptions.disableDefaultFontAssets(), initOptions.loadFonts(fonts)],
      }),
      renderer.init({ getModule: this.assets.rendererWasm }),
    ]);
    this.compiler = compiler;
    this.renderer = renderer;
    console.info(`${LOG} init: WASM ready in ${Math.round(performance.now() - t0)} ms`);

    await this.selfCheck();
    console.info(`${LOG} init: done in ${Math.round(performance.now() - t0)} ms`);
  }

  /**
   * Verify fonts actually loaded. Typst does not warn about missing fonts, so without this a
   * broken font setup would render nothing and every comparison would be meaningless.
   * Also warms up the compiler so the first real compile is fast.
   * @throws Error when the reference render is missing or has no glyph outlines
   */
  private async selfCheck(): Promise<void> {
    const res = await this.render('x^2 + frac(a, b)');
    if (!res) throw new Error('Typst self-check failed: reference expression did not compile');
    // Glyphs are emitted as <path d="..."> outlines; no outlines means no usable math font.
    const glyphCount = (res.markup.match(/<path[^>]*\sd="/g) ?? []).length;
    console.info(`${LOG} self-check: ${glyphCount} glyph outlines in reference render`);
    if (glyphCount < 3) {
      throw new Error(`Typst self-check failed: math font not loaded (${glyphCount} glyphs)`);
    }
  }

  /**
   * Compile and render a math source.
   * @param source - Typst math source (without `$`)
   * @returns render result, or null on compile error
   */
  render(source: string): Promise<RenderResult | null> {
    // Chain onto the queue so compiles never interleave; swallow errors in the chain itself.
    const run = this.queue.then(() => this.renderNow(source));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async renderNow(source: string): Promise<RenderResult | null> {
    const { compiler, renderer } = this;
    if (!compiler || !renderer) throw new Error('TypstEngine.render called before init()');
    compiler.addSource(MAIN_PATH, wrapSource(source));
    let artifact: Uint8Array | undefined;
    try {
      // With diagnostics 'none', typst.ts throws on compile errors instead of returning them.
      // Errors are expected while the player is mid-typing, so they map to null, not exceptions.
      artifact = (await compiler.compile({ mainFilePath: MAIN_PATH, diagnostics: 'none' })).result;
    } catch {
      return null;
    }
    if (!artifact) return null;
    const raw = await renderer.renderSvg({ format: 'vector', artifactContent: artifact });
    return { markup: svgForDisplay(raw), format: 'svg', key: normalizeSvg(raw) };
  }

  /**
   * @param a - first render
   * @param b - second render
   * @returns true when both normalized SVGs are identical
   */
  equivalent(a: RenderResult, b: RenderResult): boolean {
    return a.key === b.key;
  }
}
