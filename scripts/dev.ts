/**
 * Local dev server for widget testing.
 *
 * Serves a demo page from demos/<name>/ with Vite HMR.
 * The @gengage/assistant-fe bare import is aliased to src/ so demos
 * work against live source without building first.
 *
 * Usage:
 *   npm run dev -- koctascomtr --sku=1000465056
 *   npm run dev -- --client=koctascomtr --sku=1000465056
 *   npm run dev -- vanilla-script
 *   npm run dev -- react --sku=DEMO-001 --port=3005
 *
 * Available demos:
 *   Account demos  — koctascomtr, arcelikcomtr, n11com, hepsiburadacom, yatasbeddingcomtr,
 *                     penticom, trendyolcom, boynercomtr, evideacom, aygazcomtr,
 *                     divanpastanelericomtr, screwfixcom, pazaramacom, lcwcom, flocomtr,
 *                     defactocomtr, avansascom, teknosacom
 *   Framework demos — vanilla-script, vanilla-esm, react, nextjs, native, gtm-custom
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

function buildDevQuery(opts: Pick<DevOptions, 'sku' | 'backendUrl'>): URLSearchParams {
  const query = new URLSearchParams();
  if (opts.sku) query.set('sku', opts.sku);
  if (opts.backendUrl) query.set('middlewareUrl', opts.backendUrl);
  return query;
}

function printUsage(): void {
  console.error('Usage: npm run dev -- <demo> [--sku=SKU] [--port=3000] [--backend-url=URL]');
  console.error('   or: npm run dev -- --client=<demo> [--sku=SKU] [--port=3000] [--backend-url=URL]');
  console.error('');
  console.error('Available demos:');
  for (const name of getAvailableDemos()) {
    console.error(`  ${name}`);
  }
}

function failUsage(message: string): never {
  console.error(message);
  console.error('');
  printUsage();
  process.exit(1);
}

function parseArgs(argv: string[]): DevOptions {
  const args = argv.slice(2);
  const knownFlagPrefixes = ['--client=', '--sku=', '--port=', '--backend-url='];
  const unknownFlags = args.filter((a) => a.startsWith('--') && !knownFlagPrefixes.some((p) => a.startsWith(p)));
  if (unknownFlags.length > 0) {
    failUsage(`Unknown option(s): ${unknownFlags.join(', ')}`);
  }

  const positionalArgs = args.filter((a) => !a.startsWith('--'));
  const namedDemo = args.find((a) => a.startsWith('--client='))?.slice('--client='.length);
  const positionalDemo = positionalArgs[0];
  if (namedDemo !== undefined && namedDemo.trim() === '') {
    failUsage('Invalid --client value: cannot be empty.');
  }

  if (namedDemo && positionalDemo && namedDemo !== positionalDemo) {
    failUsage(`Conflicting demo values: positional "${positionalDemo}" vs --client="${namedDemo}".`);
  }

  const portRaw = args.find((a) => a.startsWith('--port='))?.slice('--port='.length);
  if (portRaw !== undefined && portRaw.trim() === '') {
    failUsage('Invalid --port value: cannot be empty.');
  }
  const port = parseInt(portRaw ?? '3000', 10);
  if (!Number.isFinite(port) || Number.isNaN(port) || port <= 0) {
    failUsage(`Invalid --port value: "${portRaw ?? ''}".`);
  }

  const demo = positionalDemo ?? namedDemo;

  if (!demo) {
    return { demo: '', sku: undefined, port, backendUrl: '' };
  }

  // Legacy positional SKU support:
  // - npm run dev -- koctascomtr 1000465056
  // - npm run dev -- --client=koctascomtr 1000465056
  const positionalSku = positionalDemo ? positionalArgs[1] : positionalArgs[0];
  const extraPositionals = positionalDemo ? positionalArgs.slice(2) : positionalArgs.slice(positionalSku ? 1 : 0);
  if (extraPositionals.length > 0) {
    failUsage(`Unexpected positional argument(s): ${extraPositionals.join(', ')}`);
  }

  const flagSku = args.find((a) => a.startsWith('--sku='))?.slice('--sku='.length);
  if (flagSku !== undefined && flagSku.trim() === '') {
    failUsage('Invalid --sku value: cannot be empty.');
  }
  if (flagSku && positionalSku) {
    failUsage('Provide SKU either as positional arg or --sku=..., not both.');
  }

  const backendUrl =
    args.find((a) => a.startsWith('--backend-url='))?.slice('--backend-url='.length) ?? 'https://chatbe-dev.gengage.ai';
  const sku = flagSku ?? positionalSku;

  return { demo, sku, port, backendUrl };
}

// ---------------------------------------------------------------------------
// Vite plugin: serves demo HTML with sku injected as query param
// ---------------------------------------------------------------------------

function gengageDevPlugin(opts: DevOptions): Plugin {
  const demoDir = resolve(ROOT, 'demos', opts.demo);
  const htmlPath = resolve(demoDir, 'index.html');
  const queryParam = buildDevQuery(opts).toString();
  const querySuffix = queryParam ? `?${queryParam}` : '';

  return {
    name: 'gengage-dev',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';
        // Keep dev options sticky even if users open bare "/" URL shown by Vite.
        if ((url === '/' || url === '/index.html') && querySuffix) {
          res.statusCode = 302;
          res.setHeader('Location', `/${querySuffix}`);
          res.end();
          return;
        }
        if (url === '/' || url === '/index.html' || url.startsWith('/?')) {
          const html = readFileSync(htmlPath, 'utf-8');
          // Use the real filesystem path (relative to Vite root) so Vite's
          // html-proxy module resolver can find inline <script> modules.
          const transformUrl = `/demos/${opts.demo}/index.html`;
          server
            .transformIndexHtml(transformUrl, html)
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
// Vite plugin: launcher page — serves demos/index.html, redirects ?demo= picks
// ---------------------------------------------------------------------------

function gengageLauncherPlugin(port: number): Plugin {
  const launcherPath = resolve(ROOT, 'demos', 'index.html');

  return {
    name: 'gengage-launcher',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url ?? '/';
        const parsed = new URL(url, `http://localhost:${port}`);

        // Serve a demo when accessed via /<demoName>/ or /<demoName>/?sku=...
        const pathMatch = parsed.pathname.match(/^\/([a-zA-Z0-9_-]+)\/?$/);
        const demoName = pathMatch?.[1];
        if (demoName) {
          const demoDir = resolve(ROOT, 'demos', demoName);
          const htmlPath = resolve(demoDir, 'index.html');
          if (existsSync(htmlPath)) {
            const html = readFileSync(htmlPath, 'utf-8');
            const transformUrl = `/demos/${demoName}/index.html`;
            server
              .transformIndexHtml(transformUrl, html)
              .then((transformed) => {
                res.setHeader('Content-Type', 'text/html');
                res.end(transformed);
              })
              .catch(next);
            return;
          }
        }

        // Serve launcher page for bare / requests
        if (url === '/' || url === '/index.html') {
          const html = readFileSync(launcherPath, 'utf-8');
          server
            .transformIndexHtml('/demos/index.html', html)
            .then((transformed) => {
              res.setHeader('Content-Type', 'text/html');
              res.end(transformed);
            })
            .catch(next);
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

  // Launcher mode: no demo specified → serve the demo launcher page
  if (!opts.demo) {
    console.log('\n── Gengage Dev Server ──────────────────────────────');
    console.log('  Mode:     Demo Launcher');
    console.log(`  URL:      http://localhost:${opts.port}`);
    console.log('────────────────────────────────────────────────────\n');

    const server = await createServer({
      root: ROOT,
      cacheDir: resolve(ROOT, 'node_modules/.vite', `demo-launcher-${opts.port}`),
      server: { port: opts.port },
      plugins: [gengageLauncherPlugin(opts.port)],
      resolve: {
        alias: { '@gengage/assistant-fe': resolve(ROOT, 'src/index.ts') },
      },
      optimizeDeps: {
        entries: ['demos/**/*.html', 'src/**/*.ts'],
        include: ['zod'],
      },
    });
    await server.listen();
    server.printUrls();
    return;
  }

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

  // Build URL with optional query params consumed by demos.
  const query = buildDevQuery(opts);
  const queryParam = query.toString();
  const querySuffix = queryParam ? `?${queryParam}` : '';

  console.log('\n── Gengage Dev Server ──────────────────────────────');
  console.log(`  Demo:     ${opts.demo}`);
  if (opts.sku) console.log(`  SKU:      ${opts.sku}`);
  console.log(`  Backend:  ${opts.backendUrl}`);
  console.log(`  URL:      http://localhost:${opts.port}${querySuffix}`);
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
