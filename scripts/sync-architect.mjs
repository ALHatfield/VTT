#!/usr/bin/env node

/**
 * Regenerates the "Database Entity-Relationship Diagram" section in
 * .github/agents/architect.agent.md from server/prisma/schema.prisma.
 *
 * Also warns when route files are newer than the agent file (REST API Map drift).
 *
 * Usage:
 *   npm run docs:sync-architect                    # sync ER + check API staleness
 *   npm run docs:sync-architect -- --dry-run       # print generated diagram, no write
 *   npm run docs:sync-architect -- --check         # exit 1 on any drift (CI mode)
 *   npm run docs:sync-architect -- --section er    # only ER sync, skip API check
 *   npm run docs:sync-architect -- --section api   # only API staleness check
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const SCHEMA_PATH = path.join(ROOT_DIR, 'server', 'prisma', 'schema.prisma');
const AGENT_PATH = path.join(ROOT_DIR, '.github', 'agents', 'architect.agent.md');

const DRY_RUN = process.argv.includes('--dry-run');
const CHECK_MODE = process.argv.includes('--check');

const sectionIdx = process.argv.indexOf('--section');
const SECTION_ONLY = sectionIdx !== -1 ? process.argv[sectionIdx + 1] : null;

// ---------------------------------------------------------------------------
// Schema parsing
// ---------------------------------------------------------------------------

function parseSchema(content) {
  const models = new Map();
  const enums = new Map();

  // Extract enums first so we can identify enum field types later
  const enumRegex = /^enum\s+(\w+)\s*\{([^}]+)\}/gm;
  let match;
  while ((match = enumRegex.exec(content)) !== null) {
    const enumName = match[1];
    const values = match[2]
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('@@') && !l.startsWith('//'));
    enums.set(enumName, values);
  }

  // Extract model blocks
  const modelRegex = /^model\s+(\w+)\s*\{([\s\S]*?)\n\}/gm;
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const body = match[2];
    models.set(modelName, parseModelBody(body));
  }

  return { models, enums };
}

function parseModelBody(body) {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//'));

  // First pass: find field names used as FKs in @relation(fields: [...])
  const fkFieldNames = new Set();
  for (const line of lines) {
    const m = line.match(/@relation\([^)]*fields:\s*\[([^\]]+)\]/);
    if (m) {
      for (const f of m[1].split(',').map((s) => s.trim())) {
        fkFieldNames.add(f);
      }
    }
  }

  // Second pass: collect all field declarations
  const fields = [];
  for (const line of lines) {
    if (line.startsWith('@@')) continue; // block-level attributes

    const m = line.match(/^(\w+)\s+(\S+)(.*)?$/);
    if (!m) continue;

    const [, name, rawType, rest = ''] = m;
    const isFk = fkFieldNames.has(name);

    // A field is UUID if it's the @id with @default(uuid()), or if it's a FK to such a field
    const isUuid =
      rest.includes('@default(uuid())') ||
      (isFk && !rawType.includes('[]'));

    fields.push({
      name,
      rawType,
      rest,
      isId: rest.includes('@id'),
      isUnique: rest.includes('@unique'),
      isFk,
      isUuid,
      // FK-owning side has @relation(fields: [...]) — skip these for relationship lines
      hasOwnFkRelation: rest.includes('@relation') && rest.includes('fields:'),
    });
  }

  return { fields };
}

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

const PRISMA_TO_MERMAID = {
  String: 'string',
  Int: 'int',
  Boolean: 'bool',
  DateTime: 'datetime',
  Json: 'json',
  Float: 'float',
  Bytes: 'bytes',
  BigInt: 'bigint',
  Decimal: 'decimal',
};

/**
 * Map a Prisma field type to a Mermaid ER type.
 * Returns null for relation fields (no DB column).
 */
function getMermaidType(rawType, isUuid, enums) {
  const base = rawType.replace(/[?[\]]/g, '');
  const prismaType = PRISMA_TO_MERMAID[base];
  if (prismaType) {
    if (prismaType === 'string' && isUuid) return 'uuid';
    return prismaType;
  }
  if (enums.has(base)) return 'enum';
  return null; // relation field — no DB column
}

// ---------------------------------------------------------------------------
// ER Diagram generation
// ---------------------------------------------------------------------------

