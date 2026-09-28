#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const TERM_WAIT_MS = 2000;
const KILL_WAIT_MS = 2000;
const POLL_INTERVAL_MS = 100;

const USAGE = [
  'Usage:',
  '  node scripts/ports.mjs check <port> [port2 ...]',
  '  node scripts/ports.mjs kill <port> [port2 ...]',
  '',
  'Examples:',
  '  npm run ports:check -- 5173 3001',
  '  npm run ports:kill -- 5173 3001',
].join('\n');

function parseArgs() {
  const [, , action, ...rawPorts] = process.argv;

  if (!action || action === '--help' || action === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  if (action !== 'check' && action !== 'kill') {
    console.error(`Invalid action: ${action}`);
    console.error(USAGE);
    process.exit(1);
  }

  if (rawPorts.length === 0) {
    console.error('At least one port is required.');
    console.error(USAGE);
    process.exit(1);
  }

  const ports = rawPorts.map((port) => {
    if (!/^\d+$/.test(port)) {
      console.error(`Invalid port: ${port}`);
      process.exit(1);
    }

    const value = Number(port);
    if (value < 1 || value > 65535) {
      console.error(`Port out of range: ${port}`);
      process.exit(1);
    }

    return String(value);
  });

  return { action, ports };
}

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function getPidsForPortWindows(port) {
  try {
    // `-p tcp` would omit IPv6 listeners (e.g. Vite on [::1]), so filter TCP rows manually.
    const output = run(`netstat -ano`);

    const pids = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /^TCP\s/i.test(line))
      .filter((line) => /LISTENING/i.test(line))
      .filter((line) => {
        const localAddr = line.split(/\s+/)[1] ?? '';
        return localAddr.endsWith(`:${port}`);
      })
      .map((line) => line.split(/\s+/).pop())
      .filter((pid) => Boolean(pid))
      // PID 0 (Idle) and 4 (System) are not killable and never own dev ports.
      .filter((pid) => pid !== '0' && pid !== '4');

    return [...new Set(pids)];
  } catch {
    return [];
  }
}

function getPidsForPortUnix(port) {
  try {
    const output = run(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`);
    const pids = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return [...new Set(pids)];
  } catch {
    return [];
  }
}

function getPidsForPort(port) {
  if (process.platform === 'win32') {
    return getPidsForPortWindows(port);
  }

  return getPidsForPortUnix(port);
}

function checkPorts(ports) {
  let hasBusyPort = false;

  for (const port of ports) {
    const pids = getPidsForPort(port);

    if (pids.length === 0) {
      console.log(`FREE ${port}`);
      continue;
    }

    hasBusyPort = true;
    console.log(`IN_USE ${port} -> ${pids.join(', ')}`);
  }

  process.exitCode = hasBusyPort ? 1 : 0;
}

function getPgidUnix(pid) {
  try {
    const output = run(`ps -o pgid= -p ${pid}`).trim();
    return output ? Number(output) : null;
  } catch {
    return null;
  }
}

function signalPidsUnix(pids, signal) {
  const ownPgid = getPgidUnix(process.pid);

  // Target process groups so watcher/wrapper parents (tsx watch, vite,
  // concurrently, npm) die with the listener and cannot respawn it.
  const targets = new Set();
  for (const pid of pids) {
    const pgid = getPgidUnix(pid);
    if (pgid && pgid !== ownPgid) {
      targets.add(-pgid);
    } else {
      targets.add(Number(pid));
    }
  }

  for (const target of targets) {
    try {
      process.kill(target, signal);
    } catch {
      // Already exited — that is the outcome we want.
    }
  }
}

async function waitForPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (getPidsForPort(port).length > 0) {
    if (Date.now() >= deadline) {
      return false;
    }
    await delay(POLL_INTERVAL_MS);
  }

  return true;
}

async function killPort(port) {
  const pids = getPidsForPort(port);

  if (pids.length === 0) {
    console.log(`FREE ${port}`);
    return true;
  }

  if (process.platform === 'win32') {
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' });
      } catch {
        // Process may have already exited; verified below.
      }
    }
  } else {
    signalPidsUnix(pids, 'SIGTERM');

    if (await waitForPortFree(port, TERM_WAIT_MS)) {
      console.log(`KILLED ${port} -> ${pids.join(', ')}`);
      return true;
    }

    signalPidsUnix(getPidsForPort(port), 'SIGKILL');
  }

  if (await waitForPortFree(port, KILL_WAIT_MS)) {
    console.log(`KILLED ${port} -> ${pids.join(', ')}`);
    return true;
  }

  const remaining = getPidsForPort(port);
  console.log(`STILL_IN_USE ${port} -> ${remaining.join(', ')}`);
  return false;
}

async function killPorts(ports) {
  let allFreed = true;

  for (const port of ports) {
    const freed = await killPort(port);
    allFreed = freed && allFreed;
  }

  process.exitCode = allFreed ? 0 : 1;
}

async function main() {
  const { action, ports } = parseArgs();

  if (action === 'check') {
    checkPorts(ports);
    return;
  }

  await killPorts(ports);
}

await main();
