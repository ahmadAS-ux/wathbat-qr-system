# Wathbah QR Asset Manager — Project Documentation v1.0

---

## 1. System Purpose

Wathbah QR Asset Manager is an internal tool for Wathbat Aluminum that automates the processing of Orgadata LogiKal glass/panel order documents (.docx). It extracts position data from the DOCX, generates QR codes for each panel position, and produces a print-ready HTML report. Field workers scan a QR code on a delivered panel to submit service requests (e.g., maintenance, replacement), which are then tracked and managed by administrators through a protected dashboard.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Browser (User)                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │         React SPA  (qr-manager)             │   │
│  │  Vite + React 19 + Tailwind CSS v4 + wouter │   │
│  │  shadcn/ui + Radix UI                       │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │  HTTP / JSON  (JWT in header) │
│  ┌──────────────────▼──────────────────────────┐   │
│  │         Express API  (api-server)           │   │
│  │  Node.js + TypeScript + Drizzle ORM         │   │
│  │  Multer · QRCode · AdmZip · pino            │   │
│  └──────────────────┬──────────────────────────┘   │
│                     │  pg (node-postgres)           │
│  ┌──────────────────▼──────────────────────────┐   │
│  │         PostgreSQL  (qr-asset-manager-db)   │   │
│  │  Tables: users, processed_docs, requests    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 3. Monorepo Structure

```
Asset-Manager-Wathbat/
├── artifacts/
│   ├── api-server/          — Express backend (Node.js web service)
│   │   └── src/
│   │       ├── index.ts     — Entry: runs migrations, seeds admin, starts server
│   │       ├── app.ts       — Express app: middleware, global JWT guard, route mount
│   │       ├── routes/
│   │       │   ├── index.ts — Combines all routers
│   │       │   ├── auth.ts  — Login / logout / me endpoints
│   │       │   ├── qr.ts    — DOCX upload, QR generation, file download/delete
│   │       │   ├── admin.ts — Metrics, requests, history, projects, user management
│   │       │   └── health.ts — Health check endpoint
│   │       ├── lib/
│   │       │   ├── auth.ts  — JWT session helpers, requireAuth, requireAdmin
│   │       │   ├── logger.ts — pino logger instance
│   │       │   └── stats.ts — In-memory counters for processed docs / QRs
│   │       └── middlewares/ — (reserved)
│   ├── qr-manager/          — React 19 frontend (Render static site)
│   │   └── src/
│   │       ├── main.tsx     — Entry: sets API base URL, patches fetch with JWT
│   │       ├── App.tsx      — Route definitions, auth guard, providers
│   │       ├── pages/       — Route-level page components
│   │       ├── components/  — Shared UI components
│   │       ├── hooks/       — use-auth, use-language context hooks
│   │       └── lib/         — Utility helpers
│   └── mockup-sandbox/      — Design mockups / prototyping (not deployed)
├── lib/
│   ├── api-spec/            — OpenAPI 3.1 YAML + orval codegen config
│   ├── api-client-react/    — Generated React Query hooks (DO NOT edit manually)
│   ├── api-zod/             — Zod schemas matching the API payloads
│   └── db/                  — Drizzle ORM schema + shared pg connection pool
├── scripts/                 — Utility scripts
├── render.yaml              — Render.com blueprint (2 services + 1 DB)
├── package.json             — Workspace root
├── pnpm-workspace.yaml      — pnpm workspaces config
├── tsconfig.base.json       — Shared TypeScript base config
└── DEPLOY.md                — Deployment instructions
```

---

## 4. Database Schema

### Table: `users`

| Column          | Type        | Constraints              | Description                     |
|-----------------|-------------|--------------------------|---------------------------------|
| `id`            | SERIAL      | PRIMARY KEY              | Auto-increment ID               |
| `username`      | TEXT        | NOT NULL, UNIQUE         | Login username                  |
| `password_hash` | TEXT        | NOT NULL                 | SHA-256 hashed password         |
| `role`          | TEXT        | NOT NULL, DEFAULT 'User' | `Admin` or `User`               |
| `created_at`    | TIMESTAMP   | NOT NULL, DEFAULT NOW()  | Account creation timestamp      |

