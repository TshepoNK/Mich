import { Page, Response } from 'playwright';
import { NetworkEvent } from '../types';

export class ObserveAgent {
  private events: NetworkEvent[] = [];
  private consoleErrors: string[] = [];

  attach(page: Page): void {
    page.on('response', (resp: Response) => {
      const req = resp.request();
      if (!isInterestingRequest(req.url(), req.resourceType())) return;
      this.events.push({
        method: req.method(),
        url: req.url(),
        status: resp.status(),
        timestamp: Date.now(),
      });
      if (this.events.length > 200) this.events = this.events.slice(-200);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
        if (this.consoleErrors.length > 50) this.consoleErrors = this.consoleErrors.slice(-50);
      }
    });
    page.on('pageerror', err => {
      this.consoleErrors.push(err.message);
    });
  }

  recent(n = 10): NetworkEvent[] {
    return this.events.slice(-n);
  }

  errors(): string[] {
    return [...this.consoleErrors];
  }

  snapshot(): { network: NetworkEvent[]; consoleErrors: string[] } {
    return { network: [...this.events], consoleErrors: [...this.consoleErrors] };
  }
}

function isInterestingRequest(url: string, resourceType: string): boolean {
  if (resourceType === 'xhr' || resourceType === 'fetch') return true;
  if (/\/api\/|\.json($|\?)|graphql/i.test(url)) return true;
  return false;
}
