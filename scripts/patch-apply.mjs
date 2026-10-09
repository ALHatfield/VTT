#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const USAGE = [
  'Usage:',
  '  node scripts/package-apply.mjs <package.zip | changes.patch> [options]',
  '',
  'Applies a handoff package (created by patch:package) to the working tree.',
  'Accepts either the zip produced by patch:package or a raw .patch file.',
  'Full snapshots (patch:snapshot) are always applied in --force mode.',
  '',
  'Options:',
  '  --check        Validate the patch without applying it',
  '  --3way         Fall back to a 3-way merge on conflicts',
  '  --keep-patch   Keep the extracted .patch file next to the zip',
  '  --force        Reset the working tree to HEAD, then apply the patch so the',
  '                 project exactly matches the packaged state. Local uncommitted',
  '                 changes (incl. untracked files) are saved to a git stash first.',
  '  -h, --help     Show this help',
  '',
  'Examples:',
  '  npm run patch:apply -- handoff/vtt-changes-2026-09-28.zip',
  '  npm run patch:apply -- vtt-changes.patch --check',
  '  npm run patch:apply -- handoff/fix.zip --3way',
  '  npm run patch:force -- handoff/vtt-changes-2026-09-28.zip',
  '  npm run patch:force -- handoff/vtt-snapshot-2026-09-28.zip',
].join('\n');