Seed: on first startup, `admin` / `admin123` (Admin role) is inserted if absent.

---

### Table: `processed_docs`

| Column              | Type      | Constraints             | Description                                  |
|---------------------|-----------|-------------------------|----------------------------------------------|
| `id`                | SERIAL    | PRIMARY KEY             | Auto-increment ID                            |
| `original_filename` | TEXT      | NOT NULL                | Original uploaded DOCX filename              |
| `report_filename`   | TEXT      | NOT NULL                | Generated HTML report filename               |
| `project_name`      | TEXT      | nullable                | Extracted from document header               |
| `processing_date`   | TEXT      | nullable                | Date string extracted from document          |
| `position_count`    | INTEGER   | NOT NULL, DEFAULT 0     | Number of panel positions found              |
| `original_file`     | BYTEA     | NOT NULL                | Raw bytes of the uploaded DOCX file          |
| `report_file`       | BYTEA     | NOT NULL                | Raw bytes of the generated HTML report       |
| `created_at`        | TIMESTAMP | NOT NULL, DEFAULT NOW() | Processing timestamp                         |

---

### Table: `requests`

| Column           | Type      | Constraints             | Description                                       |
|------------------|-----------|-------------------------|---------------------------------------------------|
| `id`             | SERIAL    | PRIMARY KEY             | Auto-increment ID                                 |
| `position_id`    | TEXT      | NOT NULL                | Panel position identifier from QR scan            |
| `request_type`   | TEXT      | NOT NULL                | Type of service request (e.g. maintenance)        |
| `customer_phone` | TEXT      | nullable                | Customer's phone number                           |
| `project_name`   | TEXT      | nullable                | Project name from QR URL param `ref`              |
| `invoice_number` | TEXT      | nullable                | Invoice number (legacy field; see startup backfill) |
| `message`        | TEXT      | nullable                | Optional free-text message from customer          |
| `status`         | TEXT      | NOT NULL, DEFAULT 'New' | Workflow status: `New`, `In Progress`, `Done`     |
| `created_at`     | TIMESTAMP | NOT NULL, DEFAULT NOW() | Submission timestamp                              |

---

## 5. API Endpoints Reference

All endpoints are prefixed with `/api`.

