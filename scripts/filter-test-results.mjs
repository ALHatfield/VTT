#!/usr/bin/env node

/**
 * Filters vitest JSON reporter output to show only a summary line
 * and full failure details. Strips ANSI escape codes from messages.
 *
 * Usage: vitest run --reporter=json 2>/dev/null | node scripts/filter-test-results.mjs
 */

const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

function stripAnsi(text) {
  return text.replace(ANSI_REGEX, '');
}

async function main() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');

  if (raw.trim().length === 0) {
    console.log('No test output received.');
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // vitest may have printed non-JSON output on crash — pass it through
    console.log(stripAnsi(raw).slice(0, 2000));
    process.exit(1);
  }

  const {
    numTotalTests = 0,
    numPassedTests = 0,
    numFailedTests = 0,
    numPendingTests = 0,
    numTotalTestSuites = 0,
    numPassedTestSuites = 0,
    numFailedTestSuites = 0,
    testResults = [],
  } = data;

  console.log(
    `Suites: ${numPassedTestSuites} passed, ${numFailedTestSuites} failed (${numTotalTestSuites} total)`,
  );
  console.log(
    `Tests:  ${numPassedTests} passed, ${numFailedTests} failed, ${numPendingTests} skipped (${numTotalTests} total)`,
  );

  if (numFailedTests === 0) {
    console.log('All tests passed.');
    process.exit(0);
  }

  console.log('\n--- FAILURES ---\n');

  for (const suite of testResults) {
    if (suite.status !== 'failed') {
      continue;
    }

    const shortName = suite.name.replace(process.cwd(), '.');
    console.log(`FILE: ${shortName}`);

    const assertions = suite.assertionResults ?? [];

    for (const assertion of assertions) {
      if (assertion.status !== 'failed') {
        continue;
      }

      const ancestors = assertion.ancestorTitles ?? [];
      const testName =
        ancestors.length > 0
          ? `${ancestors.join(' > ')} > ${assertion.title}`
          : assertion.title;

      console.log(`  FAIL: ${testName}`);

      const messages = assertion.failureMessages ?? [];
      for (const msg of messages) {
        const clean = stripAnsi(msg).trim();
        // Indent each line of the failure message
        const indented = clean
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n');
        console.log(indented);
      }
    }

    console.log('');
  }

  process.exit(1);
}

main();
