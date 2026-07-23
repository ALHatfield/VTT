#!/usr/bin/env node

/**
 * Dependency graph analyzer — parses the Mermaid graph from roadmap.md,
 * cross-references phase statuses from feature docs, and outputs:
 * unblocked phases, blocked phases, critical path, and parallelizable work.
 *
 * Usage:
 *   npm run project:graph
 *   npm run project:graph -- --validate
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

const SLUG_MAP = {
  P0: null,
  A: 'auth',
  PO: 'portal',
  C: 'campaigns',
  PA: 'play-area',
  E: 'editor',
  CH: 'characters',
};

function hasFlag(flag) {
  return process.argv.includes(flag);
}

/**
 * Returns true if two Mermaid node IDs belong to different feature slugs.
 */
function isCrossFeature(nodeIdA, nodeIdB) {
  return resolveSlugFromNodeId(nodeIdA) !== resolveSlugFromNodeId(nodeIdB);
}

async function readFileIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Parse the Mermaid graph into { nodes, edges }.
 * nodes: Map<nodeId, label>
 * edges: Array<{ from, to }>
 */
function parseMermaidGraph(content) {
  const mermaidMatch = content.match(/```mermaid\s*\n([\s\S]*?)```/);
  if (!mermaidMatch) {
    return { nodes: new Map(), edges: [] };
  }

  const graphContent = mermaidMatch[1];
  const nodes = new Map();
  const edges = [];

  for (const line of graphContent.split('\n')) {
    const trimmed = line.trim();

    // Skip graph directive and empty lines
    if (!trimmed || /^graph\s/i.test(trimmed) || /^%%/.test(trimmed)) {
      continue;
    }

    // Parse edge: A --> B or A[label] --> B[label]
    const edgeMatch = trimmed.match(
      /^(\w+)(?:\[([^\]]*)\])?\s*-->\s*(\w+)(?:\[([^\]]*)\])?/
    );

    if (edgeMatch) {
      const fromId = edgeMatch[1];
      const fromLabel = edgeMatch[2] || null;
      const toId = edgeMatch[3];
      const toLabel = edgeMatch[4] || null;

      if (fromLabel && !nodes.has(fromId)) {
        nodes.set(fromId, fromLabel);
      }

      if (toLabel && !nodes.has(toId)) {
        nodes.set(toId, toLabel);
      }

      // Ensure nodes exist even without labels
      if (!nodes.has(fromId)) {
        nodes.set(fromId, fromId);
      }

      if (!nodes.has(toId)) {
        nodes.set(toId, toId);
      }

      edges.push({ from: fromId, to: toId });
      continue;
    }

    // Parse standalone node definition: A[label]
    const nodeMatch = trimmed.match(/^(\w+)\[([^\]]*)\]/);
    if (nodeMatch && !nodes.has(nodeMatch[1])) {
      nodes.set(nodeMatch[1], nodeMatch[2]);
    }
  }

  return { nodes, edges };
}

/**
 * Extract a phase ID like "4H" from a Mermaid node label like "play-area 4H: Initiative".
 * Returns { slug, phaseId } or null.
 */
function parsePhaseFromLabel(label) {
  // Match patterns like "auth 1A", "play-area 4H: Initiative", "Phase 0: Foundation"
  const phaseMatch = label.match(
    /(?:^|\s)(\d+[A-Z](?:\.\d+)?)/
  );

  if (phaseMatch) {
    return phaseMatch[1];
  }

  return null;
}

/**
 * Resolve the slug from a Mermaid node ID prefix.
 */
function resolveSlugFromNodeId(nodeId) {
  for (const [prefix, slug] of Object.entries(SLUG_MAP)) {
    if (nodeId.startsWith(prefix) && slug !== null) {
      return slug;
    }
  }

  return null;
}

/**
 * Parse the Current Status table from a feature doc.
 * Returns Map<phaseId, status>.
 */
function parseFeatureStatuses(content) {
  const statuses = new Map();
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

    if (cells.length >= 3) {
      statuses.set(cells[0].trim(), cells[2].trim());
    }
  }

  return statuses;
}

/**
 * Detect cycles using DFS. Returns the first cycle found or null.
 */
