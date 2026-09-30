/**
 * Vite + Vitest config.
 *
 * - `base: './'` makes the static bundle work from any path on any static host.
 * - WASM binaries are emitted as hashed assets via `?url` imports (long-cacheable).
 * - `__APP_VERSION__` is stamped into run records for future server-side validation.
 */
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

export default defineConfig({
  base: './',
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    environment: 'node',
    testTimeout: 30_000,
  },
})
