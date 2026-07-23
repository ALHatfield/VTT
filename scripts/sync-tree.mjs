#!/usr/bin/env node

/**
 * Regenerate .project/project-tree.md from the actual filesystem.
 * Preserves existing (NEW - Phase X) and (MODIFIED - Phase X) markers
 * on entries whose paths still exist.
 *
 * Usage:
 *   npm run docs:sync-tree
 *   npm run docs:sync-tree -- --dry-run
 *   npm run docs:sync-tree -- --phase 6A
 *   npm run docs:sync-tree -- --phase 6A --modified server/prisma/schema.prisma,server/prisma/seed.ts
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const TREE_FILE = path.join(ROOT_DIR, '.project', 'project-tree.md');
const DRY_RUN = process.argv.includes('--dry-run');

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

const PHASE_ID = getArgValue('--phase');
const MODIFIED_RAW = getArgValue('--modified');
const MODIFIED_PATHS = MODIFIED_RAW
  ? new Set(MODIFIED_RAW.split(',').map((p) => p.trim()))
  : new Set();

const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
]);

const EXCLUDE_FILES = new Set(['package-lock.json']);

/**
 * Parse existing markers from the current project-tree.md.
 * Returns a Map of relative path -> marker string (e.g., "(NEW - Phase 1A)")
 */
async function parseExistingMarkers() {
  const markers = new Map();

  try {
    const content = await fs.readFile(TREE_FILE, 'utf8');
    const codeBlockMatch = content.match(/```[\s\S]*?```/);
    if (!codeBlockMatch) {
      return markers;
    }

    const block = codeBlockMatch[0];
    const lines = block.split('\n');

    // Stack tracks current directory path as we parse tree lines
    const dirStack = [''];

    for (const line of lines) {
      // Match tree lines: "│   ├── filename.ts   (NEW - Phase 1A)"
      const treeMatch = line.match(
        /^([│\s]*)[├└]──\s+(.+?)(\s+\((?:NEW|MODIFIED)\s+-\s+.+\))?\s*$/
      );
      if (!treeMatch) {
        continue;
      }

      const prefix = treeMatch[1];
      const name = treeMatch[2].trim();
      const marker = treeMatch[3]?.trim() ?? null;

      // Calculate depth from prefix (each level is 4 chars: "│   " or "    ")
      const depth = Math.floor(prefix.replace(/\s/g, '│').length / 4) + 1;

      // Adjust stack to current depth
      while (dirStack.length > depth) {
        dirStack.pop();
      }

      const isDir = name.endsWith('/');
      const cleanName = isDir ? name.slice(0, -1) : name;
      const fullPath = [...dirStack.filter(Boolean), cleanName].join('/');

      if (isDir) {
        dirStack.push(cleanName);
      }

      if (marker) {
        markers.set(fullPath, marker);
      }
    }
  } catch {
    // No existing file — no markers to preserve
  }

  return markers;
}

/**
 * Scan the filesystem and return a sorted list of relative paths.
 * Uses Node.js fs instead of shell find+sort for cross-platform compatibility.
 */
async function scanFilesystem() {
  const results = [];

  async function walk(relDir) {
    let entries;
    try {
      entries = await fs.readdir(path.join(ROOT_DIR, relDir || '.'), { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (EXCLUDE_FILES.has(entry.name)) continue;
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        results.push(rel);
        await walk(rel);
      } else {
        results.push(rel);
      }
    }
  }

  await walk('');
  return results;
}

/**
 * Build a tree structure from a flat list of paths.
 */
function buildTree(paths) {
  const root = { name: 'VTT', children: new Map(), isDir: true };

  for (const filePath of paths) {
    const parts = filePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          children: new Map(),
          isDir: !isLast,
          path: parts.slice(0, i + 1).join('/'),
        });
      } else if (!isLast) {
        current.children.get(part).isDir = true;
      }

      current = current.children.get(part);
    }
  }

  return root;
}

/**
 * Filter out excluded directories and files, and remove .gitkeep
 * from non-empty directories.
 */
function shouldInclude(node) {
  if (EXCLUDE_DIRS.has(node.name) && node.isDir) {
    return false;
  }

  if (EXCLUDE_FILES.has(node.name)) {
    return false;
  }

  return true;
}

function hasNonGitkeepChildren(node) {
  if (!node.isDir) {
    return false;
  }

  for (const child of node.children.values()) {
    if (child.name !== '.gitkeep' && shouldInclude(child)) {
      return true;
    }
  }

  return false;
}

/**
 * Render the tree as ASCII art.
 */
