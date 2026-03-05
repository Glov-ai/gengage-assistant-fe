import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      outDir: 'dist',
    }),
  ],
  resolve: {
    alias: {
      '@gengage/assistant-fe/native': resolve(__dirname, 'src/native/index.ts'),
      '@gengage/assistant-fe': resolve(__dirname, 'src/index.ts'),
      '@gengage/common': resolve(__dirname, 'src/common/index.ts'),
      '@gengage/chat': resolve(__dirname, 'src/chat/index.ts'),
      '@gengage/qna': resolve(__dirname, 'src/qna/index.ts'),
      '@gengage/simrel': resolve(__dirname, 'src/simrel/index.ts'),
    },
  },
  server: {
    warmup: {
      clientFiles: ['demos/koctascomtr/index.html', 'src/index.ts', 'src/chat/index.ts', 'src/qna/index.ts', 'src/simrel/index.ts'],
    },
  },
  optimizeDeps: {
    entries: ['demos/**/*.html', 'src/**/*.ts'],
    include: ['zod'],
  },
  build: {
    cssCodeSplit: true,
    lib: {
      // Each widget can also be built as a standalone IIFE for vanilla embed
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        chat: resolve(__dirname, 'src/chat/index.ts'),
        qna: resolve(__dirname, 'src/qna/index.ts'),
        simrel: resolve(__dirname, 'src/simrel/index.ts'),
        common: resolve(__dirname, 'src/common/index.ts'),
        native: resolve(__dirname, 'src/native/index.ts'),
      },
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true,
  },
});
