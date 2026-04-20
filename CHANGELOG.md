# Changelog

All notable changes to the Wathbah QR Asset Manager are documented in this file.

---

## [2.6.1] - April 2026

### Fixed — Audit Issues (payment roles, phone validation, RTL, i18n)

- **CRITICAL — Payment role permissions** (`erp.ts`): `POST /erp/projects/:id/payments` (create milestone) was incorrectly gating on `Admin, FactoryManager, SalesAgent`. Changed to `Admin, Accountant` to match WORKFLOW_REFERENCE_v3 Section 4 permissions matrix.
- **Phone validation** (`Projects.tsx`): Added `type="tel"`, `maxLength={10}`, and `/^05\d{8}$/` regex validation to the phone field in `CreateProjectModal`. Shows Arabic error via `erp_phone_error` i18n key. Field border turns red on invalid input; clears on edit.
- **RTL violation** (`ContractPage.tsx`): Changed `.contract-page[dir="rtl"] { text-align: right }` to `text-align: end` to comply with CSS logical properties rule.
- **Hardcoded bilingual strings** — Moved 13 `isRtl ? 'ar' : 'en'` inline strings to `i18n.ts` across 6 files:
  - `AdminSettings.tsx`: `settings_load_error`, `settings_save_error`, `loading_text`, `saving_text`
  - `ContractPage.tsx`: `contract_load_error`, `contract_loading`, `error_unexpected`, `contract_no_quotation`, `erp_cancel` (reused)
  - `Payments.tsx`: `erp_payment_proof`, `choose_file`
  - `ProjectDetail.tsx`: `cut_opt_more_profiles`, `contract_stage_label`, `erp_payment_label_placeholder`, `choose_file`
  - `Projects.tsx`: `admin_filter_all` (reused existing key)

### Changed — UI/UX (sidebar, navigation, cross-references)

- **Sidebar sections** (`AdminLayout.tsx`): Collapsible MANUFACTURING SYSTEM + QR SYSTEM sections with `localStorage` persistence, 44px touch targets, border-inline-start accent, no scrollbar.
- **Split Clients & Projects** into two separate sidebar nav items: Clients (`/erp/leads`, Users2 icon, overdue badge) + Projects (`/erp/projects`, FolderOpen icon).
- **Same-page nav refresh**: Clicking the active sidebar link forces `window.location.href` for a full page reload.
- **Email button** (`ResultsView.tsx`): Added Send Email action (opens `mailto:` with pre-filled subject + bilingual body).
- **Cross-reference links**: Lead→Project and Project→Lead cross-reference buttons styled with teal colour + hover underline.

---

## [2.5.3] - April 2026

### Added — Assembly List + Cut Optimisation Parsers

- **`parsed_assembly_lists` DB table** — stores parsed positions (positionCode, quantity, system, dimensions, glass items) from Orgadata Assembly List DOCX files
- **`parsed_cut_optimisations` DB table** — stores parsed profile summary (number, description, colour, qty, length, wastage) from Orgadata Cut Optimisation DOCX files
- **`assembly-list-parser.ts`** — extracts project name + walks Position/Quantity/System/Size/Glass segments; parses glass rows in groups of 6 after header skip
- **`cut-optimisation-parser.ts`** — extracts project name + finds Summary marker, skips 11 headers, parses profile rows in groups of 7
- **Auto-parse on upload** — uploading `assembly_list` or `cut_optimisation` file type triggers non-blocking parse; file is always saved even if parse fails
- **`GET /api/erp/projects/:id/parsed-assembly-list`** — returns parsed assembly list row (Admin/FactoryManager/Employee)
- **`GET /api/erp/projects/:id/parsed-cut-optimisation`** — returns parsed cut optimisation row
- **ProjectDetail data panels** — position count badge on Assembly List file card + expandable list (positionCode, qty, dimensions, first glass description); profile count badge on Cut Optimisation card + compact table (top 10: Profile No, Description, Qty, Wastage%)
- **7 new i18n keys** (`assembly_list_parsed_positions`, `assembly_list_pcs`, `cut_opt_*`) in both Arabic and English
- Removed "Orgadata Technical Document sample" from CLAUDE.md pending list — replaced by shared real document samples

