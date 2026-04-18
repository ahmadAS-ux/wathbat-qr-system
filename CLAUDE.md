# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚡ Quick Reference — Read Before Every Session

1. CLAUDE.md
2. WORKFLOW_REFERENCE_v3.md
3. CODE_STRUCTURE.md — exact file paths, data flows, validation rules
4. QUALITY_GATES.md — verify all 10 gates before every commit
5. UI_UX_CHECKLIST.md — when modifying frontend
6. SECURITY_BASELINE.md — when modifying backend

**Golden rule:** Claude Code runs fully autonomously — no confirmation steps, commits and pushes all changes automatically.

## Project Overview

Wathbah Manufacturing System (v2.1) — a full-stack TypeScript monorepo that manages aluminum & glass manufacturing projects from first customer contact through warranty. Built on top of the QR Asset Manager which processes DOCX files, generates QR codes, and tracks customer service requests. Includes a multi-role admin dashboard with JWT authentication. Frontend is a React SPA; backend is an Express API backed by PostgreSQL.

## Commands

**Package manager:** pnpm (not npm/yarn)

```bash
# Install all dependencies
pnpm install

# Full build (typecheck + all packages)
pnpm run build

# TypeScript checking only
pnpm run typecheck

# API server (dev mode)
pnpm --filter @workspace/api-server dev

# Frontend (Vite dev server on port 5173)
pnpm --filter @workspace/qr-manager dev

# Build individual packages
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/qr-manager build

# Regenerate React Query hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Create deployable ZIP
pnpm run export-zip
```

There are no automated tests configured.

## Architecture

**Monorepo layout:**
- `artifacts/api-server/` — Express backend
- `artifacts/qr-manager/` — React 19 + Vite frontend
- `lib/api-spec/` — OpenAPI YAML spec + orval codegen config
- `lib/api-client-react/` — Generated React Query hooks (output of codegen, do not edit manually)
- `lib/api-zod/` — Zod validation schemas for API payloads
- `lib/db/` — Drizzle ORM schema + shared DB instance

### Backend (`artifacts/api-server/`)

- Entry: `src/index.ts` — runs DB migrations, seeds admin account + dropdown options, starts server
- App: `src/app.ts` — middleware, global JWT auth guard, route mounting
- Auth guard skips: `POST /api/admin/requests` (public scan form), `GET /api/healthz`, `GET /api/erp/options/:category`
- DB tables auto-created on startup via Drizzle:
  - **QR System:** `users`, `processed_docs`, `requests`
  - **ERP (Phase 1):** `leads`, `lead_logs`, `projects`, `project_files`, `dropdown_options`
- Default seed credentials: `admin` / `admin123`
- Startup migration renames `'User'` role → `'Employee'` (idempotent)
- ERP routes mounted at `/api/erp/` via `routes/erp.ts`
- Auth middleware: `requireAuth` + `requireRole(...roles)` in `src/lib/auth.ts`

### Frontend (`artifacts/qr-manager/`)

- Entry: `src/main.tsx` — sets API base URL, monkey-patches global `fetch` to inject JWT token from localStorage
- Routing: wouter (not React Router)
- Protected routes handled in `src/App.tsx` via auth/language context providers
- Public routes: `/login`, `/scan` (customer QR scan form)
- UI: Radix UI + shadcn/ui + Tailwind CSS v4
- ERP pages: `src/pages/erp/` — Leads, LeadDetail, Projects, ProjectDetail
- Sidebar includes ERP nav item (العملاء والمشاريع) with overdue lead badge

### Code Generation Workflow

When the OpenAPI spec (`lib/api-spec/`) changes, regenerate the client:
```bash
pnpm --filter @workspace/api-spec run codegen
```
This updates `lib/api-client-react/` — never hand-edit generated files there.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `PORT` | API server port (**required** — frontend build fails without it) |
| `NODE_ENV` | `development` or `production` |
| `BASE_PATH` | Frontend base URL path (**required** — frontend build fails without it) |
| `VITE_API_URL` | Frontend API base URL (optional; uses relative paths if unset) |
| `JWT_SECRET` | JWT signing secret (auto-generated if omitted on Render) |
| `QR_SCAN_BASE_URL` | Base URL embedded in QR codes; falls back to `/scan` |
| `LOG_LEVEL` | Pino log level: `trace`/`debug`/`info`/`warn`/`error` (default: `info`) |

