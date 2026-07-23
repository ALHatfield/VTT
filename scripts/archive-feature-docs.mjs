#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const FEATURES_DIR = path.join(ROOT_DIR, '.project', 'features');
const ARCHIVE_DIR = path.join(ROOT_DIR, '.project', '.archive', 'features');
const COMPLETE_DIR = path.join(ROOT_DIR, '.project', 'complete');
const TODAY = new Date().toISOString().slice(0, 10);

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const force = args.has('--force');
const slugArg = getArgValue('--slug');

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }

  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function normalizePhaseId(phaseId) {
  return phaseId.trim();
}

function parseSlugFromFeatureDoc(content, fallback) {
  const slugMatch = content.match(/^>\s*\*\*Slug:\*\*\s*`([^`]+)`/m);
  return slugMatch?.[1]?.trim() ?? fallback;
}

function parseCompletedPhases(content) {
  const completed = new Set();
  const lines = content.split(/\r?\n/);

  let inCurrentStatus = false;

  for (const line of lines) {
    if (/^##\s+Current Status\s*$/i.test(line)) {
      inCurrentStatus = true;
      continue;
    }

    if (inCurrentStatus && /^##\s+/.test(line)) {
      break;
    }

    if (!inCurrentStatus) {
      continue;
    }

    if (!line.includes('|')) {
      continue;
    }

    const columns = line
      .split('|')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (columns.length < 3) {
      continue;
    }

    const [phaseId, _name, status] = columns;
    if (phaseId.toLowerCase() === 'phase' || /^-+$/.test(phaseId)) {
      continue;
    }

    if (status.toLowerCase() === 'complete') {
      completed.add(normalizePhaseId(phaseId));
    }
  }

  return completed;
}

function parseAllPhaseIds(content) {
  const phaseIds = [];
  const lines = content.split(/\r?\n/);

  let inCurrentStatus = false;

  for (const line of lines) {
    if (/^##\s+Current Status\s*$/i.test(line)) {
      inCurrentStatus = true;
      continue;
    }

    if (inCurrentStatus && /^##\s+/.test(line)) {
      break;
    }

    if (!inCurrentStatus || !line.includes('|')) {
      continue;
    }

    const columns = line
      .split('|')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (columns.length < 3) {
      continue;
    }

    const [phaseId] = columns;
    if (phaseId.toLowerCase() === 'phase' || /^-+$/.test(phaseId)) {
      continue;
    }

    phaseIds.push(normalizePhaseId(phaseId));
  }

  return phaseIds;
}

function collectPhaseSections(content) {
  const phaseHeaderRegex = /^##\s+Phase\s+([^:]+):\s*(.+)$/gm;
  const matches = [];

  let match;
  while ((match = phaseHeaderRegex.exec(content)) !== null) {
    matches.push({
      start: match.index,
      headerLine: match[0],
      phaseId: normalizePhaseId(match[1]),
      phaseName: match[2].trim(),
    });
  }

  // Collect all ## header positions for section boundary detection.
  // This prevents non-phase headers (e.g. "## Post-MVP Phases") from being
  // consumed into a phase section's raw content.
  const h2Regex = /^## /gm;
  const h2Positions = [];
  while ((match = h2Regex.exec(content)) !== null) {
    h2Positions.push(match.index);
  }

  const sections = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const nextH2 = h2Positions.find((pos) => pos > current.start + current.headerLine.length);
    const end = nextH2 ?? content.length;
    const raw = content.slice(current.start, end);

    sections.push({
      ...current,
      end,
      raw,
    });
  }

  return sections;
}

function stripCompletedStatusRows(content, completedPhases) {
  const lines = content.split(/\r?\n/);
  const output = [];
  let inStatusSection = false;

  for (const line of lines) {
    if (/^##\s+Current Status\s*$/i.test(line)) {
      inStatusSection = true;
      output.push(line);
      continue;
    }

    if (inStatusSection && /^##\s+/.test(line)) {
      inStatusSection = false;
    }

    if (!inStatusSection) {
      output.push(line);
      continue;
    }

    if (!line.includes('|')) {
      output.push(line);
      continue;
    }

    const columns = line
      .split('|')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    if (columns.length < 3) {
      output.push(line);
      continue;
    }

    const [phaseId] = columns;

    // Keep header and separator rows
    if (phaseId.toLowerCase() === 'phase' || /^-+$/.test(phaseId)) {
      output.push(line);
      continue;
    }

    // Skip completed rows
    if (completedPhases.has(normalizePhaseId(phaseId))) {
      continue;
    }

    output.push(line);
  }

  return output.join('\n');
}

function buildFullyCompletedRedirect(content, slug) {
  const lines = content.split(/\r?\n/);
  let metadataEndIndex = -1;
  let foundHeader = false;

  for (let i = 0; i < lines.length; i += 1) {
    if (/^#\s+/.test(lines[i])) {
      foundHeader = true;
      continue;
    }

    if (foundHeader && /^---\s*$/.test(lines[i])) {
      metadataEndIndex = i;
      break;
    }
  }

  if (metadataEndIndex === -1) {
    metadataEndIndex = Math.min(lines.length - 1, 10);
  }

  const header = lines.slice(0, metadataEndIndex + 1).join('\n');
  const archivePath = `.project/.archive/features/${slug}/`;
  const completePath = `.project/.archive/complete/`;

  return [
    header,
    '',
    `All phases complete. See \`${archivePath}\` for archived phase details and \`${completePath}\` for completion records.`,
    '',
  ].join('\n');
}

