import { chromium } from 'playwright';
import { TestSpec, RunResult, StepResult } from '../types';
import { FlowAgent } from './flow';
import { MemoryAgent, stepKey } from './memory';
import { ObserveAgent } from './observe';
import { generateFailureBrief } from '../failure-brief';

export interface RunOptions {
  headless?: boolean;
  baseUrl?: string;
}

export async function runTest(spec: TestSpec, opts: RunOptions = {}): Promise<RunResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();

  const browser = await chromium.launch({ headless: opts.headless ?? true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const memory = new MemoryAgent(spec.name);
  const observe = new ObserveAgent();
  observe.attach(page);
  const flow = new FlowAgent(page, memory, observe);

  const stepResults: StepResult[] = [];

  try {
    if (spec.url) {
      await page.goto(spec.url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    }

    for (const step of spec.steps) {
      const res = await flow.run(step);
      stepResults.push(res);
      if (res.status === 'fail') break;
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const passed = stepResults.length === spec.steps.length && stepResults.every(r => r.status === 'pass');
  const failed = stepResults.find(s => s.status === 'fail');

  memory.recordRun({
    startedAt,
    passed,
    failedStep: failed?.description,
    failureSignature: failed ? `${stepKey(failed.description)}:${(failed.error ?? '').slice(0, 60)}` : undefined,
  });

  let failureBrief: string | undefined;
  if (!passed) {
    const flakiness = memory.detectFlakinessPattern();
    failureBrief = await generateFailureBrief(spec, stepResults, observe.snapshot(), flakiness);
  }

  memory.flush();

  return {
    testName: spec.name,
    passed,
    steps: stepResults,
    startedAt,
    durationMs: Date.now() - start,
    failureBrief,
  };
}
