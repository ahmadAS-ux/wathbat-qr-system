# QUALITY_GATES.md
# بوابات الجودة — فحص إلزامي قبل كل commit

> **Purpose:** This file must be read by Claude Code before every commit.
> Add to CLAUDE.md quick reference: "Read QUALITY_GATES.md before committing."
> Every checklist item is a PASS/FAIL gate — all must pass before `git commit`.

---

## Pre-Commit Quality Gates

Claude Code must verify ALL of the following before running `git commit`. If any gate fails, fix it first — do not commit broken code.

---

### Gate 1: TypeScript Compilation ✅

```bash
pnpm run typecheck
```

- Zero errors required — no `// @ts-ignore` or `as any` workarounds
- Warning: `(req as any).session` pattern already exists in legacy code — do NOT add new instances. Use typed request interfaces instead.

**FAIL if:** Any TypeScript error exists. Fix the type, don't suppress it.

---

### Gate 2: Build Succeeds ✅

```bash
pnpm run build
```

- Both API (esbuild) and frontend (Vite) must build without errors
- Vite build requires `PORT` and `BASE_PATH` env vars — set them before building

**FAIL if:** Build throws any error. Do not push code that doesn't build.

---

### Gate 3: Server Starts Without Crash ✅

```bash
# Start the API server and check it responds
pnpm --filter @workspace/api-server dev &
sleep 5
curl http://localhost:3001/api/healthz
```

- Server must respond `{ "status": "ok" }` within 10 seconds
- Check terminal output for startup errors (migration failures, seed failures, missing env vars)
- All new tables must be auto-created via Drizzle migration on startup
- Seed data (admin user, dropdown options) must insert without errors

**FAIL if:** Server crashes, healthz doesn't respond, or startup logs show errors.

---

### Gate 4: New API Endpoints Respond ✅

For every NEW or MODIFIED endpoint in this commit:

```bash
# Example: test a new endpoint
curl -s http://localhost:3001/api/erp/options/lead_source | head -100
```

- Public endpoints must return 200 without auth token
- Protected endpoints must return 401 without token (not 500)
- Protected endpoints must return 200 with valid token
- Response shape must match the API contract in WORKFLOW_REFERENCE_v3.md
- **Empty responses are suspicious** — if a list endpoint returns `[]` when seed data should exist, that's a bug

**FAIL if:** Any endpoint returns 500, or returns empty when data should exist.

---

### Gate 5: Arabic Text Rendering ✅

For every NEW or MODIFIED UI component:

- All user-facing text must exist in `src/lib/i18n.ts` in BOTH Arabic and English
- No hardcoded Arabic strings in JSX — always use the `t()` or translation helper
- No hardcoded English strings visible to users
- Dropdown menus must show `labelAr` (Arabic mode) or `labelEn` (English mode) — never `value` or database keys
- Verify: switch language to Arabic → all text renders as Arabic letters, not boxes (□□□) or question marks

**Known risk:** PDF generation needs Tahoma font (TAHOMA.TTF / TAHOMABD.TTF). System fonts like FreeSans lack Arabic glyphs. If generating PDFs with Arabic, verify the font renders correctly.

**FAIL if:** Any UI text shows in wrong language, is missing, or shows as boxes/question marks.

---

### Gate 6: RTL Layout Integrity ✅

For every NEW or MODIFIED page/component:

- `dir="rtl"` set on page root — check `document.documentElement.dir`
- No `text-align: left` or `text-align: right` — use `start` / `end`
- No `margin-left`, `margin-right`, `padding-left`, `padding-right` — use `inline-start` / `inline-end`
- English text inside Arabic context wrapped with `<span dir="ltr" className="ltr">`
- Sidebar appears on RIGHT side in Arabic mode
- Icons/arrows don't look reversed (check chevrons, back buttons)
- Tables: columns should flow right-to-left in Arabic mode

**FAIL if:** Any layout element appears on wrong side or text alignment breaks when switching language.

---

### Gate 7: Form Validation & Data Integrity ✅

For every NEW or MODIFIED form:

- All required fields show validation error in Arabic when empty and submitted
- Phone number validation works (Saudi format: 05XXXXXXXX)
- Date fields accept valid dates and reject invalid ones
- Dropdown fields populated with real options — not empty or showing dashes
- File upload: correct file types accepted, oversized files rejected with message
- After successful submit: form clears, list/table refreshes, new item appears
- After failed submit: error message shown in current language, form data preserved

**FAIL if:** A required field can be submitted empty, or a form shows no feedback on error.

---

### Gate 8: Role-Based Access Control ✅

For every NEW or MODIFIED endpoint/page:

Check against the permissions table in WORKFLOW_REFERENCE_v3.md Section 4:

- **Admin:** can access everything
- **Factory Manager:** can access projects, leads, manufacturing, vendors — NOT user management
- **Employee:** can create leads/projects, upload files — NOT delete records, NOT see prices (TBD)
- **Sales Agent:** can view all leads, edit own — NOT access projects/vendors/payments
- **Accountant:** can manage payments/Qoyod — NOT create projects or leads

