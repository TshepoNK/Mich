export type Intent =
  | { kind: 'navigate'; url: string }
  | { kind: 'click'; target: string }
  | { kind: 'type'; target: string; text: string }
  | { kind: 'submit'; target?: string }
  | { kind: 'wait'; ms?: number }
  | { kind: 'assert_visible'; target: string }
  | { kind: 'assert_text_contains'; target: string; text: string }
  | { kind: 'assert_url'; pattern: string }
  | { kind: 'assert_network'; method: string; urlPattern: string; status: number };

export interface TestSpec {
  name: string;
  url?: string;
  steps: Step[];
}

export interface Step {
  description: string;
  intent?: Intent;
}

export type Strategy =
  | 'aria-label'
  | 'role+name'
  | 'label-for'
  | 'placeholder'
  | 'visible-text'
  | 'dom-hint';

export interface ElementFingerprint {
  hint: string;
  ariaLabel?: string;
  visibleText?: string;
  role?: string;
  placeholder?: string;
  domPathHint?: string;
  confidenceByStrategy: Partial<Record<Strategy, number>>;
  lastSeenAt: string;
  successCount: number;
  failureCount: number;
}

export interface NetworkEvent {
  method: string;
  url: string;
  status?: number;
  timestamp: number;
}

export interface StepResult {
  description: string;
  status: 'pass' | 'fail' | 'skipped';
  strategyUsed?: Strategy;
  durationMs: number;
  error?: string;
  evidence?: {
    networkEvents?: NetworkEvent[];
    consoleErrors?: string[];
    screenshotPath?: string;
  };
}

export interface RunResult {
  testName: string;
  passed: boolean;
  steps: StepResult[];
  startedAt: string;
  durationMs: number;
  failureBrief?: string;
}
