#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|tsx)$/;
const TEST_ROOTS = ['client/src', 'server/src', 'shared/src'];

function collectTestFiles(dir) {
  const absoluteDir = path.join(ROOT_DIR, dir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTestFiles(relativePath));
      continue;
    }

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(relativePath.replaceAll('\\', '/'));
    }
  }

  return files;
}

function existingTestRoots() {
  return TEST_ROOTS.filter((dir) => {
    try {
      return statSync(path.join(ROOT_DIR, dir)).isDirectory();
    } catch {
      return false;
    }
  });
}

function runVitest(cwd, testPaths, label) {
  const vitestEntry = path.join(ROOT_DIR, 'node_modules', 'vitest', 'vitest.mjs');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [vitestEntry, 'run', '--reporter=json', ...testPaths], {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const stdout = [];
    const stderr = [];
    const heartbeat = setInterval(() => {
      console.log(`WAIT ${label}`);
    }, 10000);

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', (error) => {
      clearInterval(heartbeat);
      resolve({ error, status: 1, stdout: '', stderr: '' });
    });
    child.on('close', (status) => {
      clearInterval(heartbeat);
      resolve({
        error: null,
        status,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

function resolveTestCommand(file) {
  for (const workspace of ['client', 'server', 'shared']) {
    const prefix = `${workspace}/`;
    if (file.startsWith(prefix)) {
      return {
        cwd: path.join(ROOT_DIR, workspace),
        testPath: file.slice(prefix.length),
      };
    }
  }

  return { cwd: ROOT_DIR, testPath: file };
}

function parseJsonOutput(file, output) {
  try {
    return JSON.parse(output);
  } catch {
    console.log(`Failed to parse Vitest JSON for ${file}`);
    console.log(output.slice(0, 4000));
    process.exit(1);
  }
}

function printFailures(testResults) {
  for (const suite of testResults) {
    if (suite.status !== 'failed') continue;

    const shortName = suite.name.replace(ROOT_DIR, '.');
    console.log(`FILE: ${shortName}`);

    for (const assertion of suite.assertionResults ?? []) {
      if (assertion.status !== 'failed') continue;
      const ancestors = assertion.ancestorTitles ?? [];
      const testName =
        ancestors.length > 0 ? `${ancestors.join(' > ')} > ${assertion.title}` : assertion.title;
      console.log(`  FAIL: ${testName}`);
      for (const message of assertion.failureMessages ?? []) {
        console.log(
          message
            .trim()
            .split('\n')
            .map((line) => `    ${line}`)
            .join('\n'),
        );
      }
    }
  }
}

async function main() {
  const requestedFiles = process.argv.slice(2).map((file) => file.replaceAll('\\', '/'));
  const files =
    requestedFiles.length > 0
      ? requestedFiles
      : existingTestRoots().flatMap(collectTestFiles).sort();

  if (files.length === 0) {
    console.log('No test files found.');
    process.exit(1);
  }

  const totals = {
    suites: 0,
    passedSuites: 0,
    failedSuites: 0,
    tests: 0,
    passedTests: 0,
    failedTests: 0,
    skippedTests: 0,
  };

  const runs = requestedFiles.length > 0 ? files.map((file) => [file]) : compactRuns(files);

  for (const [index, runFiles] of runs.entries()) {
    const label =
      runFiles.length === 1
        ? runFiles[0]
        : `${workspaceName(runFiles[0])} (${runFiles.length} files)`;
    console.log(`RUN ${index + 1}/${runs.length} ${label}`);
    const { cwd, testPaths } = resolveRunCommand(runFiles);
    let result = await runVitest(cwd, testPaths, label);

    if ((result.stdout ?? '').trim().length === 0 && runFiles.length === 1) {
      console.log(`RETRY ${label}`);
      result = await runVitest(cwd, testPaths, label);
    }

    if (result.error) {
      console.log(`Failed to run Vitest for ${label}: ${result.error.message}`);
      process.exit(1);
    }

    const output = (result.stdout ?? '').trim();

    if (output.length === 0) {
      console.log(`No test output received for ${label}.`);
      if (result.stderr) console.log(result.stderr.slice(0, 4000));
      process.exit(result.status ?? 1);
    }

    const data = parseJsonOutput(label, output);
    totals.suites += data.numTotalTestSuites ?? 0;
    totals.passedSuites += data.numPassedTestSuites ?? 0;
    totals.failedSuites += data.numFailedTestSuites ?? 0;
    totals.tests += data.numTotalTests ?? 0;
    totals.passedTests += data.numPassedTests ?? 0;
    totals.failedTests += data.numFailedTests ?? 0;
    totals.skippedTests += data.numPendingTests ?? 0;

    if ((data.numFailedTests ?? 0) > 0 || result.status !== 0) {
      console.log(`--- FAILURES (${label}) ---`);
      printFailures(data.testResults ?? []);
      if (result.stderr) console.log(result.stderr.slice(0, 4000));
      process.exit(result.status ?? 1);
    }
  }

  console.log(
    `Suites: ${totals.passedSuites} passed, ${totals.failedSuites} failed (${totals.suites} total)`,
  );
  console.log(
    `Tests:  ${totals.passedTests} passed, ${totals.failedTests} failed, ${totals.skippedTests} skipped (${totals.tests} total)`,
  );
  console.log('All tests passed.');
}

function compactRuns(files) {
  const clientFiles = files.filter((file) => file.startsWith('client/'));
  const serverFiles = files.filter((file) => file.startsWith('server/'));
  const sharedFiles = files.filter((file) => file.startsWith('shared/'));
  return [clientFiles, ...serverFiles.map((file) => [file]), sharedFiles].filter(
    (runFiles) => runFiles.length > 0,
  );
}

function workspaceName(file) {
  return file.split('/')[0] ?? 'workspace';
}

function resolveRunCommand(files) {
  const firstWorkspace = workspaceName(files[0]);
  if (files.some((file) => workspaceName(file) !== firstWorkspace)) {
    return { cwd: ROOT_DIR, testPaths: files };
  }

  const cwd = path.join(ROOT_DIR, firstWorkspace);
  const prefix = `${firstWorkspace}/`;
  return {
    cwd,
    testPaths: files.map((file) => file.slice(prefix.length)),
  };
}

await main();
