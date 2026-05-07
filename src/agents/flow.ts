import { Page } from 'playwright';
import { Step, StepResult, Intent } from '../types';
import { resolve, captureFingerprint } from '../fingerprint';
import { MemoryAgent, stepKey } from './memory';
import { ObserveAgent } from './observe';
import { inferIntent } from '../goal-parser';

const ACTION_TIMEOUT_MS = 8000;

export class FlowAgent {
  constructor(
    private page: Page,
    private memory: MemoryAgent,
    private observe: ObserveAgent,
  ) {}

  async run(step: Step): Promise<StepResult> {
    const start = Date.now();
    const intent = step.intent ?? inferIntent(step.description);
    if (!intent) {
      return {
        description: step.description,
        status: 'fail',
        durationMs: Date.now() - start,
        error: `Could not parse intent from: "${step.description}". Try a clearer phrasing — see README for supported patterns.`,
      };
    }

    try {
      const result = await this.dispatch(step, intent);
      return { ...result, durationMs: Date.now() - start };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.memory.recordFailure(stepKey(step.description));
      return {
        description: step.description,
        status: 'fail',
        durationMs: Date.now() - start,
        error: message,
        evidence: {
          networkEvents: this.observe.recent(),
          consoleErrors: this.observe.errors(),
        },
      };
    }
  }

  private async dispatch(step: Step, intent: Intent): Promise<Omit<StepResult, 'durationMs'>> {
    const key = stepKey(step.description);

    switch (intent.kind) {
      case 'navigate':
        await this.page.goto(intent.url, { waitUntil: 'domcontentloaded', timeout: ACTION_TIMEOUT_MS * 2 });
        return { description: step.description, status: 'pass' };

      case 'click': {
        const fp = this.memory.get(key);
        const r = await resolve(this.page, intent.target, fp);
        if (!r) throw new Error(`Could not locate element matching "${intent.target}"`);
        await r.locator.click({ timeout: ACTION_TIMEOUT_MS });
        const newFp = await captureFingerprint(r.locator, intent.target, r.strategy, fp);
        this.memory.set(key, newFp);
        this.memory.recordSuccess(key, r.strategy);
        return { description: step.description, status: 'pass', strategyUsed: r.strategy };
      }

      case 'type': {
        const fp = this.memory.get(key);
        const r = await resolve(this.page, intent.target, fp);
        if (!r) throw new Error(`Could not locate input matching "${intent.target}"`);
        await r.locator.fill(intent.text, { timeout: ACTION_TIMEOUT_MS });
        const newFp = await captureFingerprint(r.locator, intent.target, r.strategy, fp);
        this.memory.set(key, newFp);
        this.memory.recordSuccess(key, r.strategy);
        return { description: step.description, status: 'pass', strategyUsed: r.strategy };
      }

      case 'submit': {
        if (intent.target) {
          const r = await resolve(this.page, intent.target);
          if (r) {
            await r.locator.click({ timeout: ACTION_TIMEOUT_MS });
            return { description: step.description, status: 'pass', strategyUsed: r.strategy };
          }
        }
        await this.page.keyboard.press('Enter');
        return { description: step.description, status: 'pass' };
      }

      case 'wait': {
        if (intent.ms) {
          await this.page.waitForTimeout(intent.ms);
        } else {
          await this.page.waitForLoadState('networkidle', { timeout: ACTION_TIMEOUT_MS });
        }
        return { description: step.description, status: 'pass' };
      }

      case 'assert_visible': {
        const r = await resolve(this.page, intent.target);
        if (!r) throw new Error(`Element "${intent.target}" not found on page`);
        const visible = await r.locator.isVisible({ timeout: ACTION_TIMEOUT_MS });
        if (!visible) throw new Error(`Element "${intent.target}" exists but is not visible`);
        return { description: step.description, status: 'pass', strategyUsed: r.strategy };
      }

      case 'assert_text_contains': {
        const r = await resolve(this.page, intent.target);
        if (!r) throw new Error(`Element "${intent.target}" not found`);
        const txt = (await r.locator.textContent({ timeout: ACTION_TIMEOUT_MS })) ?? '';
        if (!txt.toLowerCase().includes(intent.text.toLowerCase())) {
          throw new Error(`Expected "${intent.text}" inside "${intent.target}", got: "${txt.trim().slice(0, 100)}"`);
        }
        return { description: step.description, status: 'pass', strategyUsed: r.strategy };
      }

      case 'assert_url': {
        const url = this.page.url();
        if (!new RegExp(intent.pattern, 'i').test(url)) {
          throw new Error(`URL "${url}" does not match pattern "${intent.pattern}"`);
        }
        return { description: step.description, status: 'pass' };
      }

      case 'assert_network': {
        const events = this.observe.recent(50);
        const match = events.find(e =>
          e.method === intent.method &&
          new RegExp(intent.urlPattern, 'i').test(e.url) &&
          e.status === intent.status,
        );
        if (!match) {
          throw new Error(`No network call matched: ${intent.method} ${intent.urlPattern} → ${intent.status}`);
        }
        return { description: step.description, status: 'pass' };
      }
    }
  }
}