function hasArchivedMarker(sectionRaw) {
  return /\*\*Status:\*\*\s+Complete\s+\(Archived\)/i.test(sectionRaw);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function archiveFeatureDoc(featureFilePath) {
  const original = await fs.readFile(featureFilePath, 'utf8');
  const featureFileName = path.basename(featureFilePath);
  const fallbackSlug = featureFileName.replace(/\.md$/i, '');
  const slug = parseSlugFromFeatureDoc(original, fallbackSlug);

  let headSectionsByPhaseId = new Map();
  if (force) {
    try {
      const headContent = execFileSync('git', ['show', `HEAD:.project/features/${featureFileName}`], {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const headSections = collectPhaseSections(headContent);
      headSectionsByPhaseId = new Map(headSections.map((section) => [section.phaseId, section]));
    } catch {
      headSectionsByPhaseId = new Map();
    }
  }

  if (slugArg && slugArg !== slug) {
    console.warn(`Skipping ${featureFileName}: slug '${slug}' does not match filter '${slugArg}'`);
    return { slug, featureFileName, archived: 0, updated: false, skipped: true };
  }

  const completedPhases = parseCompletedPhases(original);
  if (completedPhases.size === 0) {
    return { slug, featureFileName, archived: 0, updated: false, skipped: false };
  }

  const sections = collectPhaseSections(original);
  if (sections.length === 0) {
    return { slug, featureFileName, archived: 0, updated: false, skipped: false };
  }

  let rebuilt = '';
  let cursor = 0;
  let archivedCount = 0;

  for (const section of sections) {
    rebuilt += original.slice(cursor, section.start);
    cursor = section.end;

    const sectionCompleted = completedPhases.has(section.phaseId);
    if (!sectionCompleted) {
      rebuilt += section.raw;
      continue;
    }

    // Phase is completed — ensure archive exists, then strip from feature doc
    const sectionIsStub = hasArchivedMarker(section.raw);
    const archiveFeatureDir = path.join(ARCHIVE_DIR, slug);
    const archiveFilePath = path.join(archiveFeatureDir, `phase-${section.phaseId}.md`);
    const archiveAlreadyExists = await fileExists(archiveFilePath);

    if (archiveAlreadyExists && !force) {
      // Archive file already exists — just strip the section
      archivedCount += 1;
      continue;
    }

    // Need to create or update archive file
    let sourceSectionRaw = section.raw;
    if (sectionIsStub && force) {
      const headSection = headSectionsByPhaseId.get(section.phaseId);
      if (headSection && !hasArchivedMarker(headSection.raw)) {
        sourceSectionRaw = headSection.raw;
      }
    }

    const completionFileName = `${slug}-${section.phaseId}.md`;
    const completionFilePath = path.join(COMPLETE_DIR, completionFileName);
    const completionExists = await fileExists(completionFilePath);

    let archiveBody = sourceSectionRaw;
    if (sectionIsStub && completionExists) {
      const completionContent = await fs.readFile(completionFilePath, 'utf8');
      archiveBody = [
        'Original phase section was already archived in the feature roadmap at archive time.',
        '',
        '## Completion Record Snapshot',
        '',
        completionContent.trimEnd(),
      ].join('\n');
    }

    const archiveContent = [
      `# Archived Phase ${section.phaseId}: ${section.phaseName}`,
      '',
      `- Feature: \`${slug}\``,
      `- Source: \`.project/features/${featureFileName}\``,
      `- Archived: ${TODAY}`,
      '',
      '---',
      '',
      archiveBody,
      '',
    ].join('\n');

    if (!dryRun) {
      await fs.mkdir(archiveFeatureDir, { recursive: true });
      await fs.writeFile(archiveFilePath, archiveContent, 'utf8');
    }

    archivedCount += 1;
    // Section is stripped — nothing added to rebuilt
  }

  rebuilt += original.slice(cursor);

  // Post-process: strip completed rows from status table or build redirect
  const allPhaseIds = parseAllPhaseIds(original);
  const allStatusComplete = allPhaseIds.length > 0 &&
    allPhaseIds.every((id) => completedPhases.has(id));
  const noRemainingSections = sections.every((s) => completedPhases.has(s.phaseId));

  if (allStatusComplete && noRemainingSections) {
    rebuilt = buildFullyCompletedRedirect(rebuilt, slug);
  } else if (completedPhases.size > 0) {
    rebuilt = stripCompletedStatusRows(rebuilt, completedPhases);
  }

  const updated = rebuilt !== original;
  if (updated && !dryRun) {
    await fs.writeFile(featureFilePath, rebuilt, 'utf8');
  }

  return {
    slug,
    featureFileName,
    archived: archivedCount,
    updated,
    skipped: false,
  };
}

async function main() {
  const featureEntries = await fs.readdir(FEATURES_DIR, { withFileTypes: true });
  const featureFiles = featureEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => path.join(FEATURES_DIR, entry.name))
    .sort((a, b) => a.localeCompare(b));

  if (featureFiles.length === 0) {
    console.log('No feature docs found in .project/features.');
    return;
  }

  const results = [];
  for (const featureFile of featureFiles) {
    const result = await archiveFeatureDoc(featureFile);
    results.push(result);
  }

  const relevant = results.filter((result) => !result.skipped);
  const archivedTotal = relevant.reduce((sum, result) => sum + result.archived, 0);

  for (const result of relevant) {
    const tag = result.updated ? 'UPDATED' : 'UNCHANGED';
    console.log(`${tag} ${result.featureFileName} (${result.slug}) -> ${result.archived} phase(s)`);
  }

  if (slugArg && relevant.length === 0) {
    console.log(`No feature doc matched slug '${slugArg}'.`);
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(`Dry run complete. ${archivedTotal} phase section(s) would be processed.`);
  } else {
    console.log(`Archive complete. ${archivedTotal} phase section(s) processed.`);
  }
}

main().catch((error) => {
  console.error('Failed to archive feature docs.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
