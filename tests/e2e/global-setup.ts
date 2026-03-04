/**
 * Playwright global setup — warms the Vite dev server before workers start.
 *
 * Vite's cold start compiles deps on first request. Without a warmup, parallel
 * workers can hit the server before compilation finishes, causing 404s or
 * half-loaded pages. This fetches key pages and entry points so all deps are cached.
 */
import { DEMO_URL } from './fixtures.js';

async function warmServer(baseURL: string, path: string): Promise<void> {
  const url = `${baseURL}${path}`;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        await res.text(); // Drain body — ensures Vite finishes compilation
        return;
      }
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
}

/** Best-effort fetch to trigger Vite module compilation. */
async function warmModule(baseURL: string, path: string): Promise<void> {
  try {
    const res = await fetch(`${baseURL}${path}`);
    if (res.ok) await res.text();
  } catch {
    // non-fatal
  }
}

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3001';

  // Warm both demo pages and the catalog in parallel
  await Promise.all([
    warmServer(baseURL, DEMO_URL),
    warmServer(baseURL, '/demos/vanilla-script/index.html'),
    warmServer('http://localhost:3002', '/'),
  ]);

  // Warm JS module compilation by fetching widget entry points.
  // Vite transforms imports on demand; fetching these root modules triggers
  // compilation of their entire dependency trees.
  await Promise.all([
    warmModule(baseURL, '/src/index.ts'),
    warmModule(baseURL, '/src/chat/index.ts'),
    warmModule(baseURL, '/src/qna/index.ts'),
    warmModule(baseURL, '/src/simrel/index.ts'),
  ]);
}
