# Testing Setup Guide

Drop this file in the root of any project. It documents the testing stack, the rules, and has copy-paste prompts for Claude Code to set things up.

---

## The Rule

- ✅ Test all business logic in `src/services/`
- ❌ Don't test route handlers, page components, or pure UI
- 📁 Tests live next to source: `auth.service.ts` → `auth.service.test.ts` in the same folder
- 🎯 One file per service, one `describe` per exported function, one `it` per behavior

---

## The Stack (in order of when you'll need each)

| Tool | When to add | Purpose |
|---|---|---|
| **Vitest** | Day 1 | Test runner. Reuses Vite config. Jest-compatible API. |
| **Testing Library** | Day 1 (install, use later) | Component/hook tests when needed. Tests behavior, not implementation. |
| **MSW** | When you have 5+ service tests | Intercepts Supabase/API calls at the network layer. Cleaner than manual mocks. |
| **Playwright** | When you have a stable feature to lock down | End-to-end tests in a real browser. |

**Skip:** Jest (slower, more config), Cypress (Playwright is better now), Storybook (overkill for a services-focused rule).

---

## Phase 1 — Vitest Setup

**Paste this into Claude Code:**

```
Set up Vitest for this project following the testing rules in TESTING.md.

Diagnosis first — before installing anything, show me:
1. What's already in package.json (any existing test setup?)
2. What's in vite.config.ts
3. Which service file you'll use for the example test, and why

Then wait for my approval.

After approval, execute:

1. Install dev deps: vitest, @vitest/ui, @vitest/coverage-v8, jsdom,
   @testing-library/react, @testing-library/jest-dom,
   @testing-library/user-event

2. Create vitest.config.ts that extends vite.config.ts using
   mergeConfig from vitest/config. Settings:
   - environment: 'jsdom'
   - globals: true
   - setupFiles: ['./src/test/setup.ts']
   - coverage.include: ['src/services/**']
   - coverage.exclude: ['src/routes/**', 'src/pages/**', '**/*.test.ts', '**/*.test.tsx']

3. Create src/test/setup.ts that imports '@testing-library/jest-dom'.

4. Add scripts to package.json:
   - "test": "vitest"
   - "test:ui": "vitest --ui"
   - "test:run": "vitest run"
   - "test:coverage": "vitest run --coverage"

5. Update tsconfig.json to include "vitest/globals" in compilerOptions.types.

6. Create one example test next to the simplest service file with 2-3
   real assertions (not placeholder tests).

7. Run `npm test` once and confirm it passes. Show me the output.

Surgical scope: only the changes above. Don't refactor existing services.
```

---

## Phase 2 — MSW (when you have 5+ service tests)

**Why now:** Once you have a handful of service tests, manually mocking Supabase in each one becomes painful. MSW intercepts at the network layer so your service code runs unchanged.

**Paste this into Claude Code:**

```
Add MSW (Mock Service Worker) to this project for mocking Supabase
and external API calls in tests.

Diagnosis first:
1. List all service files in src/services/
2. Identify which external APIs/Supabase tables they call
3. Propose a folder structure for handlers (e.g., src/test/mocks/handlers/)

Wait for my approval.

After approval:

1. Install: msw (as devDependency)

2. Create src/test/mocks/server.ts — sets up the MSW server for Node
   (test environment), not the browser worker.

3. Create src/test/mocks/handlers/index.ts that exports an array of
   handlers. Create one handler file per external service
   (supabase.ts, etc.). Start with empty arrays — we'll add handlers
   as tests need them.

4. Update src/test/setup.ts to:
   - Start the MSW server in beforeAll
   - Reset handlers in afterEach
   - Close the server in afterAll

5. Refactor ONE existing service test to use MSW instead of its current
   mocking approach. Show me the before/after.

6. Run `npm test` and confirm everything still passes.

Don't refactor every test at once. We migrate one at a time as we
touch each service.
```

