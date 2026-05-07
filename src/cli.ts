#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import { parseSpec } from './goal-parser';
import { runTest } from './agents/orchestrator';
import { LLM_AVAILABLE } from './llm';

const VERSION = '0.1.0';

function usage(): never {
  console.error('Mich Orion v' + VERSION);
  console.error('');
  console.error('Usage:');
  console.error('  orion run <spec-file> [--headed]');
  console.error('  orion --version');
  console.error('');
  console.error('Spec formats: .yaml, .yml, .gherkin, .feature');
  console.error('');
  console.error('Set ANTHROPIC_API_KEY for AI-powered failure briefs (optional).');
  process.exit(1);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0) usage();
  const cmd = argv[0];

  if (cmd === '--version' || cmd === '-v') {
    console.log('orion ' + VERSION);
    return;
  }

  if (cmd !== 'run') usage();

  const file = argv[1];
  if (!file) usage();
  const headed = argv.includes('--headed');

  const absPath = path.resolve(file);
  if (!fs.existsSync(absPath)) {
    console.error(`Spec file not found: ${absPath}`);
    process.exit(2);
  }

  const text = fs.readFileSync(absPath, 'utf8');
  const spec = parseSpec(text, path.basename(absPath));

  const banner = '━'.repeat(60);
  console.log(banner);
  console.log(`▶ Mich Orion v${VERSION}`);
  console.log(`  LLM:   ${LLM_AVAILABLE ? 'connected (Claude)' : 'offline — set ANTHROPIC_API_KEY for AI failure briefs'}`);
  console.log(`  Test:  ${spec.name}`);
  console.log(`  Steps: ${spec.steps.length}`);
  if (spec.url) console.log(`  URL:   ${spec.url}`);
  console.log(banner);
  console.log('');

  const result = await runTest(spec, { headless: !headed });

  for (let i = 0; i < result.steps.length; i++) {
    const s = result.steps[i];
    const icon = s.status === 'pass' ? '✓' : s.status === 'fail' ? '✗' : '·';
    const strat = s.strategyUsed ? ` [${s.strategyUsed}]` : '';
    const ms = String(s.durationMs).padStart(5, ' ');
    console.log(`  ${icon} ${ms}ms  ${s.description}${strat}`);
    if (s.error) console.log(`           → ${s.error}`);
  }

  // skipped steps when failure halted execution
  for (let i = result.steps.length; i < spec.steps.length; i++) {
    console.log(`  · skip   ${spec.steps[i].description}`);
  }

  console.log('');
  console.log(banner);
  console.log(result.passed ? `✓ PASSED in ${result.durationMs}ms` : `✗ FAILED in ${result.durationMs}ms`);
  console.log(banner);

  if (result.failureBrief) {
    console.log('');
    console.log(result.failureBrief);
  }

  process.exit(result.passed ? 0 : 1);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('orion: fatal error');
  console.error(`  ${msg}`);
  if (/Executable doesn't exist/i.test(msg) || /chromium/i.test(msg)) {
    console.error('');
    console.error('Hint: install Playwright browsers with `npx playwright install chromium`.');
  }
  process.exit(2);
});
