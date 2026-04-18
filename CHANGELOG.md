# Changelog

All notable changes to the Wathbah QR Asset Manager are documented in this file.

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
