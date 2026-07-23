#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

const USAGE = [
  'Usage:',
  '  npm run phase:start -- --slug <slug> [--ports 5173,3001] [--kill-ports]',
  '  npm run phase:prep -- --slug <slug> [--ports 5173,3001] [--kill-ports]',
  '  npm run phase:verify -- [--slug <slug>] [--target full|client|server] [--compact]',
  '  npm run phase:finish -- --slug <slug> [--phase <id>] [--target full|client|server] [--compact] [--write-docs] [--modified path1,path2,...]',
  '  npm run docs:sync-phase -- --slug <slug> [--dry-run]',
].join('\n');

function parseArgs() {
  const [, , command, ...rest] = process.argv;

  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    process.exit(0);
  }

  const values = new Map();
  const flags = new Set();

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith('--')) {
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      values.set(token, next);
      index += 1;
      continue;
    }

    flags.add(token);
  }

  return {
    command,
    values,
    flags,
  };
}

function runNpm(args) {
  const npmExecPath = process.env.npm_execpath;

  const result = npmExecPath
    ? spawnSync(process.execPath, [npmExecPath, ...args], {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        shell: false,
      })
    : spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
        cwd: ROOT_DIR,
        stdio: 'inherit',
        shell: false,
      });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runNodeScript(scriptName, args = []) {
  const scriptPath = path.join(ROOT_DIR, 'scripts', scriptName);
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

async function checkRequiredPaths(slug) {
  const paths = [
    `.project/features/${slug}.md`,
    `.github/instructions/feature-${slug}.instructions.md`,
    '.project/roadmap.md',
  ];

  const missing = [];

  for (const workspacePath of paths) {
    try {
      await fs.access(path.join(ROOT_DIR, workspacePath));
    } catch {
      missing.push(workspacePath);
    }
  }

  if (missing.length > 0) {
    console.error('Missing required files:');
    for (const item of missing) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }
}

function parsePorts(portText) {
  if (!portText) {
    return ['5173', '3001'];
  }

  return portText
    .split(',')
    .map((port) => port.trim())
    .filter((port) => port.length > 0);
}

async function prep(values, flags) {
  const slug = values.get('--slug');
  if (!slug) {
    console.error('Missing --slug for prep command.');
    console.error(USAGE);
    process.exit(1);
  }

  const ports = parsePorts(values.get('--ports'));

  await checkRequiredPaths(slug);

  console.log(`Preparing context for slug '${slug}'...`);
  runNodeScript('slug-context.mjs', ['--slug', slug]);

  if (flags.has('--kill-ports')) {
    console.log(`Killing requested ports: ${ports.join(', ')}`);
    runNodeScript('ports.mjs', ['kill', ...ports]);
  }

  console.log(`Checking ports: ${ports.join(', ')}`);
  runNodeScript('ports.mjs', ['check', ...ports]);

  console.log('Phase prep complete.');
}

async function start(values, flags) {
  await prep(values, flags);
  console.log('Phase start complete.');
}

function runVitestSlug(slug, compact) {
  const globs = [`**/features/${slug}/**`, `shared/src/**/${slug}*`];

  if (!compact) {
    runNpm(['run', 'test', '--', 'run', ...globs]);
    return;
  }

  const npmArgs = process.env.npm_execpath
    ? [process.execPath, process.env.npm_execpath]
    : [process.platform === 'win32' ? 'npm.cmd' : 'npm'];

  const vitestResult = spawnSync(
    npmArgs[0],
    [...npmArgs.slice(1), 'run', 'test', '--', 'run', '--reporter=json', ...globs],
    { cwd: ROOT_DIR, stdio: ['inherit', 'pipe', 'ignore'], shell: false },
  );

  const filterResult = spawnSync(
    process.execPath,
    [path.join(ROOT_DIR, 'scripts', 'filter-test-results.mjs')],
    {
      cwd: ROOT_DIR,
      input: vitestResult.stdout ?? Buffer.from(''),
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: false,
    },
  );

  if (filterResult.status !== 0) process.exit(filterResult.status ?? 1);
}

function verify(values, flags) {
  const target = values.get('--target') ?? 'full';
  const compact = flags.has('--compact');
  const lintScript = compact ? 'copilot:lint' : 'lint';
  const testScript = compact ? 'copilot:test' : 'test';
  const slug = values.get('--slug');
  if (slug) {
    runNpm(['run', lintScript, '-w', 'client']);
    runNpm(['run', lintScript, '-w', 'server']);
    runVitestSlug(slug, compact);
    return;
  }

  if (target === 'full') {
    runNpm(['run', lintScript, '-w', 'client']);
    runNpm(['run', lintScript, '-w', 'server']);
    runNpm(['run', testScript]);
    return;
  }

  if (target === 'client') {
    runNpm(['run', lintScript, '-w', 'client']);
    runNpm(['run', testScript, '-w', 'client']);
    return;
  }

  if (target === 'server') {
    runNpm(['run', lintScript, '-w', 'server']);
    runNpm(['run', testScript, '-w', 'server']);
    return;
  }

  console.error(`Invalid --target value: ${target}`);
  console.error('Allowed values: full, client, server');
  process.exit(1);
}

function docsSync(values, flags) {
  const slug = values.get('--slug');
  if (!slug) {
    console.error('Missing --slug for docs-sync command.');
    console.error(USAGE);
    process.exit(1);
  }

  const archiveArgs = ['--slug', slug];
  if (flags.has('--dry-run')) {
    archiveArgs.push('--dry-run');
  }

  runNodeScript('archive-feature-docs.mjs', archiveArgs);

  runNodeScript('docs-check.mjs', ['--slug', slug]);

  console.log('Docs sync checks complete.');
}

function finish(values, flags) {
  const slug = values.get('--slug');
  const phaseId = values.get('--phase');
  const modifiedPaths = values.get('--modified');
  const writeDocs = values.has('--write-docs');

  if (!slug) {
    console.error('Missing --slug for finish command.');
    console.error(USAGE);
    process.exit(1);
  }

  // Strip --slug so verify() always runs the full target gate, not the fast slug path
  const verifyValues = new Map(values);
  verifyValues.delete('--slug');
  verify(verifyValues, flags);

  const docsValues = new Map();
  docsValues.set('--slug', slug);

  const docsFlags = new Set();
  if (!writeDocs) {
    docsFlags.add('--dry-run');
  }

  docsSync(docsValues, docsFlags);

  const syncTreeArgs = [];
  if (!writeDocs) {
    syncTreeArgs.push('--dry-run');
  }

  if (phaseId) {
    syncTreeArgs.push('--phase', phaseId);
  }

  if (modifiedPaths) {
    syncTreeArgs.push('--modified', modifiedPaths);
  }

  runNodeScript('sync-tree.mjs', syncTreeArgs);

  const architectArgs = writeDocs ? [] : ['--dry-run'];
  runNodeScript('sync-architect.mjs', architectArgs);

  if (!writeDocs) {
    console.log('Docs sync was run in dry-run mode. Add --write-docs to apply archive changes.');
  }

  if (!phaseId) {
    console.log(
      'Tip: pass --phase <id> to auto-mark new and modified entries in .project/project-tree.md.',
    );
  }

  console.log('Phase finish complete.');
}

async function main() {
  const { command, values, flags } = parseArgs();

  if (flags.has('--write-docs')) {
    values.set('--write-docs', 'true');
  }

  if (command === 'start') {
    await start(values, flags);
    return;
  }

  if (command === 'prep') {
    await prep(values, flags);
    return;
  }

  if (command === 'verify') {
    verify(values, flags);
    return;
  }

  if (command === 'docs-sync') {
    docsSync(values, flags);
    return;
  }

  if (command === 'finish') {
    finish(values, flags);
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error(USAGE);
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
