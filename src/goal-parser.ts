import * as yaml from 'js-yaml';
import { TestSpec, Step, Intent } from './types';

export function parseSpec(text: string, filename: string): TestSpec {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return parseYaml(text);
  if (lower.endsWith('.gherkin') || lower.endsWith('.feature')) return parseGherkin(text);
  if (text.trim().startsWith('test:')) return parseYaml(text);
  return parseGherkin(text);
}

function parseYaml(text: string): TestSpec {
  const obj = yaml.load(text) as any;
  if (!obj || typeof obj !== 'object') throw new Error('Invalid test spec: expected an object');

  const name: string = obj.test ?? obj.name ?? 'Unnamed test';
  const url: string | undefined = obj.url;
  const stepsRaw: unknown[] = Array.isArray(obj.steps) ? obj.steps : [];

  const steps: Step[] = stepsRaw.map(raw => {
    if (typeof raw === 'string') {
      return { description: raw, intent: inferIntent(raw) ?? undefined };
    }
    if (raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      const desc = (r.description ?? r.intent ?? r.assert ?? r.action ?? JSON.stringify(r)) as string;
      if (typeof r.kind === 'string') {
        return { description: desc, intent: r as unknown as Intent };
      }
      return { description: desc, intent: inferIntent(desc) ?? undefined };
    }
    return { description: String(raw) };
  });

  return { name, url, steps };
}

function parseGherkin(text: string): TestSpec {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  let name = 'Unnamed test';
  let url: string | undefined;
  const steps: Step[] = [];

  for (const line of lines) {
    if (/^test:/i.test(line)) {
      name = line.replace(/^test:\s*/i, '').trim();
      continue;
    }
    if (/^url:/i.test(line)) {
      url = line.replace(/^url:\s*/i, '').trim();
      continue;
    }
    if (/^(given|when|then|and|but)\b/i.test(line)) {
      const desc = line.replace(/^(given|when|then|and|but)\s+/i, '');
      steps.push({ description: desc, intent: inferIntent(desc) ?? undefined });
    }
  }

  return { name, url, steps };
}

export function inferIntent(desc: string): Intent | null {
  const trimmed = desc.trim();

  let m = trimmed.match(/^(?:i\s+)?(?:navigate|go|open|visit)\s+(?:to\s+)?(\S+)/i);
  if (m && /^https?:\/\//i.test(m[1])) return { kind: 'navigate', url: m[1] };

  m = trimmed.match(/^(?:i\s+)?(?:type|enter|fill(?:\s+in)?|input)\s+"([^"]+)"\s+(?:into|in|to)\s+(?:the\s+)?(.+?)(?:\s+(?:field|input|box))?$/i);
  if (m) return { kind: 'type', text: m[1], target: cleanTarget(m[2]) };

  m = trimmed.match(/^(?:i\s+)?(?:type|enter|fill(?:\s+in)?|input)\s+(?:my\s+|the\s+)?(.+?)\s+(?:as|with|=)\s+"([^"]+)"$/i);
  if (m) return { kind: 'type', target: cleanTarget(m[1]), text: m[2] };

  m = trimmed.match(/^(?:i\s+)?(?:enter|provide|use)\s+(?:my\s+|the\s+)?(?:email(?:\s+address)?|email)\s+"([^"]+)"/i);
  if (m) return { kind: 'type', target: 'email', text: m[1] };

  if (/^(?:i\s+)?(?:submit(?:\s+the\s+form)?|press\s+enter)$/i.test(trimmed)) {
    return { kind: 'submit' };
  }

  m = trimmed.match(/^(?:i\s+)?(?:click|press|tap|select|choose)\s+(?:on\s+)?(.+)$/i);
  if (m) return { kind: 'click', target: cleanTarget(m[1]) };

  m = trimmed.match(/^(?:the\s+)?url\s+(?:should\s+)?(?:contains?|includes?|matches?)\s+"?([^"]+)"?$/i);
  if (m) return { kind: 'assert_url', pattern: m[1].trim() };

  m = trimmed.match(/^(?:i\s+)?(?:should\s+see|see|am\s+on(?:\s+the)?)\s+(?:the\s+)?(.+?)(?:\s+(?:page|screen|view))?$/i);
  if (m) return { kind: 'assert_visible', target: cleanTarget(m[1]) };

  m = trimmed.match(/^(?:the\s+)?(.+?)\s+(?:is|should\s+be)\s+visible$/i);
  if (m) return { kind: 'assert_visible', target: cleanTarget(m[1]) };

  m = trimmed.match(/^(?:the\s+)?(.+?)\s+(?:should\s+contain|contains?)\s+"([^"]+)"$/i);
  if (m) return { kind: 'assert_text_contains', target: cleanTarget(m[1]), text: m[2] };

  m = trimmed.match(/^wait(?:\s+(\d+)\s*(?:ms|s)?)?$/i);
  if (m) return { kind: 'wait', ms: m[1] ? Number(m[1]) : undefined };

  return null;
}

function cleanTarget(raw: string): string {
  return raw.replace(/^the\s+/i, '').replace(/\s+$/g, '').trim();
}
