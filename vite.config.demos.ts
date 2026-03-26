/**
 * Vite config for building the demo launcher + all demo pages as a static
 * multi-page app. Output goes to `dist-demos/` for Cloudflare Pages (or any
 * static host).
 *
 * Build:  npm run build:demos
 * Output: dist-demos/
 *   index.html                  ← launcher
 *   koctascomtr/index.html      ← Koçtaş demo
 *   penticom/index.html       ← Penti demo
 *   ...
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, existsSync } from 'fs';

const ROOT = __dirname;
const DEMOS_DIR = resolve(ROOT, 'demos');

// Discover all demo directories that have an index.html
function discoverDemoEntries(): Record<string, string> {
  const entries: Record<string, string> = {
    main: resolve(DEMOS_DIR, 'index.html'),
  };

  for (const name of readdirSync(DEMOS_DIR)) {
    const htmlPath = resolve(DEMOS_DIR, name, 'index.html');
    if (existsSync(htmlPath)) {
      entries[name] = htmlPath;
    }
  }

  return entries;
}

export default defineConfig({
  root: DEMOS_DIR,
  resolve: {
    alias: {
      '@gengage/assistant-fe/native': resolve(ROOT, 'src/native/index.ts'),
      '@gengage/assistant-fe': resolve(ROOT, 'src/index.ts'),
      '/src': resolve(ROOT, 'src'),
      '/demos': resolve(ROOT, 'demos'),
    },
  },
  build: {
    outDir: resolve(ROOT, 'dist-demos'),
    emptyOutDir: true,
    rollupOptions: {
      input: discoverDemoEntries(),
      treeshake: false,
    },
    sourcemap: false,
  },
});