---

## [2.5.2] - April 2026

### Added — Contract Generator (A4 printable HTML + Settings template + Integrity Check)

- **`system_settings` DB table** — key-value store for admin-editable settings; seeded with 6 contract template keys on startup
- **`GET/PUT /api/erp/settings/contract-template`** — Admin-only endpoint to read/upsert contract template sections
- **`GET /api/erp/projects/:id/contract`** — Returns project + quotation + section + drawing metadata + template for contract rendering
- **`POST /api/erp/projects/:id/contract/mark-printed`** — Advances stageInternal to 4 when contract is printed
- **`POST /api/erp/projects/:id/contract/override-log`** — Logs integrity override events
- **Contract page** at `/erp/projects/:id/contract` — cover page → positions table → drawings (1 per A4 page) → terms + signature
- **Print CSS** using `@page size: A4` + `page-break-after: always` — no PDF library, browser native
- **Drawings** loaded lazily via `<img src="/api/erp/drawings/:id">` — no base64 blobs
- **`{{placeholder}}` rendering** — `renderPlaceholders()` + `findUnresolved()` for template substitution
- **Contract Integrity Check** (`contract-integrity.ts`) — runs on page load, returns green/amber/red + issue list; blocks print on errors
- **Override flow** — confirmation modal → logs to backend → enables one print session
- **Admin Settings page** at `/erp/settings` (Admin only) — Contract Template editor with 6 textareas, placeholder reference card, RTL-aware (Tajawal/DM Sans)
- **"Generate / Print Contract" button** on ProjectDetail — visible to Admin/FactoryManager/SalesAgent; disabled if no quotation uploaded
- **38 new i18n keys** (`contract_*`) in both Arabic and English
- Updated `WORKFLOW_REFERENCE_v3.md`: Stage 4, Section 3.7 (system_settings), Section 8 (navigation)

---

## [2.5.1] - April 2026

### Added — Quotation + Section Parsers with 409 name-mismatch detection

**Backend (`artifacts/api-server/`)**
- New DB tables: `parsed_quotations`, `parsed_sections`, `parsed_section_drawings` (created on startup, idempotent)
- `quotation-parser.ts`: extracts project name, quotation number (collapses digit-spaces), date (DD/MM/YYYY), position rows (code, qty, unit price, line total, description), grand totals. Fingerprint-deduplicates screen+print copies
- `section-parser.ts`: extracts metadata (project name, system), walks `<a:blip>` in document order, dedupes consecutive duplicates, returns drawings with `orderIndex` preserved. `positionCode` is null — deferred to v2.5.2
- `name-match.ts`: `normalizeProjectName` + `namesMatch` helpers (strips punctuation, lowercases, collapses spaces)
- Upload handler `POST /api/erp/projects/:id/files`: after saving file, dispatches to parser based on `fileType`. **Parser failure does NOT roll back the file upload**
- Quotation 409 flow: if project name in file ≠ system name, deletes the just-inserted file row and returns `{ error: 'PROJECT_NAME_MISMATCH', nameInFile, nameInSystem }`. Pass `?confirmNameMismatch=true` to bypass; add `?updateProjectName=true` to rename the project
- Section name mismatch: warning-only (logs, does not block)
- New GET endpoints: `GET /api/erp/projects/:id/parsed-quotation`, `GET /api/erp/projects/:id/parsed-section` (metadata + drawing list, no blobs), `GET /api/erp/drawings/:id` (streams image with `Cache-Control: public, max-age=3600`)
- Parser unit tests in `src/lib/parsers/__tests__/` using `node:test` + fixture files from `test-fixtures/` (skipped gracefully if fixtures absent)

**Frontend (`artifacts/qr-manager/`)**
- `NameMismatchModal.tsx`: shows both names in styled boxes; three choices: Proceed & update project name (amber) / Proceed (bordered) / Cancel upload (gray). RTL-safe, both names LTR-wrapped
- `ProjectDetail.tsx`: `uploadFile` now checks for 409 on `price_quotation` and sets `nameMismatch` state → modal shown → retry with `?confirmNameMismatch=true[&updateProjectName=true]`
- 8 new i18n keys: `name_mismatch_*` + `parser_warning_toast` (ar + en)

