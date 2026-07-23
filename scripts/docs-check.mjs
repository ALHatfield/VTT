#!/usr/bin/env node

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

function parseArgs() {
  const values = new Map();
  const flags = new Set();
  const raw = process.argv.slice(2);

  for (let index = 0; index < raw.length; index += 1) {
    const token = raw[index];
    if (!token.startsWith('--')) {
      continue;
    }

    const next = raw[index + 1];
    if (next && !next.startsWith('--')) {
      values.set(token, next);
      index += 1;
      continue;
    }

    flags.add(token);
  }

  return { values, flags };
}

async function exists(workspacePath) {
  try {
    await fs.access(path.join(ROOT_DIR, workspacePath));
    return true;
  } catch {
    return false;
  }
}

function parseFeatureSlugsFromRoadmap(content) {
  const slugs = new Set();
  const lines = content.split(/\r?\n/);

  let inFeatureTable = false;

  for (const line of lines) {
    if (/^##\s+Feature Status/i.test(line)) {
      inFeatureTable = true;
      continue;
    }

    if (inFeatureTable && /^##\s+/.test(line)) {
      break;
    }

    if (!inFeatureTable || !line.includes('|')) {
      continue;
    }

    const match = line.match(/`([^`]+)`/);
    if (!match) {
      continue;
    }

    const slug = match[1].trim();
    if (slug.toLowerCase() === 'slug') {
      continue;
    }

    slugs.add(slug);
  }

  return [...slugs].sort((a, b) => a.localeCompare(b));
}

async function main() {
  const { values, flags } = parseArgs();
  const onlySlug = values.get('--slug');
  const strict = flags.has('--strict');

  const roadmapPath = '.project/roadmap.md';
  const readmePath = 'README.md';

  const issues = [];
  const warnings = [];

  if (!(await exists(roadmapPath))) {
    issues.push(`Missing required file: ${roadmapPath}`);
  }

  if (!(await exists(readmePath))) {
    issues.push(`Missing required file: ${readmePath}`);
  }

  if (issues.length > 0) {
    for (const issue of issues) {
      console.error(`ERROR: ${issue}`);
    }
    process.exit(1);
  }

  const roadmapContent = await fs.readFile(path.join(ROOT_DIR, roadmapPath), 'utf8');
  const readmeContent = await fs.readFile(path.join(ROOT_DIR, readmePath), 'utf8');

  let slugs = parseFeatureSlugsFromRoadmap(roadmapContent);
  if (onlySlug) {
    slugs = slugs.filter((slug) => slug === onlySlug);
    if (slugs.length === 0) {
      issues.push(`Slug '${onlySlug}' was not found in .project/roadmap.md feature table.`);
    }
  }

  for (const slug of slugs) {
    const featureDocPath = `.project/features/${slug}.md`;
    const instructionPath = `.github/instructions/feature-${slug}.instructions.md`;

    if (!(await exists(featureDocPath))) {
      issues.push(`Missing feature doc for slug '${slug}': ${featureDocPath}`);
    }

    if (!(await exists(instructionPath))) {
      issues.push(`Missing feature instruction for slug '${slug}': ${instructionPath}`);
    }

    if (!readmeContent.includes(featureDocPath)) {
      warnings.push(`README.md does not reference ${featureDocPath}`);
    }
  }

  if (issues.length === 0 && warnings.length === 0) {
    console.log('Docs check passed with no issues.');
    return;
  }

  for (const issue of issues) {
    console.error(`ERROR: ${issue}`);
  }

  for (const warning of warnings) {
    console.warn(`WARN: ${warning}`);
  }

  if (issues.length > 0) {
    process.exit(1);
  }

  if (warnings.length > 0 && strict) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
