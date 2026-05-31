import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
} from '@playwright/test/reporter';

/**
 * Posts a compact run summary to a Slack channel via an Incoming Webhook.
 *
 *   ✅ Yotta automation — PASSED
 *   9 passed · 0 failed · 0 flaky · 0 skipped  (in 42.3s)
 *   <failed / flaky tests listed as bullet points>
 *   <repo · branch · run link, when in GitHub Actions>
 *
 * Configuration (all via env — nothing is committed):
 *   SLACK_WEBHOOK_URL  Incoming-webhook URL. When unset, this reporter is a
 *                      no-op, so it is safe to keep enabled locally and in CI.
 *   SLACK_NOTIFY_ON    'always' (default) posts on every run; 'failure' posts
 *                      only when there are failed or flaky tests.
 *
 * Mirrors `github-summary-reporter.ts`: only failed/flaky tests are itemised
 * (passing rows are summarised in the header) to keep the message readable.
 */
class SlackReporter implements Reporter {
  private rootSuite!: Suite;
  private startedAt = 0;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.rootSuite = suite;
    // Date.now is fine here — used only for an elapsed-time display.
    this.startedAt = Date.now();
  }

  async onEnd(_result: FullResult): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return; // No webhook configured → stay silent.

    const counts = { passed: 0, failed: 0, flaky: 0, skipped: 0 };
    const failures: string[] = [];

    for (const test of this.rootSuite.allTests()) {
      const title = this.titleOf(test);
      switch (test.outcome()) {
        case 'expected':
          counts.passed++;
          break;
        case 'unexpected':
          counts.failed++;
          failures.push(`❌ ${title}`);
          break;
        case 'flaky':
          counts.flaky++;
          failures.push(`⚠️ ${title} (flaky)`);
          break;
        case 'skipped':
          counts.skipped++;
          break;
      }
    }

    const notifyOn = (process.env.SLACK_NOTIFY_ON || 'always').toLowerCase();
    const hasProblems = counts.failed > 0 || counts.flaky > 0;
    if (notifyOn === 'failure' && !hasProblems) return;

    const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1);
    const message = this.buildMessage(counts, failures, elapsed);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(
          `[slack-reporter] Slack webhook returned ${res.status} ${res.statusText}: ${body}`,
        );
      }
    } catch (err) {
      // Never fail the run because a notification could not be delivered.
      console.error('[slack-reporter] Failed to post to Slack webhook:', err);
    }
  }

  /** Builds a Slack Block Kit payload. `text` is the notification fallback. */
  private buildMessage(
    counts: { passed: number; failed: number; flaky: number; skipped: number },
    failures: string[],
    elapsed: string,
  ): Record<string, unknown> {
    const overall =
      counts.failed > 0
        ? { emoji: '❌', label: 'FAILED' }
        : counts.flaky > 0
          ? { emoji: '⚠️', label: 'PASSED (flaky)' }
          : { emoji: '✅', label: 'PASSED' };

    const workflow = process.env.GITHUB_WORKFLOW || 'Playwright tests';
    const headline = `${overall.emoji} ${workflow} — ${overall.label}`;
    const tally =
      `*${counts.passed}* passed · *${counts.failed}* failed · ` +
      `*${counts.flaky}* flaky · *${counts.skipped}* skipped  (in ${elapsed}s)`;

    const blocks: Record<string, unknown>[] = [
      {
        type: 'header',
        text: { type: 'plain_text', text: headline, emoji: true },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: tally },
      },
    ];

    if (failures.length > 0) {
      // Slack section text caps at 3000 chars; trim defensively on big suites.
      const MAX = 12;
      const shown = failures.slice(0, MAX);
      if (failures.length > MAX) {
        shown.push(`…and ${failures.length - MAX} more`);
      }
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: shown.join('\n') },
      });
    }

    const context = this.contextLine();
    if (context) {
      blocks.push({
        type: 'context',
        elements: [{ type: 'mrkdwn', text: context }],
      });
    }

    return { text: `${headline} — ${this.plainTally(counts)}`, blocks };
  }

  /** GitHub Actions metadata as a single mrkdwn context line, when present. */
  private contextLine(): string {
    const repo = process.env.GITHUB_REPOSITORY;
    if (!repo) return ''; // Not in GitHub Actions (e.g. a local run).

    const server = process.env.GITHUB_SERVER_URL || 'https://github.com';
    const branch = process.env.GITHUB_REF_NAME;
    const sha = process.env.GITHUB_SHA;
    const runId = process.env.GITHUB_RUN_ID;

    const parts: string[] = [`*${repo}*`];
    if (branch) parts.push(`\`${branch}\``);
    if (sha) parts.push(`<${server}/${repo}/commit/${sha}|${sha.slice(0, 7)}>`);
    if (runId) {
      parts.push(`<${server}/${repo}/actions/runs/${runId}|View run>`);
    }
    return parts.join(' · ');
  }

  private plainTally(counts: {
    passed: number;
    failed: number;
    flaky: number;
    skipped: number;
  }): string {
    return (
      `${counts.passed} passed, ${counts.failed} failed, ` +
      `${counts.flaky} flaky, ${counts.skipped} skipped`
    );
  }

  /**
   * Builds a readable test label: `Describe › Test (project)`. Mirrors the
   * GitHub summary reporter so both surfaces label tests identically.
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

export default SlackReporter;
