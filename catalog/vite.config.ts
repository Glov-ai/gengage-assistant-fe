import { defineConfig } from 'vite';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..');

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@gengage/assistant-fe/chat': resolve(ROOT, 'dist/chat.js'),
      '@gengage/assistant-fe/qna': resolve(ROOT, 'dist/qna.js'),
      '@gengage/assistant-fe/simrel': resolve(ROOT, 'dist/simrel.js'),
      '@gengage/assistant-fe/common': resolve(ROOT, 'dist/common.js'),
      '@gengage/assistant-fe': resolve(ROOT, 'dist/index.js'),
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
