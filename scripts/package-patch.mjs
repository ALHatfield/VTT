#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

const USAGE = [
  'Usage:',
  '  node scripts/package-patch.mjs [-o <output.zip>] [-- <pathspec> ...]',
  '',
  'Creates a git patch of all uncommitted changes (staged, unstaged, and',
  'untracked files) and compresses it into a zip for handoff.',
  '',
  'Options:',
  '  -o, --output   Output zip path (default: handoff/vtt-changes-<timestamp>.zip)',
  '  -h, --help     Show this help',
  '',
  'Examples:',
  '  npm run patch:package',
  '  npm run patch:package -- -o my-feature.zip',
  '  npm run patch:package -- -- client/src/features/editor',
].join('\n');

const PATCH_NAME = 'vtt-changes.patch';

function parseArgs() {
  const args = process.argv.slice(2);
  let output = null;
  const pathspecs = [];

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      console.log(USAGE);
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      output = args[i + 1];
      if (!output) {
        console.error('Missing value for --output.');
        process.exit(1);
      }
      i += 1;
    } else if (arg === '--') {
      pathspecs.push(...args.slice(i + 1));
      break;
    } else {
      pathspecs.push(arg);
    }
  }

  return { output, pathspecs };
}

function git(gitArgs, options = {}) {
  return execFileSync('git', gitArgs, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 256,
    ...options,
  });
}

function buildPatch(pathspecs) {
  const scope = pathspecs.length > 0 ? ['--', ...pathspecs] : [];

  // Tracked changes (staged + unstaged) relative to HEAD.
  const trackedDiff = git(['diff', 'HEAD', '--binary', ...scope]);

  // Untracked files diffed against /dev/null so they apply as new files.
  const untracked = git(['ls-files', '--others', '--exclude-standard', ...scope])
    .split('\n')
    .filter(Boolean);

  let untrackedDiff = '';
  for (const file of untracked) {
    try {
      // git diff --no-index exits 1 when files differ — that's expected.
      untrackedDiff += git(['diff', '--no-index', '--binary', '/dev/null', file]);
    } catch (error) {
      if (error.status === 1 && typeof error.stdout === 'string') {
        untrackedDiff += error.stdout;
      } else {
        throw error;
      }
    }
  }

  return { patch: trackedDiff + untrackedDiff, untrackedCount: untracked.length };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Builds a single-entry zip (deflate) in memory — no external `zip` binary needed.
function createZip(entryName, data) {
  const name = Buffer.from(entryName, 'utf8');
  const compressed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const now = new Date();
  const dosTime =
    (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const dosDate =
    ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(8, 8); // method: deflate
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(data.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28); // extra field length

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(8, 10); // method: deflate
  centralHeader.writeUInt16LE(dosTime, 12);
  centralHeader.writeUInt16LE(dosDate, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(data.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  // extra/comment lengths, disk number, internal/external attrs all zero
  centralHeader.writeUInt32LE(0, 42); // local header offset

  const centralOffset = localHeader.length + name.length + compressed.length;
  const centralSize = centralHeader.length + name.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(1, 8); // entries on this disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([localHeader, name, compressed, centralHeader, name, eocd]);
}

function main() {
  const { output, pathspecs } = parseArgs();

  try {
    git(['rev-parse', '--is-inside-work-tree'], { stdio: 'pipe' });
  } catch {
    console.error('Not inside a git repository.');
    process.exit(1);
  }

  const { patch, untrackedCount } = buildPatch(pathspecs);

  if (patch.trim().length === 0) {
    console.log('No uncommitted changes found — nothing to package.');
    process.exit(0);
  }

  const timestamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
  const zipPath = output ?? path.join('handoff', `vtt-changes-${timestamp}.zip`);
  const zipDir = path.dirname(zipPath);
  if (zipDir !== '.' && !existsSync(zipDir)) {
    mkdirSync(zipDir, { recursive: true });
  }

  const zipBuffer = createZip(PATCH_NAME, Buffer.from(patch, 'utf8'));
  writeFileSync(zipPath, zipBuffer);

  const sizeKb = (zipBuffer.length / 1024).toFixed(1);
  const changedFiles = new Set(
    [...patch.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]),
  ).size;

  console.log(`Packaged ${changedFiles} changed file(s) (${untrackedCount} untracked).`);
  console.log(`  ${zipPath} (${sizeKb} KB)`);
  console.log('');
  console.log('To apply on the other end:');
  console.log(`  unzip ${path.basename(zipPath)} && git apply ${PATCH_NAME}`);
}

main();
