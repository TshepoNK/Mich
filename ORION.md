# ORION — The Autonomous UI Testing Platform

*Designed to make every tester as powerful as a senior SDET*

---

## 1. PROBLEM ANALYSIS

### Top 10 Pain Points of Playwright & Cypress Today

**Pain Point 1 — Selector Brittleness**
Both tools rely on CSS selectors, XPath, or `data-testid` attributes. When a frontend developer renames a class, restructures a component, or a design system updates, selectors break silently or loudly. A single design sprint can invalidate hundreds of test files. The SDET then spends days in "selector archaeology" — reading DOM diffs to find what moved.

**Pain Point 2 — High Floor, Low Ceiling for Non-Coders**
Playwright requires TypeScript/JavaScript fluency: async/await, fixtures, page object models, configuration files. Cypress has better DX but still requires JavaScript. A manual QA tester with 8 years of domain knowledge who can't write arrow functions is a second-class citizen. The tool excludes its most valuable users.

**Pain Point 3 — Test Authoring Is Expensive and Slow**
Writing a complete, reliable test for a checkout flow in Playwright takes an experienced engineer 2–4 hours. Recording tools (Playwright Codegen, Cypress Studio) generate brittle, unreadable code with hardcoded waits and fragile selectors. They're useful for 10 minutes and broken for 6 months.

**Pain Point 4 — Flakiness Is a System-Level Problem With No System-Level Solution**
Both tools offer `retry()`, `waitFor()`, and polling utilities — but these are band-aids. Flakiness from race conditions, animation timing, network variability, and third-party scripts is endemic. Teams routinely disable flaky tests rather than fix them, creating a false safety net. Playwright's trace viewer helps diagnosis but doesn't prevent recurrence.

**Pain Point 5 — Parallel Execution Is Complex to Configure**
Playwright's workers and Cypress's parallelization (paid Cloud feature) require infrastructure knowledge: worker counts, shard config, CI matrix setup. A QA team without a DevOps ally cannot realistically achieve fast parallel execution.

**Pain Point 6 — Test Maintenance Cost Is Proportional to App Velocity**
The faster the team ships, the more tests break. At scale (500+ tests, weekly releases), maintenance consumes 30–50% of automation engineering time. This defeats the purpose of automation. Neither tool has a structural answer — they offer better APIs, not fewer maintenance hours.

**Pain Point 7 — No Understanding of Business Intent**
Playwright and Cypress know nothing about what a test *means*. A test failure is a line number and a stack trace. Did the user flow break? Did a payment fail? Did a regulatory step get skipped? The tools cannot distinguish a cosmetic regression from a critical business logic failure.

**Pain Point 8 — Visual Testing Is a Paid Add-On Afterthought**
Pixel-diff screenshots (Percy, Applitools) require separate tooling, accounts, and integration work. They also generate excessive false positives from font rendering differences, animation states, and platform variations. Visual confidence is not native to either tool.

**Pain Point 9 — No Memory Between Test Runs**
Each test run is stateless. The tools cannot learn that `#submit-btn` flakes on Tuesdays because the production ad script loads slowly, or that the `/checkout` route has been flaky for 3 sprints in a row. There is no institutional memory — each failure is treated as novel.

**Pain Point 10 — Debugging Requires Expert Knowledge**
Reading a Playwright trace, understanding network waterfalls, correlating console errors to test failures — this is expert-level work. A mid-level QA engineer handed a failing trace file is often helpless. Cypress's time-travel UI is better but still requires knowing *what to look for*.

### Who Suffers Most and Why

| User | Primary Pain |
|---|---|
| Manual QA testers transitioning to automation | High floor — JavaScript requirement is a blocker |
| SDET teams at fast-moving startups | Maintenance cost destroys ROI within 3 months |
| QA leads at enterprises | Cannot demonstrate consistent value when 30% of tests are flaky |
| Offshore/outsourced QA teams | Documentation gap — tests as code are hard to review for business logic |
| Accessibility/compliance testers | No built-in semantic understanding; everything requires custom scripting |

