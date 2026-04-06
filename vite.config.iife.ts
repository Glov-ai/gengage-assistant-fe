/**
 * Vite config for IIFE (CDN / script-tag) builds.
 *
 * Produces self-contained bundles with all dependencies (zod, json-render, etc.)
 * baked in, so consumers can load a widget with a single <script> tag:
 *
 *   <script src="https://cdn.example.com/gengage/chat.iife.js"></script>
 *   <script>
 *     const chat = new window.Gengage.GengageChat({ ... });
 *   </script>
 *
 * Each widget file extends `window.Gengage`, so loading multiple widgets
 * on the same page is safe — they share the namespace without clobbering.
 *
 * Since Vite's IIFE format requires a single entry point, this config is
 * invoked three times (once per widget) by `scripts/build-iife.ts`.
 *
 * Run:  npm run build:iife        (IIFE only)
 * Or:   npm run build             (library + IIFE)
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

// The widget to build is passed via GENGAGE_IIFE_WIDGET env var.
// Valid values: 'chat', 'qna', 'simrel', 'simbut', 'native'
const widget = process.env['GENGAGE_IIFE_WIDGET'] ?? 'chat';
const validWidgets = ['chat', 'qna', 'simrel', 'simbut', 'native'] as const;
if (!validWidgets.includes(widget as (typeof validWidgets)[number])) {
  throw new Error(
    `Invalid GENGAGE_IIFE_WIDGET="${widget}". Must be one of: ${validWidgets.join(', ')}`,
  );
}

export default defineConfig({
  resolve: {
    alias: {
      '@gengage/common': resolve(__dirname, 'src/common/index.ts'),
      '@gengage/chat': resolve(__dirname, 'src/chat/index.ts'),
      '@gengage/qna': resolve(__dirname, 'src/qna/index.ts'),
      '@gengage/simrel': resolve(__dirname, 'src/simrel/index.ts'),
      '@gengage/simbut': resolve(__dirname, 'src/simbut/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, `src/${widget}/index.ts`),
      formats: ['iife'],
      name: 'Gengage',
      fileName: () => `${widget}.iife.js`,
    },
    rollupOptions: {
      output: {
        // extend: true means each IIFE extends window.Gengage instead of
        // overwriting it, so loading chat.iife.js + qna.iife.js is safe.
        extend: true,
      },
    },
    sourcemap: true,
  },
});
