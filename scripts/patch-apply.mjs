#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inflateRawSync } from 'node:zlib';

const USAGE = [
  'Usage:',
  '  node scripts/package-apply.mjs <package.zip | changes.patch> [options]',
  '',
  'Applies a handoff package (created by patch:package) to the working tree.',
  'Accepts either the zip produced by patch:package or a raw .patch file.',
  '',
  'Options:',
  '  --check        Validate the patch without applying it',
  '  --3way         Fall back to a 3-way merge on conflicts',
  '  --keep-patch   Keep the extracted .patch file next to the zip',
  '  -h, --help     Show this help',
  '',
  'Examples:',
  '  npm run patch:apply -- handoff/vtt-changes-2026-09-28.zip',
  '  npm run patch:apply -- vtt-changes.patch --check',
  '  npm run patch:apply -- handoff/fix.zip --3way',
].join('\n');

function parseArgs() {
  const args = process.argv.slice(2);
  let input = null;
  let check = false;
  let threeWay = false;
  let keepPatch = false;

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

  return { input, check, threeWay, keepPatch };
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
    const patchEntry = entries.find((entry) => entry.name.endsWith('.patch')) ?? entries[0];
    return { patch: patchEntry.data, entryName: patchEntry.name, fromZip: true };
  }

  return { patch: buffer, entryName: path.basename(input), fromZip: false };
}

function main() {
  const { input, check, threeWay, keepPatch } = parseArgs();

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

  const { patch, entryName, fromZip } = resolvePatch(input);

  if (patch.length === 0 || patch.toString('utf8').trim().length === 0) {
    console.error('Patch is empty — nothing to apply.');
    process.exit(1);
  }

  const changedFiles = new Set(
    [...patch.toString('utf8').matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]),
  );

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
  }
}

main();