### Problems Traditional Automation Can Never Fully Solve

1. **Semantic drift** — When a button label changes from "Proceed to Checkout" to "Continue", a traditional test breaks. It cannot understand that the *intent* is identical.
2. **Dynamic, generative UI** — AI-generated content, personalization engines, and feature flags mean the UI is never the same twice. Deterministic selectors are structurally incompatible with non-deterministic UIs.
3. **Intent verification** — "Did the user successfully complete the goal?" is a different question than "Did element X exist?" Traditional tools only answer the latter.
4. **Proactive test generation** — Traditional tools cannot watch a developer's PR and generate tests for new flows without a human writing them first.

---

## 2. CORE VISION

### One-Sentence Product Vision
> Orion turns your application's goals into living tests that write, heal, and explain themselves — so QA teams can focus on judgment, not code.

### Elevator Pitch (Non-Technical)
> "You know how a great QA engineer knows your app so well they can spot what's wrong just by looking at it? Orion does that — but for every screen, every flow, every release. You describe what your app is supposed to do in plain English. Orion watches the app, tests it, fixes its own tests when the app changes, and tells you in plain language when something is actually broken — not just when a CSS class changed."

### What Makes This Fundamentally Different

Most "AI testing tools" add AI as a feature layer: an AI that generates a Playwright script, or an AI that explains a failure. That is AI as a productivity tool.

Orion treats AI as the **execution engine**. The test is the *goal*, not the script. A script is an artifact the system produces and discards as needed. The agent pursues the goal using whatever observational strategy works — DOM inspection, visual understanding, network analysis, semantic reasoning — and adapts in real time.

The difference is this: in Playwright, a broken selector means a broken test. In Orion, a broken selector means the agent tries three other strategies, succeeds, updates its strategy map, and files a low-priority notice that the old selector is gone.

---

## 3. AI + AGENTIC ARCHITECTURE

### Agent Model Overview

Orion uses a multi-agent architecture with three distinct agent tiers:

```
┌─────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                    │
│  Receives: Test goal + app context                      │
│  Produces: Execution plan, agent assignments, priority  │
└──────────────────┬──────────────────────────────────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│  FLOW    │ │ ASSERT   │ │ OBSERVE  │
│  AGENT   │ │  AGENT   │ │  AGENT   │
│          │ │          │ │          │
│ Navigates│ │ Verifies │ │ Monitors │
│ the UI   │ │ outcomes │ │ network, │
│ to reach │ │ against  │ │ console, │
│ goal     │ │ intent   │ │ perf     │
└──────────┘ └──────────┘ └──────────┘
       │           │           │
       └───────────┼───────────┘
                   ▼
        ┌──────────────────┐
        │   MEMORY AGENT   │
        │ Stores: selectors │
        │ learned, failure  │
        │ patterns, timing  │
        │ heuristics        │
        └──────────────────┘
```

### What Goals Do Agents Receive?

Goals are expressed at three levels:

**Level 1 — Business Goal (human-written):**
```
Goal: "A new user can register, verify their email, and purchase a carbon credit"
Success: User account exists in system, order confirmed, email receipt sent
```

**Level 2 — Flow Goal (orchestrator-derived):**
```
Sub-goal 1: Navigate to registration page
Sub-goal 2: Complete form with valid data
Sub-goal 3: Receive and click verification email link
Sub-goal 4: Browse and select carbon credit product
Sub-goal 5: Complete checkout with test payment
```

**Level 3 — Action Goal (flow agent-derived):**
```
Micro-goal: Locate email input and enter value
Strategy priority: [semantic-label, aria-role, visual-position, placeholder-text, DOM-structure]
```

Agents never receive CSS selectors as input. They receive *intent*.

### How Agents Observe the Application

Orion's agents use a **layered observation model**:

**Layer 1 — Semantic DOM Analysis**
The agent reads the accessibility tree (not raw DOM) first. ARIA roles, labels, and descriptions provide intent-rich signals. A button with `aria-label="Add to cart"` is understood semantically, not positionally.

**Layer 2 — Visual Model**
A lightweight vision model (fine-tuned on UI patterns) processes screenshots to identify interactive regions, form fields, navigation landmarks, and state changes. This is the fallback when DOM semantics are poor (common in legacy enterprise apps).

**Layer 3 — Network Observation**
The Observe Agent watches XHR/fetch calls. It knows that after clicking "Submit Order", a `POST /api/orders` with `201` means success — even if the UI shows a loading spinner for 3 seconds. This eliminates timing-based flakiness for data-driven assertions.

**Layer 4 — Intent Memory**
The Memory Agent stores a graph of: `{goal} → {strategy that worked} → {confidence score}`. Over time, agents stop trying low-confidence strategies first. The system *learns* your application's quirks.

### How Agents Recover From Failures Autonomously

**Scenario: A selector breaks because a developer refactored a component.**

Traditional tool behavior: Test fails at line 47. CI turns red. Engineer investigates.

Orion agent behavior:
```
Step 1: Primary strategy failed (CSS selector `.checkout-btn` not found)
Step 2: Agent escalates to visual strategy — locates button-shaped element
        in expected screen region with text "Complete Purchase"
Step 3: Action succeeds
Step 4: Memory Agent logs: `.checkout-btn` is stale, visual+text strategy
        confidence=0.97
Step 5: Orchestrator queues low-priority notice: "Selector update recommended"
Step 6: Test passes. CI stays green.
```

**Scenario: A race condition causes an intermittent failure.**

```
Step 1: Flow Agent clicks "Submit" — assertion fails (element not visible yet)
Step 2: Observe Agent notes: network request still in-flight (XHR pending)
Step 3: Flow Agent applies intelligent wait: waits for network idle on
        /api/checkout endpoint
Step 4: Assertion succeeds
Step 5: Memory Agent records: this flow requires network-aware wait,
        not time-based wait
Step 6: Future runs skip the initial timeout entirely
```

---

## 4. TEST AUTHORING EXPERIENCE

### Method A — Natural Language

A tester opens Orion's test editor and types:

```
Test: User can reset their password

Given I am on the login page
When I click "Forgot password"
And I enter my email address "test@example.com"
And I submit the form
Then I should see a confirmation message
And I should receive a reset email within 30 seconds
```

Orion's authoring agent:
1. Parses the intent of each step
2. Maps steps to executable sub-goals
3. Runs the test live against the app in a sandboxed browser
4. Records the successful execution path as a *verified* test
5. Stores the semantic test + the execution evidence

The tester never sees a line of JavaScript.

**Before (Playwright equivalent):**
```typescript
test('user can reset password', async ({ page }) => {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('[data-testid="forgot-password-link"]').click();
  await page.waitForURL('**/forgot-password');
  await page.locator('#email-input').fill('test@example.com');
  await page.locator('[type="submit"]').click();
  await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });
  // Email verification requires external API call — not implemented
});
```

**After (Orion):**
```
Test: User can reset their password
→ Navigate to login
→ Click forgot password link
→ Enter email: test@example.com
→ Submit form
→ Assert: confirmation message visible
→ Assert: reset email received (integrated with Mailosaur/Mailtrap)
```

### Method B — Assisted UI Recording (Smart Recorder)

The tester clicks "Record" in the Orion browser extension. They perform the flow manually. But unlike Playwright Codegen:

- **The recorder captures *intent*, not implementation.** When you click a button, it records "clicked the Add to Cart button", not `page.click('#btn-atc-7f3a')`.
- **The recorder asks clarifying questions in real time:** "I see you filled in a form — should I use this exact value or mark this as dynamic test data?"
- **The recorder annotates assertions:** After each meaningful action, it shows a sidebar: "Should I assert that this toast message appeared? Should I assert the cart count changed?"
- **The recorder produces a readable test spec**, not code:

```yaml
test: Add item to cart
steps:
  - action: navigate
    url: /products
  - action: click
    target: "First product listing"
    intent: open_product
  - action: click
    target: "Add to Cart button"
    intent: add_to_cart
  - assert:
    type: element_visible
    target: "Cart updated notification"
  - assert:
    type: count_changed
    target: "Cart item count"
    expected_delta: +1
```

### Method C — Zero-Code Workflow Builder

For testers who are more comfortable with structured workflows than prose, Orion offers a visual canvas:

```
[Start] → [Open URL: /checkout] → [Fill Form: {test_data.user}]
       → [Click: Submit Order] → [Branch: Success/Error]
                                      ↓              ↓
                               [Assert: order   [Capture: error
                                confirmation]    details, fail]
```

Each node is configured via dropdowns and inputs — no code. Test data is referenced from a YAML/CSV store or generated by an AI data generator ("Generate: realistic US address"). Conditions use plain language operators: "if the page contains", "if the URL includes", "if network returned error".

---

## 5. SELF-HEALING & INTELLIGENCE

### How Selectors Become Irrelevant

Orion stores a **multi-modal element fingerprint** — not a selector. For a given interactive element, it stores:

```json
{
  "element_id": "checkout-submit",
  "fingerprint": {
    "aria_label": "Complete purchase",
    "visible_text": "Complete Purchase",
    "role": "button",
    "screen_region": "bottom-right-form",
    "visual_hash": "a3f7...",
    "dom_path_hint": "form > .actions > button:last-child",
    "network_trigger": "POST /api/orders",
    "confidence_scores": {
      "aria_label": 0.99,
      "visible_text": 0.97,
      "screen_region": 0.71,
      "dom_path_hint": 0.43
    }
  }
}
```

When a test runs, the agent tries strategies in confidence order. The DOM path hint — the fragile part — is the **last resort**, not the first.

### How Tests Evolve as the App Evolves

Orion maintains a **test genome** — a representation of what the test *intends* to verify, separate from how it currently executes. When the app changes:

1. **Silent healing** — Element moved, relabeled, or restructured but functionally equivalent. Agent heals silently, logs the change, confidence > 0.85.
2. **Assisted healing** — Ambiguous change. Agent presents: "The checkout flow changed. I found 2 possible matches for the 'Submit Order' step. Please confirm which is correct." Tester clicks one. Test updates. Confidence restored.
3. **Breaking change alert** — The flow fundamentally changed. The agent cannot find a confident path. It flags this as a **potential functional regression**, not just a test failure. The tester investigates with full context.

### How the System Learns From Previous Runs

Orion's Memory Agent builds a **run graph** per test over time:

```
Run #47: Flaked on step 3 (network timeout) — environment: CI, time: 14:32 UTC
Run #48: Passed
Run #49: Flaked on step 3 (network timeout) — environment: CI, time: 14:31 UTC
Run #50: Passed
```

Pattern detected: Step 3 flakes in CI at ~14:30 UTC. Likely cause: scheduled job contending for database. Agent adds a conditional wait strategy specifically for CI runs during this window, and files a notice to the team: "Recurring flakiness detected — possible infrastructure contention. Occurs on CI only, ~2:30 PM UTC."

This is institutional memory — the kind that currently lives in a Slack message from 6 months ago that nobody can find.

---

## 6. EXECUTION & DEBUGGING

### How Failures Are Explained

When a test fails, Orion does not show a stack trace. It shows a **Failure Brief** — structured like an incident report:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FAILURE BRIEF — Test: User Checkout Flow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WHAT FAILED:
  Step 4 of 7: "Order confirmation message should appear"

WHAT HAPPENED:
  The checkout form was submitted successfully (POST /api/orders → 201 OK).
  However, the confirmation message never appeared on screen.
  A JavaScript error occurred 240ms after submission:
  "TypeError: Cannot read properties of undefined (reading 'orderId')"
  in file: checkout-confirmation.component.js:84