| Method   | Path                            | Auth Required  | Description                                        | Request Body / Params                                                  | Response                              |
|----------|---------------------------------|----------------|----------------------------------------------------|------------------------------------------------------------------------|---------------------------------------|
| GET      | `/healthz`                      | No             | Health check                                       | —                                                                      | `{ status: "ok" }`                    |
| GET      | `/health`                       | No             | Health check (alias)                               | —                                                                      | `{ status: "ok" }`                    |
| POST     | `/auth/login`                   | No             | Log in, receive JWT                                | `{ username, password }`                                               | `{ token, user: { id, username, role } }` |
| POST     | `/auth/logout`                  | Yes            | Invalidate JWT session                             | —                                                                      | `{ ok: true }`                        |
| GET      | `/auth/me`                      | Yes            | Get current user from token                        | —                                                                      | `{ userId, username, role }`          |
| POST     | `/qr/process`                   | Yes            | Upload DOCX, parse positions, generate QR HTML     | `multipart/form-data`: `file` (`.docx`, max 50 MB)                     | `{ fileId, positions[], projectName, date, totalPositions, rawPositionCount }` |
| GET      | `/qr/download/:fileId`          | Yes            | Download generated HTML report                     | Path param: `fileId` (integer)                                         | HTML file download                    |
| GET      | `/qr/download/:fileId/original` | Yes            | Download original uploaded DOCX                    | Path param: `fileId` (integer)                                         | DOCX file download                    |
| DELETE   | `/qr/:id`                       | Yes            | Delete processed document record                   | Path param: `id` (integer)                                             | `204 No Content`                      |
| GET      | `/admin/metrics`                | Yes            | Dashboard KPIs                                     | —                                                                      | `{ totalDocsProcessed, totalQRsGenerated, requestsThisMonth, successRate }` |
| GET      | `/admin/requests`               | Yes            | List scan requests (filterable by status)          | Query param: `status` (`New` \| `In Progress` \| `Done` \| `All`)      | `Request[]`                           |
| POST     | `/admin/requests`               | **No (public)**| Customer submits a scan request via QR form        | `{ positionId, requestType, customerPhone?, projectName?, invoiceNumber?, message? }` | `201 Request`              |
| PATCH    | `/admin/requests/:id`           | Yes            | Update request status                              | `{ status }`                                                           | Updated `Request`                     |
| DELETE   | `/admin/requests/:id`           | Admin only     | Delete a request                                   | Path param: `id`                                                       | `{ ok: true }`                        |
| GET      | `/admin/projects`               | Yes            | List unique project names from processed docs      | —                                                                      | `string[]`                            |
| GET      | `/admin/history`                | Yes            | List all processed document records (no file bytes) | —                                                                     | `ProcessedDoc[]` (no binary fields)   |
| GET      | `/admin/users`                  | Admin only     | List all user accounts                             | —                                                                      | `{ id, username, role, createdAt }[]` |
| POST     | `/admin/users`                  | Admin only     | Create a new user account                          | `{ username, password, role: "Admin"\|"User" }`                        | `201 { id, username, role, createdAt }` |
| DELETE   | `/admin/users/:id`              | Admin only     | Delete a user (cannot delete self or last admin)   | Path param: `id`                                                       | `{ ok: true }`                        |

---

## 6. Frontend Pages & Routes

Routing library: **wouter**. Base path set from Vite's `BASE_URL`.

**Notes:**
- Unauthenticated access to protected routes redirects to `/login`.
- Already-authenticated users visiting `/login` are redirected to `/`.
- The `Header` component is shown only on `/` — hidden on `/scan`, `/login`, and all `/admin/*` paths (which use `AdminLayout` with a sidebar instead).
- JWT token is stored in `localStorage` under key `auth_token` and injected by a global `fetch` patch in `main.tsx`.

---

### `/login` — Public — `pages/Login.tsx`

**Purpose:** Username/password login form.

**Components used:**
| Component / Hook | Role |
|---|---|
| `useAuth` | Calls `login(username, password)` → `POST /api/auth/login`. On success stores token and navigates to `/`. |
| `useLanguage` | Drives bilingual labels and RTL layout. Language toggle button shown in the form footer. |
| `useLocation` (wouter) | Redirects to `/` after successful login. |
| framer-motion | Fade-in animation on the card. |

**API calls:** `POST /api/auth/login`

---

### `/scan` — Public — `pages/Scan.tsx`

**Purpose:** Customer-facing QR code scan page. Reads panel data from URL params, lets the customer submit a service request.

**Components used:**
| Component / Hook | Role |
|---|---|
| `useLanguage` | Arabic/English bilingual labels and RTL layout. Language toggle in top bar. |
| `AnimatePresence` / `motion` (framer-motion) | Animates three states: invalid QR, form, success screen. |
| Inline icon components | `SnapchatIcon`, `InstagramIcon`, `XIcon`, `TikTokIcon` — rendered in the footer social links. Defined privately inside the file. |
| `API_BASE` | Constructs the fetch URL for `POST /api/admin/requests`. |

**URL params consumed:** `pos` (position ID), `w` (width mm), `h` (height mm), `qty` (quantity), `ref` (project name).

**API calls:** `POST /api/admin/requests` (no auth token — public endpoint)

---

### `/` — Protected — `pages/Home.tsx`

**Purpose:** Main DOCX upload page. Shows a 3-step guide, drag-and-drop upload zone, processing state, error/duplicate warnings, and the results table after processing.