---

## Phase 3 — Playwright (when you have a stable feature)

**Why later:** E2E tests are expensive to write and maintain. Only add them for flows that *must not break* — login, checkout, the core user journey.

**Paste this into Claude Code:**

```
Set up Playwright for end-to-end testing of [FEATURE NAME — e.g. "the
booking flow"].

Diagnosis first:
1. Identify the user journey in code: which routes, which forms,
   which success states
2. Propose 3-5 critical-path tests (not exhaustive — just the ones
   that would catch a real regression)
3. Confirm the dev server command (npm run dev?) and the URL it runs on

Wait for my approval.

After approval:

1. Install: @playwright/test
2. Run: npx playwright install chromium (just chromium for now,
   we can add browsers later)
3. Create playwright.config.ts:
   - testDir: './e2e'
   - baseURL from env or http://localhost:5173
   - webServer: starts the dev server before tests
   - Use chromium only for now
4. Create e2e/ folder at project root (separate from src/)
5. Write the 3-5 tests we agreed on
6. Add scripts to package.json:
   - "e2e": "playwright test"
   - "e2e:ui": "playwright test --ui"
7. Add e2e/playwright-report/ and e2e/test-results/ to .gitignore
8. Run the suite once and show me the output

Note: e2e tests are NOT in src/, so the "tests next to source"
rule doesn't apply here. E2E tests are about user flows, not
code modules.
```

---

## Phase 4 — Component Tests with Testing Library (as needed)

**Why "as needed":** Most components don't need tests. Add a component test only when:
- The component has non-trivial logic (form validation, conditional rendering based on multiple states)
- You've had a bug in it before
- It's used in many places and breaking it would cascade

**Paste this into Claude Code:**

```
Write a Testing Library test for the component at [PATH].

Diagnosis first:
1. Read the component
2. List the behaviors worth testing (input validation, state changes,
   conditional rendering — NOT styling, NOT prop passthrough)
3. Identify what needs mocking (services, hooks, context providers)

Wait for my approval on the behavior list before writing tests.

Then:
- Create [PATH].test.tsx next to the component
- Use @testing-library/react and @testing-library/user-event
- Test behavior, not implementation (no testing internal state directly)
- Use screen.getByRole when possible (better for accessibility)
- Mock services with MSW handlers, not vi.mock, when the component
  triggers network calls

Run the test and show me the output.
```

---

## Daily-use Commands

```bash
npm test              # watch mode, runs on file change
npm run test:ui       # browser UI for tests (very nice)
npm run test:run      # single run, for CI or pre-commit
npm run test:coverage # coverage report — focus on src/services/
npm run e2e           # Playwright (once installed)
```

---

## Test File Pattern

```typescript
// src/services/booking.service.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createBooking } from './booking.service'

describe('createBooking', () => {
  beforeEach(() => {
    // reset any state if needed
  })

  it('rejects bookings in the past', async () => {
    const result = await createBooking({ date: '2020-01-01' })
    expect(result.error).toBe('DATE_IN_PAST')
  })

  it('creates a booking with valid data', async () => {
    const result = await createBooking({ date: '2026-12-01' })
    expect(result.data).toBeDefined()
    expect(result.error).toBeNull()
  })

  it('rejects double-bookings for the same slot', async () => {
    // MSW returns "slot taken" from the mock Supabase
    const result = await createBooking({ date: '2026-12-01', slot: 'A' })
    expect(result.error).toBe('SLOT_TAKEN')
  })
})
```

---

## Workflow Reminder

Per the agent lanes:

- **Claude (chat):** decides *what* gets tested, reviews failures that reveal design issues
- **Claude Code:** writes and runs tests, fixes implementation when tests catch bugs
- **Antigravity:** runs the suite for visual confirmation, debugs flaky tests involving browser/network

When in doubt, hand it to Claude Code with the prompt blocks above. Don't run setup steps manually.
