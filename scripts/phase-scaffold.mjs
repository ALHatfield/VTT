#!/usr/bin/env node

/**
 * Scaffold skeleton files for a feature phase with project conventions pre-filled.
 * Generates only files that don't already exist. Updates barrel exports and registrations.
 *
 * Usage:
 *   npm run phase:scaffold -- --slug <slug> --phase <id>
 *   npm run phase:scaffold -- --slug <slug> --phase <id> --server --client --shared
 *   npm run phase:scaffold -- --slug <slug> --phase <id> --dry-run
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

const USAGE = [
  'Usage:',
  '  npm run phase:scaffold -- --slug <slug> --phase <id> [--server] [--client] [--shared] [--dry-run]',
  '',
  'When no scope flags are passed, all scopes are generated.',
  '',
  'Examples:',
  '  npm run phase:scaffold -- --slug characters --phase 6A',
  '  npm run phase:scaffold -- --slug editor --phase 4B --server --shared',
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

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function toPascalCase(slug) {
  return slug
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function toCamelCase(slug) {
  const pascal = toPascalCase(slug);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeIfNew(filePath, content, dryRun) {
  const relativePath = path.relative(ROOT_DIR, filePath);

  if (await fileExists(filePath)) {
    console.log(`  SKIP (exists): ${relativePath}`);
    return false;
  }

  if (dryRun) {
    console.log(`  WOULD CREATE: ${relativePath}`);
    return true;
  }

  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
  console.log(`  CREATED: ${relativePath}`);
  return true;
}

async function ensureBarrelExport(barrelPath, exportLine, dryRun) {
  const relativePath = path.relative(ROOT_DIR, barrelPath);

  if (!(await fileExists(barrelPath))) {
    console.log(`  SKIP (barrel not found): ${relativePath}`);
    return false;
  }

  const content = await fs.readFile(barrelPath, 'utf8');
  if (content.includes(exportLine)) {
    console.log(`  SKIP (already exported): ${relativePath}`);
    return false;
  }

  if (dryRun) {
    console.log(`  WOULD UPDATE: ${relativePath} — add "${exportLine}"`);
    return true;
  }

  const updatedContent = `${content.trimEnd()}\n${exportLine}\n`;
  await fs.writeFile(barrelPath, updatedContent, 'utf8');
  console.log(`  UPDATED: ${relativePath}`);
  return true;
}

function generateSharedTypes(slug, phaseId) {
  const pascal = toPascalCase(slug);
  return `// ${pascal} shared types — Phase ${phaseId}
// Add interfaces and type definitions here

`;
}

function generateSharedValidators(slug, phaseId) {
  const pascal = toPascalCase(slug);
  return `// ${pascal} shared validators — Phase ${phaseId}

import { z } from 'zod';

`;
}

function generateSharedConstants(slug, phaseId) {
  const pascal = toPascalCase(slug);
  return `// ${pascal} shared constants — Phase ${phaseId}

`;
}

function generateService(slug, phaseId) {
  const pascal = toPascalCase(slug);
  return `import { prisma } from '../../shared/db/prisma.js';

/**
 * ${pascal} service — Phase ${phaseId}
 */

`;
}

function generateRoutes(slug, phaseId) {
  const pascal = toPascalCase(slug);
  return `import { Router } from 'express';

import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireAuth } from '../auth/auth.middleware.js';

/**
 * ${pascal} routes — Phase ${phaseId}
 */
const router = Router();

router.use(requireAuth);

export { router as ${toCamelCase(slug)}Router };
`;
}

function generateRoutesTest(slug, phaseId) {
  const pascal = toPascalCase(slug);
  return `import { beforeAll, afterAll, describe, expect, it } from 'vitest';

/**
 * ${pascal} routes — Phase ${phaseId}
 */
describe('${pascal} Routes', () => {
  // TODO: Add route tests
});
`;
}

function generateHook(slug, phaseId) {
  const pascal = toPascalCase(slug);
  const camel = toCamelCase(slug);
  return `import { useCallback, useEffect, useState } from 'react';