function parseArgs() {
  const args = process.argv.slice(2);
  let input = null;
  let check = false;
  let threeWay = false;
  let keepPatch = false;
  let force = false;

  for (const arg of args) {
    if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === '--check') {
      check = true;
    } else if (arg === '--3way') {
      threeWay = true;
    } else if (arg === '--keep-patch') {
      keepPatch = true;
    } else if (arg === '--force') {
      force = true;
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}\n\n${USAGE}`);
      process.exit(1);
    } else if (input) {
      console.error('Only one input file may be given.');
      process.exit(1);
    } else {
      input = arg;
    }
  }

  if (!input) {
    console.error(`Missing input file.\n\n${USAGE}`);
    process.exit(1);
  }

  return { input, check, threeWay, keepPatch, force };
}

function git(gitArgs, options = {}) {
  return execFileSync('git', gitArgs, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
    ...options,
  });
}

const LOCAL_HEADER_SIG = 0x04034b50;

// Extracts every entry from a zip by walking local file headers.
// Handles stored (0) and deflate (8) methods — matches what patch:package emits.
function extractZipEntries(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === LOCAL_HEADER_SIG) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);

    const nameStart = offset + 30;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString('utf8');
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    let data;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      data = inflateRawSync(compressed);
    } else {
      console.error(`Unsupported zip compression method (${method}) for entry "${name}".`);
      process.exit(1);
    }

    entries.push({ name, data });
    offset = dataStart + compressedSize;
  }

  if (entries.length === 0) {
    console.error('No entries found in zip — is this a valid patch package?');
    process.exit(1);
  }

  return entries;
}

function resolvePatch(input) {
  const buffer = readFileSync(input);

  if (input.toLowerCase().endsWith('.zip')) {
    const entries = extractZipEntries(buffer);
    const bundleEntry = entries.find((entry) => entry.name.endsWith('.bundle'));
    if (bundleEntry) {
      return { patch: bundleEntry.data, entryName: bundleEntry.name, fromZip: true, isSnapshot: true };
    }
    const patchEntry = entries.find((entry) => entry.name.endsWith('.patch')) ?? entries[0];
    return { patch: patchEntry.data, entryName: patchEntry.name, fromZip: true, isSnapshot: false };
  }

  const isSnapshot = input.toLowerCase().endsWith('.bundle');
  return { patch: buffer, entryName: path.basename(input), fromZip: false, isSnapshot };
}

// Checks the patch against a pristine HEAD using a throwaway index, so local edits don't matter.
function appliesCleanlyToHead(patch) {
  const tempIndex = path.join(os.tmpdir(), `vtt-force-apply-${process.pid}.index`);
  const env = { ...process.env, GIT_INDEX_FILE: tempIndex };
  try {
    git(['read-tree', 'HEAD'], { env, stdio: 'pipe' });
    git(['apply', '--cached', '--check', '--whitespace=nowarn', '-'], {
      env,
      input: patch,
      stdio: ['pipe', 'pipe', 'inherit'],
    });
    return true;
  } catch {
    return false;
  } finally {
    if (existsSync(tempIndex)) unlinkSync(tempIndex);
  }
}

// Stashes local changes (incl. untracked) as a backup, then hard-resets to HEAD. Returns the stash ref.
function resetToHead() {
  const dirty = git(['status', '--porcelain']).trim().length > 0;
  let backupRef = null;

  if (dirty) {
    const message = `patch:force backup ${new Date().toISOString()}`;
    git(['stash', 'push', '--include-untracked', '-m', message], { stdio: 'pipe' });
    backupRef = git(['rev-parse', '--short', 'stash@{0}']).trim();
    console.log(`Backed up local changes to stash (${backupRef}): "${message}"`);
  }

  // Stash leaves tracked files at HEAD; this guarantees it even when nothing was stashed.
  git(['reset', '--hard', 'HEAD'], { stdio: 'pipe' });

  return backupRef;
}

// Loads the snapshot bundle's objects into the repo and returns its commit, tree, and sender base.
function unbundleSnapshot(bundle) {
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'vtt-snapshot-'));
  const bundlePath = path.join(tmpDir, 'snapshot.bundle');
  writeFileSync(bundlePath, bundle);

  try {
    git(['bundle', 'verify', bundlePath], { stdio: 'pipe' });
    const [firstRef] = git(['bundle', 'unbundle', bundlePath]).trim().split('\n');
    const commit = firstRef.split(' ')[0];
    const tree = git(['rev-parse', `${commit}^{tree}`]).trim();
    const base = git(['log', '-1', '--format=%b', commit]).match(/base: (\w+)/)?.[1] ?? null;
    return { commit, tree, base };
  } catch (error) {
    console.error('Invalid snapshot bundle.');
    console.error(error.stderr?.toString() ?? error.message);
    process.exit(1);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

function printFollowUps(files) {
  const steps = [];
  if (files.some((file) => /(^|\/)package(-lock)?\.json$/.test(file))) {
    steps.push('npm install          # dependencies changed');
  }
  if (files.some((file) => file.startsWith('server/prisma/schema.prisma') || file.startsWith('server/prisma/migrations/'))) {
    steps.push('npm run db:migrate   # Prisma schema/migrations changed (also regenerates the client)');
  }
  if (files.some((file) => file.startsWith('server/prisma/seed.ts'))) {
    steps.push('npm run db:seed      # seed data changed (warning: resets seed-scene tokens/walls/lights)');
  }
  if (steps.length === 0) return;

  console.log('');
  console.log('Next steps (then restart the dev server):');
  for (const step of steps) console.log(`  ${step}`);
}

function forceApplySnapshot(bundle, { check }) {
  const { tree, base } = unbundleSnapshot(bundle);
  const head = git(['rev-parse', 'HEAD']).trim();
  const fileCount = git(['ls-tree', '-r', '--name-only', tree]).split('\n').filter(Boolean).length;
  const differingFiles = git(['diff', '--name-only', 'HEAD', tree]).split('\n').filter(Boolean);

  console.log(`Snapshot: ${fileCount} file(s), taken on ${base?.slice(0, 7) ?? 'unknown commit'}.`);
  console.log(`Your HEAD: ${head.slice(0, 7)} — ${differingFiles.length} file(s) differ from the snapshot.`);

  if (check) {
    console.log('Snapshot is valid — safe to force apply.');
    return;
  }

  const backupRef = resetToHead();

  // --reset -u rewrites index + working tree to the snapshot, deleting tracked files it lacks.
  git(['read-tree', '-u', '--reset', tree], { stdio: 'pipe' });
  // Restore the index to HEAD so the snapshot shows up as unstaged/untracked changes.
  git(['reset', '-q'], { stdio: 'pipe' });

  console.log('Working tree now matches the snapshot exactly.');
  if (base && base !== head) {
    console.log(`Note: sender was on ${base.slice(0, 7)}; git status shows differences vs your HEAD.`);
  }
  if (backupRef) {
    console.log('To restore your previous changes later: git stash list / git stash apply');
  }
  printFollowUps(differingFiles);
}

function forceApply(patch, { check, threeWay }) {
  const cleanOnHead = appliesCleanlyToHead(patch);

  if (check) {
    console.log(
      cleanOnHead
        ? 'Patch applies cleanly on top of HEAD — safe to force apply.'
        : 'Patch does NOT apply cleanly on top of HEAD.',
    );
    process.exit(cleanOnHead ? 0 : 1);
  }

  if (!cleanOnHead && !threeWay) {
    console.error('Patch does not apply cleanly on top of HEAD — nothing was changed.');
    console.error('The sender was likely on a different commit. Retry with --3way to attempt a merge.');
    process.exit(1);
  }

  const backupRef = resetToHead();
  const applyArgs = ['apply', '--whitespace=nowarn'];
  if (threeWay) applyArgs.push('--3way');
  applyArgs.push('-');

  try {
    git(applyArgs, { input: patch, stdio: ['pipe', 'inherit', 'inherit'] });
  } catch {
    const failedPath = path.join(os.tmpdir(), `vtt-force-apply-${Date.now()}.patch`);
    writeFileSync(failedPath, patch);
    console.error('');
    console.error('Failed to apply patch. Working tree is at HEAD (plus any partial 3-way results).');
    console.error(`Patch left at: ${failedPath}`);
    if (backupRef) console.error('Restore your previous changes with: git reset --hard && git stash pop');
    process.exit(1);
  }

  if (backupRef) {
    console.log('To restore your previous changes later: git stash list / git stash apply');
  }
}

function main() {
  const { input, check, threeWay, keepPatch, force } = parseArgs();

  if (!existsSync(input)) {
    console.error(`File not found: ${input}`);
    process.exit(1);
  }

  try {
    git(['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
  } catch {
    console.error('Not inside a git repository.');
    process.exit(1);
  }

  const { patch, entryName, fromZip, isSnapshot } = resolvePatch(input);

  if (isSnapshot) {
    if (!force) {
      console.error('This is a full project snapshot — it replaces your working tree.');
      console.error(`Apply it with: npm run patch:force -- ${input}`);
      process.exit(1);
    }
    forceApplySnapshot(patch, { check });
    return;
  }

  if (patch.length === 0 || patch.toString('utf8').trim().length === 0) {
    console.error('Patch is empty — nothing to apply.');
    process.exit(1);
  }

  const changedFiles = new Set(
    [...patch.toString('utf8').matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]),
  );

  if (force) {
    forceApply(patch, { check, threeWay });
    console.log(`Force applied ${changedFiles.size} file(s) on top of HEAD.`);
    printFollowUps([...changedFiles]);
    return;
  }

  // Write the patch to disk so git apply failures leave it around for inspection.
  const patchPath = fromZip ? path.join(path.dirname(input), entryName) : input;
  if (fromZip) {
    writeFileSync(patchPath, patch);
  }

  const applyArgs = ['apply', '--whitespace=nowarn'];
  if (check) applyArgs.push('--check');
  if (threeWay) applyArgs.push('--3way');
  applyArgs.push(patchPath);

  try {
    git(applyArgs, { stdio: 'inherit' });
  } catch {
    console.error('');
    console.error(check ? 'Patch does NOT apply cleanly.' : 'Failed to apply patch.');
    if (!threeWay && !check) {
      console.error('Tip: retry with --3way to attempt a merge, or --check to diagnose.');
    }
    console.error(`Patch left at: ${patchPath}`);
    process.exit(1);
  }

  if (fromZip && !keepPatch && !check) {
    unlinkSync(patchPath);
  }

  if (check) {
    console.log(`Patch applies cleanly (${changedFiles.size} file(s)).`);
  } else {
    console.log(`Applied ${changedFiles.size} file(s):`);
    for (const file of changedFiles) {
      console.log(`  ${file}`);
    }
    printFollowUps([...changedFiles]);
  }
}

main();
