#!/usr/bin/env node

/**
 * Scaffold a phase completion record from a template.
 *
 * Usage:
 *   npm run docs:completion -- --slug auth --phase 1A
 *   npm run docs:completion -- --slug auth --phase 1A --force
 *
 * Creates: .project/.archive/complete/{slug}-{phase}.md
 * Will not overwrite an existing file unless --force is passed.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const COMPLETE_DIR = path.join(ROOT_DIR, '.project', '.archive', 'complete');

const USAGE = [
  'Usage:',
  '  npm run docs:completion -- --slug <slug> --phase <id>',
  '  npm run docs:completion -- --slug <slug> --phase <id> --force',
  '',
  'Example:',
  '  npm run docs:completion -- --slug auth --phase 1A',
].join('\n');

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    return null;
  }

  return value.trim();
}

/**
 * Try to extract the phase name from the feature doc.
 */
async function findPhaseName(slug, phaseId) {
  const featureDocPath = path.join(ROOT_DIR, '.project', 'features', `${slug}.md`);

  try {
    const content = await fs.readFile(featureDocPath, 'utf8');

    // Match "## Phase 1A: MVP Authentication"
    const regex = new RegExp(
      `^##\\s+Phase\\s+${phaseId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*(.+)$`,
      'm'
    );
    const match = content.match(regex);
    return match?.[1]?.trim() ?? '{Phase Name}';
  } catch {
    return '{Phase Name}';
  }
}

/**
 * Try to extract the feature display name from the feature doc title.
 */
async function findFeatureName(slug) {
  const featureDocPath = path.join(ROOT_DIR, '.project', 'features', `${slug}.md`);

  try {
    const content = await fs.readFile(featureDocPath, 'utf8');

    // Match "# Auth" or "# Play Area"
    const match = content.match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() ?? slug;
  } catch {
    return slug;
  }
}

function buildTemplate({ featureName, slug, phaseId, phaseName, date }) {
  return [
    `# ${featureName} — Phase ${phaseId}: ${phaseName}`,
    '',
    `**Completed:** ${date}`,
    `**Feature:** \`${slug}\``,
    '',
    '## Deliverables',
    '',
    '{List of files created or modified, grouped by package}',
    '',
    '## Test Results',
    '',
    '{Actual test output — include command run, number of tests passed/failed, and any relevant curl examples or performance metrics. Do not leave this section as a placeholder.}',
    '',
    '## Decisions & Insights',
    '',
    '{Any architectural decisions made during implementation that weren\'t in the original plan.',
    'Gotchas encountered and how they were resolved.',
    'Patterns established that future phases should follow.}',
    '',
    '## Dependencies Unlocked',
    '',
    '{List which phases are now unblocked per the dependency graph in roadmap.md}',
    '',
  ].join('\n');
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(USAGE);
    process.exit(0);
  }

  const slug = getArgValue('--slug');
  const phaseId = getArgValue('--phase');
  const force = process.argv.includes('--force');

  if (!slug || !phaseId) {
    console.error('Both --slug and --phase are required.');
    console.error(USAGE);
    process.exit(1);
  }

  const fileName = `${slug}-${phaseId}.md`;
  const filePath = path.join(COMPLETE_DIR, fileName);
  const relativePath = `.project/.archive/complete/${fileName}`;

  // Check for existing file
  try {
    await fs.access(filePath);
    if (!force) {
      console.error(`File already exists: ${relativePath}`);
      console.error('Use --force to overwrite.');
      process.exit(1);
    }
    console.log(`Overwriting existing file: ${relativePath}`);
  } catch {
    // File doesn't exist — good
  }

  const [featureName, phaseName] = await Promise.all([
    findFeatureName(slug),
    findPhaseName(slug, phaseId),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const formattedDate = new Date(today).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const content = buildTemplate({
    featureName,
    slug,
    phaseId,
    phaseName,
    date: formattedDate,
  });

  await fs.mkdir(COMPLETE_DIR, { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
  console.log(`Created: ${relativePath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
