# V4_ROADMAP.md
# Wathbah v4.0.0 Stabilization Roadmap

> **Created:** April 2026
> **Baseline:** v3.4.1 (commit `d0be8ba`)
> **Target:** v4.0.0
> **Excludes:** Qoyod integration (waiting on API key), mobile hamburger menu, factory manager test
> **Approach:** Trust + push for Stages 1–3; full review for Stages 4–5

---

## Stage Boundaries — Cadence Rules

**Between Stages 1, 2, 3:**
- Claude Code works autonomously within the stage
- At stage boundary: stops, reports commit list + typecheck status, waits for user "go"
- No screenshot verification needed between these stages

**Between Stages 4, 5:**
- Review-before-implement is MANDATORY
- Screenshot verification on live Render site after each commit
- No bundling — strict commit splitting

**Always:**
- All 15 Quality Gates must pass before each commit
- Version bump per Gate 12
- CHANGELOG.md updated

---

## Stage 1 — Permission Foundation (v3.5.0)

**Goal:** Create the missing infrastructure that Stages 2–4 will use. No behavior change.

**Required reading:** CLAUDE.md, USERS_AND_PERMISSIONS.md, CODE_STRUCTURE.md (Section: How Role Permissions Work).

**Commits — exactly 3, in this order:**

**Commit 1: Create `lib/permissions.ts` helper**
- New file: `artifacts/qr-manager/src/lib/permissions.ts`
- Export named role-check functions:
  - `canViewPrices(role)` → Admin, FactoryManager, Accountant
  - `canDeleteProject(role)` → Admin, FactoryManager
  - `canEditContract(role)` → Admin
  - `canViewContract(role)` → Admin, FactoryManager, SalesAgent
  - `canViewProjectDetail(role)` → Admin, FactoryManager, Employee, Accountant
  - `canViewPayments(role)` → Admin, Accountant
  - `canCreateMilestone(role)` → Admin, Accountant
  - `canManageUsers(role)` → Admin
  - `canEditDropdowns(role)` → Admin
  - `canViewQRSystem(role)` → Admin
  - `canViewVendors(role)` → Admin, FactoryManager, Employee
  - `canCreateProject(role)` → Admin, FactoryManager, Employee
  - `canViewLeads(role)` → Admin, FactoryManager, Employee, SalesAgent
- Export type: `Role = 'Admin' | 'FactoryManager' | 'Employee' | 'SalesAgent' | 'Accountant'`
- Each function takes `role: Role | undefined` and returns `boolean`
- Pure functions only — no React, no hooks, no side effects
- TypeScript types must match the existing `useAuth()` return type
- Commit message: `feat: add lib/permissions.ts role helper (no behavior change)`

**Commit 2: Create `RequireRole` route guard component**
- New file: `artifacts/qr-manager/src/components/RequireRole.tsx`
- Takes props: `roles: Role[]`, `children: React.ReactNode`, `fallback?: string` (default: `/admin`)
- Uses `useAuth()` to get current user
- If user role not in allowed list → redirect to fallback path via `useLocation()`
- If still loading user → render null
- If allowed → render children
- Commit message: `feat: add RequireRole route guard component`

