# KNOWN_ISSUES.md
# Wathbah ERP — Open Technical Debt & Audit Findings

> **Purpose:** Single source of truth for known issues that have been
> identified but not yet fixed. Each issue lists severity, current
> mitigation, and the planned version where it will be addressed.
> **Audience:** Ahmad, Claude Code, future developers.
> **Last updated:** 2026-05-10 — v4.4.12: H-6 resolved (LibreOffice profile isolation + CSS Grid fix + font stack); C-9 added
> **Status:** Active — update when issues are resolved or new ones found

---

## L-X — ContractPage missing share UI (DEFERRED, post v4.3.4)

**Severity:** Low
**Source:** v4.3.4 implementation review
**Status:** Resolved — v4.4.5

**Resolution:** Share block added to `ContractPage.tsx`. When a contract has an access token, ContractPage now shows the public URL, copy button, and open-in-new-tab button — mirroring the existing pattern in ProjectDetail.tsx. Backend GET contract endpoint (`GET /api/erp/projects/:id/contract`) expanded to join the `contracts` table and return `accessToken` and `tokenExpiresAt` in its response.

---

## L-X — Silent parser failure on .docx upload (DEFERRED, post v4.3.4)

**Severity:** Medium
**Source:** v4.3.4 investigation (codex_investigation_v4_3_4.md, Q2)
**Status:** Open — deferred for post-pause triage

**Description:**
When a .docx file is uploaded to a parsed slot type (Quotation, Section, Assembly List, Cut Optimisation), the file is saved successfully but parsing can fail silently. The user has no indication that the parsed data extraction failed — the file appears uploaded normally.

The v4.3.4 ParsedDataPreviewModal Download button is a workaround: even if parsed data is empty, users can always download the original file. But the underlying issue — that parsing can fail without user feedback — is not fixed.

**Current mitigation:** Download button in preview modal always available regardless of parse state.

**Why deferred:**
- Workaround exists (Download from preview modal)
- Premature investigation now = guessing at scope
- Deferred investigation after real usage = grounded in real failure patterns

**Trigger to fix:**
- A team member uploads a file expecting parsed data and gets nothing
- Frequent enough to be a real workflow problem (vs. rare edge case)

**Investigation needed before fixing:**
- Which parsers can fail (quotation, section, assembly_list, cut_optimisation)?
- What error states do they hit (timeout, malformed XML, unexpected structure)?
- Should failures show a banner on the file slot, block the upload, or log to console for admins?

**Files affected:**
- `artifacts/api-server/src/routes/erp.ts` — silent catch blocks at lines ~2031, ~2047
- `artifacts/qr-manager/src/pages/erp/ProjectDetail.tsx` — upload success handler

---

## L-X — Contract feature RESTRICT FK (v4.3.0 — known limitation)

**Severity:** Low (test data only — no production data at risk)
**Source:** v4.3.0 schema design (Codex review)
**Status:** ✅ Resolved in v4.3.1

**Description:** `contracts.quotation_file_id` uses PostgreSQL's default RESTRICT FK
behavior: deleting a `project_files` row will fail if a contract row references it.
In v4.3.0 no contracts are created (PDF generation ships in v4.3.1), so no real-world
risk existed yet.

**Fix applied in v4.3.1:** DELETE /erp/projects/:id now wrapped in `db.transaction()` and
deletes `contracts` rows before `project_files` rows for the target project.

---

## How to read this file

Each issue has:
- **Severity:** High / Medium / Low — based on real-world risk in current operating context
- **Source:** how the issue was discovered
- **Status:** Open / In Progress / Resolved
- **Current mitigation:** what protects you today (if anything)
- **Planned fix:** target version + scope of work
- **Files affected:** specific paths so future work has anchors

When an issue is resolved, **do not delete it** — change status to Resolved and add the version that fixed it. This preserves audit history.

---

## Severity definitions

- **High:** could cause data loss, security breach, or service outage in current operating context. Fix in next 1–2 versions.
- **Medium:** technical debt that creates ongoing cost (slow development, fragile builds, drift). Fix when natural to address.
- **Low:** quality-of-life. Fix when convenient.

---

## High Severity (active)

### H-1 — Stored XSS risk via .html uploads + public file serving

**Source:** Codex external audit (April 2026)
**Status:** Resolved — v4.4.5
**Discovered:** v4.0.14 audit

