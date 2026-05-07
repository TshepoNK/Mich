import { TestSpec, StepResult, NetworkEvent } from './types';
import { LLM_AVAILABLE, ask } from './llm';

const SYSTEM_PROMPT = `You write incident-style failure briefs for UI tests run by the Orion testing tool.

Rules:
- No stack traces, no line numbers, no jargon.
- Be concise, specific, and human-readable. A QA lead with no JavaScript knowledge should understand it.
- Distinguish between application bugs and test drift. Be explicit about your confidence.
- If console errors and a network failure coincide with the failed step, that strongly suggests an app bug.
- If the element simply could not be located but no errors fired, that suggests test drift or UI change.

Use this exact structure:

WHAT FAILED:
  <step number and description>

WHAT HAPPENED:
  <plain-language explanation>

LIKELY CAUSE:
  <app bug | test drift | environment | flakiness> — confidence: <low|medium|high>
  <one-line reasoning>

IMPACT ASSESSMENT:
  <how bad is this for users>

SUGGESTED NEXT STEP:
  <one concrete action>`;

export async function generateFailureBrief(
  spec: TestSpec,
  steps: StepResult[],
  evidence: { network: NetworkEvent[]; consoleErrors: string[] },
  flakinessNote: string | null,
): Promise<string> {
  const failed = steps.find(s => s.status === 'fail');
  if (!failed) return '';

  if (LLM_AVAILABLE) {
    try {
      const prompt = buildPrompt(spec, steps, failed, evidence, flakinessNote);
      const brief = await ask({
        system: SYSTEM_PROMPT,
        prompt,
        cacheSystem: true,
        maxTokens: 700,
      });
      return decorate(brief, spec.name, flakinessNote);
    } catch {
      return staticBrief(spec, steps, failed, evidence, flakinessNote);
    }
  }
  return staticBrief(spec, steps, failed, evidence, flakinessNote);
}

function buildPrompt(
  spec: TestSpec,
  steps: StepResult[],
  failed: StepResult,
  evidence: { network: NetworkEvent[]; consoleErrors: string[] },
  flakinessNote: string | null,
): string {
  const idx = steps.indexOf(failed);
  const lines = [
    `Test: ${spec.name}`,
    `Failed at step ${idx + 1} of ${steps.length}: "${failed.description}"`,
    `Error: ${failed.error}`,
    '',
    'Recent network activity (last 8):',
    ...evidence.network.slice(-8).map(e => `  ${e.method} ${e.url} → ${e.status ?? 'pending'}`),
    '',
    'Console errors:',
    ...(evidence.consoleErrors.length ? evidence.consoleErrors.slice(-5).map(e => `  - ${e}`) : ['  (none)']),
  ];
  if (flakinessNote) {
    lines.push('', 'Memory note:', `  ${flakinessNote}`);
  }
  return lines.join('\n');
}

function staticBrief(
  spec: TestSpec,
  steps: StepResult[],
  failed: StepResult,
  evidence: { network: NetworkEvent[]; consoleErrors: string[] },
  flakinessNote: string | null,
): string {
  const idx = steps.indexOf(failed);
  const hasConsoleErrors = evidence.consoleErrors.length > 0;
  const hasFailedNetwork = evidence.network.some(e => (e.status ?? 0) >= 400);

  const cause = hasConsoleErrors || hasFailedNetwork
    ? 'app bug — confidence: medium\n  JavaScript error or failed network call coincided with the test failure.'
    : 'test drift or UI change — confidence: medium\n  No app errors observed; the element simply could not be matched.';

  const lines = [
    bar(),
    `FAILURE BRIEF — ${spec.name}`,
    bar(),
    '',
    'WHAT FAILED:',
    `  Step ${idx + 1} of ${steps.length}: "${failed.description}"`,
    '',
    'WHAT HAPPENED:',
    `  ${failed.error ?? 'Unknown error'}`,
    '',
    'LIKELY CAUSE:',
    `  ${cause}`,
    '',
  ];

  if (hasConsoleErrors) {
    lines.push('CONSOLE ERRORS:');
    for (const e of evidence.consoleErrors.slice(-3)) lines.push(`  - ${e}`);
    lines.push('');
  }

  if (evidence.network.length > 0) {
    lines.push('RECENT NETWORK ACTIVITY:');
    for (const e of evidence.network.slice(-5)) {
      lines.push(`  ${e.method} ${e.url} → ${e.status ?? 'pending'}`);
    }
    lines.push('');
  }

  lines.push('IMPACT ASSESSMENT:');
  lines.push('  Run a manual check of the affected flow to confirm severity.');
  lines.push('');
  lines.push('SUGGESTED NEXT STEP:');
  lines.push(hasConsoleErrors
    ? '  Investigate the console errors above. If recent commits touched the implicated page, start there.'
    : '  Re-run the test in headed mode (--headed) to see the page state at the failure point.');

  if (flakinessNote) {
    lines.push('');
    lines.push('MEMORY NOTE:');
    lines.push(`  ${flakinessNote}`);
  }

  return lines.join('\n');
}

function decorate(brief: string, testName: string, flakinessNote: string | null): string {
  const out = [bar(), `FAILURE BRIEF — ${testName}`, bar(), '', brief.trim()];
  if (flakinessNote && !brief.includes('flak')) {
    out.push('', 'MEMORY NOTE:', `  ${flakinessNote}`);
  }
  return out.join('\n');
}

function bar(): string {
  return '━'.repeat(60);
}
