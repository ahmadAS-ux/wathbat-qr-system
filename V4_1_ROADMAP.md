# V4_1_ROADMAP.md
# Wathbah v4.1.0 Customer Entity Refactor Roadmap

> **Created:** April 2026
> **Baseline:** v4.0.0
> **Target:** v4.1.0
> **Context:** Database is empty. No production migration required.
> **Approach:** Additive first, destructive cleanup last. Preserve deployed behavior at every stage.

---

## Stage Boundaries - Cadence Rules

**Between Stages 1, 2:**
- Claude Code works autonomously within the stage
- At stage boundary: stops, reports commit list + typecheck/build status, waits for user "go"
- No frontend screenshot verification required if the stage is backend-only and response shapes stay compatible

**Between Stages 3, 4, 5, 6, 7:**
- Review-before-implement is MANDATORY
- Local smoke test after each commit
- Render smoke test after each stage boundary
- No bundling for destructive cleanup work
- Stage 7 is the only schema-drop stage and must remain isolated

**Always:**
- All 15 Quality Gates must pass before each commit
- Version bump per Gate 12
- CHANGELOG.md updated
- API response shapes must remain stable until Stage 7 cleanup
- `processed_docs` history is preserved on customer/project delete by nulling `project_id`, not deleting QR history

---

## Stage 1 - Customer Foundation (v4.0.1)

**Goal:** Add the new customer entity and shared phone utilities without breaking existing routes or pages.

**Required reading:** CLAUDE.md, WORKFLOW_REFERENCE_v3.md, CODE_STRUCTURE.md, QUALITY_GATES.md, lib/db/src/schema/leads.ts, lib/db/src/schema/projects.ts, artifacts/api-server/src/index.ts

**Commits - exactly 2, in this order:**

**Commit 1: Add customers schema + additive startup migrations**
- New file: `lib/db/src/schema/customers.ts`
- Update `lib/db/src/schema/index.ts`
- In `artifacts/api-server/src/index.ts`:
- Create `customers` table with idempotent SQL
- Add `customer_id` columns to `leads` and `projects`
- Add guarded FK constraints with `ON DELETE RESTRICT`
- Add indexes on `leads.customer_id`, `projects.customer_id`, and `customers.name`
- Add DB CHECK constraints for customer status and E.164 phone format
- Do NOT drop `customer_name` or `phone` from `leads` or `projects`
- Commit message: `feat: add customers table and additive customer_id migrations`

**Commit 2: Add shared phone normalization and validation utilities**
- New shared backend utility for:
- E.164 normalization
- Saudi local-to-E.164 conversion
- International validation wrapper
- No route behavior change yet except utility availability
- Commit message: `feat: add shared phone normalization and E.164 validation utilities`

**Stage boundary:**
- Run `pnpm run typecheck` - zero errors required
- Run `pnpm run build` - zero errors required
- Server starts and reruns migrations safely on restart
- Bump all 3 package.json files to 4.0.1
- Update CHANGELOG.md
- Push both commits
- Report commit hashes + version + `Stage 1 complete, ready for Stage 2`
- WAIT for user `go`

---

## Stage 2 - Customer API (v4.0.2)

**Goal:** Add customer CRUD, search, and safe-delete backend contracts while keeping leads/projects unchanged.

**Required reading:** USERS_AND_PERMISSIONS.md, QUALITY_GATES.md, CODE_STRUCTURE.md, artifacts/api-server/src/routes/erp.ts

**Commits - exactly 3, in this order:**

**Commit 1: Add customer search + CRUD endpoints**
- Add routes under `/api/erp/customers`
- GET list
- GET detail
- POST create
- PATCH update
- GET search by name/phone
- Normalize phone to E.164 before save
- Enforce `phone` UNIQUE conflict handling
- Commit message: `feat: add customer search and CRUD endpoints`

**Commit 2: Add customer dependency inspection contract**
- Add dependency summary logic for linked leads/projects
- Include counts and lightweight arrays for UI warning
- Preserve API shape proposed in review
- Commit message: `feat: add customer dependency inspection endpoint`

