# Mich Orion

**Goal-oriented agentic UI testing — built on Playwright, intelligence on top.**

Orion is a different kind of UI test runner. You don't write selectors. You don't write JavaScript. You describe what the app should *do*, and a small swarm of agents figures out how to verify it — and adapts as the app evolves.

The full product vision lives in [ORION.md](ORION.md). This README covers what's actually working in the v1 walking skeleton.

---

## What works in v0.1 (today)

- **Two test formats** — YAML or Gherkin-style natural language. No code.
- **Multi-strategy element resolution** — aria-label → role+name → label-for → placeholder → visible-text → DOM hint. The brittle DOM hint is the *last* resort, never the first.
- **File-backed memory** — every successful resolution is fingerprinted to `.orion/memory/<test>.json`. Future runs prefer the strategies that worked.
- **Network observation** — XHR/fetch traffic is recorded alongside each step for evidence.
- **Console error capture** — JS errors that fire near a failure are surfaced in the Failure Brief.
- **Failure Brief** — incident-style report instead of stack trace. Distinguishes app bugs from test drift. Uses Claude Sonnet if `ANTHROPIC_API_KEY` is set; falls back to a deterministic structured brief otherwise.
- **Flakiness detection** — after enough runs, recurring failure signatures are flagged.
- **CLI** — single binary, JUnit-style exit codes (0 pass, 1 fail, 2 fatal).

## What's not built yet (deliberately)

The vision in `ORION.md` describes a months-long platform. The walking skeleton is the irreducible core. The following are scoped for later:

- Visual model fallback (vision-based element matching)
- Browser extension recorder
- Visual workflow builder UI
- Self-healing diff confirmation flow
- Cloud parallel execution
- HTML report and JUnit XML output
- GitHub Action / CI integrations
- Cross-browser (Firefox/WebKit)
- Component testing

## Install

```powershell
npm install
npx playwright install chromium
```

## Run an example

```powershell
npm run test:example
```

That runs `examples/example-domain.orion.yaml`. Pass `--headed` to watch:

```powershell
npx tsx src/cli.ts run examples/example-domain.orion.yaml --headed
```

## Optional — wire up the LLM

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-..."
npm run test:example
```

When set, failure briefs are written by Claude Sonnet 4.6 with prompt caching. Without the key, you still get a useful structured brief — just not as fluent.

## Writing a test

**YAML form:**

```yaml
test: User can reset their password
url: https://your-app.com/login

steps:
  - "click the Forgot password link"
  - "type \"test@example.com\" into the email field"
  - "submit the form"
  - "I should see a confirmation message"
  - "url should contain reset-sent"
```

**Gherkin form:**

```gherkin
Test: User can reset their password
URL: https://your-app.com/login

When I click the Forgot password link
And I type "test@example.com" into the email field
And I submit the form
Then I should see a confirmation message
```

### Supported step phrasings

| Pattern | Becomes |
|---|---|
| `navigate to https://...` | `navigate` |
| `click the X button` / `click X` | `click` |
| `type "VALUE" into the X field` | `type` |
| `submit the form` / `press enter` | `submit` |
| `I should see X` / `X is visible` | `assert_visible` |
| `the X should contain "Y"` | `assert_text_contains` |
| `url should contain "Y"` | `assert_url` |
| `wait` / `wait 500ms` | `wait` |

If a phrasing doesn't parse, the step fails fast with a clear message. The grammar is intentionally narrow — wider parsing is the LLM's job in v0.2.

## Architecture

```
CLI ─▶ Goal Parser ─▶ Orchestrator
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
          Flow Agent   Memory Agent   Observe Agent
              │           │              │
              ▼           ▼              ▼
        Fingerprint   .orion/memory   Playwright events
        Resolver      (file-backed)   (network, console)
              │
              ▼
         Playwright
              │
              ▼
        On failure ─▶ Failure Brief Generator
                       (LLM if available, deterministic otherwise)
```

The discipline that matters most: **selectors are computed, not stored**. Memory holds aria-labels, visible text, roles — not CSS. When a class name changes, nothing breaks.

## Project layout

```
src/
  cli.ts                  CLI entry point
  goal-parser.ts          YAML + Gherkin → TestSpec; intent inference
  fingerprint.ts          Multi-strategy element resolution
  failure-brief.ts        LLM + offline failure brief generators
  llm.ts                  Anthropic SDK wrapper (with prompt caching)
  types.ts                Shared types
  agents/
    orchestrator.ts       Run lifecycle, Playwright launch
    flow.ts               Per-step execution (click/type/assert/...)
    observe.ts            Network + console observation
    memory.ts             File-backed fingerprint + run history

examples/
  example-domain.orion.yaml
  duck-search.orion.gherkin
```

## License