**Components used:**
| Component / Hook | Role |
|---|---|
| `FileUpload` | Drag-and-drop DOCX dropzone. Calls `onFileSelect(file)` on valid drop/click. |
| `ResultsView` | Full results table + download banner rendered after successful processing. |
| `useProcessDocument` (generated React Query hook) | Mutation that posts `multipart/form-data` to `POST /api/qr/process`. Returns `isPending`, `onSuccess`, `onError`. |
| `useLanguage` | Bilingual labels and RTL step guide order (Arabic reverses the 3 steps right→left). |
| Inline `StepGuide` | Animated 3-step instructional strip (Upload → Process → Download). Private sub-component inside the file. |
| `AnimatePresence` / `motion` | Page-level transitions between upload and results states; fade animations for status banners. |

**API calls:** `POST /api/qr/process` (via `useProcessDocument`), `GET /api/qr/download/:fileId` (via `ResultsView`)

---

### `/admin` — Protected — `pages/Admin.tsx`

**Purpose:** Admin dashboard. Shows 4 KPI stat cards, a paginated document archive table, a service requests table, and a "New Request" modal. Admin role also sees a User Management shortcut card.

**Components used:**
| Component / Hook | Role |
|---|---|
| `AdminLayout` | Dark sidebar with navigation, language toggle, user info, and logout. Wraps all admin pages. |
| `useLanguage` | Bilingual column headers, labels, RTL flex direction on all rows. |
| `useAuth` | Reads `user.role` to conditionally show delete buttons and the User Management card. |
| `motion` (framer-motion) | Staggered fade-in for stat cards and table rows. |
| `Link` (wouter) | "View all" links to `/admin/history` and `/admin/requests`. |

**API calls:**
- `GET /api/admin/metrics` — KPI cards
- `GET /api/admin/requests` — requests table
- `GET /api/admin/history` — archive table
- `GET /api/admin/projects` — project dropdown in "New Request" modal
- `POST /api/admin/requests` — "New Request" modal submission
- `PATCH /api/admin/requests/:id` — inline status dropdown
- `DELETE /api/admin/requests/:id` — delete request button (Admin only)
- `GET /api/qr/download/:id` — HTML report download
- `GET /api/qr/download/:id/original` — original DOCX download
- `DELETE /api/qr/:id` — delete document record

---

### `/admin/history` — Protected — `pages/AdminHistory.tsx`

**Purpose:** Full paginated archive of all processed DOCX files. Supports client-side search by project name or filename. Loads 20 rows at a time with a "Show more" button.

**Components used:**
| Component / Hook | Role |
|---|---|
| `AdminLayout` | Sidebar layout wrapper. |
| `useLanguage` | Bilingual headers and search placeholder; RTL input icon placement. |
| `motion` (framer-motion) | Fade-in per table row. |

**API calls:**
- `GET /api/admin/history` — load all records on mount
- `GET /api/qr/download/:id` — download HTML report button
- `GET /api/qr/download/:id/original` — download original DOCX button
- `DELETE /api/qr/:id` — delete record button

---

### `/admin/requests` — Protected — `pages/AdminRequests.tsx`

**Purpose:** Full service request management. Supports search, status filter tabs with counts, inline status updates, delete (Admin), and Excel export of all requests.

**Components used:**
| Component / Hook | Role |
|---|---|
| `AdminLayout` | Sidebar layout wrapper. |
| `useLanguage` | Bilingual column headers, filter labels, RTL input layout. |
| `useAuth` | Reads `user.role` to show/hide the delete column. |
| `useLocation` (wouter) | Navigates to `/admin?project=...` when a project name is clicked. |
| `XLSX` (SheetJS) | `exportExcel()` — exports all requests to `Wathbat_Requests.xlsx`. |
| `motion` (framer-motion) | Fade-in per table row. |

**API calls:**
- `GET /api/admin/requests` — load all requests on mount
- `PATCH /api/admin/requests/:id` — inline status dropdown
- `DELETE /api/admin/requests/:id` — delete button (Admin only)

