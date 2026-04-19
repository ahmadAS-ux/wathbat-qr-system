# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚡ Quick Reference — Read Before Every Session

**Read in this order:**
1. `CLAUDE.md` (this file) — commands, architecture, roles, RTL rules
2. `WORKFLOW_REFERENCE_v3.md` — business logic, DB schemas, API contracts, phase plan
3. `CODE_STRUCTURE.md` — exact file paths, data flows, form specs, validation rules
4. `QUALITY_GATES.md` — verify all 12 gates before every commit
5. `UI_UX_CHECKLIST.md` — read before modifying any frontend component
6. `SECURITY_BASELINE.md` — read before modifying any backend route

**Golden rule:** Claude Code runs fully autonomously — no confirmation steps, commits and pushes all changes automatically.

**Version rule:** Every commit that changes behavior bumps version in all 3 package.json files + CHANGELOG + git tag. See QUALITY_GATES.md Gate 12.

---


## Project Overview

**Wathbah Manufacturing System (v2.4)** — a full-stack TypeScript monorepo that manages aluminum & glass manufacturing projects from first customer contact through warranty.

Built in two layers:
- **Layer 1 (v1.0):** QR Asset Manager — processes Orgadata DOCX files, generates QR codes, tracks customer service requests
- **Layer 2 (v2.x):** ERP System — leads CRM, projects lifecycle, file upload, role-based access

Frontend: React 19 SPA. Backend: Express API. Database: PostgreSQL. Deployed: Render.com.

---

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
# ⚠️ WARNING: Do NOT run until openapi.yaml covers all 19+ routes — will overwrite working hooks
pnpm --filter @workspace/api-spec run codegen