**Resolution:**
- **Part A:** `isGlassFormat()` no longer accepts `.html` files — Glass Order slot uploads of `.html`/`.htm` now return 400. The `isHtml` helper function is preserved (still used by glass extraction logic for legacy rows) — only its role in upload gating is removed.
- **Part B:** The file-serving handler (`GET /api/erp/projects/:id/files/:fileId`) now detects `.html`/`.htm` extensions on stored filenames and forces `Content-Type: application/octet-stream` + `Content-Disposition: attachment`, defanging any `.html` files already in the database. Browsers download them rather than rendering them as HTML, eliminating the stored-XSS chain.

**Note on Option B:** Moving file serving to a separate subdomain (`files.wathbat.sa`) remains a future hardening option but is not required given Part A + Part B coverage.

---

### H-2 — Auth tokens are long-lived and logout doesn't revoke

**Source:** Codex external audit (April 2026)
**Status:** Resolved — v4.4.9
**Discovered:** v4.0.14 audit

**Resolution:** Implemented jti-based server-side token revocation.

- JWT expiry reduced from 7 days to 24 hours (`createSession` in `artifacts/api-server/src/lib/auth.ts`).
- `createSession` now embeds a `jti: crypto.randomUUID()` in every token payload.
- New `revoked_tokens` table (idempotent `CREATE TABLE IF NOT EXISTS` migration) stores revoked jtis with their expiry timestamps.
- `deleteSession` is now async and inserts the token's jti into `revoked_tokens` on logout.
- `requireAuth` checks the blocklist after `jwt.verify` succeeds: if jti is found in `revoked_tokens`, returns 401. If DB lookup fails, returns 500 (never silently passes through).
- Startup cleanup: `DELETE FROM revoked_tokens WHERE expires_at < NOW()` runs on each server start.
- Backward compatibility: pre-v4.4.9 tokens without jti pass through and expire on their original schedule (max 7 days post-deploy).

**Remaining (deferred):**
- Tokens still stored in `localStorage` — httpOnly cookie auth deferred to future patch.
- Refresh token mechanism not implemented — 24h expiry is the mitigation.

---

### H-3 — Role model inconsistency: AdminUsers creates the wrong role string

**Source:** Codex external audit (April 2026)
**Status:** ✅ Resolved — v4.4.3
**Discovered:** v4.0.14 audit (independently confirmed our earlier review for v4.4.0)
**Fixed in:** v4.4.3

**The bug:**
1. The user creation form in `artifacts/qr-manager/src/pages/AdminUsers.tsx:217` only allows creating users with role `'Admin'` or `'User'`
2. The active RBAC system expects roles `'Admin' | 'FactoryManager' | 'Employee' | 'SalesAgent' | 'Accountant'` — see `artifacts/qr-manager/src/lib/permissions.ts:7` and route guards like `artifacts/api-server/src/routes/erp.ts:702`
3. A one-time startup migration at `artifacts/api-server/src/index.ts:519` renames legacy `'User'` → `'Employee'` for existing rows, but **the user creation form still writes `'User'`**
4. **Result:** newly-created non-Admin users get role `'User'`, which doesn't match any RBAC check, so they can't access anything until the next server restart (when the migration runs again)

**Why this hasn't been a major problem:**
- Most user creation has been Admin accounts (which map correctly)
- The one-time migration runs every startup (idempotent), so users with role `'User'` get auto-corrected to `'Employee'` within a few hours
- New non-Admin user creation has been rare in early operations

**Files affected:**
- `artifacts/qr-manager/src/pages/AdminUsers.tsx:217` (form options)
- `artifacts/api-server/src/routes/admin.ts:132` (backend creation endpoint)
- `artifacts/api-server/src/index.ts:519` (rename migration)

**Planned fix (v4.4.0):**
Already covered by the v4.4.0 permissions roadmap. The fix:
- AdminUsers form: dropdown of all 7 roles (Admin / FactoryManager / Employee / SalesAgent / Accountant / Collaborator / Customer)
- Backend creation endpoint: validate role against the 7 allowed strings
- Remove the one-time `'User'` → `'Employee'` migration (no longer needed once form is fixed)

See `V4_4_PERMISSIONS_ROADMAP.md` Commit 7.

---

### H-4 — Web process performs schema migration on startup, continues on failure

**Source:** Codex external audit (April 2026)
**Status:** Open (acceptable for current scale)
**Discovered:** v4.0.14 audit
**Planned fix:** Deferred to v4.5.0+ (architectural improvement, not urgent)

**The pattern:**
1. `artifacts/api-server/src/index.ts:22` runs `runStartupMigrations()` on every server boot
2. Migrations create/alter tables with `IF NOT EXISTS` guards (idempotent — generally safe)
3. **However:** the migration block at `artifacts/api-server/src/index.ts:508` does `DELETE FROM processed_docs WHERE project_id IS NULL` — destructive, intentional one-time cleanup from Stage 6.5
4. If migration fails, error is logged but server boot continues — `artifacts/api-server/src/index.ts:42` and `:561`