**Commit 3: Add admin-only confirmed customer delete flow**
- `DELETE /api/erp/customers/:id`
- First call without `confirm=true` returns 409 when dependencies exist
- Second call with `confirm=true` deletes customer graph
- Preserve `processed_docs` by nulling `project_id`
- Run delete flow inside `db.transaction()`
- Commit message: `fix: add admin-only confirmed customer delete flow`

**Stage boundary:**
- Run `pnpm run typecheck`
- Run `pnpm run build`
- Manual API smoke test:
- Create customer
- Search customer by name and phone
- Exact-phone duplicate returns conflict
- Delete without confirm returns 409
- Delete with confirm succeeds
- Bump all 3 package.json files to 4.0.2
- Update CHANGELOG.md
- Push all 3 commits
- Report commit hashes + version + `Stage 2 complete, ready for Stage 3`
- WAIT for user `go`

---

## Stage 3 - Lead/Project Backend Refactor (v4.0.3)

**Goal:** Refactor lead/project routes to use `customer_id` while preserving existing frontend response shapes.

**Required reading:** WORKFLOW_REFERENCE_v3.md, CODE_STRUCTURE.md, QUALITY_GATES.md, artifacts/api-server/src/routes/erp.ts, artifacts/api-server/src/index.ts

**Commits - exactly 3, in this order:**

**Commit 1: Refactor lead reads and writes through customers**
- `GET /erp/leads`
- `GET /erp/leads/:id`
- `POST /erp/leads`
- `PATCH /erp/leads/:id`
- `GET /erp/leads/search`
- Responses still expose `customerName` and `phone`, but sourced via customers join
- Lead creation accepts either `customerId` or inline customer payload
- Commit message: `refactor: resolve lead reads and writes through customers`

**Commit 2: Refactor project reads through customers joins**
- `GET /erp/projects`
- `GET /erp/projects/:id`
- `GET /erp/projects/:id/contract`
- `GET /erp/phases/:id`
- `GET /erp/payments/all`
- `/erp/search`
- `/erp/activity-feed`
- Any SQL that currently reads `projects.customer_name` or `projects.phone`
- Preserve existing JSON response keys: `customerName`, `phone`
- Commit message: `refactor: resolve project reads through customers joins`

**Commit 3: Refactor project create/convert flows through customer transactions**
- `POST /erp/leads/:id/convert`
- `POST /erp/projects`
- `POST /erp/files/create-project-from-file`
- Ensure every new project gets `customer_id`
- Normalize phone at write time
- Do NOT silently rewrite canonical customer data from project forms
- Commit message: `refactor: create leads and projects via customer transactions`

**Stage boundary:**
- Run `pnpm run typecheck`
- Run `pnpm run build`
- Manual backend smoke test:
- Create lead with new customer
- Create lead with existing customer
- Convert lead to project
- Create project directly
- Fetch project detail
- Fetch contract payload
- Fetch public phase payload
- Fetch payments/all
- Global search still works
- Bump all 3 package.json files to 4.0.3
- Update CHANGELOG.md
- Push all 3 commits
- Report commit hashes + version + `Stage 3 complete, ready for Stage 4`
- WAIT for user `go`

**After Stage 3:**
- Render auto-deploys
- User performs a backend smoke test against the deployed API/UI
- Only proceed to Stage 4 after confirmation

---

## Stage 4 - Customer UI Foundation (v4.0.4)

**Goal:** Add customer master-data UI and reusable form primitives without cutting over the lead/project forms yet.

**Required reading:** CLAUDE.md RTL rules, CODE_STRUCTURE.md, USERS_AND_PERMISSIONS.md, artifacts/qr-manager/src/pages/erp/Leads.tsx, artifacts/qr-manager/src/pages/erp/Projects.tsx

**Commits - exactly 2, in this order:**

**Commit 1: Add customers master-data page**
- New page: `artifacts/qr-manager/src/pages/erp/Customers.tsx`
- Add route in `App.tsx`
- Add sidebar entry in `AdminLayout.tsx`
- Page shows canonical customer records with related counts
- Read-only in first pass if needed
- Commit message: `feat: add customers master-data page`

**Commit 2: Add reusable CustomerPicker and PhoneInput components**
- New shared components under `artifacts/qr-manager/src/components/erp/`
- `CustomerPicker`
- `PhoneInput`
- Full Arabic/English + RTL support
- `PhoneInput` supports country picker, paste normalization, E.164 state
- Commit message: `feat: add reusable CustomerPicker and PhoneInput components`

