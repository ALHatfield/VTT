#!/usr/bin/env node

import { execSync } from 'node:child_process';

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
    shell: true,
  });
}

function getPidsForPortWindows(port) {
  try {
    const output = run(`netstat -ano -p tcp`);

    const pids = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => /LISTENING/i.test(line))
      .filter((line) => {
        const localAddr = line.split(/\s+/)[1] ?? '';
        return localAddr.endsWith(`:${port}`);
      })
      .map((line) => line.split(/\s+/).pop())
      .filter((pid) => Boolean(pid));

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

function killPorts(ports) {
  for (const port of ports) {
    const pids = getPidsForPort(port);

    if (pids.length === 0) {
      console.log(`FREE ${port}`);
      continue;
    }

    for (const pid of pids) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        } else {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        }
        console.log(`KILLED ${port} -> ${pid}`);
      } catch {
        console.log(`FAILED ${port} -> ${pid}`);
        process.exitCode = 1;
      }
    }
  }
}

function main() {
  const { action, ports } = parseArgs();

  if (action === 'check') {
    checkPorts(ports);
    return;
  }

  killPorts(ports);
}

main();
