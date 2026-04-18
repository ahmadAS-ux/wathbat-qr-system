# PROJECT_HEALTH_REVIEW.md
# مراجعة صحة المشروع — إلزامي بعد كل مرحلة

> **Purpose:** Run this review after completing each phase (before starting the next one).
> It validates that what was built actually works for the factory — not just technically correct.
> Ahmad runs Part A (business). Claude Code verifies Part B (technical).

---

## When To Run This Review

| Trigger | What to review |
|---------|---------------|
| Phase completed and deployed | Full review — Parts A + B + C |
| Major bug found in production | Part B only (technical) + root cause added to Part D |
| Customer/manager gives feedback | Part A only (business alignment) |
| Before starting next phase | Confirm all blockers from previous review are resolved |

---

## Part A: Business Alignment Review (Ahmad runs this)

> **Goal:** Make sure what we built matches how the factory actually works.
> Do this by sitting with the factory manager for 30 minutes and walking through the system together.

### A1. Real Workflow Validation

For each feature built in this phase, answer:

| Question | How to verify | Pass/Fail |
|----------|--------------|-----------|
| Does the factory manager understand what each screen does without explanation? | Watch him use it — no coaching. If he asks "what does this button do?" → that's a fail | |
| Does the data entry flow match the real sequence of events? | Ask: "When a customer calls, what do you do first?" Compare his answer to our system flow | |
| Are there steps the factory does that the system doesn't cover? | Ask: "Is there anything you do between [stage X] and [stage Y] that isn't here?" | |
| Are there fields the factory never uses? | Ask: "Do you actually track [field name] for every customer?" If "no" or "sometimes" → consider making it optional | |
| Is the Arabic terminology correct? | Ask: "Is [Arabic label] the word you use, or do you call it something else?" | |

### A2. Data Quality Check

| Question | How to verify | Pass/Fail |
|----------|--------------|-----------|
| Does the seed/dropdown data match reality? | Show the dropdown options to the manager: "Are these the right categories? Anything missing?" | |
| Are the role permissions correct? | Ask each role: "Can you do what you need to? Are you blocked from anything you should access?" | |
| Is the 4-stage display meaningful? | Show a project card with "In Study" badge: "Does this label make sense to you?" | |

### A3. Adoption Risk Check

| Question | Answer | Risk Level |
|----------|--------|------------|
| Will the team use this instead of WhatsApp/paper? | | High if "maybe" |
| Is the system faster than the current process? | | High if "no" |
| Can the team use it on their phones? | | Medium if "no" |
| Does anyone resist using it? Who and why? | | Note names and reasons |
| What's the #1 complaint from the team so far? | | Fix before next phase |

### A4. Missing Features Check

| Question | Answer |
|----------|--------|
| What can't you do in the system that you need to do today? | |
| What workaround are you using because the system doesn't support it? | |
| What would save you the most time if we added it next? | |

**Action:** Write down answers. If any critical gap is found, add it to the next phase scope BEFORE starting development.

---

## Part B: Technical Health Review (Claude Code verifies)

> **Goal:** Make sure the codebase is clean, secure, and maintainable.

### B1. Code Quality

| Check | Command / Method | Pass/Fail |
|-------|-----------------|-----------|
| Zero TypeScript errors | `pnpm run typecheck` | |
| Build succeeds | `pnpm run build` | |
| No new `as any` casts added | `grep -r "as any" artifacts/ --include="*.ts" --include="*.tsx" \| wc -l` — compare to previous count | |
| No new `console.log` in backend | `grep -r "console.log" artifacts/api-server/src/ \| wc -l` — should use `logger` instead | |
| No hardcoded strings in JSX | `grep -rn "\"[أ-ي]" artifacts/qr-manager/src/pages/ --include="*.tsx"` — Arabic text should be in i18n.ts | |

### B2. Database Health

| Check | How to verify | Pass/Fail |
|-------|--------------|-----------|
| All tables created without errors | Check server startup logs — no SQL errors | |
| Seed data complete (18 dropdown rows) | `SELECT category, COUNT(*) FROM dropdown_options GROUP BY category` — should show 5+6+4+4=19 | |
| No duplicate seeds after restart | Restart server 3 times, check count stays the same | |
| Migration is idempotent | `CREATE TABLE IF NOT EXISTS` on all tables | |
| No orphaned data | Foreign key references are valid (no lead_logs pointing to deleted leads) | |

