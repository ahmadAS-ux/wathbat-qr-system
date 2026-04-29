# KNOWN_ISSUES.md
# Wathbah ERP — Open Technical Debt & Audit Findings

> **Purpose:** Single source of truth for known issues that have been
> identified but not yet fixed. Each issue lists severity, current
> mitigation, and the planned version where it will be addressed.
> **Audience:** Ahmad, Claude Code, future developers.
> **Last updated:** April 2026 — v4.1.0: resolved H-5 and M-4 (LibreOffice extractor)
> **Status:** Active — update when issues are resolved or new ones found

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
**Status:** Open
**Discovered:** v4.0.14 audit
**Planned fix:** v4.1.2 or v4.1.3 (after extractor decision is made)

**The chain:**
1. The Glass Order upload endpoint accepts `.html` files in addition to `.docx` and `.pdf` (`artifacts/api-server/src/routes/erp.ts:113`)
2. Uploaded `.html` files are stored in `project_files.file_data` as bytes
3. The file-serving endpoints (`GET /api/erp/projects/:id/files/:fileId` and `.../extracted`) are public — added to `isPublic` in v4.0.12 (`artifacts/api-server/src/app.ts`)
4. Files are served `inline` with their stored mime type — meaning `.html` files render as live HTML in the browser
5. **Anyone authenticated with upload access could upload an HTML file containing JavaScript, then any user navigating to the file URL would execute that JavaScript on the API origin — stealing JWTs from localStorage**

**Why it's not actively exploited:**
- Only authenticated users can upload (still requires login)
- Internal team only — no external user uploads in production
- File IDs are sequential integers — enumerable but not guessable to outsiders
- No known threat actors with upload access

**Files affected:**
- `artifacts/api-server/src/routes/erp.ts:113` (.html acceptance for glass)
- `artifacts/api-server/src/app.ts:33` (isPublic list)
- `artifacts/api-server/src/routes/erp.ts:2144` (inline serving)

**Planned fix:**
- **Option A (smaller):** Reject `.html` glass uploads. Only accept `.docx` and `.pdf`. The HTML support was for legacy data that doesn't exist in production.
- **Option B (larger, future):** Move file serving to a different subdomain (`files.wathbat.sa`) with no auth cookie scope. Standard isolation pattern.

A future patch will implement Option A as the immediate mitigation. Option B is a v4.4.0+ consideration.

---

### H-2 — Auth tokens are long-lived and logout doesn't revoke

**Source:** Codex external audit (April 2026)
**Status:** Open
**Discovered:** v4.0.14 audit
**Planned fix:** v4.4.0 (paired with permissions dashboard)

**The issues, compounding:**
1. JWTs have 7-day expiry — `artifacts/api-server/src/lib/auth.ts:34`
2. Logout is a client-only no-op — `artifacts/api-server/src/lib/auth.ts:38` does nothing server-side; the token remains valid until natural expiry
3. Tokens stored in `localStorage` — `artifacts/qr-manager/src/hooks/use-auth.tsx:25` — readable by any JavaScript on the page (compounds H-1)
4. No server-side blacklist — once issued, a token is valid for 7 days regardless of password change, role change, or account disable

**Real-world implication:** if H-1 is exploited (or a token leaks via any other XSS vector), the attacker has 7 days of access that cannot be revoked except by changing JWT signing keys (which logs out everyone).

**Why it's not actively exploited:** small team, internal use, no known active XSS vectors in v4.0.14. But H-1 + H-2 together form a real risk if both are present.

**Files affected:**
- `artifacts/api-server/src/lib/auth.ts:34` (token expiry)
- `artifacts/api-server/src/lib/auth.ts:38` (no-op logout)
- `artifacts/qr-manager/src/hooks/use-auth.tsx:25` (localStorage)
- `artifacts/qr-manager/src/main.tsx:10` (global injection)

**Planned fix (v4.4.0):**
The permissions stage already plans to address auth as part of the dashboard work. The fix combines:
- Server-side token blacklist (revoked JTI table, checked on every requireAuth)
- Logout endpoint that adds the current token to the blacklist
- Reduce JWT expiry to 24 hours
- Refresh token mechanism for active sessions
- httpOnly cookie auth for new tab navigation (which we considered earlier in v4.0.12 but deferred)

If a future patch ships before v4.4.0, consider an interim partial fix: just reduce JWT expiry to 24 hours (one-line change, no schema work).

---

### H-3 — Role model inconsistency: AdminUsers creates the wrong role string

**Source:** Codex external audit (April 2026)
**Status:** Open
**Discovered:** v4.0.14 audit (independently confirmed our earlier review for v4.4.0)
**Planned fix:** v4.4.0 (already in roadmap)

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
**Status:** Resolved — v4.1.0
**Discovered:** Codex inspected the actual `word/document.xml` of an Orgadata sample file
**Fixed in:** v4.1.0 — Option Medium chosen: LibreOffice headless DOCX→PDF extraction, deployed via Docker on Render

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

## Low Severity (active)

### L-1 — Default user `admin/admin123` exists on first startup

**Source:** Wathbah handoff documentation
**Status:** Documented — operational concern, not a bug
**Planned fix:** v4.4.0 (force password change on first login)

The default `admin/admin123` account is created on every fresh DB. This is intended for first-time setup but should be:
1. Force a password change on first login
2. Or generate a random password printed to logs once

Schedule with v4.4.0 since the user management dashboard is being rebuilt then.

---

## Resolved (audit log)

When resolving an issue, change its status to **Resolved**, add the version that fixed it, and move it to this section. Do not delete the issue text — keep it for audit history.

| ID | Title | Resolved in |
|----|-------|-------------|
| H-5 | Mammoth is the wrong tool for Orgadata .docx | v4.1.0 — LibreOffice DOCX→PDF |
| M-4 | FILE_UPLOAD_GUIDE.md still describes v4.0.13 extractor behavior | v4.1.0 — docs updated |

Full issue text remains in their original severity sections above for audit history.

---

## How to add a new issue

1. Pick the next available ID (H-6, M-5, L-2, etc.)
2. Add it to the appropriate severity section
3. Include: source, status, planned fix version, files affected, current mitigation
4. Update the "Last updated" date at the top of this file
5. Commit with message: `docs(known-issues): add [ID] [short title]`