function renderTree(node, markers, prefix = '', isLast = true, isRoot = true) {
  const lines = [];

  if (isRoot) {
    lines.push(`${node.name}/`);
  }

  const children = [...node.children.values()]
    .filter(shouldInclude)
    .filter((child) => {
      // Keep .gitkeep only if the directory would otherwise appear empty
      if (child.name === '.gitkeep') {
        return !hasNonGitkeepChildren(node);
      }
      return true;
    })
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const isChildLast = i === children.length - 1;
    const connector = isChildLast ? '└── ' : '├── ';
    const childPrefix = isChildLast ? '    ' : '│   ';

    const displayName = child.isDir ? `${child.name}/` : child.name;
    const marker = markers.get(child.path) ?? '';
    const markerSuffix = marker ? ` ${marker}` : '';

    // Pad marker to align with existing style
    const padding = marker ? ' '.repeat(Math.max(0, 40 - (prefix + connector + displayName).length)) : '';

    lines.push(`${prefix}${connector}${displayName}${padding}${markerSuffix}`);

    if (child.isDir) {
      const subLines = renderTree(
        child,
        markers,
        prefix + childPrefix,
        isChildLast,
        false
      );
      lines.push(...subLines);
    }
  }

  return lines;
}

/**
 * Collect all relative paths from the existing tree for diffing.
 */
function collectTreePaths(markers) {
  return new Set(markers.keys());
}

/**
 * Parse all paths from the existing project-tree.md (regardless of markers).
 */
async function parseExistingPaths() {
  const paths = new Set();

  try {
    const content = await fs.readFile(TREE_FILE, 'utf8');
    const codeBlockMatch = content.match(/```[\s\S]*?```/);
    if (!codeBlockMatch) {
      return paths;
    }

    const block = codeBlockMatch[0];
    const lines = block.split('\n');
    const dirStack = [''];

    for (const line of lines) {
      const treeMatch = line.match(
        /^([│\s]*)[├└]──\s+(.+?)(\s+\((?:NEW|MODIFIED)\s+-\s+.+\))?\s*$/
      );
      if (!treeMatch) {
        continue;
      }

      const prefix = treeMatch[1];
      const name = treeMatch[2].trim();
      const depth = Math.floor(prefix.replace(/\s/g, '│').length / 4) + 1;

      while (dirStack.length > depth) {
        dirStack.pop();
      }

      const isDir = name.endsWith('/');
      const cleanName = isDir ? name.slice(0, -1) : name;
      const fullPath = [...dirStack.filter(Boolean), cleanName].join('/');

      if (isDir) {
        dirStack.push(cleanName);
      }

      paths.add(fullPath);
    }
  } catch {
    // No existing file
  }

  return paths;
}

async function main() {
  // Snapshot old paths before regeneration (for --phase diffing)
  const oldPaths = PHASE_ID ? await parseExistingPaths() : new Set();

  console.log('Scanning filesystem...');
  const paths = await scanFilesystem();
  console.log(`Found ${paths.length} paths.`);

  console.log('Parsing existing markers...');
  const markers = await parseExistingMarkers();
  console.log(`Preserved ${markers.size} marker(s).`);

  // If --phase is provided, auto-detect new files and apply markers
  if (PHASE_ID) {
    const newPaths = new Set();

    for (const filePath of paths) {
      if (!oldPaths.has(filePath)) {
        newPaths.add(filePath);
      }
    }

    // Apply NEW markers to paths that are new (not in old tree)
    for (const newPath of newPaths) {
      if (!markers.has(newPath)) {
        markers.set(newPath, `(NEW - Phase ${PHASE_ID})`);
      }
    }

    // Apply MODIFIED markers to explicitly listed paths
    for (const modPath of MODIFIED_PATHS) {
      if (!markers.has(modPath) && paths.includes(modPath)) {
        markers.set(modPath, `(MODIFIED - Phase ${PHASE_ID})`);
      }
    }

    console.log(`Phase ${PHASE_ID}: ${newPaths.size} new file(s), ${MODIFIED_PATHS.size} modified path(s) marked.`);
  }

  const tree = buildTree(paths);
  const treeLines = renderTree(tree, markers);
  const treeContent = treeLines.join('\n');

  const header = [
    '# VTT Project Tree',
    '',
    '> **This file must reflect the actual filesystem at all times.** Every agent and prompt that creates or modifies files must update this tree before finishing. Mark new files with `(NEW - Phase X.Y)` and modified files with `(MODIFIED - Phase X.Y)`.',
    '>',
    '> For the planned target structure, see `copilot-instructions.md` § Project Structure.',
    '',
  ].join('\n');

  const output = `${header}\`\`\`\n${treeContent}\n\`\`\`\n`;

  if (DRY_RUN) {
    console.log('\n--- DRY RUN (would write) ---\n');
    console.log(output);
    return;
  }

  await fs.writeFile(TREE_FILE, output, 'utf8');
  console.log(`Updated ${path.relative(ROOT_DIR, TREE_FILE)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