## Key Conventions

- TypeScript strict mode throughout; run `pnpm run typecheck` before committing
- Composite TypeScript projects — libs emit declarations only (`emitDeclarationOnly: true`)
- API build uses esbuild (`artifacts/api-server/build.mjs`); frontend uses Vite
- Deployment target: **Render.com** only (`render.yaml`). Railway was abandoned.

## 5 User Roles

| Role | DB Value | Access Level |
|------|----------|-------------|
| Admin (المدير العام) | `'Admin'` | Full access — settings, users, dropdown editor, all data |
| Factory Manager (مدير المصنع) | `'FactoryManager'` | Projects, leads, manufacturing, vendors, pricing, delete records |
| Employee (الموظف) | `'Employee'` | Create leads/projects, upload files, receive items, update status |
| Sales Agent (مندوب المبيعات) | `'SalesAgent'` | View all leads, edit own assigned leads only, no project access |
| Accountant (المحاسب) | `'Accountant'` | Payments, Qoyod uploads, mark payments — no projects or leads |

See WORKFLOW_REFERENCE_v3.md Section 4 for the full permissions table.

## Bilingual / RTL Rules (Mandatory for all UI work)
- Arabic font: **Tajawal** | English font: **DM Sans**
- Add `dir="rtl"` on the page root element
- Wrap any English text inside Arabic context with `<span dir="ltr" class="ltr">text</span>`
- Use `text-align: start` or `text-align: end` — never `left` or `right`
- Use `margin-inline-start/end` and `padding-inline-start/end` — never `left` or `right`
- CSS class for inline English: `.ltr { direction: ltr; display: inline-block; font-family: 'DM Sans', sans-serif; }`
- All user-facing strings must be in `src/lib/i18n.ts` in BOTH Arabic and English
- Dropdown labels: use `labelAr` in Arabic mode, `labelEn` in English mode — never raw `value`

## Version
- Current: **v2.2** — Phone validation (05XXXXXXXX) + dropdown label fix + quality/security docs
- Previous: v2.1 — Phase 1 ERP complete (Leads, Projects, File Upload, Contact Log, Dropdown Editor)
- Baseline: v1.0 (commit c3ee916, tag v1.0) — original QR Asset Manager
- Git tag: `v2.2` — Phone validation + dropdown fix
- Services: `qr-asset-manager-db` (PostgreSQL), `qr-asset-manager-api` (Express), `qr-asset-manager-web` (React static site)

## ERP System Reference

Read **WORKFLOW_REFERENCE_v3.md** before working on any ERP feature. It contains:
- 13-stage project lifecycle (Prospective Customer → Project Complete)
- 4 UI display stages (New / In Study / In Production / Complete)
- DB schemas for all tables (leads, lead_logs, projects, project_files, dropdown_options)
- API contracts for all `/api/erp/` endpoints
- Role permissions matrix
- Phased build plan with Claude Code prompts

### Phase Status
- **Phase 1:** ✅ Complete — Leads CRM, Projects, File Upload, Contact Log, Sidebar Badge, Dropdown Editor
- **Phase 2:** ⏳ Next — Contracts + Payments (needs contract template sample from Ahmad)
- **Phase 3:** 🔜 Procurement + Manufacturing
- **Phase 4:** 🔜 Delivery + Installation + Warranty

### Pending Inputs from Ahmad
- Orgadata Technical Document sample (.docx)
- Orgadata Price Quotation sample (.docx)
- Contract template example
- Qoyod document format sample
- Wathbah logo (high-res)
- Confirm: can Employee see prices?
- Confirm: warranty default duration
- Confirm: payment milestone defaults (30/40/30?)

