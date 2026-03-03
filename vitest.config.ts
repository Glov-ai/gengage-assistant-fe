import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@gengage/common': resolve(__dirname, 'src/common/index.ts'),
      '@gengage/chat': resolve(__dirname, 'src/chat/index.ts'),
      '@gengage/qna': resolve(__dirname, 'src/qna/index.ts'),
      '@gengage/simrel': resolve(__dirname, 'src/simrel/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['tests/setup.ts'],
  },
});
