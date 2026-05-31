import { appendFileSync } from 'node:fs';
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from '@playwright/test/reporter';

/**
 * Writes a compact run summary to the GitHub Actions job summary
 * (`$GITHUB_STEP_SUMMARY`), rendered as a "Run Playwright tests summary" card:
 *
 *   FAILED — 0 passed, 9 failed, 9 flaky, 0 skipped
 *   | Status | Test | Duration |
 *   | ...    | ...  | ...      |
 *
 * Only failed and flaky tests are listed (passing rows are summarised in the
 * header) to keep the table readable on large suites. Per-failure error
 * annotations come from Playwright's built-in `github` reporter.
 *
 * Outside CI (`GITHUB_STEP_SUMMARY` unset) this reporter does nothing, so it is
 * safe to keep enabled locally.
 */
class GitHubSummaryReporter implements Reporter {
  private rootSuite!: Suite;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
  }

  onEnd(_result: FullResult): void {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY;
    if (!summaryPath) return;

    const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    const rows: string[] = [];

    for (const test of this.rootSuite.allTests()) {
      const durationMs = test.results.reduce((sum, r) => sum + r.duration, 0);
      const duration = `${(durationMs / 1000).toFixed(1)}s`;
      const title = this.titleOf(test);

      switch (test.outcome()) {
        case 'expected':
          counts.passed++;
          break;
        case 'unexpected':
          counts.failed++;
          rows.push(`| ❌ Failed | ${escape(title)} | ${duration} |`);
          break;
        case 'flaky':
          counts.flaky++;
          rows.push(`| ⚠️ Flaky | ${escape(title)} | ${duration} |`);
          break;
        case 'skipped':
          counts.skipped++;
          break;
      }
    }

    const overall = counts.failed > 0 ? 'FAILED' : counts.flaky > 0 ? 'PASSED (flaky)' : 'PASSED';
    const headline =
      `### ${overall} — ${counts.passed} passed, ${counts.failed} failed, ` +
      `${counts.flaky} flaky, ${counts.skipped} skipped`;

    const lines = [headline, ''];
    if (rows.length > 0) {
      lines.push('| Status | Test | Duration |', '| :--- | :--- | ---: |', ...rows);
    } else {
      lines.push('✅ No failed or flaky tests.');
    }
    lines.push('');

    appendFileSync(summaryPath, lines.join('\n') + '\n');
  }

  /**
   * Builds a readable test label: `Describe › Test (project)`. `titlePath()`
   * yields `['', project?, file, ...describe, test]`; we locate the spec file
   * segment to split project (before it) from the describe/test path (after).
   */
  private titleOf(test: TestCase): string {
    const segments = test.titlePath().filter(Boolean);
    const fileIdx = segments.findIndex(
      (s) => /\.(spec|test)\.[tj]s$/.test(s) || s.includes('/'),
    );
    const projectName = fileIdx > 0 ? segments[fileIdx - 1] : '';
    const titleSegs = fileIdx >= 0 ? segments.slice(fileIdx + 1) : segments;
    const label = titleSegs.join(' › ');
    return projectName ? `${label} (${projectName})` : label;
  }
}

/** Keep pipe characters and newlines from breaking the markdown table. */
function escape(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export default GitHubSummaryReporter;