Test each new endpoint with at minimum 2 roles:
1. A role that SHOULD have access → returns 200
2. A role that should NOT have access → returns 403 (not 500)

**FAIL if:** An unauthorized role can access a restricted endpoint, or a 403 returns as 500.

---

### Gate 9: Data Seeding & Migration Safety ✅

- New tables use `CREATE TABLE IF NOT EXISTS` — safe to run multiple times
- Seed data uses `INSERT ... ON CONFLICT DO NOTHING` or a count-check guard — no duplicates on restart
- Column additions to existing tables use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
- Never DROP or DELETE existing data without explicit instruction from Ahmad
- Role migration: `'User'` → `'Employee'` must be idempotent (safe to run repeatedly)

**FAIL if:** A server restart causes duplicate seed data, a missing column error, or data loss.

---

### Gate 10: No Broken Existing Features ✅

After every change, verify these existing features still work:

- [ ] `/api/healthz` returns `{ ok: true }`
- [ ] Login with admin/admin123 works
- [ ] QR upload (POST /api/qr/process) still works with a .docx file
- [ ] Customer scan page (`/scan`) loads and submits
- [ ] Admin dashboard shows metrics and requests
- [ ] Service requests table loads with status filter

**FAIL if:** Any existing feature broke. The ERP is additive — it must not touch existing code paths.

---

### Gate 11: Data Ownership & Integration Check ✅

For every NEW feature or Phase that creates or consumes data:

**Data source:**
- [ ] Every piece of data has a clear single source of truth (Orgadata file / manual entry / external system)
- [ ] If two systems produce the same data field (e.g. project name from Orgadata AND from ERP) → conflict resolution is defined before coding starts

**Data binding:**
- [ ] Every record is bound to its parent entity via a foreign key (project_id / lead_id / request_id)
- [ ] It is impossible to create an unbound record unless explicitly designed that way
- [ ] If unbound records are allowed → there is a notification or warning visible to Admin

**Cross-system data flow:**
- [ ] If this feature consumes data from a previous Phase or system → the DB foreign key linking them is documented in CODE_STRUCTURE.md before coding starts
- [ ] If the foreign key is missing from an existing table → an idempotent ALTER TABLE migration is added

**Conflict handling:**
- [ ] If data comes from an external file (e.g. Orgadata .docx) AND from user input → conflict is detected server-side and surfaced to the user — never silently overwritten
- [ ] User confirmation is required before any system name/value is updated based on file content

**FAIL if:** Any record can be created without a parent entity when one is required, OR if two data sources can conflict without the user being notified.

---

### Gate 12: Version Bump on Every Release ✅

Every commit that adds a feature, fixes a bug, or changes behavior must:

**Version bump in 3 package.json files (keep them in sync):**
- [ ] package.json (root)
- [ ] artifacts/qr-manager/package.json
- [ ] artifacts/api-server/package.json

**Follow Semantic Versioning:**
- **PATCH** (x.y.Z) — bug fixes, documentation updates, small tweaks
  Example: v2.3.0 → v2.3.1
- **MINOR** (x.Y.0) — new features, non-breaking changes
  Example: v2.3.x → v2.4.0
- **MAJOR** (X.0.0) — breaking changes, architecture shifts
  Example: v2.x.x → v3.0.0

**Update CHANGELOG.md:**
- [ ] Add new entry at the top under ## [X.Y.Z] - [Month Year]
- [ ] Group changes into: Added / Changed / Fixed / Removed
- [ ] Include root cause for any bug fix

**Create Git tag:**
- [ ] After commit is pushed: git tag vX.Y.Z && git push origin vX.Y.Z

**Verify version displays correctly:**
- [ ] Footer on any admin page shows new version number
- [ ] Build hash in footer matches the commit being released
- [ ] Build date is current

**FAIL if:** Version is bumped in one package.json but not the others, or CHANGELOG is not updated, or git tag is missing.

---

## Commit Message Convention

```
type: short description

Longer explanation if needed.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Types:
- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — maintenance, version bump, docs
- `refactor:` — code restructure without behavior change

---

## Quick Reference for Claude Code

Add this to every Claude Code prompt:

```
Before committing, verify all gates in QUALITY_GATES.md pass:
1. pnpm run typecheck — zero errors
2. pnpm run build — succeeds
3. Server starts and /api/healthz responds
4. New endpoints return correct responses (not 500, not empty)
5. Arabic text renders correctly (not boxes)
6. RTL layout correct (sidebar right, text-align: start/end)
7. Forms validate required fields with Arabic error messages
8. Role permissions match WORKFLOW_REFERENCE_v3.md
9. Seed data doesn't duplicate on restart
10. Existing QR system features still work
11. Every new data record has a parent entity link (no unbound records without design intent)
12. Version bumped in all 3 package.json files + CHANGELOG updated + git tag created
```
