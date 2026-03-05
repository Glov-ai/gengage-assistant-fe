import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const ROOT = resolve(__dirname, '..');

function readPackageVersion(): string {
  const parsed: unknown = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid package.json: expected an object.');
  }

  const version = (parsed as { version?: unknown }).version;
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error('Invalid package.json: missing non-empty string "version".');
  }

  return version;
}

const PACKAGE_VERSION = readPackageVersion();

export default defineConfig({
  root: __dirname,
  define: {
    __GENGAGE_VERSION__: JSON.stringify(PACKAGE_VERSION),
  },
  resolve: {
    alias: {
      // Resolve directly to source modules so catalog remains stable even while
      // dist/ is being rebuilt in parallel during development.
      '@gengage/assistant-fe/chat': resolve(ROOT, 'src/chat/index.ts'),
      '@gengage/assistant-fe/qna': resolve(ROOT, 'src/qna/index.ts'),
      '@gengage/assistant-fe/simrel': resolve(ROOT, 'src/simrel/index.ts'),
      '@gengage/assistant-fe/common': resolve(ROOT, 'src/common/index.ts'),
      '@gengage/assistant-fe': resolve(ROOT, 'src/index.ts'),
    },
  },
  server: {
    port: 3002,
    fs: {
      // Allow serving files from the parent directory (dist/, src/chat/components/chat.css)
      allow: [__dirname, resolve(__dirname, '..')],
    },
  },
  build: {
    outDir: resolve(ROOT, 'catalog-dist'),
    emptyOutDir: true,
  },
});