**Docs**
- `WORKFLOW_REFERENCE_v3.md` Section 3: added `parsed_quotations`, `parsed_sections`, `parsed_section_drawings` schema definitions
- `WORKFLOW_REFERENCE_v3.md` Section 7: Quotation + Section updated from "⏳ Parser in v2.5.1" → "✅ Parsed"
- `WORKFLOW_REFERENCE_v3.md` Stage 2–3: updated to describe parser behavior and 409 flow

### Gate 12 — Version Bump
All 3 package.json files synced to 2.5.1.

---

## [2.5.0] - April 2026

### Changed — Project Files Slots Cleanup (UI + backend validation)

**Backend (`artifacts/api-server/`)**
- Created `lib/db/src/constants/file-types.ts` — single source of truth for `PROJECT_FILE_TYPES`, `DEPRECATED_FILE_TYPES`, `MULTI_FILE_TYPES`, `UI_SLOT_ORDER`
- Added `lib/db/src/constants/index.ts` and exported from `lib/db/src/index.ts`
- `POST /api/erp/projects/:id/files`: validates `fileType` — deprecated types (`technical_doc`, `qoyod_deposit`, `qoyod_payment`, `attachment`) return 400 with deprecation message; invalid types return 400
- Multi-file behavior: `qoyod` uploads accumulate (no deletion of prior files); all other types replace on re-upload
- `GET /api/erp/projects/:id`: files now include `uploadedByName` (joined from users table)
- `DELETE /api/erp/projects/:id/files/:fileId`: permissions expanded to Admin / FactoryManager / Accountant / file owner (was ADMIN_FM only); returns 204 No Content
- Startup log: counts legacy fileType rows in DB (`technical_doc`, `qoyod_deposit`, `qoyod_payment`, `attachment`) — informational only, zero behavioral impact
- TODO comment added in `erp.ts` for Phase 2 payment milestone upload integration

**Frontend (`artifacts/qr-manager/`)**
- Project Files card replaced: 5 slots → 6 slots in new order:
  1. Glass / Panel Order (`glass_order`) — single-file
  2. Quotation (`price_quotation`) — single-file, renamed from "Price Quotation"
  3. Section (`section`) — single-file, new
  4. Assembly List (`assembly_list`) — single-file, new
  5. Cut Optimisation (`cut_optimisation`) — single-file, new
  6. Qoyod (`qoyod`) — **multi-file**: shows file list with uploader name, date, download + delete per file; "Add file" button; empty state with Upload button
- Removed `FILE_TYPES` constant; replaced with `FILE_SLOTS` (6 entries with `multiFile` flag)
- Added `deleteFile()` handler calling `DELETE /api/erp/projects/:id/files/:fileId`
- 16 new i18n keys added (ar + en): `project_file_*` namespace

**Docs**
- `WORKFLOW_REFERENCE_v3.md` Section 3.4: updated `fileType` comment
- `WORKFLOW_REFERENCE_v3.md` Section 7: replaced 3-row table with 6-row table; added multi-file and parser status columns
- `WORKFLOW_REFERENCE_v3.md` Stage 5 + Stage 11: updated to reference Qoyod slot; noted v2.5.0 merge

### Deprecated (hidden from UI, still in DB)
- `technical_doc` — replaced by `section` + `assembly_list` + `cut_optimisation`
- `qoyod_deposit` / `qoyod_payment` — merged into multi-file `qoyod` slot
- `attachment` — removed

### Gate 12 — Version Bump
All 3 package.json files synced to 2.5.0.

---

## [2.4.2] - April 2026

### Changed (Frontend — ProjectDetail.tsx detect-first glass order)

- Replaced the 409-based conflict dialog in `ProjectDetail.tsx` with a detect-first flow
- When a `glass_order` file is selected, `POST /api/erp/files/detect-project` is called first to extract the Orgadata name before uploading
- New `GlassOrderConfirmDialog` shows the orgadata name pill (same style as v2.4.1) and:
  - If names match: single "Upload" confirm button (no conflict steps needed)
  - If names differ: "Update system name" / "Keep current name" / "Cancel" — same resolution options as the old 409 dialog
