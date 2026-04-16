# Changelog

All notable changes to the Wathbah QR Asset Manager are documented in this file.

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