function buildErDiagram(models, enums) {
  const modelNames = new Set(models.keys());
  const lines = ['erDiagram'];

  // Relationship lines — only from the non-FK side to avoid double-emission.
  // The FK-owning side always has @relation(fields: [...]), so we skip those.
  // The back-reference side (array or non-owning scalar) is what we emit from.
  for (const [modelName, { fields }] of models) {
    for (const field of fields) {
      const base = field.rawType.replace(/[?[\]]/g, '');
      if (!modelNames.has(base)) continue; // not a relation field
      if (field.hasOwnFkRelation) continue; // FK-owning side — skip

      const isArray = field.rawType.includes('[]');
      const isOptional = field.rawType.endsWith('?') && !isArray;

      let arrow;
      if (isArray) {
        arrow = '||--o{';
      } else if (isOptional) {
        arrow = '||--o|';
      } else {
        arrow = '||--||';
      }

      lines.push(`    ${modelName} ${arrow} ${base} : "${field.name}"`);
    }
  }

  lines.push('');

  // Entity attribute blocks
  for (const [modelName, { fields }] of models) {
    lines.push(`    ${modelName} {`);

    for (const field of fields) {
      const mermaidType = getMermaidType(field.rawType, field.isUuid, enums);
      if (!mermaidType) continue; // relation field — no DB column, skip

      const keys = [];
      if (field.isId) keys.push('PK');
      if (field.isUnique) keys.push('UK');
      if (field.isFk) keys.push('FK');
      const keyStr = keys.length > 0 ? ` ${keys.join(', ')}` : '';

      if (mermaidType === 'enum') {
        const base = field.rawType.replace(/[?[\]]/g, '');
        const vals = (enums.get(base) ?? []).join(' | ');
        lines.push(`        ${mermaidType} ${field.name}${keyStr} "${vals}"`);
      } else {
        lines.push(`        ${mermaidType} ${field.name}${keyStr}`);
      }
    }

    lines.push('    }');
    lines.push('');
  }

  // Remove trailing blank line
  while (lines.at(-1) === '') lines.pop();

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Agent file splice — only touches the erDiagram fenced block
// ---------------------------------------------------------------------------

const SECTION_HEADER = '### Database Entity-Relationship Diagram';
const FENCE_OPEN = '```mermaid\n';
const FENCE_CLOSE = '\n```';

function spliceErSection(agentContent, newDiagram) {
  const headerIdx = agentContent.indexOf(SECTION_HEADER);
  if (headerIdx === -1) {
    throw new Error(`Section "${SECTION_HEADER}" not found in agent file`);
  }

  const fenceOpenIdx = agentContent.indexOf(FENCE_OPEN, headerIdx);
  if (fenceOpenIdx === -1) {
    throw new Error('Opening ```mermaid fence not found after section header');
  }

  const contentStart = fenceOpenIdx + FENCE_OPEN.length;
  const fenceCloseIdx = agentContent.indexOf(FENCE_CLOSE, contentStart);
  if (fenceCloseIdx === -1) {
    throw new Error('Closing ``` fence not found after ER diagram');
  }

  // Only the bytes between the fences are replaced — everything else is untouched
  return (
    agentContent.slice(0, contentStart) +
    newDiagram +
    agentContent.slice(fenceCloseIdx)
  );
}

// ---------------------------------------------------------------------------
// API staleness check
// ---------------------------------------------------------------------------

async function findRouteFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findRouteFiles(fullPath)));
    } else if (entry.name === 'routes.ts' || entry.name.endsWith('.router.ts')) {
      results.push(path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/'));
    }
  }
  return results;
}

async function checkApiStaleness(agentMtimeMs) {
  let routeFiles;
  try {
    routeFiles = await findRouteFiles(path.join(ROOT_DIR, 'server', 'src', 'features'));
  } catch (error) {
    console.warn(
      'Could not check route file staleness:',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }

  let newestMtimeMs = 0;
  let newestFile = '';

  for (const rf of routeFiles) {
    try {
      const stat = await fs.stat(path.join(ROOT_DIR, rf));
      if (stat.mtimeMs > newestMtimeMs) {
        newestMtimeMs = stat.mtimeMs;
        newestFile = rf;
      }
    } catch {
      // skip inaccessible files
    }
  }

  return newestMtimeMs > agentMtimeMs
    ? { stale: true, newestFile }
    : { stale: false, newestFile: '' };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const [schemaContent, agentContent, agentStat] = await Promise.all([
    fs.readFile(SCHEMA_PATH, 'utf8'),
    fs.readFile(AGENT_PATH, 'utf8'),
    fs.stat(AGENT_PATH),
  ]);

  let exitCode = 0;

  // --- ER Diagram sync ---
  if (SECTION_ONLY === null || SECTION_ONLY === 'er') {
    const { models, enums } = parseSchema(schemaContent);
    const newDiagram = buildErDiagram(models, enums);
    const newAgentContent = spliceErSection(agentContent, newDiagram);
    const changed = newAgentContent !== agentContent;

    if (!changed) {
      console.log('ER diagram: up to date.');
    } else if (DRY_RUN || CHECK_MODE) {
      console.log('ER diagram: would be updated.');
      if (DRY_RUN) {
        console.log('\n--- Generated ER Diagram (dry run) ---\n');
        console.log(newDiagram);
        console.log('\n--- End of ER Diagram ---');
      }
      if (CHECK_MODE) exitCode = 1;
    } else {
      await fs.writeFile(AGENT_PATH, newAgentContent, 'utf8');
      console.log('ER diagram: updated architect.agent.md');
    }
  }

  // --- REST API Map staleness check ---
  if (SECTION_ONLY === null || SECTION_ONLY === 'api') {
    const result = await checkApiStaleness(agentStat.mtimeMs);

    if (result === null) {
      console.warn('REST API Map: could not locate route files to check staleness.');
    } else if (result.stale) {
      console.warn(
        '\n\u26a0  Route files have changed since the last architect sync.' +
          '\n   Review the REST API Map section in architect.agent.md manually.' +
          `\n   Newest changed route: ${result.newestFile}`
      );
      if (CHECK_MODE) exitCode = 1;
    } else {
      console.log('REST API Map: no route changes detected.');
    }
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
