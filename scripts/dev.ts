/**
 * Local dev server for widget testing.
 *
 * Serves a demo page from demos/<name>/ with Vite HMR.
 * The @gengage/assistant-fe bare import is aliased to src/ so demos
 * work against live source without building first.
 *
 * Usage:
 *   npm run dev -- koctascomtr --sku=1000465056
 *   npm run dev -- vanilla-script
 *   npm run dev -- react --sku=DEMO-001 --port=3005
 *
 * Available demos:
 *   Account demos  — koctascomtr, arcelikcomtr, n11com, yatasbeddingcomtr, hepsiburadacom
 *   Framework demos — vanilla-script, vanilla-esm, react, nextjs, native
 */

import { createServer, type Plugin } from 'vite';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(new URL('.', import.meta.url).pathname, '..');

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface DevOptions {
  demo: string;
  sku?: string;
  port: number;
  backendUrl: string;
}

function parseArgs(argv: string[]): DevOptions {
  const args = argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npm run dev -- <demo> [--sku=SKU] [--port=3000] [--backend-url=URL]');
    console.error('');
    console.error('Available demos:');
    for (const name of getAvailableDemos()) {
      console.error(`  ${name}`);
    }
    process.exit(1);
  }

  const demo = args[0]!;
  const positionalSku = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
  const sku = args.find((a) => a.startsWith('--sku='))?.split('=')[1] ?? positionalSku;
  const port = parseInt(args.find((a) => a.startsWith('--port='))?.split('=')[1] ?? '3000', 10);
  const backendUrl = args.find((a) => a.startsWith('--backend-url='))?.split('=')[1] ?? '';

  return { demo, sku, port, backendUrl };
}

// ---------------------------------------------------------------------------
// Vite plugin: serves demo HTML with sku injected as query param
// ---------------------------------------------------------------------------

function gengageDevPlugin(opts: DevOptions): Plugin {
  const demoDir = resolve(ROOT, 'demos', opts.demo);
  const htmlPath = resolve(demoDir, 'index.html');

  return {
    name: 'gengage-dev',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';
        if (url === '/' || url === '/index.html' || url.startsWith('/?')) {
          const html = readFileSync(htmlPath, 'utf-8');
          server
            .transformIndexHtml('/', html)
            .then((transformed) => {
              res.setHeader('Content-Type', 'text/html');
              res.end(transformed);
            })
            .catch(next);
          return;
        }

        // Serve other files from the demo directory (e.g. native-bridge.js)
        const localFile = resolve(demoDir, url.slice(1).split('?')[0]!);
        if (localFile.startsWith(demoDir) && existsSync(localFile)) {
          const content = readFileSync(localFile);
          res.end(content);
          return;
        }

        next();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv);

  // Verify demo exists
  const demoDir = resolve(ROOT, 'demos', opts.demo);
  if (!existsSync(resolve(demoDir, 'index.html'))) {
    console.error(`Demo not found: "${opts.demo}"`);
    console.error(`Expected: ${demoDir}/index.html`);
    console.error('');
    console.error('Available demos:');
    for (const name of getAvailableDemos()) {
      console.error(`  ${name}`);
    }
    process.exit(1);
  }

  // Build URL with sku query param
  const skuParam = opts.sku ? `?sku=${opts.sku}` : '';

  console.log('\n── Gengage Dev Server ──────────────────────────────');
  console.log(`  Demo:     ${opts.demo}`);
  if (opts.sku) console.log(`  SKU:      ${opts.sku}`);
  console.log(`  Backend:  ${opts.backendUrl}`);
  console.log(`  URL:      http://localhost:${opts.port}${skuParam}`);
  console.log('────────────────────────────────────────────────────\n');

  const server = await createServer({
    root: ROOT,
    cacheDir: resolve(ROOT, 'node_modules/.vite', `demo-${opts.demo}-${opts.port}`),
    server: {
      port: opts.port,
      warmup: {
        clientFiles: [
          `demos/${opts.demo}/index.html`,
          'src/index.ts',
          'src/chat/index.ts',
          'src/qna/index.ts',
          'src/simrel/index.ts',
        ],
      },
      proxy: {
        '/chat': {
          target: opts.backendUrl,
          changeOrigin: true,
        },
        '/analytics': {
          target: opts.backendUrl,
          changeOrigin: true,
        },
      },
    },
    plugins: [gengageDevPlugin(opts)],
    resolve: {
      alias: {
        '@gengage/assistant-fe': resolve(ROOT, 'src/index.ts'),
      },
    },
    optimizeDeps: {
      entries: ['demos/**/*.html', 'src/**/*.ts'],
      include: ['zod'],
    },
  });

  await server.listen();
  server.printUrls();
}

function getAvailableDemos(): string[] {
  const dir = resolve(ROOT, 'demos');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f: string) => !f.startsWith('.') && existsSync(resolve(dir, f, 'index.html')))
    .sort();
}

main().catch(console.error);