---

### `/admin/users` — Protected (Admin only) — `pages/AdminUsers.tsx`

**Purpose:** User account management. Table of all users with role badges. "Create User" modal (username, password, role). Admins cannot delete themselves or the last Admin account.

**Components used:**
| Component / Hook | Role |
|---|---|
| `AdminLayout` | Sidebar layout wrapper. |
| `useLanguage` | Bilingual labels and RTL layout. |
| `useAuth` | Reads `user.userId` to disable delete on the current user's own row. |
| `motion` (framer-motion) | Fade-in per table row; scale-in on modal. |

**API calls:**
- `GET /api/admin/users` — load user list on mount
- `POST /api/admin/users` — "Create User" modal submission
- `DELETE /api/admin/users/:id` — delete button

---

### `*` (404) — `pages/not-found.tsx`

**Purpose:** Generic 404 fallback. Renders a centred icon, "404" heading, and a "Return Home" button.

**Components used:**
| Component / Hook | Role |
|---|---|
| `Button` (shadcn/ui) | "Return Home" styled button. |
| `useLanguage` | Reads translation key for the page message. |
| `Link` (wouter) | Navigates back to `/`. |

---

## 7. Key Flows

### 7a. DOCX Upload & Processing Flow

1. User (authenticated) visits `/` and selects an Orgadata LogiKal `.docx` file.
2. Frontend posts `multipart/form-data` to `POST /api/qr/process`.
3. API validates the file type (DOCX only, max 50 MB).
4. `parseAndInjectQR()` unzips the DOCX, reads `word/document.xml`.
5. XML is parsed: project name and date are extracted from header segments.
6. All top-level `<w:tbl>` tables are found; duplicate tables (Orgadata exports screen + print copies) are deduplicated by fingerprint.
7. Within each table, glass sections are detected by "Name:" rows; position data rows are extracted (`position`, `quantity`, `width`, `height`, `area`, `perimeter`, `price`, `total`).
8. A QR code data URL is generated per position with URL params: `pos`, `w`, `h`, `qty`, `ref` (project name), pointing to the `/scan` page.
9. A self-contained HTML report (A4 landscape, print-ready) is built with embedded QR images and per-section subtotals.
10. The record is inserted into `processed_docs` (both DOCX and HTML stored as BYTEA).
11. The API returns `{ fileId, positions[], projectName, date, totalPositions }`.

### 7b. QR Code Generation Flow

- QR codes encode a URL: `{QR_SCAN_BASE_URL}/scan?pos=XX/Y&w=NNN&h=NNN&qty=N&ref=ProjectName`
- `QR_SCAN_BASE_URL` env var overrides the default; fallback uses `REPLIT_DOMAINS` or `/scan`.
- Codes are 200×200 px, margin 1, error correction level M.
- Generated as base64 data URLs and embedded directly in the HTML report.

### 7c. QR Code Scan Flow (customer facing)

1. Customer scans a QR code on a delivered panel; browser opens `/scan?pos=...&ref=...&w=...&h=...&qty=...`.
2. The `Scan` page (public, no login required) displays panel details pre-filled from URL params.
3. Customer fills in `requestType`, optional phone and message, then submits.
4. Frontend posts to `POST /api/admin/requests` (the only unauthenticated POST endpoint).
5. A new `requests` row is created with `status = "New"`.

### 7d. Request Tracking Flow

1. Admin views `/admin/requests` to see all incoming requests.
2. Requests can be filtered by status (`New`, `In Progress`, `Done`).
3. Admin updates a request status via `PATCH /api/admin/requests/:id`.
4. Admin (role `Admin`) can delete requests via `DELETE /api/admin/requests/:id`.
5. Dashboard metrics at `/admin` show `requestsThisMonth` and `successRate` (% with status `Done`).

### 7e. Authentication Flow