**Why this is acceptable today:**
- Single Render service instance — no concurrent migration race conditions
- All current migrations are idempotent
- The destructive `DELETE` only runs once (after first run, `WHERE project_id IS NULL` returns zero rows)
- Has been working in production since v3.x

**Why Codex flagged it:**
- In multi-instance deployments, simultaneous boots could cause race conditions
- "Continue on failure" can leave production half-migrated
- Embedded migrations are harder to roll back than dedicated migration tools

**Planned fix (v4.5.0+):**
- Migrate to a proper Drizzle Kit migration workflow (separate from app boot)
- CI step runs `drizzle-kit push` before deploy promotion
- App boot only verifies schema, doesn't modify it
- This is a significant operational change — needs its own stage planning

---

### H-5 — Mammoth is the wrong tool for Orgadata .docx (extractor produces near-empty output)

**Source:** Codex deep-dive investigation (April 2026, against v4.0.14)
**Status:** Deprecated — v4.1.1
**Discovered:** Codex inspected the actual `word/document.xml` of an Orgadata sample file
**Fixed in:** v4.1.0 — Option Medium chosen: LibreOffice headless DOCX→PDF extraction, deployed via Docker on Render
**Deprecated in:** v4.1.1 — The extractor concept itself was deprecated for the 7 Orgadata .docx slots. Upload-time extraction no longer happens. The contract feature (forthcoming) handles Quotation conversion at contract-generation time using the same LibreOffice infrastructure shipped in v4.1.0.

