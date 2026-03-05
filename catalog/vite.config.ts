import { defineConfig } from 'vite';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

export default defineConfig({
  root: __dirname,
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
