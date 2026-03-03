/**
 * Kill processes listening on dev ports (3000-3010).
 *
 * Usage:
 *   npm run kill
 */

import { execSync } from 'node:child_process';

const START_PORT = 3000;
const END_PORT = 3010;

function listListeningPids(port: number): number[] {
  try {
    const raw = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, {
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8',
    }).trim();
    if (!raw) return [];
    const pids = raw
      .split('\n')
      .map((line) => Number.parseInt(line.trim(), 10))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
    return Array.from(new Set(pids));
  } catch {
    return [];
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const byPort = new Map<number, number[]>();
  for (let port = START_PORT; port <= END_PORT; port++) {
    const pids = listListeningPids(port);
    if (pids.length > 0) byPort.set(port, pids);
  }

  if (byPort.size === 0) {
    console.log(`[gengage:kill] No listeners found on ports ${START_PORT}-${END_PORT}.`);
    return;
  }

  const allPids = Array.from(new Set(Array.from(byPort.values()).flat()));

  console.log(`[gengage:kill] Found listeners on ports ${START_PORT}-${END_PORT}:`);
  for (const [port, pids] of byPort) {
    console.log(`  - ${port}: ${pids.join(', ')}`);
  }

  for (const pid of allPids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Ignore permission/race errors.
    }
  }

  await sleep(250);

  const stubborn = allPids.filter((pid) => isAlive(pid));
  if (stubborn.length > 0) {
    console.log(`[gengage:kill] Forcing ${stubborn.length} process(es) with SIGKILL...`);
    for (const pid of stubborn) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // Ignore permission/race errors.
      }
    }
    await sleep(120);
  }

  const remaining: Array<{ port: number; pids: number[] }> = [];
  for (let port = START_PORT; port <= END_PORT; port++) {
    const pids = listListeningPids(port);
    if (pids.length > 0) remaining.push({ port, pids });
  }

  if (remaining.length === 0) {
    console.log(`[gengage:kill] Cleared all listeners on ports ${START_PORT}-${END_PORT}.`);
    return;
  }

  console.error('[gengage:kill] Some listeners are still active:');
  for (const item of remaining) {
    console.error(`  - ${item.port}: ${item.pids.join(', ')}`);
  }
  process.exit(1);
}

void main();
