#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

const USAGE = [
  'Usage:',
  '  npm run slug:context -- --slug <slug>',
  '',
  'Example:',
  '  npm run slug:context -- --slug campaigns',
].join('\n');

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value.trim();
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listNoteFiles(slug) {
  const notesDir = path.join(ROOT_DIR, '.project', 'notes');

  try {
    const entries = await fs.readdir(notesDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(`${slug}-`) && name.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `.project/notes/${name}`);
  } catch {
    return [];
  }
}

async function listHandoffFiles(slug) {
  const handoffsDir = path.join(ROOT_DIR, '.project', 'handoffs');

  try {
    const entries = await fs.readdir(handoffsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(`${slug}-`) && name.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `.project/handoffs/${name}`);
  } catch {
    return [];
  }
}

async function checkPath(workspacePath) {
  const absolutePath = path.join(ROOT_DIR, workspacePath);
  const exists = await pathExists(absolutePath);

  return {
    workspacePath,
    exists,
  };
}

function printSection(title, items) {
  console.log(`\n${title}`);

  if (items.length === 0) {
    console.log('  - (none)');
    return;
  }

  for (const item of items) {
    if (typeof item === 'string') {
      console.log(`  - ${item}`);
      continue;
    }

    const status = item.exists ? 'FOUND' : 'MISSING';
    console.log(`  - [${status}] ${item.workspacePath}`);
  }
}

async function walkFeatureInstructionMatches(slug) {
  const instructionsDir = path.join(ROOT_DIR, '.github', 'instructions');

  try {
    const entries = await fs.readdir(instructionsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => name.includes(slug) && name.endsWith('.instructions.md'))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `.github/instructions/${name}`);
  } catch {
    return [];
  }
}

async function main() {
  const slug = getArgValue('--slug');

  if (!slug) {
    console.error(USAGE);
    process.exit(1);
  }

  const planningChecks = await Promise.all([
    checkPath(`.project/features/${slug}.md`),
    checkPath('.project/roadmap.md'),
  ]);

  const notes = await listNoteFiles(slug);
  const handoffs = await listHandoffFiles(slug);

  const rulesChecks = await Promise.all([
    checkPath(`.github/instructions/feature-${slug}.instructions.md`),
    checkPath('.github/instructions/coding-standards.instructions.md'),
  ]);

  const relatedInstructions = await walkFeatureInstructionMatches(slug);

  const sharedChecks = await Promise.all([
    checkPath(`shared/src/types/${slug}.ts`),
    checkPath(`shared/src/validators/${slug}.ts`),
    checkPath(`shared/src/constants/${slug}.ts`),
  ]);

  const serverChecks = await Promise.all([
    checkPath(`server/src/features/${slug}`),
    checkPath('server/prisma/schema.prisma'),
  ]);

  const clientChecks = await Promise.all([checkPath(`client/src/features/${slug}`)]);

  const existingCount = [
    ...planningChecks,
    ...rulesChecks,
    ...sharedChecks,
    ...serverChecks,
    ...clientChecks,
  ].filter((item) => item.exists).length;

  const totalCount =
    planningChecks.length +
    rulesChecks.length +
    sharedChecks.length +
    serverChecks.length +
    clientChecks.length;

  console.log(`Slug context for: ${slug}`);
  console.log(`Coverage: ${existingCount}/${totalCount} required paths found`);

  printSection('Planning Sources', planningChecks);
  printSection('Notes (slug-matched)', notes);
  printSection('Handoffs (slug-matched)', handoffs);
  printSection('Rules Sources', rulesChecks);
  printSection('Related Instruction Files', relatedInstructions);
  printSection('Shared Artifacts', sharedChecks);
  printSection('Server Artifacts', serverChecks);
  printSection('Client Artifacts', clientChecks);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exit(1);
});
