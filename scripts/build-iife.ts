/**
 * Build IIFE bundles for each widget.
 *
 * Vite's IIFE format requires a single entry point, so we invoke
 * `vite build` once per widget, passing the widget name via env var.
 *
 * Usage:  tsx scripts/build-iife.ts
 * Or:     npm run build:iife
 */

import { execFileSync } from 'child_process';
import { resolve } from 'path';

const widgets = ['chat', 'qna', 'simrel', 'simbut', 'native'] as const;
const viteBin = resolve('node_modules/vite/bin/vite.js');

for (const widget of widgets) {
  console.log(`\n  Building IIFE: ${widget}...\n`);
  execFileSync(process.execPath, [viteBin, 'build', '--config', 'vite.config.iife.ts'], {
    stdio: 'inherit',
    env: { ...process.env, GENGAGE_IIFE_WIDGET: widget },
  });
}

console.log('\n  IIFE builds complete.\n');