- Detecting spinner shown in the file row's upload button while the detect call is in-flight
- Graceful fallback: if `detect-project` fails for any reason, upload proceeds directly (no regression)
- Removed `ConflictData` interface and `conflictData` state; replaced by `GlassDetectResult` + `glassDetect`
- 2 new i18n keys: `glass_confirm_title` + `glass_confirm_upload` (ar + en)

### Why

Issue #4 extension — detect-first UX is now consistent across all upload entry points:
Home.tsx (v2.4.1) and ProjectDetail.tsx (v2.4.2) both show the orgadata name before committing the upload.

### Gate 12 — Version Bump
All 3 package.json files synced to 2.4.2.

---

## [2.4.1] - April 2026

### Added (Frontend — Home.tsx project picker dialog)

- `DetectDialog` component inline in `Home.tsx` — 3-step upload flow: detect → pick project → upload
- Step 1: File drop → `POST /api/erp/files/detect-project` → show orgadata name pill + fuzzy-matched project cards
- Step 2: User clicks a matching project card (green ≥80% match, amber 60–79%) to upload; or expands "Create new project" form
- Step 3: Create-new form pre-fills project name from Orgadata; requires customerName, buildingType, productInterest; calls `POST /api/erp/files/create-project-from-file` then uploads to resulting project
- Upload calls `POST /api/erp/projects/:id/files?confirm=true&fileType=glass_order` — saves to `processed_docs` with `project_id` set
- 9 new i18n keys in both Arabic and English (`detect_dialog_title`, `detect_orgadata_label`, `detect_matches_heading`, `detect_no_matches`, `detect_score_label`, `detect_create_heading`, `detect_create_submit`, `detect_cancel`, `detect_customer_name`)

### Changed

