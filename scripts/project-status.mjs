#!/usr/bin/env node

/**
 * Project status dashboard — parses roadmap.md status table and all
 * feature docs to produce a pre-formatted status summary.
 *
 * Outputs: completed phases, in-progress phases with task counts,
 * not-started phases, and roadmap ↔ feature doc drift warnings.
 *
 * Usage:
 *   npm run project:status
 *   npm run project:status -- --slug play-area
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

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

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Parse the Feature Status table from roadmap.md.
 * Returns array of { slug, feature, phases, status, currentPhase }.
 */
function parseRoadmapStatusTable(content) {
  const rows = [];
  const lines = content.split(/\r?\n/);

  let inTable = false;
  let headerPassed = false;

  for (const line of lines) {
    if (/^##\s+Feature Status/i.test(line)) {
      inTable = true;
      continue;
    }

    if (inTable && /^##\s+/.test(line)) {
      break;
    }

    if (!inTable || !line.includes('|')) {
      continue;
    }

    // Skip separator row
    if (/^\|[\s-|]+\|$/.test(line.trim())) {
      headerPassed = true;
      continue;
    }

    // Skip header row
    if (!headerPassed) {
      headerPassed = line.toLowerCase().includes('slug');
      continue;
    }

    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length < 5) {
      continue;
    }

    const slug = cells[0].replace(/`/g, '').trim();
    rows.push({
      slug,
      feature: cells[1].trim(),
      phases: cells[2].trim(),
      status: cells[3].trim(),
      currentPhase: cells[4].trim(),
    });
  }

  return rows;
}

/**
 * Parse the Current Status table from a feature doc.
 * Returns array of { phaseId, name, status }.
 */
function parseFeatureStatusTable(content) {
  const rows = [];
  const lines = content.split(/\r?\n/);

  let inTable = false;
  let headerPassed = false;

  for (const line of lines) {
    if (/^##\s+Current Status/i.test(line)) {
      inTable = true;
      continue;
    }

    if (inTable && /^##\s+/.test(line) && !/Current Status/i.test(line)) {
      break;
    }

    if (!inTable || !line.includes('|')) {
      continue;
    }

    if (/^\|[\s-|]+\|$/.test(line.trim())) {
      headerPassed = true;
      continue;
    }

    if (!headerPassed) {
      headerPassed = line.toLowerCase().includes('phase');
      continue;
    }

    const cells = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length < 3) {
      continue;
    }

    rows.push({
      phaseId: cells[0].trim(),
      name: cells[1].trim(),
      status: cells[2].trim(),
    });
  }

  return rows;
}

/**
 * Count task checkboxes in a feature doc for a specific phase.
 * Returns { checked, total }.
 */
function countPhaseTasks(content, phaseId) {
  const lines = content.split(/\r?\n/);
  let inPhase = false;
  let checked = 0;
  let total = 0;

  const phasePattern = new RegExp(
    `^##\\s+Phase\\s+${phaseId.replace(/\./g, '\\.')}[:\\s]`,
    'i'
  );

  for (const line of lines) {
    if (phasePattern.test(line)) {
      inPhase = true;
      continue;
    }

    if (inPhase && /^##\s+/.test(line) && !phasePattern.test(line)) {
      break;
    }

    if (!inPhase) {
      continue;
    }

    if (/^\s*-\s+\[x\]/i.test(line)) {
      checked += 1;
      total += 1;
    } else if (/^\s*-\s+\[\s\]/.test(line)) {
      total += 1;
    }
  }

  return { checked, total };
}

/**
 * Parse the Mermaid dependency graph to find completed phase IDs.
 * Used to cross-reference with archive records.
 */
function parseMermaidNodes(content) {
  const nodes = new Set();
  const mermaidMatch = content.match(/```mermaid\s*\n([\s\S]*?)```/);
  if (!mermaidMatch) {
    return nodes;
  }

  const graphContent = mermaidMatch[1];
  const nodePattern = /\[([^\]]+)\]/g;
  let match;

  while ((match = nodePattern.exec(graphContent)) !== null) {
    nodes.add(match[1].trim());
  }

  return nodes;
}