### B3. API Health

| Check | How to verify | Pass/Fail |
|-------|--------------|-----------|
| All endpoints respond (not 500) | `curl` each new endpoint — all return 200 or proper error codes | |
| Auth enforced on protected endpoints | Call without token → must get 401 | |
| Role enforcement works | Call with wrong role → must get 403 | |
| Validation rejects bad input | POST with empty required fields → must get 400 with message | |
| Phone validation works | POST with "123" → must get 400; POST with "0536080555" → must get 201 | |

### B4. Frontend Health

| Check | How to verify | Pass/Fail |
|-------|--------------|-----------|
| All pages load without blank screen | Visit each new page — content appears within 3 seconds | |
| Arabic mode: all text in Arabic | Switch to Arabic → no English text visible (except brand names) | |
| English mode: all text in English | Switch to English → no Arabic text visible (except brand names) | |
| RTL layout correct in Arabic | Sidebar on right, text aligned right, icons not reversed | |
| Dropdowns show labels (not dashes) | Open every dropdown → real text appears, not "—" | |
| Forms show validation errors | Submit empty required form → error messages appear in current language | |
| Empty states have messages | Open an empty list → message appears, not blank page | |
| Loading states visible | Slow connection → spinner or skeleton visible during API calls | |

### B5. Security Quick Check

| Check | How to verify | Pass/Fail |
|-------|--------------|-----------|
| No SQL concatenation in new code | Review `erp.ts` — all queries use Drizzle ORM | |
| File uploads validate .docx | Upload a .txt file → should be rejected | |
| Passwords never in API responses | GET /api/admin/users → no `password_hash` field in response | |
| New routes have requireAuth | Review `erp.ts` — every route (except public) has middleware | |

### 🤖 Claude Code Audit Prompt — Copy and Run After Each Phase

```
Read PROJECT_HEALTH_REVIEW.md Part B. Run every check and report results.

B1 — Code Quality:
- Run: pnpm run typecheck
- Run: pnpm run build  
- Count: grep -rn "as any" artifacts/ --include="*.ts" --include="*.tsx" | wc -l
- Count: grep -rn "console.log" artifacts/api-server/src/ --include="*.ts" | wc -l
- Count hardcoded Arabic in JSX: grep -rn '"[أ-ي]' artifacts/qr-manager/src/pages/ --include="*.tsx" | head -20

B2 — Database Health:
- Start the dev server
- Query: SELECT category, COUNT(*) FROM dropdown_options GROUP BY category
- Restart server, query again — counts must match
- Check all foreign key references are valid (no orphaned records)

B3 — API Health:
- curl http://localhost:3001/api/healthz → must return { ok: true }
- curl http://localhost:3001/api/erp/options/lead_source → must return array with labelAr/labelEn populated
- curl http://localhost:3001/api/erp/leads (without token) → must get 401
- curl http://localhost:3001/api/erp/leads (with valid admin token) → must get 200
- POST /api/erp/leads with empty body → must get 400 with error message
- POST /api/erp/leads with phone "123" → must get 400 with phone validation error
- POST /api/erp/leads with phone "0536080555" and all required fields → must get 201
- Test role enforcement: call a FactoryManager-only endpoint with Employee token → must get 403

B4 — Frontend Health:
- Check i18n.ts has both ar and en for every key used in erp/ pages
- Check every Select component maps labelAr/labelEn correctly (not showing raw value or dashes)
- Check every form has validation with Arabic error messages for required fields
- Check every page has a loading state (spinner or skeleton)
- Check every page has an empty state message (not blank page)
- Check phone input has: type="tel", maxLength={10}, regex /^05\d{8}$/

B5 — Security:
- grep for SQL string concatenation in erp.ts — must find zero
- Check requireAuth on every erp route (list all routes without it)
- Check password_hash is excluded from all user API responses
- Check file upload validates .docx extension

Report format for each check:
- PASS ✅ or FAIL ❌
- For every FAIL: what exactly is wrong and the exact code/file to fix
- Summary at the end: X passed, Y failed, Z need attention

IMPORTANT: Do NOT fix anything — report only. I will review and decide what to fix.
Do NOT commit or push anything.
```