1. User submits username + password to `POST /api/auth/login`.
2. Server looks up the user, verifies the SHA-256 password hash.
3. A JWT is created (`createSession`) and returned with the user record.
4. Frontend stores the token in `localStorage['auth_token']`.
5. All subsequent `/api/` requests have the `Authorization: Bearer <token>` header injected automatically by the patched `globalThis.fetch` in `main.tsx`.
6. The global auth guard in `app.ts` calls `requireAuth` on every `/api` route except the three public paths.
7. Logout calls `POST /api/auth/logout`, which invalidates the session server-side, then clears `localStorage`.

---

## 8. Environment Variables

| Variable          | Required | Default                   | Where Used          | Description                                                |
|-------------------|----------|---------------------------|---------------------|------------------------------------------------------------|
| `DATABASE_URL`    | Yes      | —                         | API server          | PostgreSQL connection string; auto-linked on Render        |
| `PORT`            | Yes      | —                         | API server          | TCP port the Express server listens on                     |
| `NODE_ENV`        | No       | `development`             | Both                | `production` enables stricter behaviour                    |
| `JWT_SECRET`      | No       | auto-generated on Render  | API server          | Secret for signing JWT tokens                              |
| `QR_SCAN_BASE_URL`| No       | `/scan` (or Replit domain)| API server (qr.ts)  | Base URL embedded in QR codes; set to production front-end URL |
| `VITE_API_URL`    | No       | `""` (relative paths)     | Frontend build      | Full URL of the API service; baked into JS bundle at build time |
| `BASE_PATH`       | No       | `/`                       | Frontend build      | Vite base path for the static site                         |

> **Important:** After the first Render deploy, set `VITE_API_URL` to the full API service URL (e.g. `https://qr-asset-manager-api.onrender.com`) and redeploy the static site. Without this, the frontend will use relative API paths and fail since the two services are on different domains.

---

## 9. Deployment Guide (Render.com)

Defined in `render.yaml` as a Render Blueprint (Infrastructure as Code).

**Services created:**

| Service name              | Type          | Runtime       | Plan |
|---------------------------|---------------|---------------|------|
| `qr-asset-manager-db`     | PostgreSQL DB | Managed       | Free |
| `qr-asset-manager-api`    | Web Service   | Node.js       | Free |
| `qr-asset-manager-web`    | Static Site   | Static        | Free |

**Step-by-step deployment:**