- `Home.tsx` no longer uses `useProcessDocument` hook (`POST /api/qr/process`); replaced with direct fetch calls to the ERP endpoints from v2.4.0
- All glass orders uploaded from Home.tsx now save to `processed_docs` with a `project_id` (Issue #4 fully resolved for Admin upload path)

### Gate 12 — Version Bump
All 3 package.json files synced to 2.4.1.

---

## [2.4.0] - April 2026

### Added (Backend only — Frontend in v2.4.1 and v2.4.2)

- New utility: `artifacts/api-server/src/lib/orgadata.ts` — extracts project name and person in charge from Orgadata DOCX without saving to DB (pure function)
- New utility: `artifacts/api-server/src/lib/fuzzy-match.ts` — finds projects with similar names using string-similarity library (tolerant of spaces, case, punctuation; score 0–100, threshold 60, max 5 results)
- New endpoint: `POST /api/erp/files/detect-project` — analyzes uploaded DOCX, returns Orgadata name + fuzzy-matched existing projects (no save, multipart/form-data)
- New endpoint: `POST /api/erp/files/create-project-from-file` — creates new project with Orgadata name + user-provided customer data (buildingType, productInterest required)
- New dependency: `string-similarity@^4.0.4` + `@types/string-similarity@^4.0.2`

### Why

Issue #4 required every Orgadata file to be linked to a project. v2.3 solved it for files uploaded from inside an existing project. v2.4 extends this to the Home.tsx upload path — Admin can now upload a file and either link to an existing project (fuzzy match) or create a new project inline. This commit adds only the backend — frontend follows in v2.4.1 (Home.tsx) and v2.4.2 (ProjectDetail.tsx).

### Framework compliance

- Gate 11 (Data Ownership): Every new endpoint enforces project_id linkage — no file can exist without a parent entity
- Gate 12 (Version Bump): All 3 package.json files synced to 2.4.0

---

## [2.3.1] - April 2026

### Added

- Version display in admin footer — shows on every admin page (Dashboard, History, Requests, Users, Dropdowns, Leads, Projects)
- Footer format: "Wathbat Aluminum · wathbat.sa" + "vX.Y.Z · Build [hash] · [date]"
- Commit hash and build date auto-injected at Vite build time via `define` compile-time constants
- Not visible on Login page or public Scan page (by design — those use Header.tsx, not AdminLayout)

### Framework improvements

- **QUALITY_GATES.md Gate 12** added — Version Bump on Every Release
  - Enforces Semantic Versioning (MAJOR.MINOR.PATCH)
  - Requires version sync across all 3 package.json files
  - Requires CHANGELOG entry + git tag
  - Verifies footer displays correct version
- CLAUDE.md Quick Reference updated with version rule (gate count 10 → 12)

### Why this was added

Previously there was no visible indicator of which version was deployed. When a bug occurred, we had no easy way to tell if the user was seeing the old or new code after a deploy. The footer now makes this instant — screenshot a bug → see exactly which commit introduced it.

---

## [2.3.0] - April 2026

### Fixed

#### Critical: Glass Order → Project linking (Issue #4)
- DOCX uploads via the legacy QR system produced `processed_docs` records with no link to any ERP project or customer — impossible to trace which delivery belonged to which customer
- Root cause: Layer 1 (QR system, v1.0) was built before Layer 2 (ERP, v2.x) existed. The `processed_docs` table was never designed with a `project_id` foreign key
- Why the framework missed it: QUALITY_GATES.md had no gate checking data ownership or cross-system binding. PROJECT_HEALTH_REVIEW.md Part A had no question asking "can this data exist without a parent entity?"

### Added

- Idempotent migration: `ALTER TABLE processed_docs ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id)`
- Glass order upload from `ProjectDetail.tsx` now extracts the project name from the Orgadata DOCX and compares it to the ERP `projects.name`
- If names differ: returns `409 Conflict` with both names → employee sees a confirmation dialog with 3 options:
  - Update system name to match Orgadata
  - Keep current system name
  - Cancel upload
- New endpoint: `GET /api/erp/projects/:id/qr-orders` — returns all glass order records linked to a project (without binary blobs)
- New section in `ProjectDetail.tsx`: "طلبيات QR / QR Orders" shows all glass orders linked to the project with filename, position count, upload date, and View Report button
- `Home.tsx` (legacy QR upload page) is now Admin-only. Non-Admin users are auto-redirected to `/erp/projects` via `useEffect`. Admin sees a banner explaining the new workflow.
- 11 new i18n keys for the QR orders section, conflict dialog, and admin-only banner

### Framework improvements (prevent recurrence)

- **QUALITY_GATES.md Gate 11** added — Data Ownership & Integration Check. Every new feature must verify: data source, foreign key binding, cross-system data flow, and conflict handling.
- **PROJECT_HEALTH_REVIEW.md Part A Section A1** — new row asking about data ownership per data type (origin, storage, parent link, unbound behavior)
- **Issue #4 documented in Part D** with 6-step fix plan and "Why the framework missed it" root cause analysis

### Removed — Deployment cleanup

- Deleted `railway.toml` — Railway was abandoned, kept sending build failure notifications on every push
- Removed all Railway references from `DEPLOY.md`, `CLAUDE.md`, and `PROJECT_DOCS.md`
- Render.com is now the only documented deployment platform

### Known Limitations (carried from v2.2)

- Free-tier cold starts on Render (15-60s first load)
- In-memory stats counters reset on every restart
- `deleteSession()` still a no-op — JWTs valid 7 days after logout
- No automated tests

---

## [2.2.0] - April 2026

### Fixed

#### Critical: ERP API calls hitting frontend instead of API server (Issue #3)
- All 21 `fetch()` calls across 6 ERP files were using bare `/api/erp/...` paths with no `API_BASE` prefix
- In production, bare paths resolve to the frontend static site (which has no proxy), not the API server — entire ERP system was non-functional in production
- Added `import { API_BASE } from '@/lib/api-base'` and prepended `${API_BASE}` to every ERP fetch call
- Files fixed: `Leads.tsx`, `LeadDetail.tsx`, `Projects.tsx`, `ProjectDetail.tsx`, `AdminUsers.tsx` (ERP option calls), `AdminLayout.tsx` (overdue badge)

#### Phone number validation (Issue #2)
- Lead creation form accepted any text in the phone field — no format enforcement
- Frontend: added `type="tel"`, `maxLength={10}`, digits-only filter, `05XXXXXXXX` placeholder, `/^05\d{8}$/` regex validation, Arabic/English error message via `erp_phone_error` i18n key
- Backend: same regex enforced in `POST /api/erp/leads` — returns `400` if phone doesn't match

#### Dropdown options visibility (Issue #1)
- Options were invisible in the lead creation form due to two compounding bugs:
  1. `active` filter used `eq(active, true)` which excludes SQL `NULL` rows — changed to `ne(active, false)` (includes `NULL`)
  2. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS active` missing — tables created before this column was added never got it; now added as an idempotent startup migration
  3. `Promise.all` error was silently swallowed — replaced `.catch(() => {})` with logging + visible amber error banner (`erp_options_load_error` i18n key)
  4. Array guard added: `Array.isArray(s) ? s : []` prevents crashes if API returns unexpected shape

### Added
- `erp_phone_error` i18n key (ar + en) for phone validation error message
- `erp_options_load_error` i18n key (ar + en) for dropdown fetch failure banner
- Startup migration: `ALTER TABLE dropdown_options ADD COLUMN IF NOT EXISTS active / sort_order`
- Startup migration: `UPDATE dropdown_options SET active = true WHERE active IS NULL`

---

## [2.1.0] - April 2026

### Added — Phase 1 ERP Foundation

#### Leads CRM
- New `leads` and `lead_logs` DB tables (auto-created on startup)
- Full leads list page (`/erp/leads`) with status tabs: Active / All
- Lead creation modal with all required fields and dropdown integration
- Lead detail page (`/erp/leads/:id`) with contact log timeline (reverse-chronological)
- "Convert to Project" action — copies lead data to new project, marks lead as converted
- "Mark as Lost" action with reason modal
- Overdue detection: leads with `firstFollowupDate` in the past shown with red badge
- Sidebar badge on "العملاء والمشاريع" shows count of overdue leads

#### Projects
- New `projects` and `project_files` DB tables
- Projects list page (`/erp/projects`) — card grid with 4 display stage filters
- Project detail page (`/erp/projects/:id`) with 13-step internal stage timeline
- File upload per file type (glass order, technical doc, price quotation, Qoyod docs)
- File download (streams BYTEA from DB as attachment)
- Notes editor with save/cancel

#### Dropdown System
- New `dropdown_options` DB table with `category`, `value`, `labelAr`, `labelEn`, `sortOrder`, `active`
- Seeded with 18 defaults across 4 categories: `lead_source`, `product_interest`, `building_type`, `budget_range`
- Public endpoint `GET /api/erp/options/:category` (no auth required — used by forms)
- Admin endpoint `GET /api/erp/options` — all options for all categories
- Admin Dropdown Editor in Settings page (`/admin/users`) — collapsible per-category, add/delete options

#### Infrastructure
- 5 new roles: `Admin`, `FactoryManager`, `Employee`, `SalesAgent`, `Accountant`
- `requireRole(...roles)` middleware added to `src/lib/auth.ts`
- Startup migration: `'User'` role renamed to `'Employee'` (idempotent)
- All ERP routes in `artifacts/api-server/src/routes/erp.ts`, mounted at `/api/erp/`
- ERP pages in `artifacts/qr-manager/src/pages/erp/`
- ~60 new i18n keys added to `src/lib/i18n.ts` for all ERP UI strings
- New support docs: `QUALITY_GATES.md`, `UI_UX_CHECKLIST.md`, `SECURITY_BASELINE.md`, `CODE_STRUCTURE.md`

---

## [1.1.0] - April 2026

### Changed
- **Simplified customer scan page (`/scan`):** Removed the request type dropdown (previously had 5 options: Item Received, Manufacturing Defect, Maintenance Request, Replacement Request, Order Inquiry). All scan form submissions now use `"Customer Request"` as the hardcoded request type. Customers no longer select a reason.
- **Admin dashboard and requests table:** Removed the "Type / نوع الطلب" column from both the dashboard preview table (`Admin.tsx`) and the full requests page (`AdminRequests.tsx`).
- **Admin "New Request" modal:** Removed the request type dropdown; new requests created by admins also use `"Customer Request"` automatically.
- **i18n cleanup:** Removed `scan_reason_label`, `scan_reason_placeholder`, and the five `scan_reason_*` translation keys from both `en` and `ar` locales.
- The `requestType` field still exists in the database schema and API — it now always receives `"Customer Request"` from both the scan form and the admin modal.

---

## [1.0.0] - April 2026

### System
- Initial production release deployed on Render.com
- Three services provisioned via `render.yaml` Blueprint: PostgreSQL database, Express API, React static site
- pnpm workspace monorepo with TypeScript strict mode throughout
- Database tables auto-created on first server startup; default `admin` account seeded automatically
- Startup migration backfills legacy `invoice_number` → `project_name` for older scan records

### Features

#### DOCX Processing
- Upload Orgadata LogiKal glass/panel order `.docx` files (max 50 MB)
- Parse `word/document.xml` to extract project name, date, and all position rows
- Detect multiple glass sections per document via "Name:" header rows; group positions per glass type
- Deduplicate tables — Orgadata exports both screen and print copies; fingerprint-based deduplication keeps only unique position data
- Report both raw position count (from file) and deduplicated position count separately

#### QR Code Generation
- Generate one QR code per panel position, embedding scan URL with params: `pos`, `w` (width mm), `h` (height mm), `qty`, `ref` (project name)
- QR codes are 200×200 px, margin 1, error correction level M
- Scan base URL configurable via `QR_SCAN_BASE_URL` environment variable

#### HTML Report
- Generate a self-contained, print-ready A4 landscape HTML report with all QR codes embedded as base64 data URLs
- Report includes: Wathbat Aluminum branding, project metadata, per-glass-section tables with subtotals (area m², perimeter m), and a grand total row
- Price and total columns intentionally omitted from the customer-facing report
- One-click print / save-as-PDF button in the report; `@media print` CSS hides the toolbar

#### Document Archive
- Store both the original DOCX and generated HTML report as BYTEA in PostgreSQL
- Download the HTML report or original DOCX at any time from the archive
- Delete document records (removes both stored files)
- Duplicate project name detection — uploading a second file for an existing project is blocked with a warning

#### Customer QR Scan Form (`/scan`)
- Public page (no login required) — accessible directly from any QR code scan
- Pre-fills panel details (position, dimensions, quantity, project reference) from URL params
- Request type dropdown with 5 options: Item Received, Manufacturing Defect, Maintenance Request, Replacement Request, Order Inquiry
- Saudi phone number validation (format: `05XXXXXXXX`)
- Optional free-text notes field (200-character limit)
- Bilingual Arabic/English with language toggle; footer includes Wathbat Aluminum contact numbers and social links
- Success screen shown after submission with a summary of the submitted request

#### Service Request Tracking
- All scan submissions stored in the `requests` table with status `New` by default
- Status workflow: `New` → `In Progress` → `Done`
- Inline status dropdown in both the dashboard preview and the full requests page
- Filter requests by status with live counts per tab (All / New / In Progress / Done)
- Search requests by position ID, phone, project name, or invoice number
- Export all requests to Excel (`Wathbat_Requests.xlsx`) via SheetJS
- Admin-only request deletion

#### Admin Dashboard
- Four KPI stat cards: Total Docs Processed, Total QRs Generated, Requests This Month, Success Rate (% Done)
- Document archive preview table (5 rows) with "View all" link; supports project filter passed via query param
- Service requests preview table (5 rows) with inline status update and "View all" link
- "New Request" modal — admin can manually create a service request with project dropdown
- Clicking a project name in the requests table navigates to the archive filtered by that project
- Refresh button reloads metrics, requests, and history simultaneously

#### Authentication & Authorization
- JWT-based authentication; tokens stored in `localStorage['auth_token']`
- Global `fetch` patch in `main.tsx` injects `Authorization: Bearer <token>` on all `/api/` requests automatically
- Two roles: `Admin` (full access) and `User` (read + status update, no delete / no user management)
- Protected routes redirect to `/login` when unauthenticated; authenticated users visiting `/login` redirect to `/`
- Session restored on page reload via `GET /api/auth/me` using the stored token

#### User Management (Admin only)
- List all user accounts with role badges and creation dates
- Create new users with username, password, and role (`Admin` or `User`)
- Delete users — cannot delete own account or the last remaining Admin account
- Current user's own row has the delete button disabled

#### Bilingual Arabic / English UI
- Full Arabic and English support across all pages
- Language persisted to `localStorage['app_language']`; defaults to Arabic (`ar`)
- RTL layout applied globally via `document.documentElement.dir`; all flex rows, icon placements, and text alignment flip correctly
- Arabic font: Tajawal; English font: DM Sans
- Bilingual HTML report: column headers in both languages, section subtotals in Arabic (`المجموع / Subtotal`)

### API

All endpoints are prefixed with `/api`.

- Added `GET  /api/healthz` — health check (public)
- Added `GET  /api/health` — health check alias (public)
- Added `POST /api/auth/login` — log in, receive JWT (public)
- Added `POST /api/auth/logout` — client-side logout only (auth required). ⚠️ Does NOT invalidate the JWT server-side; tokens remain valid until their 7-day expiry. A token blocklist is required for true server-side invalidation.
- Added `GET  /api/auth/me` — get current user from token (auth required)
- Added `POST /api/qr/process` — upload DOCX, parse positions, generate QR HTML report (auth required)
- Added `GET  /api/qr/download/:fileId` — download generated HTML report (auth required)
- Added `GET  /api/qr/download/:fileId/original` — download original DOCX (auth required)
- Added `DELETE /api/qr/:id` — delete processed document record (auth required)
- Added `GET  /api/admin/metrics` — dashboard KPIs (auth required)
- Added `GET  /api/admin/requests` — list scan requests, filterable by status (auth required)
- Added `POST /api/admin/requests` — customer submits a scan request (public — no auth)
- Added `PATCH /api/admin/requests/:id` — update request status (auth required)
- Added `DELETE /api/admin/requests/:id` — delete request (Admin only)
- Added `GET  /api/admin/projects` — list unique project names (auth required)
- Added `GET  /api/admin/history` — list processed document records without binary fields (auth required)
- Added `GET  /api/admin/users` — list all user accounts (Admin only)
- Added `POST /api/admin/users` — create a new user account (Admin only)
- Added `DELETE /api/admin/users/:id` — delete a user account (Admin only)

### Known Limitations

- **Free-tier cold starts:** Render's free plan spins down services after inactivity. The first request after a sleep period will be slow (15–60 s cold start).
- **In-memory stats:** `totalDocsProcessed` and `totalQRsGenerated` counters reset to zero on every server restart/redeploy.
- **No DB file size limit:** Both the original DOCX and HTML report are stored as BYTEA in PostgreSQL. Large files consume DB storage; the free tier has a 1 GB limit.
- **Password hashing uses scrypt** (`crypto.scryptSync`): A memory-hard KDF suitable for internal tool authentication. Not SHA-256 (earlier docs incorrectly stated SHA-256).
- **No notifications:** Administrators must manually check the dashboard for new scan requests — there is no email or push alert system.
- **OpenAPI spec is incomplete:** `lib/api-spec/openapi.yaml` only documents `/healthz` and `/qr/process`. All admin, auth, and additional QR endpoints are not reflected in the generated React Query hooks.
- **Legacy `invoice_number` field:** Old QR codes sent the project name in `invoice_number`. A startup migration backfills existing rows but the column remains in the schema.
- **Single-region deployment:** Both the API and DB are in the `oregon` region. Latency may be high for users in Saudi Arabia.
- **No automated tests:** There are no unit, integration, or end-to-end tests in this project.

### Infrastructure

- Deployment platform: Render.com (Blueprint via `render.yaml`)
- Region: `oregon` (US West) for both API and database
- Database: `qr-asset-manager-db` — managed PostgreSQL, free tier, database `qrdb`, user `qrdbuser`
- API service: `qr-asset-manager-api` — Node.js web service, free tier; `JWT_SECRET` auto-generated; `DATABASE_URL` auto-linked from DB
- Frontend: `qr-asset-manager-web` — Render static site; SPA fallback rewrites all paths to `index.html`
- Package manager: pnpm (workspaces monorepo)
- API build: esbuild via `artifacts/api-server/build.mjs`
- Frontend build: Vite; static output at `artifacts/qr-manager/dist/public`
- Health check path: `GET /api/healthz`
- Environment variable `VITE_API_URL` must be set manually after first deploy and static site redeployed to bake in the API origin