**The discovery (Codex's findings):**

1. The previous diagnosis ("Orgadata files are rasterized full-page JPEG images") **was wrong**. Codex unzipped the sample `Glass_Panel Order - General from 09_03_25.docx` and inspected `word/document.xml` directly. The file contains **hundreds of real text runs and tables**: glass spec rows, dimensions, prices, totals, and named fields like "Glass/Panel Order", "Date", and "Person in Charge".

2. The single image mammoth surfaces is **a 1027×128 banner logo** — not a full page render.

3. Mammoth is a **semantic-Word-document tool**, not a layout renderer. Its README explicitly warns it's a poor fit for layout-heavy documents and that it doesn't reconstruct positioned content (text boxes, anchored elements). Orgadata files use exactly that kind of layout.

4. **Result:** today's extractor produces a near-empty A4 HTML page because mammoth doesn't extract the structured table content from Orgadata's layout-driven XML. The "logo repeated many times" observation was probably 8 banner images at section breaks, with the real document content invisible to mammoth's output.

**Why all four patches today (v4.0.11 → v4.0.14) failed to fix it:**
- v4.0.11 — Built on wrong tool, wrong understanding of file structure
- v4.0.13 — "Fixed" the wrong problem (suppressed images), made it worse (blank page)
- v4.0.14 — Reverted to v4.0.11 broken state (still broken, just less broken)

The diagnosis was wrong from the start. No amount of mammoth configuration will produce useful output for these files because mammoth simply does not extract layout-driven content.

**The codebase already has the correct pattern, unused for this:**
- `artifacts/api-server/src/lib/parsers/quotation-parser.ts:24` reads .docx XML directly with `adm-zip`
- `artifacts/api-server/src/lib/parsers/section-parser.ts:17` does the same
- `artifacts/api-server/src/lib/orgadata.ts:48` provides Orgadata-specific helpers
- These parsers extract structured data successfully — they're used for QR data extraction
- The extractor at `docx-extractor.ts:18` does NOT use this approach; it uses mammoth instead

**Files affected:**
- `artifacts/api-server/src/lib/docx-extractor.ts` (the broken extractor)
- `artifacts/api-server/src/routes/erp.ts:1892` (where it's called from)
- `STAGE_6_5_PHILOSOPHY_ALIGNMENT.md:96` (Rule 11 — based on wrong assumption, needs revision after fix)
- `DESIGN_GAP_ANALYSIS.md:107` (assumes the abstraction works)
- `FILE_UPLOAD_GUIDE.md:70` (claims extractor excludes images — already stale)

**Three options (per Codex):**

| Option | Cost | What it does |
|---|---|---|
| **Small** | 1-2 hours | Hide the EXTRACTED tile for the seven Orgadata .docx slot types. Keep ORIGINAL tile + 3 buttons. Glass and Qoyod still have meaningful extracts. Honest about scope. |
| **Medium** | 3-7 days | Add LibreOffice headless to Render Docker image. Replace mammoth with `libreoffice --convert-to pdf`. Extracted artifact becomes a PDF (browsers preview PDFs natively). Real engineering work. |
| **Large** | Weeks | Build custom Orgadata XML parser using the existing `adm-zip` pattern. Produces both human preview and structured contract data. Product-level feature. |

**Codex recommends Option Medium.**

**Decision pending — Ahmad to choose between Small and Medium for v4.1.0 with fresh eyes (deferred to next session).**

**Implications for Philosophy Rule 11:**
Rule 11 ("every .docx slot gets an A4 HTML extract") was invented from assumptions about file structure that were wrong. The rule needs revision after the extractor decision is made. Glass Order's QR HTML extract works; Qoyod's byte copy is meaningful; the seven .docx slots' "A4 HTML extract" idea was built on a mistake. The Philosophy will be updated as part of whichever option is chosen.

**Related: Preview button on .docx**
Codex also confirmed Claude's earlier claim that ".docx Preview = browser download" was directionally correct but oversold as "unfixable." Real options exist:
- Convert .docx to PDF on upload (LibreOffice on Render) — same infrastructure as Option Medium above
- Frontend `docx-preview` library (renders in browser, no server changes)
- Microsoft Office Online viewer iframe (rejected by Codex — security concerns + public URL coupling)

If H-5 is fixed via Option Medium (LibreOffice), the Preview button on .docx files **automatically becomes useful** because the original would convert to PDF and serve PDF previews. This is one of the reasons Option Medium has high value despite higher cost.

**Lesson learned (process):**
The original Stage 6.6 spec was authored without empirical investigation of the actual files being processed. We invented an extractor concept based on what "should" be in a .docx, not on what was actually there. Future "extract" or "parse" stages must include an empirical investigation step (open the actual file, inspect the actual structure) before code is written. This is now codified for future sessions.

---

### H-6 — PDF contract generation crashes the API process (`spawn soffice ENOENT`)

**Source:** Production error logs; Render Blueprint sync audit (May 2026)
**Status:** ✅ RESOLVED — v4.4.12
**Discovered:** v4.4.10 investigation

**Symptom:**
Production logs show `Error: spawn soffice ENOENT` from
`lib/html-to-pdf.ts` and `lib/docx-extractor.ts` when the
"Generate PDF Contract" button is used. The API process
crashes or returns 500; no PDF is produced.

**Root cause:**
The crash is a downstream consequence of a Render Blueprint
sync failure that has been blocking since v4.1.0 (commit
de3fb2f). `render.yaml` declared `databases[0].plan: free`
while the actual managed Postgres instance was already on
`basic-256mb`. Render rejects blueprint syncs that would
downgrade a database plan, so every sync since de3fb2f was
rejected at validation — the Render UI shows the error:

  databases[0].plan cannot downgrade database from Basic-256mb to Free

Because the blueprint never applied, the LibreOffice Docker
runtime migration (introduced in de3fb2f / v4.1.0) never
took effect. The `qr-asset-manager-api` service has been
running on the Node runtime from before v4.1.0, with no
`soffice` binary present. Any call path that invokes
`libreoffice --headless --convert-to pdf` fails immediately
with ENOENT.

**Files affected:**
- `artifacts/api-server/src/lib/html-to-pdf.ts` — spawns soffice
- `artifacts/api-server/src/lib/docx-extractor.ts` — spawns soffice
- `render.yaml` — database plan declaration (fixed in v4.4.10)

**Fix applied in v4.4.10:**
`render.yaml` `databases[0].plan` corrected from `free` to
`basic-256mb` to match the actual Render instance state,
unblocking blueprint sync.

**Remaining path to full resolution:**
Render's documentation lists `runtime` as immutable on
existing services. After the v4.4.10 sync unblocks, two
outcomes are possible:

1. **Auto-flip (best case):** Render detects the Dockerfile
   declaration and flips the API service runtime from Node to
   Docker automatically. H-6 resolves without further action.
2. **Runtime stays Node:** The API service must be deleted
   and recreated via the Render dashboard so it provisions
   fresh with `runtime: docker`. This is a manual dashboard
   operation; a brief service outage (~2–5 min) is expected.
   Ahmad monitors the Render Blueprint Syncs page after
   v4.4.10 deploys to determine which path applies.

**Current mitigation:** None — PDF contract generation is
non-functional in production until the runtime carries
LibreOffice.

**Status update (v4.4.11):** v4.4.10 unblocked the Render
Blueprint sync but exposed a separate pnpm overrides issue
that prevented the Docker build from completing. v4.4.11
fixes the overrides; Docker build should now complete and
the LibreOffice-equipped container should start. H-6 will
resolve when end-to-end PDF generation is confirmed working
in production. If the v4.4.11 build deploys successfully
and login works but PDF generation still fails, open a
follow-up investigation under H-6.

**Resolution path (v4.4.10 + v4.4.11 + v4.4.12):**
- v4.4.10 unblocked Render Blueprint sync (databases plan mismatch — render.yaml said free, actual Postgres on basic-256mb).
- v4.4.11 fixed pnpm overrides (Docker build was failing on platform-specific exclusions causing ERR_PNPM_LOCKFILE_CONFIG_MISMATCH).
- v4.4.12 added LibreOffice profile isolation, stderr capture, removed CSS Grid, and corrected the font stack — together resolving the exit 1 failures.

---

### L-5 — Search functionality bugs (RESOLVED v4.4.4)

**Source:** Codex audit (May 2026)
**Status:** ✅ Resolved — v4.4.4

**Description:** Empirical search audit found multiple bugs on Customers/Leads/Projects page-level searches:
- **S-01 (HIGH):** Projects search ignored project code column entirely. The projects route had no `q` parameter at all — frontend filtered locally on already-loaded data.
- **S-02 (HIGH):** Customers phone search did not match user-typed local format (e.g., `0501234567` did not match stored `+966501234567`).
- **S-03 (HIGH):** Leads page had no page-level search bar at all.
- **S-04 (MEDIUM):** Projects text search and stage filter were mutually exclusive — you couldn't combine them.

**Resolution:**
- S-01: Projects route now parses `q` and ILIKEs across `code`, `name`, and joined `customers.name`. Frontend stops post-filtering.
- S-02: Customers route detects phone-shaped queries and normalizes via `normalizePhoneToE164()`. New `isPhoneShaped()` helper added to `phone.ts`.
- S-03: Added search input to Leads page. Backend leads route now accepts `?q=`, joins `customersTable`, and ILIKEs joined `customers.name` / `customers.phone`.
- S-04: Projects route combines `q` and `stageDisplay` in a single WHERE clause.

**Deferred to v4.4.5+:** S-05 (Customers tab/status + search), S-06 (Arabic normalization), S-07 (email/location columns), S-08 (race conditions), partial phone-prefix matching.

---

## Medium Severity (active)

### M-1 — File ingestion is RAM-heavy and DB-heavy

**Source:** Codex external audit (April 2026)
**Status:** Open (already roadmapped)
**Planned fix:** v4.2.0 — already planned in `V4_ROADMAP.md`

**The pattern:**
- `artifacts/api-server/src/routes/erp.ts:54,71` use `multer.memoryStorage()` with 50 MB per file limits
- Batch upload allows up to 20 files (`erp.ts:1614`) — theoretical 1 GB peak memory
- Files stored as Postgres `bytea` columns in `lib/db/src/schema/project_files.ts:18` and `processed_docs.ts:18`
- Render's free PostgreSQL has a 1 GB total storage limit

**Already addressed in v4.2.0 roadmap (`V4_ROADMAP.md`):**
- New `file_storage` reference table
- BYTEA columns become FK references
- Backend can swap to S3 without touching app or DB schema (storage_backend column drives behavior)
- Streaming upload instead of memory buffering

No additional action needed beyond what's already planned.

---

### M-2 — Generated API contract is stale relative to live API

**Source:** Codex external audit (April 2026)
**Status:** Open
**Planned fix:** Not yet scheduled — quality-of-life improvement

**The gap:**
- `lib/api-spec/openapi.yaml:9` documents only `/health` and `/qr/*` endpoints
- The live server in `artifacts/api-server/src/routes/index.ts:10` mounts hundreds of additional endpoints (auth, admin, erp)
- The frontend uses raw `fetch()` for core flows like auth in `artifacts/qr-manager/src/hooks/use-auth.tsx:27`
- The shared client/schema packages (`lib/api-client-react`, `lib/api-zod`) exist but are not used for the most important surfaces

**Why it's a real cost:**
- No type safety between frontend and backend on critical endpoints
- API contract drift goes undetected
- Developers maintain two versions of every endpoint type (one in TS for backend, one in TS for frontend)

**Why it's not urgent:**
- The contract is implicitly stable because frontend and backend are owned by the same team
- TypeScript catches some mismatches in code review
- Hasn't caused production bugs

**Planned fix:**
- Auto-generate OpenAPI spec from Express routes (e.g., via `express-zod-api` or similar)
- Re-generate `lib/api-client-react` from the updated spec
- Migrate frontend `fetch()` calls to typed client (incremental — endpoint by endpoint)
- This is multi-version work, schedule alongside v4.5.0 or later

---

### M-3 — Build is fragile, no CI, no tests in main manifests

**Source:** Codex external audit (April 2026)
**Status:** Partially fixable
**Planned fix:** Mockup build fix in next patch; CI/test framework in future stage

**The issues:**
1. `pnpm run build` fails without `PORT` and `BASE_PATH` env vars because of `artifacts/mockup-sandbox/vite.config.ts:8` requiring them
2. `package.json` files do not expose a `test` script
3. `.github/` directory exists but contains no CI workflow file
4. Parser tests exist under `artifacts/api-server/src/lib/parsers/__tests__` but have no run path

**Why this matters:**
- New developers can't `git clone && pnpm build` successfully without env setup knowledge
- Regressions are caught only by manual testing (which is what got us into the v4.0.13 → v4.0.14 thrash)
- No automated verification that production builds before merge

**Quick fix possible in a future patch:**
- Add fallback defaults to `mockup-sandbox/vite.config.ts` so build works without env vars (5-minute change)
- Document in CONTRIBUTING.md (or CLAUDE.md) that `pnpm run typecheck && pnpm run build` should pass before any commit

**Larger fix (future stage):**
- Add `test` scripts to root and per-package manifests
- Set up vitest or jest with the existing parser tests
- Add `.github/workflows/ci.yml` with typecheck + build + test on PR
- This is a multi-day initiative — schedule its own stage

---

### M-4 — FILE_UPLOAD_GUIDE.md still describes v4.0.13 extractor behavior

**Source:** Codex external audit (April 2026)
**Status:** Resolved — v4.1.0
**Fixed in:** v4.1.0 — FILE_UPLOAD_GUIDE.md and STAGE_6_5_PHILOSOPHY_ALIGNMENT.md updated alongside H-5 resolution

**The gap:**
`FILE_UPLOAD_GUIDE.md:70` still says the .docx extractor excludes images. This was true in v4.0.13 (briefly) and was reverted in v4.0.14. The guide is now stale on this specific topic.

This is low-effort to fix but should happen at the same time as the extractor decision (H-5), so the guide ends up describing whatever the extractor actually does post-fix.

---

## C-9 — Contract PDF: parser-derived fields blank, signature signer fields blank

**Severity:** Medium
**Status:** Identified — v4.4.13+ work
**First observed:** 2026-05-10 (after v4.4.12 ship)

After v4.4.12, contract PDF generation works end-to-end. Two field categories still render as visible em-dashes/empty lines:

1. quotationNumber / quotationDate — parser bug C-5/C-6.
2. Signature signer fields — no DB schema yet.

Neither is a runtime failure; both are visible placeholders.

---

## Low Severity (active)

### S-07 — Customers search missing email/location columns (RESOLVED v4.4.5)

**Severity:** Low
**Source:** v4.4.5 search expansion sweep
**Status:** Resolved — v4.4.5

**Description:** The customers listing search predicate covered only `name` and `phone`. Searching by email address or location text returned no results even when those values were visible in the customer row.

**Resolution:** Added `ilike(customersTable.email, ...)` and `ilike(customersTable.location, ...)` to the existing `or(...)` predicate in the customers listing route in `erp.ts`. v4.4.4 phone normalization (`isPhoneShaped`/`normalizePhoneToE164`) preserved unchanged.

---

### L-6 — Sidebar search input contrast (RESOLVED v4.4.6)

**Severity:** Low
**Source:** v4.4.6 hotfix
**Status:** Resolved — v4.4.6

**Description:** Sidebar search input had `text-white/80` set in JSX, but a global `input:not(...)` rule in `index.css` forced `#FAFAF7` cream background, producing white-on-cream text that was nearly invisible. The earlier reference to a "v4.4.3 contrast fix" was inaccurate — v4.4.3 was an unrelated RBAC fix, not a sidebar contrast change.

**Resolution:** Added `.sidebar-search-input` marker class to the input JSX, then excluded that class from the global cream-input rule in `index.css` via `:not(.sidebar-search-input)`. The input now keeps its dark-sidebar Tailwind classes (`bg-white/[0.07]` + `text-white/80`), producing white text on a semi-transparent dark background — fully readable.

**Reversibility:** Trivial. Remove the marker class from JSX and from the CSS exclusion.

---

### L-7 — Sidebar global search did not return customers (RESOLVED v4.4.6)

**Severity:** Low
**Source:** v4.4.6 hotfix
**Status:** Resolved — v4.4.6

**Description:** The sidebar search route at `GET /api/erp/search` returned only leads and projects results. Customer records were not searchable directly — they could only appear via leads/projects joins. Customer-only entities (no leads, no projects) were invisible to global search.

**Resolution:** Added a third query branch to the search route. Customer branch searches `customers.name`, `customers.phone` (with E.164 normalization), `customers.email`, and `customers.location`. Returns customer records as `type: 'customer'` in the dropdown. Frontend dropdown updated to display customer-typed results with a distinct icon (UserCircle, emerald) and label.

**Navigation:** Customer results navigate to `/erp/customers` (the list page). A future version may add `/erp/customers/:id` detail page for direct linking.

**Deferred:**
- SalesAgent role mismatch (sees search input but backend suppresses project results) — separate session.
- Project code in sidebar search — not currently searched. Separate enhancement for future version.

---

### L-8 — Sidebar search threw 500 errors due to Drizzle null-param binding (RESOLVED v4.4.7)

**Severity:** Low (search failures — not a data-loss issue)
**Source:** v4.4.7 Codex empirical audit
**Status:** Resolved — v4.4.7

**Description:** All sidebar search queries triggered Postgres error `42P18: could not determine data type of parameter` and returned 500 from `/api/erp/search` (and `/api/erp/leads/search`). User-visible symptom: "No results" dropdown for every query, even valid ones like a customer name that clearly existed.

**Root cause:** Three Drizzle SQL template literals used the pattern `OR (${normalizedPhone} IS NOT NULL AND c.phone = ${normalizedPhone})` where `normalizedPhone` could be `null` (returned by `normalizePhoneToE164` for non-phone-shaped queries). Postgres prepared-statement type inference cannot resolve the type of an untyped null parameter inside a bare `IS NOT NULL` check, so the entire query failed at bind time.

**Why this wasn't caught earlier:** Two prior Codex audits performed static SQL string review and concluded the SQL was correct (it IS, when types are explicitly declared). The bug only manifests at runtime parameter binding via Drizzle/pg. The v4.4.7 audit performed empirical reproduction in a real PostgreSQL cluster, confirming both the bug and the fix.

**Resolution:** Replaced the broken pattern at three sites in `artifacts/api-server/src/routes/erp.ts`:
- `/erp/leads/search` (lines 858–875)
- `/erp/search` leads branch (lines 904–916)
- `/erp/search` customer branch (lines 941–950)

Each now uses Drizzle's `sql.empty()` for a conditional fragment:

```typescript
const phoneExactMatch = normalizedPhone
  ? sql`OR c.phone = ${normalizedPhone}`
  : sql.empty();
```

Interpolated as `${phoneExactMatch}` into the parent query. When `normalizedPhone` is null, `sql.empty()` renders as a no-op (no SQL text, no parameters), eliminating the untyped-null binding.

**Reversibility:** Revert single commit. The conditional-fragment pattern is well-known Drizzle idiom; no new dependencies.

---

### L-1 — Default user `admin/admin123` exists on first startup

**Source:** Wathbah handoff documentation
**Status:** Resolved — v4.4.8

**Resolution:** Implemented force-password-change flow with scrypt-safe default detection.

- Schema: added `must_change_password` boolean column to `users` table (idempotent ALTER TABLE migration).
- Backend lib: `artifacts/api-server/src/lib/default-passwords.ts` exports an `isDefaultPassword()` check against a known weak-password Set (`admin123`, `password`, `12345678`, `admin`, `wathbah`, `password123`).
- Login auto-flag: when a user authenticates with a password matching the defaults Set, the flag is set automatically (post-auth, idempotent). No deterministic-hash comparison needed (which would not work with scrypt's per-salt non-determinism).
- `/auth/me` does DB lookup so the flag survives page reload.
- `/auth/change-password` endpoint validates new password (≥6 chars, not on defaults list).
- `/admin/users/:id/clear-must-change` admin-only rollback endpoint for stuck users.
- Frontend: standalone ChangePassword page (NOT wrapped in AdminLayout — prevents redirect loop). AdminLayout guard redirects to `/change-password` unless already on `/change-password` or `/login`. Login redirects to `/change-password` instead of `/` when flag is set.
- AdminUsers shows per-row "Force password change" button.

**Auto-handles seeded admin:** No manual SQL needed. First time admin logs in with `admin123`, the auto-flag fires, and they're redirected to `/change-password`.

**Rollback (emergency, all users stuck):** `UPDATE users SET must_change_password = FALSE;`

---

### L-2 — Auto-displayed parsed tables on Files tab (RESOLVED v4.1.2)

**Description:** ProjectDetail.tsx auto-fetched and rendered
inline parsed-data tables for Assembly List ("22 positions"
table) and Cut Optimisation ("21 profiles" table) under their
respective slot cards. The user never requested these displays.

**Status:** Resolved — v4.1.2

**Resolution:** Frontend display removed (loadParsedData
function, useState, useEffect, render blocks, interfaces all
cleaned up). Backend parsing infrastructure preserved. v4.1.3
plans to add an on-demand Preview modal that uses this data.

**Reversibility:** High. To restore display, re-add the chain
in ProjectDetail.tsx.

---

### L-3 — Logo asset display issues (RESOLVED v4.4.2)

**Description:** Company logo (image_1774733777220.png) had a
white background. Sidebar (AdminLayout.tsx:157) and Login
(Login.tsx:46) used CSS inversion to render it on dark
surfaces, producing artifacts. Header (Header.tsx:35-37) and
ContractPage (ContractPage.tsx:373) rendered the white-
background logo on light surfaces, where it appeared invisible
(white-on-white).

**Status:** Resolved — v4.4.2

**Resolution (v4.1.2 stopgap):** Replaced the logo file with a
transparent-background PNG version of the real Wathbah brand
logo. CSS inversion on dark surfaces retained. Light surfaces
now display the logo correctly without inversion.

**Resolution (v4.4.2 final):** Replaced stopgap with `wathbah-logo.png`
(292×220 px RGBA, proper brand asset). CSS inversion retained on dark
surfaces (sidebar, login); no inversion on light surfaces (header,
contract). Sidebar logo bumped h-9 → h-12. White-background artifacts
fully eliminated.

**Future work:** v4.1.3 or later — replace stopgap with
proper dual-asset approach (separate light-color logo for
dark surfaces, no CSS inversion). Requires designer-provided
light-variant asset.

---

### L-4 — Default UI text size too dense for default zoom (RESOLVED v4.4.0)

**Description:** Default font sizing of sidebar nav items and page-header titles forced Ahmad to manually zoom the browser to 80–90% to achieve a comfortable working density. New users would land on the default zoom and see oversized chrome.

**Status:** Resolved — v4.4.0

**Resolution:** Reduced sidebar nav text from `text-[13.5px]` to `text-[13px]` in `AdminLayout.tsx`. Reduced page header titles from `text-2xl` to `text-xl` on `Customers.tsx`, `Leads.tsx`, and `Projects.tsx`. ERP pages already at `text-xl` were intentionally left unchanged. Subtitles, table headers, table cells, form labels, form inputs, button labels, search bars, and footers were intentionally NOT modified — content density preserved.

**Reasoning:** Codex empirical review chose these exact swaps to match Ahmad's preferred ~85% zoom default without pushing Tajawal Arabic glyphs below readable size.

---

## Resolved (audit log)

When resolving an issue, change its status to **Resolved**, add the version that fixed it, and move it to this section. Do not delete the issue text — keep it for audit history.

| ID | Title | Resolved in |
|----|-------|-------------|
| L-8 | Sidebar search 500 errors — Drizzle null-param 42P18 | v4.4.7 — sql.empty() conditional fragment at 3 sites |
| L-7 | Sidebar global search did not return customers | v4.4.6 — customer branch added to /erp/search route |
| L-6 | Sidebar search input contrast | v4.4.6 — .sidebar-search-input marker class + global CSS exclusion |
| S-07 | Customers search missing email/location columns | v4.4.5 — added to customers listing ILIKE predicate |
| L-X | ContractPage missing share UI | v4.4.5 — share block added, backend expanded to return token fields |
| H-1 | Stored XSS via .html glass uploads + inline serving | v4.4.5 — upload rejected, serve-time defanging applied |
| L-5 | Search bugs: no q on projects, no phone normalization, no Leads search, stage+search conflict | v4.4.4 — S-01/02/03/04 fixed |
| H-3 | Role model inconsistency: AdminUsers creates wrong role string | v4.4.3 — form, backend validator, schema default all corrected |
| H-5 | Mammoth is the wrong tool for Orgadata .docx | Resolved in v4.1.0 then Deprecated in v4.1.1 — extraction concept removed for non-Glass/non-Qoyod slots |
| M-4 | FILE_UPLOAD_GUIDE.md still describes v4.0.13 extractor behavior | v4.1.0 — docs updated |

Full issue text remains in their original severity sections above for audit history.

---

## How to add a new issue

1. Pick the next available ID (H-6, M-5, L-2, etc.)
2. Add it to the appropriate severity section
3. Include: source, status, planned fix version, files affected, current mitigation
4. Update the "Last updated" date at the top of this file
5. Commit with message: `docs(known-issues): add [ID] [short title]`