# Create deployable ZIP
pnpm run export-zip
```

There are no automated tests configured.

---

## Architecture

**Monorepo layout:**
- `artifacts/api-server/` — Express backend
- `artifacts/qr-manager/` — React 19 + Vite frontend
- `lib/api-spec/` — OpenAPI YAML spec + orval codegen config
- `lib/api-client-react/` — Generated React Query hooks (do not edit manually)
- `lib/api-zod/` — Zod validation schemas for API payloads
- `lib/db/` — Drizzle ORM schema + shared DB instance

### Backend (`artifacts/api-server/`)

- Entry: `src/index.ts` — runs DB migrations, seeds admin account + dropdown options, starts server
- App: `src/app.ts` — middleware, CORS, global JWT auth guard, route mounting
- Auth guard skips: `POST /api/admin/requests`, `GET /api/healthz`, `GET /api/erp/options/:category`
- DB tables auto-created on startup via Drizzle (QR system + ERP Phase 1 tables)
- Default seed credentials: `admin` / `admin123`
- Startup migrations (all idempotent):
  - Renames `'User'` role → `'Employee'`
  - `ALTER TABLE dropdown_options ADD COLUMN IF NOT EXISTS active / sort_order`
  - `UPDATE dropdown_options SET active = true WHERE active IS NULL`
- ERP routes: `routes/erp.ts`, mounted at `/api/erp/`
- Auth middleware: `requireAuth` + `requireRole(...roles)` in `src/lib/auth.ts`

### Frontend (`artifacts/qr-manager/`)

- Entry: `src/main.tsx` — sets API base URL, monkey-patches global `fetch` to inject JWT from localStorage
- Routing: wouter (not React Router)
- Public routes: `/login`, `/scan`
- ERP pages: `src/pages/erp/` — Leads, LeadDetail, Projects, ProjectDetail
- Sidebar: `AdminLayout.tsx` — includes ERP nav + overdue lead badge

### ⚠️ Critical: API Base URL in Every Page

All ERP fetch calls MUST use `API_BASE`. Bare paths break silently in production (caused Issue #3 — entire ERP non-functional on first deploy).

```typescript
import { API_BASE } from '@/lib/api-base';
fetch(`${API_BASE}/api/erp/leads`)   // ✅ correct
fetch('/api/erp/leads')              // ❌ breaks in production
```

Already applied to: `Leads.tsx`, `LeadDetail.tsx`, `Projects.tsx`, `ProjectDetail.tsx`, `AdminUsers.tsx`, `AdminLayout.tsx`.
**Every new ERP page MUST import and use `API_BASE`.**

---

## Environment Variables

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | ✅ Required | PostgreSQL connection string |
| `PORT` | ✅ Required | API server port — frontend build fails without it |
| `BASE_PATH` | ✅ Required | Frontend base URL path — frontend build fails without it |
| `NODE_ENV` | Recommended | `development` or `production` |
| `VITE_API_URL` | Production only | Full API URL — baked into bundle at build time, not runtime |
| `JWT_SECRET` | Optional | Auto-generated if omitted on Render |
| `QR_SCAN_BASE_URL` | Optional | Base URL in QR codes; falls back to `/scan` |
| `LOG_LEVEL` | Optional | `trace`/`debug`/`info`/`warn`/`error` (default: `info`) |

---

## 5 User Roles

| Role | DB Value | What they can do |
|------|----------|-----------------|
| Admin (المدير العام) | `'Admin'` | Everything — settings, users, all data, delete |
| Factory Manager (مدير المصنع) | `'FactoryManager'` | Projects, leads, manufacturing, vendors, pricing, delete |
| Employee (الموظف) | `'Employee'` | Create leads/projects, upload files, receive items, update status |
| Sales Agent (مندوب المبيعات) | `'SalesAgent'` | View all leads, edit own assigned leads only |
| Accountant (المحاسب) | `'Accountant'` | Payments, Qoyod uploads — no leads/projects |

Full permissions matrix: **WORKFLOW_REFERENCE_v3.md Section 4**

---

## Bilingual / RTL Rules (Mandatory for all UI work)

- Arabic font: **Tajawal** | English font: **DM Sans**
- `dir="rtl"` on the page root element
- English text inside Arabic context: `<span dir="ltr" className="ltr">text</span>`
- CSS positions: `text-align: start/end` — never `left/right`
- CSS spacing: `margin-inline-start/end`, `padding-inline-start/end` — never `left/right`
- All user-facing strings: `src/lib/i18n.ts` in BOTH Arabic and English — no exceptions
- Dropdown labels: always `labelAr` / `labelEn` — never raw `value`

---

## Version & Phase Status

- **Current:** v2.4.2 — ProjectDetail detect-first glass order (Issue #4 complete)
- **Previous:** v2.4.1 — Home.tsx project picker dialog
- **Baseline:** v1.0 (tag `v1.0`, commit `c3ee916`) — original QR Asset Manager, safe rollback point

### ERP Phase Status
| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Leads CRM, Projects, File Upload, Contact Log, Dropdown Editor |
| Phase 2 | ⏳ Next | Contracts + Payments |
| Phase 3 | 🔜 Future | Procurement + Manufacturing |
| Phase 4 | 🔜 Future | Delivery + Installation + Warranty |

### Pending from Ahmad (blockers for Phase 2+)
- Orgadata Technical Document sample (.docx)
- Orgadata Price Quotation sample (.docx)
- Contract template example
- Qoyod document format sample
- Wathbah logo (high-res PNG/SVG)
- Confirm: can Employee see prices? (default: No)
- Confirm: warranty default duration (typically 12 months?)
- Confirm: payment milestone defaults (30/40/30?)

---

## Quality & Security Summary

### Before every commit — all 12 gates must pass (QUALITY_GATES.md):
1. `pnpm run typecheck` — zero errors
2. `pnpm run build` — succeeds
3. Server starts, `/api/healthz` responds
4. New endpoints return correct responses (not 500, not empty)
5. Arabic text renders correctly (no □□□)
6. RTL layout correct (sidebar right in Arabic, text-align: start/end)
7. Forms validate with Arabic error messages
8. Role permissions match WORKFLOW_REFERENCE_v3.md Section 4
9. Seed data doesn't duplicate on restart
10. Existing QR system features still work

### Before every frontend change (UI_UX_CHECKLIST.md):
- Typography (Tajawal/DM Sans), colors, status badge consistency
- Loading states, error states, empty states — all required
- Bilingual rendering, RTL layout, full translation

### Before every backend change (SECURITY_BASELINE.md):
1. `requireAuth` + `requireRole()` on every protected route
2. No SQL string concatenation — Drizzle ORM only
3. File uploads: validate `.docx` extension + MIME + 50MB limit
4. Input validation: `parseInt` + `isNaN` on URL params, trim strings
5. Never log or return passwords / JWT secrets / DATABASE_URL

---

## ⚠️ Known Technical Debt

### Authentication
- `deleteSession()` is a no-op — JWTs remain valid 7 days after logout (fix: token blocklist)
- `(req as any).session` unsafe cast — do NOT add new instances
- **Password hashing is scrypt** (crypto.scryptSync) — NOT SHA-256 (earlier docs were wrong)

### Stats
- `lib/stats.ts` in-memory counters reset on every restart — dashboard KPIs unreliable after cold start

### OpenAPI
- `lib/api-spec/openapi.yaml` only documents ~3 of 19+ routes
- ⚠️ Do NOT run codegen — will overwrite `lib/api-client-react/` with incomplete hooks

### Build
- `PORT` and `BASE_PATH` are strictly required by `vite.config.ts` — build fails without them
- Replit plugin `@replit/vite-plugin-runtime-error-modal` still imported in production — safe to guard

### Deployment docs
- `replit.md` describes old architecture — ignore

### Unused code (safe to remove in future)
- ~38 shadcn/ui components never imported
- Unused custom components: `empty.tsx`, `field.tsx`, `item.tsx`, `spinner.tsx`, `button-group.tsx`, `input-group.tsx`
- Unused hook: `hooks/use-mobile.tsx`
- Unused packages: `embla-carousel-react`, `react-icons`, `input-otp`, `date-fns`, `next-themes`, `react-resizable-panels`, `recharts`, `cmdk`, several `@radix-ui` packages