1. Push the repository to GitHub.
2. Log in to [render.com](https://render.com) and click **New → Blueprint**.
3. Connect the repository; Render will detect `render.yaml` automatically.
4. Click **Apply** — Render provisions the DB, API service, and static site in order.
5. Once the API service is running, copy its URL (e.g. `https://qr-asset-manager-api.onrender.com`).
6. In the `qr-asset-manager-web` static site settings, add env var:
   - `VITE_API_URL` = `https://qr-asset-manager-api.onrender.com`
7. Also set `QR_SCAN_BASE_URL` on the API service to the frontend URL + `/scan`:
   - `QR_SCAN_BASE_URL` = `https://qr-asset-manager-web.onrender.com/scan`
8. Trigger a manual redeploy of `qr-asset-manager-web` so the API URL is baked in.
9. Access the app at the static site URL. Log in with `admin` / `admin123` and change the password immediately.

**Build commands (from render.yaml):**

```
# API
pnpm install --no-frozen-lockfile && pnpm --filter @workspace/api-server build
pnpm --filter @workspace/api-server start

# Frontend
pnpm install --no-frozen-lockfile && pnpm --filter @workspace/qr-manager build
# Static publish path: ./artifacts/qr-manager/dist/public
```

**Health check:** `GET /api/healthz` — Render uses this to verify the API is up.

**SPA routing:** All paths on the static site rewrite to `/index.html` (configured in render.yaml `routes`).

---

## 10. Known Issues & Limitations — v1.0

- **Free-tier cold starts:** Render's free plan spins down services after inactivity. The first request after a sleep period will be slow (15–60 s cold start).
- **In-memory stats:** `totalDocsProcessed` and `totalQRsGenerated` counters in `lib/stats.ts` are in-memory only. They reset to zero on every server restart/redeploy.
- **No file size check on original DOCX in DB:** Files are stored as BYTEA in PostgreSQL. Large DOCX files will increase DB storage usage; the free PostgreSQL tier has a 1 GB limit.
- **Password hashing uses SHA-256 (not bcrypt):** Acceptable for an internal tool but not hardened for public-facing authentication.
- **No email / notification system:** Administrators must manually check the dashboard for new scan requests.
- **OpenAPI spec is incomplete:** The `lib/api-spec/openapi.yaml` only documents `/healthz` and `/qr/process`. All admin, auth, and additional QR endpoints exist only in the Express routes and are not reflected in the generated client hooks.
- **`invoice_number` is a legacy field:** Old QR codes sent the project name in `invoice_number`. A startup migration backfills existing rows, but the field remains in the schema.
- **Single-region deployment:** Both the API and DB are in `oregon`. Latency may be high for users in the Middle East (Saudi Arabia).
- **No automated tests:** There are no unit, integration, or end-to-end tests in this project.

---

## 12. Component Reference

This section covers every custom component and hook in `artifacts/qr-manager/src/`. shadcn/ui primitives in `components/ui/` are standard Radix UI wrappers and are not documented here.

---

### `components/FileUpload.tsx` — `FileUpload`

**What it renders:** An animated drag-and-drop upload zone. Shows pulse rings when idle, a highlighted state when a file is dragged over, a loading overlay while processing, and an inline error banner for rejected files.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `onFileSelect` | `(file: File) => void` | Called with the accepted File when the user drops or clicks to select. |
| `isLoading` | `boolean` | When `true`, disables interaction and shows a spinner overlay. |

**Hooks used:** `useLanguage` (bilingual labels + RTL font class), `useDropzone` (react-dropzone — accepts `.docx` only, max 1 file).

**API calls:** None. Delegates upload to the parent via `onFileSelect`.

**Used by:** `Home` page.

---

### `components/ResultsView.tsx` — `ResultsView`

**What it renders:** Post-processing results panel. Contains: a dark download/print banner, a 4-card stats row (raw positions, deduplicated positions, project name, date), a scrollable data table with one QR code image per row, and a "Process another file" reset link.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `result` | `ProcessResult` | The API response from `POST /api/qr/process` — contains `fileId`, `positions[]`, `projectName`, `date`, `totalPositions`, `rawPositionCount`. |
| `onReset` | `() => void` | Called when the user clicks "Process another file" to return to the upload state. |

**Hooks used:** `useLanguage` (bilingual column headers + RTL table direction), `useState` (download loading / error state).

**API calls:** `GET /api/qr/download/:fileId` — triggered by the "Download Report" button; streams the HTML file as a blob download.

**Used by:** `Home` page.

---

### `components/layout/AdminLayout.tsx` — `AdminLayout`

**What it renders:** Full-page layout shell for all `/admin/*` pages. Renders a fixed dark sidebar (`#1B2A4A`) on desktop (≥ lg breakpoint) and a slide-in drawer on mobile. The sidebar contains: brand logo (links to `/`), a pinned "QR Asset Manager" link, navigation items, language toggle, current username, and logout button.

**Props:**
| Prop | Type | Description |
|---|---|---|
| `children` | `React.ReactNode` | Page content rendered in the main area to the right of the sidebar. |

**Navigation items (dynamic):**
- `/admin` — Dashboard (always shown)
- `/admin/history` — Archive (always shown)
- `/admin/requests` — Service Requests (always shown)
- `/admin/users` — Users (shown only if `user.role === 'Admin'`)

**Hooks used:** `useLanguage` (nav labels, RTL mobile drawer slide direction), `useAuth` (user display name, logout, role check for Users nav item), `useLocation` (active state highlighting).

**API calls:** `POST /api/auth/logout` (via `useAuth.logout` on the sign-out button).

**Used by:** `Admin`, `AdminHistory`, `AdminRequests`, `AdminUsers` pages.

---

### `components/layout/Header.tsx` — `Header`

**What it renders:** Sticky top navigation bar shown only on the `/` (Home) page. Contains: brand logo (links to `/`), a language toggle button, the current username, and a logout button. Conditionally renders a link to `/admin` (when on Home) or a link back to `/` (when on an admin page — though in practice `Header` is not shown on admin pages).

**Props:** None.

**Hooks used:** `useLanguage` (language toggle label, bilingual app title, RTL flex direction), `useAuth` (username display, logout), `useLocation` (detects whether current path is an admin page).

**API calls:** `POST /api/auth/logout` (via `useAuth.logout`).

**Used by:** `AppRoutes` in `App.tsx` — rendered above the `<Switch>` when not on `/scan`, `/login`, or `/admin/*`.

---

### `hooks/use-auth.tsx` — `AuthProvider` / `useAuth`

**What it provides:** React context for authentication state across the entire app.

**Context shape (`AuthContextType`):**
| Field | Type | Description |
|---|---|---|
| `user` | `AuthUser \| null` | `{ userId, username, role }` — null when not logged in. |
| `isLoading` | `boolean` | True during the initial token validation on app load. |
| `login` | `(username, password) => Promise<{ ok, error? }>` | Posts to `POST /api/auth/login`, stores token in `localStorage['auth_token']`, sets user state. |
| `logout` | `() => Promise<void>` | Posts to `POST /api/auth/logout`, removes token from localStorage, clears user state. |

**Startup behaviour:** On mount, `AuthProvider` reads `localStorage['auth_token']` and calls `GET /api/auth/me` to restore session. If the token is invalid, it is removed.

**API calls:** `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`.

**Used by:** `App.tsx` (wraps entire app), `Login`, `Header`, `AdminLayout`, `Admin`, `AdminRequests`, `AdminUsers`.

---

### `hooks/use-language.tsx` — `LanguageProvider` / `useLanguage`

**What it provides:** React context for bilingual Arabic/English support and RTL layout.

**Context shape (`LanguageContextType`):**
| Field | Type | Description |
|---|---|---|
| `language` | `'ar' \| 'en'` | Current language. Persisted to `localStorage['app_language']`. Defaults to `'ar'`. |
| `setLanguage` | `(lang) => void` | Changes language. Also updates `document.documentElement.dir` and `lang` attribute. |
| `t` | `(key: TranslationKey) => string` | Returns translated string from `lib/i18n.ts`. Falls back to English if Arabic key is missing. |
| `isRtl` | `boolean` | `true` when `language === 'ar'`. Used throughout to conditionally flip flex row direction, text-align, icon placement, etc. |

**Used by:** Every page and custom component in the app.

---

### `lib/api-base.ts` — `API_BASE`

**What it exports:** A single constant `API_BASE: string`.

In production, this equals `VITE_API_URL` (the full API origin, e.g. `https://qr-asset-manager-api.onrender.com`). In development, it is an empty string so that Vite's dev proxy forwards `/api/...` requests to `localhost`.

Every component that calls the API directly (those not using the generated React Query hooks) prepends `${API_BASE}` to their fetch URLs.

**Used by:** `ResultsView`, `Admin`, `AdminHistory`, `AdminRequests`, `AdminUsers`, `Scan`, `use-auth.tsx`.

---

### shadcn/ui components (`components/ui/`)

All files in `components/ui/` are standard shadcn/ui components — thin wrappers around Radix UI primitives styled with Tailwind CSS. They are not documented individually. The ones actively used by custom code are:

| Component | Used in |
|---|---|
| `Button` | `Header`, `NotFound` |
| `Toaster` / `Toast` | `App.tsx` (global toast container) |
| `Tooltip` / `TooltipProvider` | `App.tsx` (wraps entire app) |