function detectCycle(edges, nodes) {
  const adjacency = new Map();
  for (const nodeId of nodes.keys()) {
    adjacency.set(nodeId, []);
  }

  for (const { from, to } of edges) {
    if (adjacency.has(from)) {
      adjacency.get(from).push(to);
    }
  }

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map();

  for (const nodeId of nodes.keys()) {
    color.set(nodeId, WHITE);
  }

  const parent = new Map();

  function dfs(nodeId) {
    color.set(nodeId, GRAY);

    for (const neighbor of adjacency.get(nodeId) || []) {
      if (color.get(neighbor) === GRAY) {
        // Reconstruct cycle
        const cycle = [neighbor, nodeId];
        let current = nodeId;
        while (parent.has(current) && parent.get(current) !== neighbor) {
          current = parent.get(current);
          cycle.push(current);
        }

        return cycle.reverse();
      }

      if (color.get(neighbor) === WHITE) {
        parent.set(neighbor, nodeId);
        const result = dfs(neighbor);
        if (result) {
          return result;
        }
      }
    }

    color.set(nodeId, BLACK);
    return null;
  }

  for (const nodeId of nodes.keys()) {
    if (color.get(nodeId) === WHITE) {
      const cycle = dfs(nodeId);
      if (cycle) {
        return cycle;
      }
    }
  }

  return null;
}

/**
 * Find orphan nodes (non-root nodes with no incoming edges).
 * The root node (P0) is exempt.
 */
function findOrphans(edges, nodes) {
  const hasIncoming = new Set();

  for (const { to } of edges) {
    hasIncoming.add(to);
  }

  const orphans = [];
  for (const nodeId of nodes.keys()) {
    if (nodeId === 'P0') {
      continue;
    }

    if (!hasIncoming.has(nodeId)) {
      orphans.push(nodeId);
    }
  }

  return orphans;
}

/**
 * Find the longest path from any incomplete node to a leaf.
 * This is the critical path — the minimum number of sequential phases to MVP.
 */
function findCriticalPath(edges, nodes, phaseStatusMap) {
  const adjacency = new Map();
  for (const nodeId of nodes.keys()) {
    adjacency.set(nodeId, []);
  }

  for (const { from, to } of edges) {
    if (adjacency.has(from)) {
      adjacency.get(from).push(to);
    }
  }

  // Only consider incomplete nodes
  const incompleteNodes = new Set();
  for (const [nodeId] of nodes) {
    const status = phaseStatusMap.get(nodeId);
    if (status !== 'Complete') {
      incompleteNodes.add(nodeId);
    }
  }

  // Memoized DFS for longest path
  const memo = new Map();

  function longestPath(nodeId) {
    if (memo.has(nodeId)) {
      return memo.get(nodeId);
    }

    const neighbors = (adjacency.get(nodeId) || []).filter((n) =>
      incompleteNodes.has(n)
    );

    if (neighbors.length === 0) {
      const result = [nodeId];
      memo.set(nodeId, result);
      return result;
    }

    let best = [];
    for (const neighbor of neighbors) {
      const subPath = longestPath(neighbor);
      if (subPath.length > best.length) {
        best = subPath;
      }
    }

    const result = [nodeId, ...best];
    memo.set(nodeId, result);
    return result;
  }

  let criticalPath = [];
  for (const nodeId of incompleteNodes) {
    const pathFromHere = longestPath(nodeId);
    if (pathFromHere.length > criticalPath.length) {
      criticalPath = pathFromHere;
    }
  }

  return criticalPath;
}

async function loadAllPhaseStatuses(roadmapRows) {
  const phaseStatusMap = new Map();

  // Phase 0 is always complete
  phaseStatusMap.set('P0', 'Complete');

  // Load archived completion records — these are the definitive source
  // for phases that have been completed and removed from feature doc status tables
  const archiveDir = path.join(ROOT_DIR, '.project', '.archive', 'complete');
  try {
    const entries = await fs.readdir(archiveDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }

      const baseName = entry.name.replace('.md', '');

      // Match slug-phaseId pattern (e.g., "play-area-4A", "auth-1A", "campaigns-3B")
      const match = baseName.match(/^(.+)-(\d+[A-Z](?:\.\d+)?)$/);
      if (match) {
        phaseStatusMap.set(match[2], 'Complete');
      }

      // Match phase-0
      if (baseName === 'phase-0') {
        phaseStatusMap.set('P0', 'Complete');
      }
    }
  } catch {
    // No archive dir
  }

  for (const row of roadmapRows) {
    const featureDocPath = path.join(
      ROOT_DIR,
      '.project',
      'features',
      `${row.slug}.md`
    );
    const content = await readFileIfExists(featureDocPath);

    if (!content) {
      continue;
    }

    if (row.status === 'Complete') {
      // Mark all phases in the roadmap range as complete
      const rangeMatch = row.phases.match(/(\d+[A-Z]).*?(\d+[A-Z])/);
      if (rangeMatch) {
        const prefix = rangeMatch[1].replace(/[A-Z]$/, '');
        const startLetter = rangeMatch[1].slice(-1);
        const endLetter = rangeMatch[2].slice(-1);
        for (
          let c = startLetter.charCodeAt(0);
          c <= endLetter.charCodeAt(0);
          c += 1
        ) {
          phaseStatusMap.set(
            `${prefix}${String.fromCharCode(c)}`,
            'Complete'
          );
        }
      }

      continue;
    }

    const featureStatuses = parseFeatureStatuses(content);

    for (const [phaseId, status] of featureStatuses) {
      // Don't override archive-confirmed completions
      if (phaseStatusMap.get(phaseId) === 'Complete') {
        continue;
      }

      phaseStatusMap.set(phaseId, status);
    }
  }

  return phaseStatusMap;
}

