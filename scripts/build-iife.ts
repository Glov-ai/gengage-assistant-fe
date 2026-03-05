/**
 * Build IIFE bundles for each widget.
 *
 * Vite's IIFE format requires a single entry point, so we invoke
 * `vite build` once per widget, passing the widget name via env var.
 *
 * Usage:  tsx scripts/build-iife.ts
 * Or:     npm run build:iife
 */

import { execSync } from 'child_process';

const widgets = ['chat', 'qna', 'simrel', 'native'] as const;

for (const widget of widgets) {
  console.log(`\n  Building IIFE: ${widget}...\n`);
  execSync(`npx vite build --config vite.config.iife.ts`, {
    stdio: 'inherit',
    env: { ...process.env, GENGAGE_IIFE_WIDGET: widget },
  });
}

console.log('\n  IIFE builds complete.\n');
