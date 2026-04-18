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
| Does every piece of data know who it belongs to? For each data type: where does it come from? (Orgadata / manual / external), where is it stored?, is it linked to the correct entity? (lead / project / request), what happens if it arrives without a linked entity? | Walk through each data type with the factory manager. For each one, open the DB and confirm the foreign key exists. If any data type has no parent link → that is a critical gap. | |

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
**Root cause:** Two causes: (1) seed data had incorrect Arabic labels, (2) apiBase missing from ERP fetch calls — requests hit frontend static site instead of API server (see Issue #3)
**Fix:** (1) Seed migration + label rendering fix in v2.2. (2) apiBase added to all ERP fetch calls in v2.2 (commit 836d98f).
**Status:** Fixed in v2.2
**Preventable by:** CODE_STRUCTURE.md Section 3 (dropdown data flow) + QUALITY_GATES.md Gate 5

### Issue #2: Phone number accepts any input
**Found in:** Phase 1 deploy
**Severity:** Major
**Category:** Bug / Missing validation
**Description:** Phone field accepts letters, short numbers, any format — no Saudi 05XXXXXXXX validation
**Impact:** Invalid phone data in database, can't call customers back
**Root cause:** No validation spec existed when Phase 1 was built
**Fix:** Frontend: type=tel, maxLength=10, /^05\d{8}$/ regex, Arabic error message. Backend: same regex in POST /api/erp/leads returns 400 if invalid.
**Status:** Fixed in v2.2 (commit 4c68bbf)
**Preventable by:** CODE_STRUCTURE.md Section 4 (form field specifications)

### Issue #3: All ERP API calls hitting frontend URL instead of API server
**Found in:** Phase 1 production testing
**Severity:** Critical
**Category:** Bug
**Description:** All 21 fetch calls across 6 ERP files used relative URLs without apiBase, which worked in dev (Vite proxy) but failed in production (static site has no proxy)
**Impact:** Entire ERP system non-functional in production — dropdowns empty, leads can't load, projects can't load
**Root cause:** apiBase import was missing from all ERP page files
**Fix:** Added `${API_BASE}` prefix to all 21 fetch calls across Leads, LeadDetail, Projects, ProjectDetail, AdminUsers, AdminLayout
**Status:** Fixed in v2.2 (commit 836d98f)
**Preventable by:** CODE_STRUCTURE.md Section 8 (Frontend API Call Pattern) — states "Use apiBase from lib/api-base.ts — don't hardcode URLs"

### Issue #4: Glass/Panel order not linked to ERP project or customer
**Found in:** Post-Phase 1 architecture review
**Severity:** Critical
**Category:** Business gap / Architecture
**Description:** When a DOCX file is uploaded via the legacy QR system (Home.tsx / POST /api/qr/process), the resulting processed_docs record has no project_id or lead_id. It is impossible to know which ERP customer or project the glass order belongs to.
**Impact:** Glass orders are floating in the system with no customer or project link. Admin cannot trace which delivery belongs to which customer. QR codes generated have no ERP context.
**Root cause:** Layer 1 (QR system) was built before Layer 2 (ERP) existed. The processed_docs table was never designed with a project_id foreign key. The decision to keep Layer 2 "additive only" (WORKFLOW_REFERENCE_v3.md Section 11) meant the integration gap was never addressed.
**Why the framework missed it:** QUALITY_GATES.md had no gate checking data ownership or cross-system binding. PROJECT_HEALTH_REVIEW.md Part A had no question asking "can this data exist without a parent entity?" Gate 11 and the new A1 row have been added to prevent recurrence.
**Fix (planned):**
- Step 1: Add project_id (nullable) to processed_docs via idempotent migration
- Step 2: Disable Home.tsx upload for all roles except Admin (legacy mode)
- Step 3: Force glass_order upload through ProjectDetail.tsx (ERP context) for all new uploads
- Step 4: On technical_doc upload (first Orgadata file per project): extract project name from DOCX, compare to projects.name — if different, return 409 Conflict with both names, require employee confirmation before proceeding. Employee can confirm to update projects.name or cancel the upload.
- Step 5: On price_quotation and glass_order uploads: skip name comparison (already resolved in Step 4)
- Step 6: Existing processed_docs records with project_id = NULL remain as-is (no data loss)
**Status:** Open — planned for implementation before Phase 2
**Preventable by:** QUALITY_GATES.md Gate 11 (newly added) + PROJECT_HEALTH_REVIEW.md Part A Section A1 (newly added row)
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