/**
 * Parse the roadmap Feature Status table.
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

    if (/^\|[\s-|]+\|$/.test(line.trim())) {
      headerPassed = true;
      continue;
    }

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

    rows.push({
      slug: cells[0].replace(/`/g, '').trim(),
      feature: cells[1].trim(),
      phases: cells[2].trim(),
      status: cells[3].trim(),
      currentPhase: cells[4].trim(),
    });
  }

  return rows;
}

/**
 * Map a Mermaid node ID to a phase ID (e.g., PA4H → 4H, A1A → 1A, PA4F1 → 4F.1, P0 → P0).
 * Sub-phases are encoded without dots in node IDs (PA4F1 = phase 4F.1).
 */
function nodeIdToPhaseId(nodeId) {
  if (nodeId === 'P0') {
    return 'P0';
  }

  // Match full sub-phase pattern: digits + letter + digit(s) at end (e.g. 4F1 → 4F.1)
  const subPhaseMatch = nodeId.match(/(\d+[A-Z])(\d+)$/);
  if (subPhaseMatch) {
    return `${subPhaseMatch[1]}.${subPhaseMatch[2]}`;
  }

  // Standard pattern: digits + letter (e.g. 4H → 4H)
  const match = nodeId.match(/(\d+[A-Z])$/);
  return match ? match[1] : nodeId;
}

