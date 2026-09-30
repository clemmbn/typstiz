/**
 * Browser asset loaders for `TypstEngine`.
 *
 * Vite's `?url` imports give hashed, long-cacheable URLs for the WASM binaries. Fonts live in
 * `public/fonts/` (preloaded from index.html) and are fetched in parallel.
 */
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';
import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import { FONT_FILES } from './fontFiles';
import type { TypstAssets } from './TypstEngine';

/**
 * Fetch one font file as bytes.
 * @param file - file name under /fonts/
 * @throws Error when the request fails, so init fails loudly instead of rendering with no font
 */
async function fetchFont(file: string): Promise<Uint8Array> {
  const res = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
  if (!res.ok) throw new Error(`Font ${file} failed to load: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

export const browserTypstAssets: TypstAssets = {
  compilerWasm: () => compilerWasmUrl,
  rendererWasm: () => rendererWasmUrl,
  fonts: () => Promise.all(FONT_FILES.map(fetchFont)),
};
