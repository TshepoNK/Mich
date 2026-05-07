import * as fs from 'fs';
import * as path from 'path';
import { ElementFingerprint, Strategy } from '../types';

const MEMORY_DIR = path.resolve(process.cwd(), '.orion', 'memory');

interface MemoryFile {
  testName: string;
  fingerprints: Record<string, ElementFingerprint>;
  runs: RunMemo[];
}

interface RunMemo {
  startedAt: string;
  passed: boolean;
  failedStep?: string;
  failureSignature?: string;
}

export class MemoryAgent {
  private readonly file: string;
  private data: MemoryFile;

  constructor(testName: string) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    this.file = path.join(MEMORY_DIR, `${slug(testName)}.json`);
    if (fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (!this.data.fingerprints) this.data.fingerprints = {};
        if (!this.data.runs) this.data.runs = [];
      } catch {
        this.data = { testName, fingerprints: {}, runs: [] };
      }
    } else {
      this.data = { testName, fingerprints: {}, runs: [] };
    }
  }

  get(stepKey: string): ElementFingerprint | undefined {
    return this.data.fingerprints[stepKey];
  }

  set(stepKey: string, fp: ElementFingerprint): void {
    this.data.fingerprints[stepKey] = fp;
  }

  recordSuccess(stepKey: string, strategy: Strategy): void {
    const fp = this.data.fingerprints[stepKey];
    if (!fp) return;
    const prev = fp.confidenceByStrategy[strategy] ?? 0.7;
    fp.confidenceByStrategy[strategy] = Math.min(0.99, prev + 0.05);
    fp.successCount += 1;
    fp.lastSeenAt = new Date().toISOString();
  }

  recordFailure(stepKey: string): void {
    const fp = this.data.fingerprints[stepKey];
    if (!fp) return;
    fp.failureCount += 1;
  }

  recordRun(memo: RunMemo): void {
    this.data.runs.push(memo);
    if (this.data.runs.length > 100) {
      this.data.runs = this.data.runs.slice(-100);
    }
  }

  detectFlakinessPattern(): string | null {
    const recent = this.data.runs.slice(-10);
    if (recent.length < 6) return null;
    const sigs = new Map<string, number>();
    for (const r of recent) {
      if (!r.passed && r.failureSignature) {
        sigs.set(r.failureSignature, (sigs.get(r.failureSignature) ?? 0) + 1);
      }
    }
    for (const [sig, count] of sigs) {
      if (count >= 3 && count < recent.length) {
        return `Recurring flakiness detected (${count}/${recent.length} recent runs): ${sig}`;
      }
    }
    return null;
  }

  flush(): void {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unnamed';
}

export function stepKey(description: string): string {
  return slug(description).slice(0, 80);
}
