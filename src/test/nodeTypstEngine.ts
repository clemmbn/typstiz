/**
 * Test helper: a `TypstEngine` that reads WASM and fonts from disk, for Vitest in Node.
 *
 * The engine is cached per test process because WASM init is the slow part.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TypstEngine } from '../engines/typst/TypstEngine';
import { FONT_FILES } from '../engines/typst/fontFiles';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nm = (p: string) => resolve(root, 'node_modules/@myriaddreamin', p);

let engine: Promise<TypstEngine> | null = null;

/** @returns a shared, initialized engine */
export function getNodeTypstEngine(): Promise<TypstEngine> {
  engine ??= (async () => {
    const e = new TypstEngine({
      compilerWasm: () => readFileSync(nm('typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm')),
      rendererWasm: () => readFileSync(nm('typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm')),
      fonts: async () => FONT_FILES.map((f) => new Uint8Array(readFileSync(resolve(root, 'public/fonts', f)))),
    });
    await e.init();
    return e;
  })();
  return engine;
}