---

## Part C: Performance & Reliability (after deploy)

| Check | How to verify | Pass/Fail |
|-------|--------------|-----------|
| Cold start time acceptable | After 30min inactivity, hit the site — loads within 60 seconds | |
| Page load under 3 seconds | On normal connection, each page renders content within 3 seconds | |
| No data loss on server restart | Restart API service on Render → all data still there | |
| Concurrent users don't crash | Two people using the system at the same time → no errors | |
| File upload works for large DOCX | Upload a 10MB+ DOCX → succeeds without timeout | |

---

## Part D: Issue Log (running record)

Track every issue found during reviews. Carry forward to the next phase.

### Template per issue:

```
### Issue #[number]: [Short title]
**Found in:** Phase [X] review
**Severity:** Critical / Major / Minor
**Category:** Business gap / Bug / UX problem / Security / Performance
**Description:** What's wrong
**Impact:** Who is affected and how
**Root cause:** Why it happened
**Fix:** What was done (or what needs to be done)
**Status:** Fixed in v[X] / Open / Deferred to Phase [X]
**Preventable by:** Which quality file should have caught this
```

### Current Issues:

```
### Issue #1: Dropdown labels showing dashes
**Found in:** Phase 1 deploy
**Severity:** Major
**Category:** Bug
**Description:** Lead creation form dropdowns show "—" instead of "واتساب", "فيلا" etc.
**Impact:** Employees can't create leads properly
**Root cause:** Seed data had incorrect Arabic labels / frontend label mapping mismatch
**Fix:** Fixed in seed migration + dropdown label rendering
**Status:** Fixed in v2.1
**Preventable by:** CODE_STRUCTURE.md Section 3 (dropdown data flow) + QUALITY_GATES.md Gate 5

### Issue #2: Phone number accepts any input
**Found in:** Phase 1 deploy
**Severity:** Major
**Category:** Bug / Missing validation
**Description:** Phone field accepts letters, short numbers, any format — no Saudi 05XXXXXXXX validation
**Impact:** Invalid phone data in database, can't call customers back
**Root cause:** No validation spec existed when Phase 1 was built
**Fix:** [Pending — needs frontend regex + backend validation]
**Status:** Open
**Preventable by:** CODE_STRUCTURE.md Section 4 (form field specifications)
```

---

## Part E: Phase Completion Sign-off

Before starting the next phase, ALL of these must be true:

| Requirement | Status |
|-------------|--------|
| Part A completed — factory manager walked through the system | ☐ |
| Part B completed — all technical checks pass | ☐ |
| Part C completed — deployed and tested on Render | ☐ |
| All Critical/Major issues from Part D are fixed | ☐ |
| WORKFLOW_REFERENCE_v3.md updated with any scope changes from Part A | ☐ |
| CODE_STRUCTURE.md updated with any new file paths or data flows | ☐ |
| CLAUDE.md version number bumped | ☐ |
| Git tag created for this version | ☐ |
| Customer/manager approval received (verbal or signed) | ☐ |

**Only after ALL boxes are checked → start next phase.**

---

## Review History

| Phase | Date | Reviewer | Result | Issues Found | Issues Fixed |
|-------|------|----------|--------|-------------|-------------|
| Phase 1 (v2.1) | April 2026 | Ahmad | Partial — bugs found before full review | 2 (dropdown labels, phone validation) | 1 fixed, 1 open |
| Phase 2 | — | — | — | — | — |
| Phase 3 | — | — | — | — | — |
| Phase 4 | — | — | — | — | — |

---

*This file is part of the project quality framework:*
*CLAUDE.md → WORKFLOW_REFERENCE_v3.md → CODE_STRUCTURE.md → QUALITY_GATES.md → UI_UX_CHECKLIST.md → SECURITY_BASELINE.md → PROJECT_HEALTH_REVIEW.md*
