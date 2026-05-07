import { Page, Locator } from 'playwright';
import { ElementFingerprint, Strategy } from './types';

export interface ResolveResult {
  locator: Locator;
  strategy: Strategy;
  confidence: number;
}

const VISIBILITY_TIMEOUT_MS = 1500;

export async function resolve(
  page: Page,
  hint: string,
  fp?: ElementFingerprint,
): Promise<ResolveResult | null> {
  const { name, role: inferredRole } = cleanHint(hint);
  const ariaLabel = fp?.ariaLabel ?? name;
  const visibleText = fp?.visibleText ?? name;
  const placeholder = fp?.placeholder ?? name;
  const role = fp?.role ?? inferredRole;

  const ordered = orderStrategies(fp);

  const hasName = name.length > 0;

  const builders: Record<Strategy, () => Locator | null> = {
    'aria-label': () => (hasName ? page.locator(`[aria-label="${escapeAttr(ariaLabel)}"]`) : null),
    'role+name': () => {
      if (!role) return null;
      return hasName
        ? page.getByRole(role as any, { name: visibleText, exact: false })
        : page.getByRole(role as any);
    },
    'label-for': () => (hasName ? page.getByLabel(visibleText, { exact: false }) : null),
    'placeholder': () => (hasName ? page.getByPlaceholder(placeholder, { exact: false }) : null),
    'visible-text': () => (hasName ? page.getByText(visibleText, { exact: false }) : null),
    'dom-hint': () => (fp?.domPathHint ? page.locator(fp.domPathHint) : null),
  };

  for (let i = 0; i < ordered.length; i++) {
    const strategy = ordered[i];
    const built = builders[strategy]?.();
    if (!built) continue;

    try {
      const count = await built.count();
      if (count === 0) continue;
      const first = built.first();
      const visible = await first
        .isVisible({ timeout: VISIBILITY_TIMEOUT_MS })
        .catch(() => false);
      if (visible || count === 1) {
        const baseConfidence = fp?.confidenceByStrategy?.[strategy] ?? (0.95 - i * 0.08);
        return {
          locator: first,
          strategy,
          confidence: Math.max(0.3, Math.min(0.99, baseConfidence)),
        };
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function captureFingerprint(
  loc: Locator,
  hint: string,
  strategy: Strategy,
  prior?: ElementFingerprint,
): Promise<ElementFingerprint> {
  const aria = await loc.getAttribute('aria-label').catch(() => null);
  const text = await loc.textContent().catch(() => null);
  const role = await loc.getAttribute('role').catch(() => null);
  const placeholder = await loc.getAttribute('placeholder').catch(() => null);

  const confidenceByStrategy = { ...(prior?.confidenceByStrategy ?? {}) };
  const prev = confidenceByStrategy[strategy] ?? 0.7;
  confidenceByStrategy[strategy] = Math.min(0.99, prev + 0.05);

  return {
    hint,
    ariaLabel: aria ?? prior?.ariaLabel,
    visibleText: text?.trim() || prior?.visibleText,
    role: role ?? prior?.role ?? cleanHint(hint).role,
    placeholder: placeholder ?? prior?.placeholder,
    domPathHint: prior?.domPathHint,
    confidenceByStrategy,
    lastSeenAt: new Date().toISOString(),
    successCount: (prior?.successCount ?? 0) + 1,
    failureCount: prior?.failureCount ?? 0,
  };
}

function orderStrategies(fp?: ElementFingerprint): Strategy[] {
  const all: Strategy[] = ['aria-label', 'role+name', 'label-for', 'placeholder', 'visible-text', 'dom-hint'];
  if (!fp || !fp.confidenceByStrategy) return all;
  return all.slice().sort((a, b) => {
    const ca = fp.confidenceByStrategy[a] ?? 0;
    const cb = fp.confidenceByStrategy[b] ?? 0;
    return cb - ca;
  });
}

const ROLE_WORDS = /^(button|link|field|input|textbox|menu|tab|checkbox|radio|option|listitem|heading|search|navigation|form|alert|banner|dialog|main)$/i;

function cleanHint(hint: string): { name: string; role?: string } {
  const trimmed = hint.replace(/^"|"$/g, '').trim();
  const m = trimmed.match(/^(.+?)\s+(button|link|field|input|textbox|menu|tab|checkbox|radio|option|listitem|heading|search|navigation|form|alert|banner|dialog|main)$/i);
  if (m) {
    const ctrl = m[2].toLowerCase();
    const role = ctrl === 'field' || ctrl === 'input' ? 'textbox' : ctrl;
    return { name: m[1].trim(), role };
  }
  if (ROLE_WORDS.test(trimmed)) {
    const ctrl = trimmed.toLowerCase();
    const role = ctrl === 'field' || ctrl === 'input' ? 'textbox' : ctrl;
    return { name: '', role };
  }
  return { name: trimmed };
}

function escapeAttr(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