## Quality & Security

### Pre-Commit Quality Gates (QUALITY_GATES.md)
Every commit must pass ALL 10 gates:
1. `pnpm run typecheck` — zero errors
2. `pnpm run build` — succeeds
3. Server starts and `/api/healthz` responds
4. New endpoints return correct responses (not 500, not empty when data expected)
5. Arabic text renders correctly (not boxes □□□)
6. RTL layout correct (sidebar right in Arabic, text-align: start/end)
7. Forms validate required fields with Arabic error messages
8. Role permissions match WORKFLOW_REFERENCE_v3.md Section 4
9. Seed data doesn't duplicate on restart
10. Existing QR system features still work (no regressions)

### UI/UX Checklist (UI_UX_CHECKLIST.md)
Read before modifying any frontend component. Covers:
- Typography (Tajawal/DM Sans), colors, status badge consistency
- Loading states, error handling, empty states
- Bilingual rendering, RTL layout, translation completeness
- Quick end-to-end test flow

### Security Baseline (SECURITY_BASELINE.md)
5 critical rules for backend code:
1. `requireAuth` + `requireRole()` on every protected route
2. No SQL string concatenation — use Drizzle ORM only
3. File uploads: validate .docx extension + MIME type + 50MB limit
4. Input validation: parseInt + isNaN check on URL params, trim strings
5. Never log or return passwords, JWT secrets, or DATABASE_URL

## ⚠️ Known Risks & Technical Debt

Read this before making any changes to auth, deployment, or stats features.

### Authentication
- **`deleteSession()` is a no-op** (`artifacts/api-server/src/lib/auth.ts`). Logout does NOT invalidate JWTs server-side. Tokens are valid for 7 days after issue regardless of logout. Fix requires a token blocklist (Redis or DB table).
- **Password hashing is scrypt** (`crypto.scryptSync`), NOT SHA-256 as some docs state. The CHANGELOG and PROJECT_DOCS.md incorrectly say SHA-256 — scrypt is correct and more secure.
- `(req as any).session` unsafe type cast used in route handlers — bypasses TypeScript type checking.

### Stats / Metrics
- **`lib/stats.ts` uses in-memory counters** (`totalDocsProcessed`, `totalQRsGenerated`). These reset to zero on every server restart or Render.com redeploy. Dashboard KPIs for "Total Docs" and "Total QRs" are unreliable after cold starts. Fix: persist to DB.

### OpenAPI / Codegen
- **`lib/api-spec/openapi.yaml`** only covers ~3 of 19+ routes. Do **NOT** run `pnpm --filter @workspace/api-spec run codegen` until the spec is fully updated — it will overwrite `lib/api-client-react/` with incomplete hooks. Use direct `fetch` calls for all undocumented routes.

### Build / Environment
- **`PORT` and `BASE_PATH` are strictly required** by `artifacts/qr-manager/vite.config.ts` — the build throws an error if either is missing. They are NOT optional.
- **Replit plugin residue**: `@replit/vite-plugin-runtime-error-modal` is always imported in `vite.config.ts` even in production builds. Should be removed or guarded.
- Dev proxy target `http://localhost:3001` is hardcoded in `vite.config.ts`.

### Documentation Gaps
- **`DEPLOY.md`** still lists Railway as the primary deployment option. Render.com is the only supported target.
- **`replit.md`** describes an old architecture. Should be deleted or marked as outdated.

### Unused Code (safe to remove)
- ~38 shadcn/ui components in `artifacts/qr-manager/src/components/ui/` are installed but never imported
- Custom unused components: `empty.tsx`, `field.tsx`, `item.tsx`, `spinner.tsx`, `button-group.tsx`, `input-group.tsx`
- Unused hook: `hooks/use-mobile.tsx`
- Unused npm packages: `embla-carousel-react`, `react-icons`, `input-otp`, `date-fns`, `next-themes`, `react-resizable-panels`, `recharts`, `cmdk`, `@radix-ui/react-context-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-navigation-menu`