**Stage boundary:**
- Run `pnpm run typecheck`
- Run `pnpm run build`
- Manual UI smoke test:
- Customers page loads in Arabic and English
- Sidebar visibility matches role matrix
- Customer search works
- Phone input formats and normalizes correctly
- Bump all 3 package.json files to 4.0.4
- Update CHANGELOG.md
- Push both commits
- Report commit hashes + version + `Stage 4 complete, ready for Stage 5`
- WAIT for user `go`

---

## Stage 5 - Lead/Project Form Refactor (v4.0.5)

**Goal:** Replace free-text customer capture in lead/project flows with customer selection or inline create.

**Required reading:** WORKFLOW_REFERENCE_v3.md form specs, CODE_STRUCTURE.md, Leads.tsx, Projects.tsx, USERS_AND_PERMISSIONS.md

**Commits - exactly 2, in this order:**

**Commit 1: Refactor lead flows to use customer picker**
- Update lead create modal and any lead edit customer fields
- Replace lead-based duplicate search with customer search
- Exact phone match auto-links existing customer
- Keep lead-specific fields separate
- Commit message: `refactor: use customer picker in lead flows`

**Commit 2: Refactor project flows to use customer picker**
- Update direct project create modal
- From-lead project conversion inherits `customerId`
- Direct project creation links or creates customer inline
- Future bulk-import service hooks prepared but not exposed in UI
- Commit message: `refactor: use customer picker in project flows`

**Stage boundary:**
- Run `pnpm run typecheck`
- Run `pnpm run build`
- Manual UI smoke test:
- Create lead with new customer
- Create lead with existing customer
- Create project with existing customer
- Create project with new customer
- Exact phone duplicate auto-links instead of duplicating
- Arabic and English validation messages render correctly
- Bump all 3 package.json files to 4.0.5
- Update CHANGELOG.md
- Push both commits
- Report commit hashes + version + `Stage 5 complete, ready for Stage 6`
- WAIT for user `go`

---

## Stage 6 - Customer Delete Warning UX (v4.0.6)

**Goal:** Surface dependency warnings before destructive customer deletes.

**Required reading:** QUALITY_GATES.md delete checklist, USERS_AND_PERMISSIONS.md, customer API contract from Stage 2

**Commits - exactly 1:**

**Commit 1: Add customer delete dependency warning UX**
- Customer page/detail delete action
- First attempt shows linked leads/projects summary from 409 payload
- Confirm path calls `?confirm=true`
- Admin only
- Show preserved QR-history note if applicable
- Commit message: `feat: add customer delete dependency warning UX`

**Stage boundary:**
- Run `pnpm run typecheck`
- Run `pnpm run build`
- Manual smoke test:
- Delete customer with no dependencies
- Delete customer with dependencies shows warning
- Confirm delete succeeds
- Non-admin cannot access delete UI or endpoint
- Bump all 3 package.json files to 4.0.6
- Update CHANGELOG.md
- Push the commit
- Report commit hash + version + `Stage 6 complete, ready for Stage 7`
- WAIT for user `go`

---

## Stage 7 - Final Cleanup + Phone Cutover Verification (v4.0.7)

**Goal:** Remove legacy duplicated columns and finalize E.164 behavior everywhere.

**Required reading:** lib/db/src/schema/leads.ts, lib/db/src/schema/projects.ts, artifacts/api-server/src/routes/erp.ts, Leads.tsx, Projects.tsx, QUALITY_GATES.md

**Commits - exactly 3, in this order:**

**Commit 1: Remove legacy customer_name and phone columns**
- Set `leads.customer_id` and `projects.customer_id` to NOT NULL
- Drop:
- `leads.customer_name`
- `leads.phone`
- `projects.customer_name`
- `projects.phone`
- Only after all Stage 3-6 smoke tests are green
- Commit message: `chore: remove legacy customer_name and phone columns`

**Commit 2: Finalize E.164 display and validation across ERP forms**
- Ensure all lead/customer/project forms use `PhoneInput`
- Ensure all display surfaces show local Saudi formatting for Saudi numbers
- Ensure backend rejects invalid non-normalized inputs on all accepting endpoints
- Commit message: `fix: finalize E.164 display and validation across ERP forms`