/**
 * Hook for fetching ${camel} data — Phase ${phaseId}
 */
export function use${pascal}s(): { data: unknown[]; loading: boolean; error: string | null } {
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch${pascal}s = useCallback(async () => {
    try {
      setLoading(true);
      // TODO: implement fetch
      setData([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch${pascal}s();
  }, [fetch${pascal}s]);

  return { data, loading, error };
}
`;
}

async function scaffoldShared(slug, phaseId, dryRun) {
  console.log('\n📦 Shared package:');

  const typesPath = path.join(ROOT_DIR, 'shared', 'src', 'types', `${slug}.ts`);
  const validatorsPath = path.join(ROOT_DIR, 'shared', 'src', 'validators', `${slug}.ts`);
  const constantsPath = path.join(ROOT_DIR, 'shared', 'src', 'constants', `${slug}.ts`);

  await writeIfNew(typesPath, generateSharedTypes(slug, phaseId), dryRun);
  await writeIfNew(validatorsPath, generateSharedValidators(slug, phaseId), dryRun);
  await writeIfNew(constantsPath, generateSharedConstants(slug, phaseId), dryRun);

  // Update barrel exports
  const typesBarrel = path.join(ROOT_DIR, 'shared', 'src', 'types', 'index.ts');
  const validatorsBarrel = path.join(ROOT_DIR, 'shared', 'src', 'validators', 'index.ts');
  const constantsBarrel = path.join(ROOT_DIR, 'shared', 'src', 'constants', 'index.ts');

  await ensureBarrelExport(typesBarrel, `export * from './${slug}.js';`, dryRun);
  await ensureBarrelExport(validatorsBarrel, `export * from './${slug}.js';`, dryRun);
  await ensureBarrelExport(constantsBarrel, `export * from './${slug}.js';`, dryRun);
}

async function scaffoldServer(slug, phaseId, dryRun) {
  console.log('\n🖥️  Server package:');

  const featureDir = path.join(ROOT_DIR, 'server', 'src', 'features', slug);

  await writeIfNew(path.join(featureDir, `${slug}.service.ts`), generateService(slug, phaseId), dryRun);
  await writeIfNew(path.join(featureDir, `${slug}.routes.ts`), generateRoutes(slug, phaseId), dryRun);
  await writeIfNew(path.join(featureDir, `${slug}.routes.test.ts`), generateRoutesTest(slug, phaseId), dryRun);
}

async function scaffoldClient(slug, phaseId, dryRun) {
  console.log('\n🌐 Client package:');

  const featureDir = path.join(ROOT_DIR, 'client', 'src', 'features', slug);
  const hooksDir = path.join(featureDir, 'hooks');

  const pascal = toPascalCase(slug);

  await writeIfNew(path.join(hooksDir, `use${pascal}s.ts`), generateHook(slug, phaseId), dryRun);
}

async function main() {
  const slug = getArgValue('--slug');
  const phaseId = getArgValue('--phase');
  const dryRun = hasFlag('--dry-run');

  if (!slug || !phaseId) {
    console.error(USAGE);
    process.exit(1);
  }

  const scopeServer = hasFlag('--server');
  const scopeClient = hasFlag('--client');
  const scopeShared = hasFlag('--shared');
  const allScopes = !scopeServer && !scopeClient && !scopeShared;

  console.log(`Scaffolding slug '${slug}' phase ${phaseId}${dryRun ? ' (DRY RUN)' : ''}...`);

  if (allScopes || scopeShared) {
    await scaffoldShared(slug, phaseId, dryRun);
  }

  if (allScopes || scopeServer) {
    await scaffoldServer(slug, phaseId, dryRun);
  }

  if (allScopes || scopeClient) {
    await scaffoldClient(slug, phaseId, dryRun);
  }

  console.log(`\n✅ Scaffold complete for '${slug}' phase ${phaseId}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