async function main() {
  const validateOnly = hasFlag('--validate');
  const concise = hasFlag('--concise');

  const roadmapPath = path.join(ROOT_DIR, '.project', 'roadmap.md');
  const roadmapContent = await readFileIfExists(roadmapPath);

  if (!roadmapContent) {
    console.error('ERROR: .project/roadmap.md not found');
    process.exit(1);
  }

  const { nodes, edges } = parseMermaidGraph(roadmapContent);

  if (nodes.size === 0) {
    console.error('ERROR: No Mermaid graph found in roadmap.md');
    process.exit(1);
  }

  const roadmapRows = parseRoadmapStatusTable(roadmapContent);
  const issues = [];

  // === VALIDATION ===

  // 1. Check for cycles
  const cycle = detectCycle(edges, nodes);
  if (cycle) {
    const cycleLabels = cycle.map(
      (id) => `${id} [${nodes.get(id) || '?'}]`
    );
    issues.push(`CIRCULAR DEPENDENCY: ${cycleLabels.join(' → ')}`);
  }

  // 2. Check for orphan nodes
  const orphans = findOrphans(edges, nodes);
  for (const orphan of orphans) {
    issues.push(
      `ORPHAN NODE: ${orphan} [${nodes.get(orphan) || '?'}] — no incoming edges`
    );
  }

  // 3. Check that all graph nodes correspond to real phases in feature docs
  for (const [nodeId, label] of nodes) {
    if (nodeId === 'P0') {
      continue;
    }

    const slug = resolveSlugFromNodeId(nodeId);
    if (!slug) {
      issues.push(
        `UNKNOWN PREFIX: ${nodeId} [${label}] — cannot resolve to a feature slug`
      );
      continue;
    }

    const featureDocPath = path.join(
      ROOT_DIR,
      '.project',
      'features',
      `${slug}.md`
    );
    const featureContent = await readFileIfExists(featureDocPath);
    if (!featureContent) {
      issues.push(
        `MISSING FEATURE DOC: ${nodeId} [${label}] — .project/features/${slug}.md not found`
      );
    }
  }

  // === VALIDATION-ONLY OUTPUT ===

  if (validateOnly) {
    if (issues.length === 0) {
      console.log('Graph validation passed ✅');
      console.log(`  Nodes: ${nodes.size}`);
      console.log(`  Edges: ${edges.length}`);
      process.exit(0);
    }

    console.log('Graph validation FAILED ❌\n');
    for (const issue of issues) {
      console.error(`  ${issue}`);
    }

    process.exit(1);
  }

  // === FULL ANALYSIS ===

  // Build phase status map: nodeId → status
  const rawPhaseStatuses = await loadAllPhaseStatuses(roadmapRows);

  // Map node IDs to their phase statuses
  const nodeStatusMap = new Map();
  const untraceable = [];
  for (const [nodeId] of nodes) {
    const phaseId = nodeIdToPhaseId(nodeId);
    const resolved = rawPhaseStatuses.get(phaseId);
    if (resolved === undefined && nodeId !== 'P0') {
      // No status in any feature doc or archive record
      untraceable.push(`${nodeId} [${nodes.get(nodeId) || '?'}] — not found in any feature doc or archive record`);
    }
    nodeStatusMap.set(nodeId, resolved || 'Not Started');
  }

  // Build incoming edges map for dependency checking
  const incomingEdges = new Map();
  for (const nodeId of nodes.keys()) {
    incomingEdges.set(nodeId, []);
  }

  for (const { from, to } of edges) {
    if (incomingEdges.has(to)) {
      incomingEdges.get(to).push(from);
    }
  }

  // Classify phases
  const unblocked = [];
  const blocked = [];
  const inProgressPhases = [];

  for (const [nodeId, label] of nodes) {
    const status = nodeStatusMap.get(nodeId);

    if (status === 'Complete') {
      continue;
    }

    if (status === 'In Progress') {
      inProgressPhases.push({ nodeId, label });
      continue;
    }

    // Check if all dependencies are complete
    const deps = incomingEdges.get(nodeId) || [];
    const incompleteDeps = deps.filter(
      (d) => nodeStatusMap.get(d) !== 'Complete'
    );

    if (incompleteDeps.length === 0) {
      const completedDeps = deps.map(
        (d) => `${d} [${nodes.get(d) || '?'}]`
      );
      unblocked.push({ nodeId, label, completedDeps });
    } else {
      const waitingOn = incompleteDeps.map(
        (d) =>
          `${d} [${nodes.get(d) || '?'}] (${nodeStatusMap.get(d) || '?'})`
      );
      blocked.push({ nodeId, label, waitingOn });
    }
  }

  // Critical path
  const criticalPath = findCriticalPath(edges, nodes, nodeStatusMap);

  // Parallelizable: unblocked phases with no mutual dependency
  // --concise: cross-feature pairs only (default: all pairs)
  const parallelizable = [];
  for (let i = 0; i < unblocked.length; i += 1) {
    for (let j = i + 1; j < unblocked.length; j += 1) {
      const a = unblocked[i].nodeId;
      const b = unblocked[j].nodeId;
      const aDepOnB = edges.some(
        (e) => e.from === b && e.to === a
      );
      const bDepOnA = edges.some(
        (e) => e.from === a && e.to === b
      );

      if (!aDepOnB && !bDepOnA) {
        if (!concise || isCrossFeature(a, b)) {
          parallelizable.push([unblocked[i], unblocked[j]]);
        }
      }
    }
  }

  // === OUTPUT ===

  console.log('== DEPENDENCY ANALYSIS ==\n');

  if (issues.length > 0) {
    console.log('VALIDATION ISSUES:');
    for (const issue of issues) {
      console.log(`  ❌ ${issue}`);
    }
    console.log('');
  }

  if (untraceable.length > 0) {
    console.log('UNTRACEABLE NODES (no status in any feature doc or archive):');
    for (const item of untraceable) {
      console.log(`  ⚠️  ${item}`);
    }
    console.log('');
  }

  if (inProgressPhases.length > 0) {
    console.log('IN PROGRESS:');
    for (const { nodeId, label } of inProgressPhases) {
      console.log(`  🔨 ${nodeId}: ${label}`);
    }
    console.log('');
  }

  console.log('UNBLOCKED (ready to build):');
  if (unblocked.length === 0) {
    console.log('  (none)');
  } else {
    for (const { nodeId, label, completedDeps } of unblocked) {
      const depsStr =
        completedDeps.length > 0
          ? ` — deps met: ${completedDeps.join(', ')}`
          : ' — no dependencies';
      console.log(`  ✅ ${nodeId}: ${label}${depsStr}`);
    }
  }

  console.log('\nBLOCKED:');
  if (blocked.length === 0) {
    console.log('  (none)');
  } else {
    for (const { nodeId, label, waitingOn } of blocked) {
      console.log(
        `  🚫 ${nodeId}: ${label} — waiting on: ${waitingOn.join(', ')}`
      );
    }
  }

  console.log('\nCRITICAL PATH (longest remaining chain):');
  if (criticalPath.length === 0) {
    console.log('  (all phases complete)');
  } else {
    const pathLabels = criticalPath.map(
      (id) => `${id} [${nodes.get(id) || '?'}]`
    );
    console.log(`  ${pathLabels.join(' → ')}`);
    console.log(`  Length: ${criticalPath.length} phases`);
  }

  if (parallelizable.length > 0) {
    console.log('\nPARALLELIZABLE (no mutual dependencies):');
    for (const [a, b] of parallelizable) {
      console.log(`  ${a.nodeId} [${a.label}] ∥ ${b.nodeId} [${b.label}]`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
