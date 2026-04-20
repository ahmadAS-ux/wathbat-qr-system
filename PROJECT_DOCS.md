# Wathbat QR Asset Manager — Project Documentation
# وثبة لإدارة الأصول بالـ QR — توثيق المشروع

---

## Table of Contents / فهرس المحتويات

1. [Project Overview / نظرة عامة](#1-project-overview--نظرة-عامة)
2. [Tech Stack / التقنيات المستخدمة](#2-tech-stack--التقنيات-المستخدمة)
3. [Project Structure / هيكل المشروع](#3-project-structure--هيكل-المشروع)
4. [API Endpoints / نقاط نهاية API](#4-api-endpoints--نقاط-نهاية-api)
5. [Database Schema / مخطط قاعدة البيانات](#5-database-schema--مخطط-قاعدة-البيانات)
6. [Environment Variables / متغيرات البيئة](#6-environment-variables--متغيرات-البيئة)
7. [Running Locally / التشغيل المحلي](#7-running-locally--التشغيل-المحلي)
8. [Deploying to Render / النشر على Render](#8-deploying-to-render--النشر-على-render)
9. [Known Issues & Fixes / المشاكل المعروفة وحلولها](#9-known-issues--fixes--المشاكل-المعروفة-وحلولها)
10. [Future Enhancements / تحسينات مستقبلية](#10-future-enhancements--تحسينات-مستقبلية)

---

## 1. Project Overview / نظرة عامة

### English

**Wathbat QR Asset Manager** is a full-stack bilingual (Arabic/English) web application for **Wathbat Aluminum** (`wathbat.sa`). It automates the workflow of processing glass/panel order documents and generating QR codes for each position.

**Core workflow:**
1. Admin uploads an Orgadata LogiKal `.docx` order file
2. The system parses all glass positions (dimensions, quantity, type) from the document
3. A QR code is generated for each position linking to a customer-facing scan page
4. A self-contained HTML report is generated and downloadable as a PDF
5. Customers scan the QR code on delivered items and submit service requests (defects, maintenance, inquiries)
6. Admins manage all incoming requests from a protected dashboard with role-based access

**Key features:**
- Bilingual UI (Arabic RTL / English LTR) with dynamic language switching
- Multi-role authentication (Admin / User) via JWT
- Admin dashboard with metrics, document archive, service requests, and user management
- Customer scan page — public, no login required
- Export requests to Excel
- Print/PDF report generation

---

### العربية

**وثبة لإدارة الأصول بالـ QR** هو تطبيق ويب متكامل ثنائي اللغة (عربي/إنجليزي) لشركة **وثبة للألمنيوم** (`wathbat.sa`). يُؤتمت سير عمل معالجة مستندات طلبيات الزجاج والألواح وإنشاء رموز QR لكل موضع.

**سير العمل الأساسي:**
1. يرفع المدير ملف طلبية Orgadata LogiKal بصيغة `.docx`
2. يستخرج النظام جميع مواضع الزجاج (الأبعاد، الكمية، النوع) من المستند
3. يُنشئ رمز QR لكل موضع يرتبط بصفحة فحص يراها العميل
4. يُنشئ تقرير HTML مكتفٍ بذاته قابل للتنزيل والطباعة بصيغة PDF
5. يقوم العملاء بمسح رمز QR على العناصر المسلّمة وتقديم طلبات الخدمة (عيوب، صيانة، استفسارات)
6. يُدير المسؤولون جميع الطلبات الواردة من لوحة تحكم محمية بصلاحيات مختلفة

---

## 2. Tech Stack / التقنيات المستخدمة

### Backend / الخلفية

| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| TypeScript | ~5.9.2 | Language |
| Express | ^5.2 | HTTP framework |
| Drizzle ORM | ^0.45.1 | Database ORM + migrations |
| PostgreSQL | 15+ | Database (via `pg` ^8.20) |
| JWT (`jsonwebtoken`) | ^9.0.3 | Authentication tokens |
| `adm-zip` | ^0.5.16 | Parse `.docx` files (unzip) |
| `qrcode` | ^1.5.4 | Generate QR code data URLs |
| `multer` | ^2.1.1 | File upload handling |
| `pino` / `pino-http` | ^9 / ^10 | Structured logging |
| `cors` | ^2 | CORS middleware |
| esbuild | 0.27.3 | Production bundler |

### Frontend / الواجهة الأمامية

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19 | UI framework |
| TypeScript | ~5.9.2 | Language |
| Vite | ^6 | Build tool + dev server |
| Tailwind CSS | v4 | Utility-first CSS |
| Radix UI / shadcn/ui | latest | Accessible UI components |
| Framer Motion | ^12 | Animations |
| Wouter | ^3 | Client-side routing |
| TanStack Query | ^5 | Server state / API hooks |
| `react-dropzone` | ^14 | File drag-and-drop upload |
| `xlsx` | ^0.18 | Excel export |
| Tajawal (font) | Google Fonts | Arabic typography |
| DM Sans (font) | Google Fonts | English typography |

### Monorepo / Workspace

| Package | Purpose |
|---------|---------|
| `pnpm` workspaces | Package manager + monorepo tooling |
| `lib/api-spec` | OpenAPI YAML spec + orval codegen config |
| `lib/api-client-react` | Generated React Query hooks (auto-generated, do not edit) |
| `lib/api-zod` | Zod validation schemas for API payloads |
| `lib/db` | Drizzle ORM schema + shared DB instance |

---

## 3. Project Structure / هيكل المشروع

```
wathbah/Asset-Manager-Wathbat/
│
├── artifacts/
│   ├── api-server/              # Express backend application
│   │   ├── src/
│   │   │   ├── index.ts         # Entry point: runs DB migrations, seeds admin, starts server
│   │   │   ├── app.ts           # Express app setup: middleware, CORS, global auth guard, route mounting
│   │   │   ├── routes/
│   │   │   │   ├── index.ts     # Route aggregator
│   │   │   │   ├── admin.ts     # Admin routes: metrics, requests, history, users
│   │   │   │   ├── auth.ts      # Login endpoint
│   │   │   │   └── qr.ts        # DOCX processing, QR generation, HTML report, download
│   │   │   └── lib/
│   │   │       ├── auth.ts      # JWT sign/verify, requireAuth, requireAdmin middleware, hashPassword
│   │   │       ├── logger.ts    # Pino logger instance
│   │   │       └── stats.ts     # In-memory counters for metrics
│   │   ├── build.mjs            # esbuild bundler script
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── qr-manager/              # React SPA frontend
│       ├── src/
│       │   ├── main.tsx         # App entry: sets API base URL, patches global fetch with JWT
│       │   ├── App.tsx          # Router setup, protected routes, layout decisions
│       │   ├── pages/
│       │   │   ├── Home.tsx         # Main upload page — upload DOCX, show results
│       │   │   ├── Admin.tsx        # Admin dashboard — metrics, archive preview, requests preview
│       │   │   ├── AdminHistory.tsx # Full document archive with search
│       │   │   ├── AdminRequests.tsx# Full service requests table with filters + Excel export
│       │   │   ├── AdminUsers.tsx   # User management (Admin role only)
│       │   │   ├── Login.tsx        # Login form
│       │   │   ├── Scan.tsx         # Public customer scan page — submit service request via QR
│       │   │   └── not-found.tsx    # 404 page
│       │   ├── components/
│       │   │   ├── layout/
│       │   │   │   ├── AdminLayout.tsx  # Sidebar navigation layout for admin pages
│       │   │   │   └── Header.tsx       # Top navigation bar for non-admin pages
│       │   │   ├── FileUpload.tsx       # Drag-and-drop DOCX uploader component
│       │   │   ├── ResultsView.tsx      # QR results table + download/print actions
│       │   │   └── ui/                  # shadcn/ui base components (Button, Input, etc.)
│       │   ├── hooks/
│       │   │   ├── use-language.tsx     # Language/RTL context provider + localStorage persistence
│       │   │   └── use-auth.tsx         # Auth context: login, logout, user state, JWT storage
│       │   └── lib/
│       │       ├── api-base.ts          # Resolves API base URL from VITE_API_URL env var
│       │       ├── i18n.ts              # All translation strings (English + Arabic)
│       │       └── utils.ts             # cn(), formatBytes() helpers
│       ├── index.html           # HTML entry: loads Google Fonts, sets base RTL
│       ├── vite.config.ts       # Vite config: aliases, build output path
│       └── package.json
│
├── lib/
│   ├── db/                      # Shared database layer
│   │   └── src/
│   │       ├── index.ts         # Exports db instance + all tables
│   │       └── schema/
│   │           ├── users.ts         # users table definition
│   │           ├── requests.ts      # requests table definition
│   │           ├── processed_docs.ts# processed_docs table definition
│   │           └── index.ts         # Re-exports all schemas
│   ├── api-spec/                # OpenAPI YAML spec + orval codegen
│   ├── api-client-react/        # AUTO-GENERATED React Query hooks — do not edit manually
│   └── api-zod/                 # Zod validation schemas
│
├── scripts/                     # Build utility scripts (export-zip.mjs)
├── render.yaml                  # Render Blueprint (infrastructure as code)
├── pnpm-workspace.yaml          # Workspace package locations
├── pnpm-lock.yaml               # Locked dependency versions
├── tsconfig.json                # Root TypeScript config (composite build)
├── tsconfig.base.json           # Shared TS compiler options
├── DEPLOY.md                    # Deployment guide
└── PROJECT_DOCS.md              # This file
```

---

## 4. API Endpoints / نقاط نهاية API

Base path: `/api`

**Authentication**: All endpoints require a JWT Bearer token in the `Authorization` header **except** the public ones listed below.

### Auth / المصادقة

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/login` | ❌ Public | Login with username + password. Returns `{ token, user }` |

**Request body:**
```json
{ "username": "admin", "password": "admin123" }
```
**Response:**
```json
{ "token": "eyJ...", "user": { "id": 1, "username": "admin", "role": "Admin" } }
```

---

### QR Processing / معالجة QR

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/qr/process` | ✅ Required | Upload a `.docx` file. Parses positions, generates QR codes, saves HTML report to DB. Returns positions + fileId |
| `GET` | `/api/qr/download/:fileId` | ✅ Required | Download the generated HTML report file |
| `GET` | `/api/qr/download/:fileId/original` | ✅ Required | Download the original `.docx` file |
| `DELETE` | `/api/qr/:id` | ✅ Required | Delete a processed document record |

**POST /api/qr/process** — multipart/form-data, field `file` (.docx only)

**Response:**
```json
{
  "fileId": "42",
  "projectName": "MR. Mohammed Al-Suwaih",
  "date": "29/12/24",
  "totalPositions": 27,
  "rawPositionCount": 27,
  "positions": [
    {
      "position": "01 / 1",
      "quantity": "2",
      "width": "455",
      "height": "2930",
      "area": "1.33",
      "perimeter": "6.77",
      "qrDataUrl": "data:image/png;base64,..."
    }
  ]
}
```

---

### Admin — Metrics / الإحصائيات

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/metrics` | ✅ Required | Returns dashboard counters: total docs, QRs generated, requests this month, success rate |

---

### Admin — Requests / طلبات الخدمة

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/requests` | ✅ Required | List all service requests (optional `?status=New\|In Progress\|Done`) |
| `POST` | `/api/admin/requests` | ❌ **Public** | Submit a new service request (used by customer QR scan page) |
| `PATCH` | `/api/admin/requests/:id` | ✅ Required | Update request status |
| `DELETE` | `/api/admin/requests/:id` | ✅ Admin only | Delete a request |

**POST /api/admin/requests** — JSON body:
```json
{
  "positionId": "01 / 1",
  "requestType": "Maintenance Request",
  "customerPhone": "0536080555",
  "projectName": "MR. Mohammed Al-Suwaih",
  "invoiceNumber": "INV-001",
  "message": "Customer notes here"
}
```

---

### Admin — History / الأرشيف

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/history` | ✅ Required | List all processed documents (without file blobs) |
| `GET` | `/api/admin/projects` | ✅ Required | List all unique project names |

---

### Admin — Users / إدارة المستخدمين

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/admin/users` | ✅ Admin only | List all users |
| `POST` | `/api/admin/users` | ✅ Admin only | Create a new user (username, password, role) |
| `DELETE` | `/api/admin/users/:id` | ✅ Admin only | Delete a user (cannot delete self or last admin) |

---

### Health Check / فحص الصحة

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/healthz` | ❌ Public | Returns `{ ok: true }` — used by Render health check |

---

### ERP — Contract (v2.5.2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/erp/settings/contract-template` | ✅ Admin only | Returns all 6 contract template keys as `{ key: value }` |
| `PUT` | `/api/erp/settings/contract-template` | ✅ Admin only | Upserts one or more contract template keys (body: `{ key: value, ... }`) |
| `GET` | `/api/erp/projects/:id/contract` | ✅ Admin / FactoryManager / SalesAgent | Returns project + parsed quotation + section metadata + drawing refs + template for contract rendering |
| `POST` | `/api/erp/projects/:id/contract/mark-printed` | ✅ Admin / FactoryManager / SalesAgent | Advances `stageInternal` to 4 when contract is printed |
| `POST` | `/api/erp/projects/:id/contract/override-log` | ✅ Admin / FactoryManager / SalesAgent | Logs integrity override events (issue codes in body) |

---

## 5. Database Schema / مخطط قاعدة البيانات

Database: **PostgreSQL**. Tables are auto-created on server startup via Drizzle ORM migrations.

### Table: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `serial` | PRIMARY KEY | Auto-increment ID |
| `username` | `text` | NOT NULL, UNIQUE | Login username |
| `password_hash` | `text` | NOT NULL | SHA-256 hashed password |
| `role` | `text` | NOT NULL | `'Admin'` or `'User'` |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Account creation time |

**Default seed:** `admin` / `admin123` (Admin role) — created on first startup if no users exist.

---

### Table: `processed_docs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `serial` | PRIMARY KEY | Auto-increment ID |
| `original_filename` | `text` | NOT NULL | Original `.docx` filename |
| `report_filename` | `text` | NOT NULL | Generated HTML report filename |
| `project_name` | `text` | nullable | Project name parsed from document |
| `processing_date` | `text` | nullable | Date parsed from document |
| `position_count` | `integer` | NOT NULL | Number of positions processed |
| `original_file` | `bytea` | NOT NULL | Binary content of original `.docx` |
| `report_file` | `bytea` | NOT NULL | Binary content of generated HTML report |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Upload/processing time |

---

### Table: `requests`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `serial` | PRIMARY KEY | Auto-increment ID |
| `position_id` | `text` | NOT NULL | Position identifier from QR (e.g. `01 / 1`) |
| `request_type` | `text` | NOT NULL | Reason for contact (e.g. `Maintenance Request`) |
| `customer_phone` | `text` | nullable | Customer's Saudi phone number |
| `project_name` | `text` | nullable | Project name from QR URL param |
| `invoice_number` | `text` | nullable | Invoice/order reference (manual entry only) |
| `message` | `text` | nullable | Customer's free-text notes |
| `status` | `text` | NOT NULL, DEFAULT `'New'` | `'New'` \| `'In Progress'` \| `'Done'` |
| `created_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Submission time |

---

### Table: `system_settings` (v2.5.2)

Key-value store for admin-editable system settings. Seeded with contract template defaults on startup.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `serial` | PRIMARY KEY | Auto-increment ID |
| `key` | `text` | NOT NULL, UNIQUE | Setting key (e.g. `contract_cover_intro_ar`) |
| `value` | `text` | NOT NULL | Setting value (up to 10,000 chars) |
| `updated_at` | `timestamp` | NOT NULL, DEFAULT NOW() | Last update time |

**Seeded keys:** `contract_cover_intro_ar`, `contract_cover_intro_en`, `contract_terms_ar`, `contract_terms_en`, `contract_signature_block_ar`, `contract_signature_block_en`

---

## 6. Environment Variables / متغيرات البيئة

### API Server (`artifacts/api-server`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | ✅ **Required** | — | PostgreSQL connection string. Format: `postgresql://user:pass@host:5432/dbname` |
| `PORT` | ✅ Required | `3000` | Port for the HTTP server. Set automatically by Render |
| `NODE_ENV` | Recommended | `development` | Set to `production` for deployments |
| `JWT_SECRET` | Optional | Auto-generated random string | Secret key for signing JWT tokens. Must be persistent across restarts in production |
| `QR_SCAN_BASE_URL` | Optional | Derived from `Origin` header | Full URL of the scan page for QR codes (e.g. `https://qr-asset-manager-web.onrender.com/scan`). Falls back to the request's `Origin` header if not set |

### Frontend (`artifacts/qr-manager`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | ✅ **Required for production** | `''` (relative) | Full URL of the API server. **Must be set before building** — baked into JS bundle at build time. Example: `https://qr-asset-manager-api.onrender.com` |
| `BASE_PATH` | Optional | `/` | URL base path. Use `/` for root deployments |
| `NODE_ENV` | Optional | `development` | Set to `production` for builds |

> ⚠️ **Critical**: `VITE_API_URL` is a **build-time** variable (Vite `import.meta.env`). Setting it in the dashboard only takes effect after a **full rebuild/redeploy** — not a restart.

---

## 7. Running Locally / التشغيل المحلي

### Prerequisites / المتطلبات الأساسية

- **Node.js** 18+ (`node --version`)
- **pnpm** (`npm install -g pnpm`)
- **PostgreSQL** running locally (`postgresql://localhost/qrdb`)

### Step-by-step / خطوة بخطوة

```bash
# 1. Clone the repository
git clone https://github.com/ahmadAS-ux/wathbat-qr-system.git
cd wathbat-qr-system

# 2. Install all dependencies (monorepo root)
pnpm install

# 3. Create a local .env file for the API server
# Create: artifacts/api-server/.env
DATABASE_URL=postgresql://postgres:password@localhost:5432/qrdb
PORT=3001
NODE_ENV=development
JWT_SECRET=my-local-secret

# 4. Create the PostgreSQL database
createdb qrdb
# or: psql -c "CREATE DATABASE qrdb;"

# 5. Start the API server (dev mode — auto-reloads)
pnpm --filter @workspace/api-server dev

# 6. In a NEW terminal — start the frontend
pnpm --filter @workspace/qr-manager dev

# 7. Open in browser
# Frontend: http://localhost:5173
# API:      http://localhost:3001/api/healthz

# Login credentials (seeded on first startup):
# Username: admin
# Password: admin123
```

### TypeScript check / فحص الأنواع

```bash
pnpm run typecheck
```

### Regenerate API client hooks / إعادة توليد hooks API

```bash
# After changing lib/api-spec/*.yaml
pnpm --filter @workspace/api-spec run codegen
```

---

## 8. Deploying to Render / النشر على Render

The project includes a `render.yaml` Blueprint that defines all services declaratively.

### Step 1: Push to GitHub

```bash
git add .
git commit -m "deploy"
git push origin main
```

### Step 2: Connect to Render

1. Go to [render.com](https://render.com) → **New → Blueprint**
2. Connect your GitHub repository
3. Render detects `render.yaml` and creates 3 resources:
   - `qr-asset-manager-api` — Express API (Web Service)
   - `qr-asset-manager-web` — React SPA (Static Site)
   - `qr-asset-manager-db` — PostgreSQL database

### Step 3: Set VITE_API_URL (Critical)

After the first deploy completes:

1. Copy the API service URL from `qr-asset-manager-api` (e.g. `https://qr-asset-manager-api.onrender.com`)
2. Go to `qr-asset-manager-web` → **Environment**
3. Add variable: `VITE_API_URL` = `https://qr-asset-manager-api.onrender.com`
4. Click **Save Changes**
5. Click **Manual Deploy → Deploy latest commit**

> Without this step the frontend will show a **blank page / connection error** because it can't reach the API.

### Step 4: Set QR Scan URL (for working QR codes)

1. Copy the frontend URL from `qr-asset-manager-web` (e.g. `https://qr-asset-manager-web.onrender.com`)
2. Go to `qr-asset-manager-api` → **Environment**
3. Add variable: `QR_SCAN_BASE_URL` = `https://qr-asset-manager-web.onrender.com/scan`
4. Click **Save Changes** (service restarts automatically)

> Without this step QR codes will embed `/scan` (relative URL) which phone cameras cannot follow.
> **Note:** The system also auto-derives the scan URL from the request's `Origin` header as a fallback, so this step may be optional after the latest code.

### Step 5: Re-upload DOCX files

After fixing `QR_SCAN_BASE_URL`, delete old reports from the admin panel and re-upload DOCX files to regenerate QR codes with correct URLs.

### Environment Variables Summary for Render Dashboard

**qr-asset-manager-api (Web Service):**

| Variable | Value | Set by |
|----------|-------|--------|
| `DATABASE_URL` | Auto-linked from PostgreSQL | render.yaml |
| `NODE_ENV` | `production` | render.yaml |
| `JWT_SECRET` | Auto-generated | render.yaml |
| `QR_SCAN_BASE_URL` | `https://YOUR-FRONTEND.onrender.com/scan` | **Manual — set after first deploy** |

**qr-asset-manager-web (Static Site):**

| Variable | Value | Set by |
|----------|-------|--------|
| `NODE_ENV` | `production` | render.yaml |
| `BASE_PATH` | `/` | render.yaml |
| `VITE_API_URL` | `https://YOUR-API.onrender.com` | **Manual — set after first deploy** |

---

## 9. Known Issues & Fixes / المشاكل المعروفة وحلولها

### Issue 1: Blank White Page on Frontend

**Symptom:** The site loads but shows a blank white page. Browser console shows `net::ERR_CONNECTION_REFUSED` or `404` errors on API calls.

**Cause:** `VITE_API_URL` is not set. Vite embeds it into the JS bundle at build time. If unset, all API calls go to a relative URL (`/api/...`) which fails on a static site without a proxy.

**Fix:**
1. Set `VITE_API_URL` = your API URL in Render dashboard → `qr-asset-manager-web` → Environment
2. Trigger a **Manual Deploy** (Settings → Manual Deploy)

---

### Issue 2: QR Codes Link to /scan (No Domain)

**Symptom:** QR codes in the downloaded report contain URLs like `/scan?pos=01/1&...`. Phone cameras cannot follow relative URLs.

**Cause:** Neither `QR_SCAN_BASE_URL` env var nor `REPLIT_DOMAINS` env var is set on the API server.

**Fix (Option A — env var):**
Set `QR_SCAN_BASE_URL` = `https://your-frontend.onrender.com/scan` in Render dashboard → `qr-asset-manager-api` → Environment.

**Fix (Option B — automatic, already in code):**
The current code derives the scan URL from the `Origin` header of the upload request automatically. If the frontend URL is correctly configured, this works without any env var.

After either fix: delete old reports and re-upload DOCX files to regenerate QR codes.

---

### Issue 3: Login Connection Error

**Symptom:** Login page shows "Connection error. Please try again."

**Cause:** `VITE_API_URL` is not set (same as Issue 1).

**Fix:** Same as Issue 1 above.

---

### Issue 4: pnpm Lockfile Conflict

**Symptom:** Build fails with `ERR_PNPM_OUTDATED_LOCKFILE` or similar lockfile mismatch errors.

**Cause:** The `pnpm-lock.yaml` was generated on a different platform or pnpm version than the build environment.

**Fix:** The build command uses `--no-frozen-lockfile` flag:
```
pnpm install --no-frozen-lockfile
```
This allows pnpm to update the lockfile during CI builds without failing.

---

### Issue 5: DATABASE_URL Not Set

**Symptom:** API server crashes on startup with `Error: DATABASE_URL is required` or DB connection refused.

**Cause:** The `DATABASE_URL` environment variable is missing or incorrect.

**Fix:**
- On Render: The `render.yaml` automatically links `DATABASE_URL` from the managed PostgreSQL instance via `fromDatabase`. Ensure the `qr-asset-manager-db` database was created in the same Blueprint.
- Locally: Set `DATABASE_URL=postgresql://postgres:password@localhost:5432/qrdb` in `artifacts/api-server/.env`.

---

### Issue 6: RTL Sidebar on Wrong Side

**Symptom:** The admin sidebar appears on the LEFT even when the language is Arabic.

**Cause (historical):** A double-reversal bug — `flex-row-reverse` was applied in the CSS when `isRtl=true`, but the HTML `dir="rtl"` attribute (set by the language hook) also reverses flex direction. The two cancelled each other out, leaving the sidebar on the left.

**Fix (already applied):** Removed all `flex-row-reverse` conditionals from `AdminLayout.tsx`. The CSS `direction: rtl` inherited from `html[dir=rtl]` now handles sidebar positioning natively.

---

### Issue 7: Customer Notes (message) Not Visible in Admin

**Symptom:** Customers submit notes via the QR scan form but admins cannot see them in the dashboard.

**Cause (historical):** The `message` field was stored in the database correctly but the `admin_col_message` column was never added to either the Admin dashboard table or the AdminRequests full table.

**Fix (already applied):** Added the **Notes / الرسالة** column to both `AdminRequests.tsx` and the requests preview in `Admin.tsx`.

---

## 10. Future Enhancements / تحسينات مستقبلية

### 1. Email / SMS Notifications on New Request
**What:** Auto-send an email or WhatsApp message to the admin when a customer submits a service request.
**How:** Add `nodemailer` or integrate Twilio/WhatsApp Business API. Trigger in `POST /api/admin/requests` handler after DB insert.

---

### 2. Request Detail Modal with Full History
**What:** Clicking a request in the admin table opens a modal showing all fields (position, dimensions, notes, phone) plus a status change timeline.
**How:** Add a `RequestDetailModal` component. Fetch full request data by ID from a new `GET /api/admin/requests/:id` endpoint.

---

### 3. QR Code Batch PDF Export
**What:** Allow admins to print all QR codes as a compact A4 label sheet (e.g. for attaching to physical items).
**How:** Add a "Print Labels" button in `ResultsView.tsx`. Generate a print-only CSS grid of QR images with position numbers.

---

### 4. Password Change for Users
**What:** Allow users to change their own password from the admin UI.
**How:** Add `PATCH /api/admin/users/:id/password` endpoint. Add a password change form in `AdminUsers.tsx` for the logged-in user.

---

### 5. Request Analytics Charts
**What:** Visual charts on the admin dashboard (request volume by month, most common request types, resolution rate).
**How:** Add Recharts or Chart.js. Create a `GET /api/admin/analytics` endpoint returning aggregated DB counts grouped by month/type.

---

### 6. Multiple File Upload / Batch Processing
**What:** Upload multiple DOCX files at once and process them in sequence.
**How:** Change the `FileUpload` component to accept multiple files. Add a queue in `Home.tsx` that processes them sequentially using the existing `useProcessDocument` hook.

---

### 7. Audit Log
**What:** Track who did what in the admin panel (uploaded a file, deleted a request, changed status, added a user).
**How:** Create a new `audit_log` table (`user_id`, `action`, `target_id`, `details`, `created_at`). Add a middleware or wrapper around sensitive routes to insert log entries.

---

### 8. Customer Feedback Rating
**What:** After submitting a service request, ask the customer to rate their experience (1-5 stars).
**How:** Add a `rating` column to the `requests` table. Show a star rating UI on the `/scan` success screen. Store rating in the same request record.

---

### 9. Offline QR Scan Support (PWA)
**What:** Make the `/scan` page work offline so customers in areas with poor connectivity can still submit requests (queued until online).
**How:** Add a service worker (`vite-plugin-pwa`). Cache the scan page assets. Use `Background Sync` API to queue failed POST requests.

---

### 10. Multi-language Report
**What:** Generate the HTML report in Arabic or based on user preference, not just English.
**How:** Pass a `lang` parameter to `parseAndInjectQR()`. Use Arabic column headers and right-to-left table layout (`dir="rtl"`) in the generated HTML when Arabic is selected.

---

*Last updated: April 2026 — Wathbat Aluminum · wathbat.sa*
