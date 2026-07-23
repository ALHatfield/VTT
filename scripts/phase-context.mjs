#!/usr/bin/env node

/**
 * Consolidated context loader — concatenates all planning, rules,
 * schema, and exemplar files for a given slug into a single stdout blob.
 *
 * Usage:
 *   npm run phase:context -- --slug <slug>
 *   npm run phase:context -- --slug <slug> --phase <id>
 *   npm run phase:context -- --slug <slug> --phase <id> --exemplar campaigns
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

const USAGE = [
  'Usage:',
  '  npm run phase:context -- --slug <slug> [--phase <id>] [--exemplar <slug>]',
  '',
  'Examples:',
  '  npm run phase:context -- --slug characters',
  '  npm run phase:context -- --slug characters --phase 6A',
  '  npm run phase:context -- --slug characters --phase 6A --exemplar campaigns',
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

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

function shouldIncludeNote(filename, slug, phase) {
  if (!filename.startsWith(`${slug}-`) || !filename.endsWith('.md')) {
    return false;
  }

  if (!phase) {
    return true;
  }

  const afterSlug = filename.slice(slug.length + 1); // e.g. "4F-fog-compositing.md"

  // Always include general notes
  if (afterSlug.startsWith('general-')) {
    return true;
  }

  // Extract the phase segment (everything before the second hyphen)
  const phaseMatch = afterSlug.match(/^([A-Za-z0-9.]+)-/);
  if (!phaseMatch) {
    return false;
  }

  const notePhase = phaseMatch[1];

  // Exact match: note is "4F.2", building "4F.2"
  if (notePhase === phase) {
    return true;
  }

  // Parent match: note is "4F", building "4F.2"
  if (phase.startsWith(notePhase + '.')) {
    return true;
  }

  return false;
}

async function listFilesFromDir(dirPath, slug, phase) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => shouldIncludeNote(name, slug, phase))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => path.join(dirPath, name));
  } catch {
    return [];
  }
}

async function extractRoadmapStatusTable(roadmapPath) {
  const content = await readFileIfExists(roadmapPath);
  if (!content) {
    return null;
  }

  const lines = content.split('\n');
  const tableLines = [];
  let inTable = false;

  for (const line of lines) {
    if (line.includes('|') && (line.includes('Feature') || line.includes('Status') || line.includes('Phase'))) {
      inTable = true;
    }

    if (inTable) {
      if (line.trim() === '' || (line.startsWith('#') && !line.startsWith('|'))) {
        break;
      }
      tableLines.push(line);
    }
  }

  return tableLines.length > 0 ? tableLines.join('\n') : content;
}

function printSection(label, relativePath, content) {
  const separator = '─'.repeat(60);
  console.log(`\n${separator}`);
  console.log(`📄 ${label}: ${relativePath}`);
  console.log(separator);
  console.log(content);
}

async function findExemplarFiles(exemplarSlug) {
  const files = [];

  const serverDir = path.join(ROOT_DIR, 'server', 'src', 'features', exemplarSlug);
  const clientDir = path.join(ROOT_DIR, 'client', 'src', 'features', exemplarSlug);

  // Server files: service, routes, routes.test
  const serverCandidates = [
    `${exemplarSlug}.service.ts`,
    `${exemplarSlug}.routes.ts`,
    `${exemplarSlug}.routes.test.ts`,
  ];

  for (const name of serverCandidates) {
    const filePath = path.join(serverDir, name);
    const content = await readFileIfExists(filePath);
    if (content) {
      files.push({
        relativePath: `server/src/features/${exemplarSlug}/${name}`,
        content,
      });
    }
  }

  // Client files: first hook, first component
  const hooksDir = path.join(clientDir, 'hooks');
  try {
    const hookEntries = await fs.readdir(hooksDir, { withFileTypes: true });
    const firstHook = hookEntries
      .filter((e) => e.isFile() && e.name.endsWith('.ts'))
      .sort((a, b) => a.name.localeCompare(b.name))[0];

    if (firstHook) {
      const hookPath = path.join(hooksDir, firstHook.name);
      const content = await readFileIfExists(hookPath);
      if (content) {
        files.push({
          relativePath: `client/src/features/${exemplarSlug}/hooks/${firstHook.name}`,
          content,
        });
      }
    }
  } catch {
    // No hooks dir
  }

  try {
    const clientEntries = await fs.readdir(clientDir, { withFileTypes: true });
    const firstComponent = clientEntries
      .filter((e) => e.isFile() && e.name.endsWith('.tsx'))
      .sort((a, b) => a.name.localeCompare(b.name))[0];

    if (firstComponent) {
      const componentPath = path.join(clientDir, firstComponent.name);
      const content = await readFileIfExists(componentPath);
      if (content) {
        files.push({
          relativePath: `client/src/features/${exemplarSlug}/${firstComponent.name}`,
          content,
        });
      }
    }
  } catch {
    // No client feature dir
  }

  return files;
}

async function main() {
  const slug = getArgValue('--slug');
  if (!slug) {
    console.error(USAGE);
    process.exit(1);
  }

  const exemplar = getArgValue('--exemplar');
  const phase = getArgValue('--phase');
  let fileCount = 0;

  // 1. Feature doc
  const featureDocPath = path.join(ROOT_DIR, '.project', 'features', `${slug}.md`);
  const featureDoc = await readFileIfExists(featureDocPath);
  if (featureDoc) {
    printSection('Feature Doc', `.project/features/${slug}.md`, featureDoc);
    fileCount += 1;
  } else {
    console.error(`⚠️  Feature doc not found: .project/features/${slug}.md`);
  }

  // 2. Feature instructions
  const featureInstructionsPath = path.join(ROOT_DIR, '.github', 'instructions', `feature-${slug}.instructions.md`);
  const featureInstructions = await readFileIfExists(featureInstructionsPath);
  if (featureInstructions) {
    printSection('Feature Instructions', `.github/instructions/feature-${slug}.instructions.md`, featureInstructions);
    fileCount += 1;
  }

  // 3. Coding standards
  const codingStandardsPath = path.join(ROOT_DIR, '.github', 'instructions', 'coding-standards.instructions.md');
  const codingStandards = await readFileIfExists(codingStandardsPath);
  if (codingStandards) {
    printSection('Coding Standards', '.github/instructions/coding-standards.instructions.md', codingStandards);
    fileCount += 1;
  }

  // 4. Roadmap (status table only)
  const roadmapPath = path.join(ROOT_DIR, '.project', 'roadmap.md');
  const roadmapTable = await extractRoadmapStatusTable(roadmapPath);
  if (roadmapTable) {
    printSection('Roadmap (status table)', '.project/roadmap.md', roadmapTable);
    fileCount += 1;
  }

  // 5. Prisma schema
  const schemaPath = path.join(ROOT_DIR, 'server', 'prisma', 'schema.prisma');
  const schema = await readFileIfExists(schemaPath);
  if (schema) {
    printSection('Prisma Schema', 'server/prisma/schema.prisma', schema);
    fileCount += 1;
  }

  // 6. Notes
  const notesDir = path.join(ROOT_DIR, '.project', 'notes');
  const noteFiles = await listFilesFromDir(notesDir, slug, phase);
  for (const notePath of noteFiles) {
    const content = await readFileIfExists(notePath);
    if (content) {
      const relativePath = path.relative(ROOT_DIR, notePath);
      printSection('Dev Note', relativePath, content);
      fileCount += 1;
    }
  }

  // 7. Handoffs
  const handoffsDir = path.join(ROOT_DIR, '.project', 'handoffs');
  const handoffFiles = await listFilesFromDir(handoffsDir, slug, phase);
  for (const handoffPath of handoffFiles) {
    const content = await readFileIfExists(handoffPath);
    if (content) {
      const relativePath = path.relative(ROOT_DIR, handoffPath);
      printSection('Handoff', relativePath, content);
      fileCount += 1;
    }
  }

  // 8. Exemplar files
  if (exemplar) {
    const exemplarFiles = await findExemplarFiles(exemplar);
    for (const file of exemplarFiles) {
      printSection(`Exemplar (${exemplar})`, file.relativePath, file.content);
      fileCount += 1;
    }

    if (exemplarFiles.length === 0) {
      console.error(`⚠️  No exemplar files found for slug: ${exemplar}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`✅ Phase context loaded: ${fileCount} file(s) for slug '${slug}'${exemplar ? ` (exemplar: ${exemplar})` : ''}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