**Commit 3: Refactor inline role checks in 4 highest-traffic files**
- `Projects.tsx` — replace inline role checks with helper calls
- `ProjectDetail.tsx` — replace `canViewContract` boolean and any other inline role checks
- `AdminLayout.tsx` — replace `isAdmin`, `isPaymentsUser`, `isErpUser` patterns where they map to helper functions (do NOT change the special composite booleans like `isPaymentsUser` if they don't have a 1:1 helper match — leave them with a TODO comment)
- `Admin.tsx` (dashboard) — replace inline role checks
- Pure refactor — zero behavior change. Run `pnpm run typecheck` and visually confirm imports are clean
- Commit message: `refactor: use lib/permissions.ts helpers across high-traffic files`

**Stage boundary:**
- Run `pnpm run typecheck` — zero errors required
- Bump all 3 package.json files to 3.5.0
- Update CHANGELOG.md with Stage 1 entry
- Push all 3 commits
- Report commit hashes + version + "Stage 1 complete, ready for Stage 2"
- WAIT for user "go" before starting Stage 2

---

## Stage 2 — Permission Bug Fixes (v3.5.1)

**Goal:** Fix all permission-related bugs from the code review and audit, using the new helper from Stage 1.

**Required reading:** USERS_AND_PERMISSIONS.md (Known Permission Gaps section), the M5 finding from the code review, the audit corrections list.

**Commits — exactly 5, one per fix:**

**Commit 1: Fix M5 — canCreateMilestone correctness**
- File: `ProjectDetail.tsx`
- The current `canCreateMilestone = Admin || FactoryManager || SalesAgent` is wrong per WORKFLOW_REFERENCE_v3.md
- Replace with `canCreateMilestone(user?.role)` from the helper (which returns Admin, Accountant)
- Also fix the matching backend route in `erp.ts` to align: only Admin and Accountant can `POST /api/erp/projects/:id/payments`
- Commit message: `fix: canCreateMilestone correctness — Admin + Accountant only (M5)`

**Commit 2: Hide prices from Employee role**
- File: `ProjectDetail.tsx`
- Wrap any display of `project.estimatedValue`, `project.quotation.subtotalNet`, `project.quotation.grandTotal`, and per-position `unitPrice` / `lineTotal` with `canViewPrices(user?.role) ? <value> : <em-dash />`
- The em-dash should be `<span className="text-slate-400">—</span>` for visual consistency
- Backend filtering NOT in this commit (defer to Stage 3 if needed) — frontend hide is acceptable for now since Employee should not see prices anywhere
- Commit message: `fix: hide prices from Employee role in ProjectDetail`

**Commit 3: Filter SalesAgent sidebar to scoped nav**
- File: `AdminLayout.tsx`
- SalesAgent should see only: Dashboard + Clients (Leads)
- Currently SalesAgent gets full ERP nav set per audit
- Update sidebar nav array to filter by role using helper functions
- Commit message: `fix: filter SalesAgent sidebar to Dashboard + Clients only`

**Commit 4: Hide QR Upload/Archive from non-Admin**
- File: `AdminLayout.tsx`
- QR Upload and Document Archive should be visible to Admin only (per live code's actual restriction; the doc was wrong)
- Update sidebar to use `canViewQRSystem(user?.role)` for these two items
- Commit message: `fix: hide QR Upload + Document Archive from non-Admin roles`

**Commit 5: Add Accountant deep-link path to project detail**
- Files: `Payments.tsx` (or wherever the payments list lives)
- Each payment milestone row should be clickable for Accountant — links to `/erp/projects/:id` with the Payments tab pre-selected
- This is the only path Accountant has into project detail (since they have no Projects sidebar item)
- Add a query param like `?tab=payments` to ProjectDetail.tsx, then read it on mount and `setActiveTab('payments')` if present
- Commit message: `feat: Accountant can navigate to project payments via payment row click`

**Stage boundary:**
- Run `pnpm run typecheck` — zero errors required
- Bump all 3 package.json files to 3.5.1
- Update CHANGELOG.md
- Push all 5 commits
- Report commit hashes + version + "Stage 2 complete, ready for Stage 3"
- WAIT for user "go"

---

## Stage 3 — Backend Robustness (v3.5.2)

**Goal:** Fix deferred code review findings.

**Required reading:** the code review report from earlier in this conversation (C2, M1, M2, M6).

**Commits — exactly 4, one per fix:**

**Commit 1: Fix C2 — atomic project create + code generation**
- File: `artifacts/api-server/src/routes/erp.ts`
- Wrap the project insert + code generation in a single `db.transaction()`
- If transaction fails, roll back — no orphan rows with `code=NULL`
- Backfill on startup is still kept as a safety net (unchanged)
- Commit message: `fix: atomic project create + code generation in single transaction (C2)`

**Commit 2: Fix M1 — CORS scoped to FRONTEND_ORIGIN**
- File: `artifacts/api-server/src/app.ts`
- Replace `app.use(cors())` with `app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }))`
- Add `FRONTEND_ORIGIN` to `.env.example` with a comment explaining production should set this to the deployed frontend URL
- On Render same-domain deploy, the env var should be set to the frontend URL (e.g. `https://qr-asset-manager-web.onrender.com`)
- Commit message: `fix: scope CORS to FRONTEND_ORIGIN env var (M1)`

**Commit 3: Fix M2 — silent catch blocks**
- Files: `ProjectDetail.tsx`, `AdminLayout.tsx`
- Find every `.catch(() => {})` and `.catch(() => set...Loading(false))` pattern that silently swallows errors
- Replace with: log the error to console + show a toast or amber error banner using existing i18n key `erp_options_load_error` (or add new keys if needed)
- Do NOT remove the `setLoading(false)` calls — keep loading state correct, just add error visibility
- Commit message: `fix: surface fetch failures instead of silent catch (M2)`

**Commit 4: Fix M6 — idempotent seed data**
- File: `artifacts/api-server/src/index.ts`
- The current `if (optCount === 0)` skips entire seed block if any row exists
- Replace with `INSERT INTO dropdown_options (...) VALUES (...) ON CONFLICT (category, value) DO NOTHING`
- This requires a unique constraint on `(category, value)` — add one with `ALTER TABLE ... ADD CONSTRAINT ... IF NOT EXISTS` style guard
- Now seeds are idempotent and partial seed states recover correctly on restart
- Commit message: `fix: idempotent dropdown seed with ON CONFLICT DO NOTHING (M6)`

**Stage boundary:**
- Run `pnpm run typecheck` — zero errors required
- Bump all 3 package.json files to 3.5.2
- Update CHANGELOG.md
- Push all 4 commits
- Report commit hashes + version + "Stage 3 complete, ready for Stage 4"
- WAIT for user "go"

**After Stage 3:**
- Render auto-deploys
- User performs a quick smoke test: log in as each role, verify nothing is broken
- Only proceed to Stage 4 after confirmation

---

## Stage 4 — Project Code Format + Contract Page Fixes (v3.6.0)

**Goal:** Visible UX improvements. RISK INCREASES HERE — review-before-implement is mandatory.

**Required reading:** All earlier reviews of project code format, ContractPage.tsx structure, FILE_UPLOAD_GUIDE.md.

### 4A — Project Code Format

**REVIEW MODE — answer before implementing:**
1. Confirm the new format: `WT-[TYPE]-[RANDOM5]` where TYPE = first 2 letters of buildingType English value uppercased (XX if null), RANDOM5 = 5 random alphanumeric uppercase
2. Confirm the advisory lock key changes from year-based to fixed `pg_advisory_xact_lock(20260101)`
3. Confirm existing codes get regenerated on next server restart via the backfill CTE
4. List exact lines in `erp.ts` and `index.ts` that will change

After answering, wait for approval, then:

**Commit 1: Backend code format change**
- Update `generateAndSetProjectCode()` in `erp.ts`
- Update backfill CTE in `index.ts` to regenerate using new format
- Test on dev: create project with buildingType=villa → code starts with `WT-VL-`
- Commit message: `feat: update project code format to WT-TYPE-RANDOM5 (opaque, no sequence)`

**Commit 2: Documentation sync**
- Update WORKFLOW_REFERENCE_v3.md Section 3.3
- Update CODE_STRUCTURE.md
- Update QOYOD_INTEGRATION_PLAN.md to reference new format in description field rule
- Commit message: `docs: update project code format documentation`

**STAGE 4A VERIFICATION (mandatory):**
- After both commits push, wait for Render deploy
- User logs in, opens any project, screenshots the new code badge
- Confirm format matches `WT-[TYPE]-[5 random chars]`
- Only proceed to 4B after confirmation

### 4B — Contract Page Arabic BiDi Fix

**THIS IS THE RISKIEST FIX IN V4.0.** ContractPage.tsx is fragile. Wrong fix breaks contract printing entirely.

**REVIEW MODE — answer before implementing:**
1. What is the EXACT current rendering problem? Read ContractPage.tsx and the print CSS, identify which elements have wrong direction
2. List every element in the contract template (intro, terms, signature blocks, positions table, payment schedule)
3. For each element, state: should it be RTL, LTR, or BiDi? What is it currently?
4. What CSS classes or `dir` attributes need to change?
5. The empty pages issue — what is causing them? Page-break CSS? Empty divs? Margins?
6. Confirm the fix does NOT modify the integrity check logic (lines around `checkContractIntegrity` call)

After answering, wait for approval, then:

**Commit 3: ContractPage.tsx BiDi fix**
- Apply only the changes confirmed in review answers
- Do NOT touch the `useEffect` that calls `checkContractIntegrity`
- Do NOT touch the `renderPlaceholders` import
- Single commit, focused change
- Commit message: `fix: contract page Arabic BiDi rendering and empty page issue`

**STAGE 4B VERIFICATION (mandatory):**
- After commit pushes, wait for Render deploy
- User opens a project's contract page in both Arabic and English
- Verify: text reads correctly in both languages, no empty pages, integrity check still works
- If anything looks wrong: stop, do not proceed to 4C, revert if necessary

### 4C — Drawing Images Fix

**REVIEW MODE — answer before implementing:**
1. Where are the drawing images expected to come from? `parsed_section_drawings` table?
2. What URL pattern does the contract template use to reference them?
3. Why are they currently broken (404? wrong path? missing data?)
4. Is the fix a backend issue (data not being returned) or frontend issue (wrong img src)?

After answering, wait for approval, then:

**Commit 4: Drawing images fix**
- Fix per review answers
- Commit message: `fix: drawing images render in contract print page`

**Stage boundary:**
- Bump all 3 package.json files to 3.6.0
- Update CHANGELOG.md with Stage 4 entry
- Report all 4 commit hashes + "Stage 4 complete, ready for Stage 5"
- WAIT for user "go"

---

## Stage 5 — Documentation Sync + v4.0.0 Tag

**Goal:** Bring all documentation in line with the now-stable codebase. Tag v4.0.0.

**Required reading:** Every doc file in the project root.

**Commits — exactly 2:**

**Commit 1: Documentation sync**
- Update USERS_AND_PERMISSIONS.md per the audit corrections (Stage 2 work makes most of those corrections obsolete — remove them from "Known Gaps" section, mark as ✅ in implementation status table)
- Update DESIGN_GAP_ANALYSIS.md — mark all items closed by Stages 1–4
- Update WORKFLOW_REFERENCE_v3.md — reflect new permission helper, RequireRole, fixed permissions matrix
- Update CODE_STRUCTURE.md — add lib/permissions.ts and RequireRole to file tree
- Update PROJECT_DOCS.md if it references any old behavior
- Add comprehensive entry to CHANGELOG.md covering all of v3.5.0 through v3.6.0
- Commit message: `docs: comprehensive sync for v4.0.0 release`

**Commit 2: Version bump to 4.0.0 + git tag**
- Bump all 3 package.json files to 4.0.0
- Add CHANGELOG.md entry for v4.0.0 noting it as a stabilization release that closes Phase 4 + cleanup
- Create git tag `v4.0.0` with message: `Wathbah v4.0.0 — Stabilization release. All 4 phases complete + cleanup batch closed.`
- Commit message: `chore: bump version to 4.0.0`

**Stage boundary:**
- Push commits + push tag
- Report final state: tag, version, commit hashes, link to CHANGELOG entry
- v4.0.0 is officially shipped

---

## Excluded from v4.0.0 (deferred to v4.1.0+)

- Qoyod integration (Phase A: connection + pull + display, Phase B: linking, Phase C: smart matching)
- Mobile hamburger menu
- Factory manager test
- Smart contract preview embed (Step 15 was solved with summary view + link, no need to revisit)
- Project name mismatch UX improvements

These should be planned in a separate roadmap document when ready.

---

## Rollback Plan

If anything goes wrong at any stage:
- v3.4.1 is the safe rollback point (commit `d0be8ba`)
- DB schema changes in v3.5.x and v3.6.0 are minimal — only `code` column format changes (no schema breaks)
- Revert path: `git revert` on the bad commit + push, Render auto-deploys

---

## Communication Format Between Stages

When Claude Code reports stage completion, it must report in this exact format:

```
STAGE N COMPLETE

Version: X.Y.Z
Commits pushed:
1. abc1234 — commit message 1
2. def5678 — commit message 2
3. ...

Typecheck: PASS
Build: PASS
CHANGELOG: updated

Ready for Stage N+1. Awaiting "go".
```

This makes the boundary unambiguous and quick to verify.