**Commit 3: Sync customer entity and phone rule documentation**
- Update form specs, schema docs, API docs, and validation examples
- Commit message: `docs: sync customer entity and phone rules`

**Stage boundary:**
- Run `pnpm run typecheck`
- Run `pnpm run build`
- Full regression smoke test:
- Contract page renders customer name correctly
- Project list/detail still show customer correctly
- Payments/all still shows customer correctly
- Public phase confirm still shows customer correctly
- QR-linked project deletion still preserves processed_docs history
- All phone inputs and displays work in Arabic and English
- Bump all 3 package.json files to 4.0.7
- Update CHANGELOG.md
- Push all 3 commits
- Report commit hashes + version + `Stage 7 complete, ready for Stage 8`
- WAIT for user `go`

---

## Stage 8 - Documentation Sync + v4.1.0 Tag

**Goal:** Final documentation sync and official v4.1.0 release tag.

**Required reading:** Every project-root doc that references leads, projects, phones, customers, or delete behavior

**Commits - exactly 2:**

**Commit 1: Comprehensive docs sync**
- Update `WORKFLOW_REFERENCE_v3.md`
- Update `CODE_STRUCTURE.md`
- Update `USERS_AND_PERMISSIONS.md`
- Update `QUALITY_GATES.md` if customer entity adds new deletion/search expectations
- Update `CLAUDE.md` if current-active-work/version notes changed
- Update `CHANGELOG.md`
- Commit message: `docs: comprehensive sync for v4.1.0 customer entity release`

**Commit 2: Version bump to 4.1.0 + git tag**
- Bump all 3 package.json files to 4.1.0
- Add top CHANGELOG entry for v4.1.0
- Create git tag `v4.1.0` with message:
- `Wathbah v4.1.0 - Customer entity refactor. Leads and projects now link to canonical customers with E.164 phone storage.`
- Commit message: `chore: bump version to 4.1.0`

**Stage boundary:**
- Push commits + push tag
- Report final state: tag, version, commit hashes, link to CHANGELOG entry
- v4.1.0 is officially shipped

---

## Verification Checklist by Risk Area

**Contract printing**
- `/api/erp/projects/:id/contract` still returns customer-facing fields
- Arabic and English contract render customer name correctly
- Public phase confirmation still shows `customerName`

**Payments**
- `/api/erp/payments/all` still includes customer display data
- Project payments tab still loads correctly
- Accountant deep-link path remains valid

**QR system**
- `processed_docs.project_id` is preserved/nullified, not destroyed, on project/customer delete
- QR report visibility from project pages still works
- No protected download link is opened in a new tab without auth strategy

**Phone behavior**
- Pasting Saudi local formats normalizes to E.164
- Country picker defaults to Saudi Arabia
- Non-Saudi numbers remain supported
- DB rejects invalid stored values

---

## Excluded from v4.1.0

- Customer merge tool
- Multiple phone numbers per customer
- Separate customer contacts table
- Customer-level invoice/accounting aggregation
- Historical backfill/cleanup scripts for legacy prod data
- Customer timeline analytics beyond linked leads and projects
- Qoyod customer sync
- Bulk import UI

These should be planned in a separate roadmap document when ready.

---

## Rollback Plan

If anything goes wrong at any stage:
- `v4.0.0` is the safe rollback point
- Stages 1-6 are additive by design and should be revert-safe
- Stage 7 is the only destructive schema cleanup stage and must remain isolated
- Revert path: `git revert` the bad commit(s) + push, Render auto-deploys
- Because the DB is empty, no production data recovery or backfill is required
- If Stage 7 fails after column drops, revert immediately before continuing work

---

## Communication Format Between Stages

When Claude Code reports stage completion, it must report in this exact format:

```text
STAGE N COMPLETE

Version: X.Y.Z
Commits pushed:
1. abc1234 - commit message 1
2. def5678 - commit message 2
3. ...

Typecheck: PASS
Build: PASS
CHANGELOG: updated

Ready for Stage N+1. Awaiting "go".
```

This makes the boundary unambiguous and quick to verify.