async function listCompletedPhases() {
  const archiveDir = path.join(ROOT_DIR, '.project', '.archive', 'complete');

  try {
    const entries = await fs.readdir(archiveDir, { withFileTypes: true });
    return entries
      .filter(
        (e) =>
          e.isFile() &&
          e.name.endsWith('.md') &&
          e.name !== 'README.md' &&
          e.name !== 'phase-0.md'
      )
      .map((e) => e.name.replace('.md', ''))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

async function main() {
  const filterSlug = getArgValue('--slug');

  const roadmapPath = path.join(ROOT_DIR, '.project', 'roadmap.md');
  const roadmapContent = await readFileIfExists(roadmapPath);

  if (!roadmapContent) {
    console.error('ERROR: .project/roadmap.md not found');
    process.exit(1);
  }

  const roadmapRows = parseRoadmapStatusTable(roadmapContent);
  const completedArchives = await listCompletedPhases();
  const drift = [];

  const completed = [];
  const inProgress = [];
  const notStarted = [];

  const slugsToProcess = filterSlug
    ? roadmapRows.filter((r) => r.slug === filterSlug)
    : roadmapRows;

  if (filterSlug && slugsToProcess.length === 0) {
    console.error(`ERROR: Slug '${filterSlug}' not found in roadmap.`);
    process.exit(1);
  }

  for (const row of slugsToProcess) {
    const featureDocPath = path.join(
      ROOT_DIR,
      '.project',
      'features',
      `${row.slug}.md`
    );
    const featureContent = await readFileIfExists(featureDocPath);

    if (!featureContent) {
      drift.push(`Missing feature doc: .project/features/${row.slug}.md`);
      continue;
    }

    const featurePhases = parseFeatureStatusTable(featureContent);

    // If no status table, feature is likely fully complete (archived)
    if (featurePhases.length === 0) {
      if (row.status === 'Complete') {
        completed.push(`${row.slug} (all phases) — ${row.feature}`);
      } else {
        drift.push(
          `${row.slug}: roadmap says "${row.status}" but feature doc has no status table (likely complete)`
        );
      }
      continue;
    }

    // Check each phase in the feature doc
    for (const phase of featurePhases) {
      const fullId = `${phase.phaseId}`;
      const tasks = countPhaseTasks(featureContent, phase.phaseId);
      const taskStr =
        tasks.total > 0 ? ` (tasks: ${tasks.checked}/${tasks.total})` : '';

      if (phase.status === 'Complete') {
        completed.push(`${row.slug} ${fullId}: ${phase.name}`);
      } else if (phase.status === 'In Progress') {
        inProgress.push(
          `${row.slug} ${fullId}: ${phase.name}${taskStr}`
        );
      } else {
        notStarted.push(
          `${row.slug} ${fullId}: ${phase.name}${taskStr}`
        );
      }
    }

    // Cross-check: roadmap says Complete but feature doc has Not Started phases
    const allComplete = featurePhases.every(
      (p) => p.status === 'Complete'
    );
    if (row.status === 'Complete' && !allComplete) {
      drift.push(
        `${row.slug}: roadmap says "Complete" but feature doc has non-complete phases`
      );
    }

    // Cross-check: roadmap says Not Started but feature doc has Complete phases
    const hasComplete = featurePhases.some(
      (p) => p.status === 'Complete'
    );
    if (row.status === 'Not Started' && hasComplete) {
      drift.push(
        `${row.slug}: roadmap says "Not Started" but feature doc has complete phases`
      );
    }
  }

  // Add Phase 0 to completed list
  if (!filterSlug) {
    completed.unshift('Phase 0: Foundation & Project Setup');

    // Add archived phases that aren't already represented
    // Build a set of slugs already covered by feature doc parsing
    const coveredSlugs = new Set(slugsToProcess.map((r) => r.slug));

    for (const archive of completedArchives) {
      // archive format: "slug-phaseId" e.g. "play-area-4A", "auth-1A"
      // Extract slug: everything before the last dash+phaseId
      const phaseMatch = archive.match(/^(.+)-(\d+[A-Z](?:\.\d+)?)$/);
      if (!phaseMatch) {
        continue;
      }

      const archiveSlug = phaseMatch[1];
      const archivePhaseId = phaseMatch[2];

      // Skip if this slug's feature doc was already parsed
      // (its completed phases are already in the list via feature doc status table)
      if (coveredSlugs.has(archiveSlug)) {
        // Check if this phase is already in the completed list
        const alreadyListed = completed.some(
          (c) =>
            c.includes(`${archiveSlug} ${archivePhaseId}`) ||
            c.includes(`${archiveSlug} (all phases)`)
        );

        if (!alreadyListed) {
          completed.push(`${archiveSlug} ${archivePhaseId} (archived)`);
        }

        continue;
      }

      completed.push(`${archiveSlug} ${archivePhaseId} (archived)`);
    }
  }

  // Output
  console.log('== PROJECT STATUS ==\n');

  console.log('COMPLETED:');
  if (completed.length === 0) {
    console.log('  (none)');
  } else {
    for (const item of completed) {
      console.log(`  ✅ ${item}`);
    }
  }

  console.log('\nIN PROGRESS:');
  if (inProgress.length === 0) {
    console.log('  (none)');
  } else {
    for (const item of inProgress) {
      console.log(`  🔨 ${item}`);
    }
  }

  console.log('\nNOT STARTED:');
  if (notStarted.length === 0) {
    console.log('  (none)');
  } else {
    for (const item of notStarted) {
      console.log(`  ⏳ ${item}`);
    }
  }

  if (drift.length > 0) {
    console.log('\nDRIFT DETECTED:');
    for (const item of drift) {
      console.log(`  ⚠️  ${item}`);
    }
  } else {
    console.log('\nDRIFT: None detected ✅');
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