WHY THIS IS LIKELY A BUG (not a test issue):
  The API returned a valid order object. The UI code failed to read it.
  This is consistent with a frontend regression, not a test configuration error.

IMPACT ASSESSMENT:
  Critical — This breaks the primary purchase flow for all users.

SUGGESTED NEXT STEP:
  Check recent changes to checkout-confirmation.component.js
  Last modified: 2 hours ago by @dev.sarah (PR #847)

SIMILAR PAST FAILURES:
  This exact error pattern occurred on 2025-11-14 (resolved in PR #712)
```

No stack traces. No line numbers. Human-readable, actionable, contextualized.

### How the Tool Auto-Suggests Fixes

For *test* failures (as opposed to app bugs), Orion suggests specific remedies:

```
SUGGESTED FIX:
  The "Add to Cart" button element fingerprint has degraded.
  Primary strategy (aria-label) no longer matches — label changed from
  "Add to cart" to "Add to bag".

  Options:
  [1] Accept: Update fingerprint to use new label "Add to bag" (recommended)
  [2] Investigate: Review if this label change was intentional
  [3] Flag: Mark as potential UX regression for team review
```

For flakiness:
```
SUGGESTED FIX:
  This step has failed 3/10 times this week due to timing.

  Root cause: The "Confirm" button appears before the form
  validation API call completes.

  Options:
  [1] Apply network-aware wait (wait for POST /api/validate → 200)
  [2] Apply element-stability wait (wait until button is not disabled)
  [3] Apply both (maximum stability)

  [Apply Fix Automatically]
```

### How Testers Replay, Edit, or Regenerate Tests

**Replay Mode:** Every test run records a full session: video, DOM snapshots at each step, network log, console log, visual diff. The tester can scrub through the timeline at the *business step* level, not frame-by-frame. "Jump to step: Submit Order."

**Edit Mode:** The tester clicks any step in the visual test spec and edits it in natural language: "Change this to use the mobile viewport" or "Add an assertion that the price didn't change." Orion regenerates only the affected steps.

**Regenerate Mode:** If a test is fundamentally broken (the flow no longer exists), the tester clicks "Regenerate". Orion runs the app, re-discovers the flow using its goal definition, and proposes a new test path: "I found a new path to complete this goal. Here's what changed: [diff view]."

---

## 7. INTEGRATION STRATEGY

### How It Uses Playwright Under the Hood

Orion uses **Playwright as its browser execution substrate** — not as its API surface. Specifically:

- Playwright handles: browser launch, CDP connection, page navigation, input dispatch, screenshot capture, network interception
- Orion handles: everything above Playwright's `Page` object — goal decomposition, element resolution, assertion semantics, failure analysis, memory

This is a deliberate abstraction. Playwright is excellent infrastructure. It's the *authoring model* and *intelligence layer* where Playwright falls short. Orion fixes that layer without rewriting browser automation primitives.

Orion also exposes an **escape hatch**: any step can include a raw Playwright script block for teams who need it. Power users aren't locked out. New users never need it.

### CI/CD Compatibility

```yaml
# GitHub Actions example
- name: Run Orion Tests
  uses: orion-testing/orion-action@v2
  with:
    goal-file: tests/orion-goals.yaml
    environment: staging
    fail-on: critical-only     # Don't fail CI for cosmetic issues
    healing-mode: auto         # Auto-heal selectors, report changes
    notify: slack              # Post failure briefs to Slack
```

Orion produces:
- JUnit XML (compatible with all CI dashboards)
- Orion HTML report (rich, visual, shareable)
- JSON test results (for custom dashboards)
- GitHub PR annotations (inline failure comments on changed files)

CI integration philosophy: **green means green**. Orion distinguishes between app regressions (block the pipeline) and test drift (notify but don't block). Teams stop ignoring red CI because CI red always means something real.

### Browser and Cloud Execution Strategy

**Local execution:** Chromium (Playwright-bundled) by default. Firefox and WebKit available.

**Cloud execution:** Orion Cloud provides:
- Parallel execution across N workers (zero configuration — specify a count)
- Geographic distribution for latency testing
- Real mobile devices (via BrowserStack/LambdaTest integration under the hood)
- Session isolation per run (no shared state contamination)

**On-premise:** Docker container with pre-configured Orion agent, Playwright browsers, and local memory store. Air-gapped enterprise deployments supported.

---

## 8. DIFFERENTIATION TABLE

| Capability | **Orion** | **Playwright** | **Cypress** |
|---|---|---|---|
| **Ease of use (non-coder)** | ★★★★★ Natural language, visual builder | ★★☆☆☆ Requires TypeScript fluency | ★★★☆☆ Requires JavaScript |
| **Test authoring speed** | Hours → Minutes | Expert: 2–4h per flow | Expert: 1–3h per flow |
| **Selector maintenance** | Near-zero (adaptive fingerprints) | High (manual, per-change) | High (manual, per-change) |
| **Flakiness handling** | Structural (network-aware, memory-guided) | Tactical (retry, waitFor) | Tactical (cy.wait, retry) |
| **Failure explanation** | Business-level brief with root cause | Stack trace + trace file | Command log + screenshots |
| **Learning curve (days to first passing test)** | < 1 day | 3–5 days | 2–4 days |
| **AI capabilities** | Native — agent-driven execution | Third-party plugins only | Third-party plugins only |
| **Self-healing** | Autonomous, tiered confidence | None built-in | None built-in |
| **Visual testing** | Integrated, semantic diff | External (Percy, Applitools) | External (Percy, Applitools) |
| **Business intent understanding** | Yes — goal-oriented | No — code-only | No — code-only |
| **Cross-browser** | Yes (Playwright substrate) | Yes | No (Chrome/Firefox/Electron) |
| **Component testing** | Roadmap v2 | Yes (experimental) | Yes (mature) |
| **CI/CD integration** | Smart (failure triage built in) | Standard | Standard |
| **Open source** | Core open, cloud paid | Fully open | Core open, cloud paid |
| **Cost of 500-test suite maintenance** | ~20% of SDET time | ~40–50% of SDET time | ~35–45% of SDET time |

---

## 9. RISKS & HARD PROBLEMS

### What Is Genuinely Hard

**Problem 1 — Non-determinism in AI decisions**
If the agent chooses *which* button to click based on visual understanding, it might occasionally choose wrong — especially in data-dense UIs (tables, grids, dashboards with repeated patterns). A test for "delete the second invoice" must reliably identify the *second* invoice, not the closest-looking one.

**Mitigation:** Anchored intent. The spec language requires explicit disambiguation: "the invoice dated 2025-03-01" not "the second invoice". The agent is prohibited from making positional guesses without explicit instruction.

---

**Problem 2 — Hallucinated test success**
An agent might *believe* a flow succeeded because it saw a success-looking screen, when in reality the backend failed silently. This is worse than a false negative — it's a false positive that gives teams false confidence.

**Mitigation:** The Observe Agent provides ground truth via network assertions. Every business-critical test *must* include at least one network-level assertion (e.g., "POST /api/orders returned 201"). Visual-only success is flagged as low-confidence.

---

**Problem 3 — Dynamic/personalized UI**
A/B test variants, feature flags, personalization engines mean the agent may encounter different UI on different runs for the same test. This is a genuine hard problem — the agent needs to handle goal-equivalent but visually different states.

**Mitigation:** Orion integrates with feature flag tools (LaunchDarkly, Unleash) to pin flag states during test execution. For unknown variance, agents use semantic equivalence matching: two different button labels that achieve the same network effect are treated as equivalent paths.

---

**Problem 4 — The cold-start problem**
A new application with no run history has no learned fingerprints, no timing heuristics, no failure patterns. The first 20–50 runs are essentially traditional automation with extra steps.

**Mitigation:** Orion bootstraps from app analysis: it crawls the app, builds a semantic element map, and pre-populates fingerprint candidates. This shortens cold-start significantly. Additionally, a shared community library of common UI patterns (Material UI, Ant Design, Shadcn) pre-loads known element behaviors.

---

**Problem 5 — LLM cost at scale**
At 500 tests × 50 CI runs/month = 25,000 test executions. If each execution makes 10 LLM calls, that's 250,000 LLM calls/month. At scale, this is a meaningful cost.

**Mitigation:** LLM calls are reserved for ambiguous situations. Confident paths (confidence > 0.90 in memory) execute deterministically using stored strategies — no LLM call. LLM is invoked only for: healing events, new elements, failure analysis, and test generation. Typical CI run: 2–3 LLM calls total per test, not 10.

---

### Where AI Might Fail and What To Do

| Failure Mode | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agent clicks wrong element in dense data table | Medium | Test unreliable | Anchored intent syntax, position-explicit overrides |
| Healing changes the wrong element | Low | Silent test degradation | Healing confidence threshold (< 0.85 requires human confirmation) |
| Failure brief misattributes root cause | Medium | Misleads developer | Brief explicitly states confidence level; links to raw evidence |
| Agent loops on an ambiguous goal | Low | Infinite execution | Hard step limit (50 actions max per sub-goal); agent escalates on limit |
| Visual model misidentifies UI state | Medium | Wrong assertion | Visual assertions require DOM corroboration; visual-only assertions are marked "unverified" |

---

## 10. MVP DEFINITION

### v1 Features (Ship These)

**Core Engine**
- Natural language test authoring (Gherkin-inspired, parsed to goal spec)
- Multi-modal element fingerprinting (aria + text + visual region)
- Playwright execution substrate
- Two-tier healing: silent (high confidence) + assisted (low confidence)
- Memory Agent: per-element strategy store, per-test run history

**Authoring**
- Browser extension with smart recorder
- Goal-spec YAML format (human-readable, version-controllable)
- Test data variables (static YAML + simple AI data generation)
- Visual test spec editor (no code required)

**Execution & Reporting**
- Local execution (Chromium)
- Failure Brief generator (LLM-powered, with raw evidence link)
- JUnit XML + Orion HTML report output
- GitHub Actions integration

**Intelligence**
- Flakiness detection (3+ failures with same signature → pattern alert)
- Selector decay notification (fingerprint confidence dropping)
- Root cause classification: app bug vs test drift vs environment issue

---

### What To Deliberately NOT Build in v1

| Feature | Reason to Defer |
|---|---|
| Component/unit testing | Different tooling paradigm; distracts from E2E differentiation |
| Mobile native testing | Entirely different substrate (Appium); focus on web first |
| Performance testing | Separate problem domain; Orion should do one thing excellently |
| Full CI/CD platform | Become a test runner, not a DevOps platform |
| Multi-user collaboration | Premature — get one user to love it first |
| Video recording | Expensive storage, low signal; screenshots + network log is sufficient for v1 |
| Cypress compatibility layer | Risk of becoming a compatibility shim rather than a new paradigm |
| Custom LLM fine-tuning | Use frontier models (Claude, GPT-4o) via API; fine-tune in v2 after data collection |
| Browser compatibility matrix | Start Chromium-only; add Firefox/WebKit in v1.1 when the core is stable |
| Accessibility testing module | Important but distinct scope; ships as a plugin in v2 |

---

### v1 Success Metric

A manual QA engineer with no JavaScript experience can:
1. Write a test for a 5-step checkout flow in under 15 minutes
2. Have it pass reliably on 3 consecutive CI runs
3. Still have it pass 2 weeks later after a UI update — without touching the test

If Orion delivers that, it has earned the right to exist.

---

*The hardest part of this product is not the AI. The hardest part is the discipline to keep the experience simple while the AI operates with full complexity underneath. The temptation will be to expose knobs. Resist it. The testers who need Orion most are the ones who will leave the moment they see a configuration file.*
