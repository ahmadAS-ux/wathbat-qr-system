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

## 🎯 Current Active Work

**Feature:** Unified Upload + Fuzzy Match (Issue #4 extension)  
**Linked to:** `WORKFLOW_REFERENCE_v3.md` → Section 9 "Active Sub-Phase Work"  
**Business goal:** Every Orgadata file (from any upload point) must be linked to a project — either existing or newly created inline.

### Sub-Phase Status

| Sub-Phase | Version | Status | Scope |
|-----------|---------|--------|-------|
| Backend utilities | v2.4.0 | ✅ Complete | `detect-project` + `create-project-from-file` endpoints |
| Home.tsx dialog | v2.4.1 | ⏳ **NEXT** | Admin upload flow with project picker |
| ProjectDetail.tsx dialog | v2.4.2 | 🔜 Queued | Unify existing conflict logic with same pattern |

**Blocker:** None — v2.4.0 tested and deployed. Ready for v2.4.1.

### Context for Next Session

The backend endpoints from v2.4.0 exist and work:
- `POST /api/erp/files/detect-project` — analyzes DOCX, returns Orgadata name + fuzzy matches
- `POST /api/erp/files/create-project-from-file` — creates project with user-provided customer data

Currently `Home.tsx` still uses the legacy `POST /api/qr/process` endpoint and does NOT link files to projects. v2.4.1 replaces this with a 3-step dialog flow:

1. User selects file → frontend calls `detect-project`
2. Dialog shows: matched projects (with fuzzy score) OR "Create new project" option
3. On selection/creation → call existing glass order upload with resolved `project_id`

### v2.4.1 Implementation Prompt (ready to run)

```
Read CLAUDE.md, CODE_STRUCTURE.md, and UI_UX_CHECKLIST.md before starting.

Implement v2.4.1 — Frontend A. Home.tsx gets a 3-step project picker dialog.
Backend endpoints already exist from v2.4.0. No backend changes in this commit.

---

CONTEXT

Currently Home.tsx uses POST /api/qr/process directly and saves to
processed_docs with no project_id. v2.4.1 intercepts the file drop,
detects the project from the DOCX, and asks the user to confirm before
uploading. The glass order then saves to processed_docs WITH project_id.

Endpoints to use (already deployed in v2.4.0):

  POST ${API_BASE}/api/erp/files/detect-project
    - multipart/form-data, field: "file"
    - response: { orgadataName, orgadataPerson, matches: [{ id, name, customerName, score }] }

  POST ${API_BASE}/api/erp/files/create-project-from-file
    - JSON body: { name, customerName, phone?, buildingType, productInterest, personInCharge? }
    - response: new project row

  POST ${API_BASE}/api/erp/projects/:id/files?fileType=glass_order
    - multipart/form-data, field "file" + body: { fileType: "glass_order" }
    - This is the EXISTING upload endpoint — re-use it, not /api/qr/process

---

CHANGES

File: artifacts/qr-manager/src/pages/Home.tsx

Replace the current single-step upload with a 3-state flow:

  STATE 1 — idle: show FileUpload dropzone (existing component)
  STATE 2 — detecting: spinner while POST /detect-project runs
  STATE 3 — dialog: show DetectDialog component

DetectDialog component (inline or separate file):

Props:
  orgadataName: string
  orgadataPerson: string | null
  matches: { id, name, customerName, score }[]
  pendingFile: File
  onSelect: (projectId: number) => void
  onCreateNew: (data: CreateProjectForm) => void
  onCancel: () => void

Dialog layout (RTL-first, same card style as rest of app):
  - Header: "رفع طلبية QR / Upload Glass Order"
  - Orgadata name pill: shows orgadataName
  - If matches.length > 0:
      List of match cards: project name + customer name + score badge
      (green ≥80, amber 60–79)
      Clicking a card → onSelect(match.id)
  - Divider + "إنشاء مشروع جديد / Create New Project" expandable form:
      Fields: customerName (required), phone (optional),
              buildingType (dropdown), productInterest (dropdown)
      Project name pre-filled from orgadataName (editable)
      Submit → onCreateNew(formData)
  - Cancel button → onCancel()
  - If matches.length === 0: skip to expanded create form, no list

Upload flow:

  handleFileSelect(file):
    1. setDetecting(true), POST to /detect-project with file
    2. On error → show uploadError banner, reset to idle
    3. On success → setPendingFile(file), setDetectResult, show dialog

  handleProjectSelected(projectId):
    1. Close dialog, show processing spinner
    2. POST to /api/erp/projects/${projectId}/files
       FormData: file + fileType=glass_order
    3. On success → setResult(data) — show QR report
    4. On 409 → show conflict warning (reuse v2.3 pattern)
    5. On error → show uploadError banner

  handleCreateAndUpload(formData):
    1. POST /create-project-from-file
    2. On success → handleProjectSelected(project.id)

  handleCancel():
    reset all state → return to idle

---

i18n keys to add (both ar + en):

  detect_dialog_title:    "رفع طلبية QR" / "Upload Glass Order"
  detect_orgadata_label:  "الاسم في الملف" / "Name in file"
  detect_matches_heading: "مشاريع مطابقة" / "Matching projects"
  detect_no_matches:      "لا توجد مشاريع مطابقة" / "No matching projects found"
  detect_score_label:     "تطابق" / "Match"
  detect_create_heading:  "إنشاء مشروع جديد" / "Create new project"
  detect_create_submit:   "إنشاء ورفع" / "Create & Upload"
  detect_cancel:          "إلغاء" / "Cancel"
  detect_customer_name:   "اسم العميل" / "Customer name"

---

Version bump: all 3 package.json 2.4.0 → 2.4.1
CHANGELOG: add v2.4.1 entry
Commit: feat: v2.4.1 — Home.tsx project picker dialog (Issue #4 extension)
Push + tag v2.4.1
```

### IMPORTANT — Maintenance rule for this section

Every time a sub-phase is completed:
1. Update the Sub-Phase Status table (move ⏳ → ✅, promote next to ⏳)
2. Replace the "v2.4.1 Implementation Prompt" block with the next sub-phase's prompt, OR remove the block entirely when all sub-phases are complete
3. When the entire feature is complete, delete this whole "Current Active Work" section — CHANGELOG is the historical record

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

- **Current:** v2.4.0 — Orgadata detect + fuzzy match backend (Issue #4 extension)
- **Previous:** v2.3.1 — Version display in footer + Gate 12 version workflow
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
