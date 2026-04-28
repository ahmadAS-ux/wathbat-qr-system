# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚡ Quick Reference — Read Before Every Session

**Read in this order:**
1. `CLAUDE.md` (this file) — commands, architecture, roles, RTL rules
2. `WORKFLOW_REFERENCE_v3.md` — business logic, DB schemas, API contracts, phase plan
3. `SYSTEM_DESIGN_v3.md` — system architecture decisions, stage model, data flow diagrams
4. `CODE_STRUCTURE.md` — exact file paths, data flows, form specs, validation rules
5. `QUALITY_GATES.md` — verify all 13 gates before every commit
6. `UI_UX_CHECKLIST.md` — read before modifying any frontend component
7. `SECURITY_BASELINE.md` — read before modifying any backend route
8. `QOYOD_INTEGRATION_PLAN.md` — future enhancement: Qoyod API integration plan (read before touching payments)
9. `TEST_CHECKLIST.md` — mandatory pre-commit verification (check items related to your change)

**Golden rule:** Claude Code runs fully autonomously — no confirmation steps, commits and pushes all changes automatically.

**Session Start Protocol:**
1. Read: CLAUDE.md → SYSTEM_DESIGN_v3.md → CODE_STRUCTURE.md
2. Run `pnpm run typecheck` — fix errors before starting task
3. Run `pnpm run build` — fix errors before starting task
4. Read TEST_CHECKLIST.md — understand what must pass
5. Do the requested task
6. Before commit: verify TEST_CHECKLIST.md items related to your change
7. Verify all 14 gates in QUALITY_GATES.md
8. Commit and push

**Version rule:** Every commit that changes behavior bumps version in all 3 package.json files + CHANGELOG + git tag. See QUALITY_GATES.md Gate 12.

**Bug Fix Protocol:**
1. READ the actual code first — do not guess from documentation
2. Add console.log at every step of the flow
3. Trace the EXACT path: click → handler → fetch → response → UI update
4. Find the EXACT line where the chain breaks
5. Fix ONLY that line — do not refactor surrounding code
6. Test the fix works
7. Remove console.logs
8. Update CODE_AUDIT.md with what you found
9. Then commit

NEVER: guess the fix from docs alone, combine multiple fixes, or refactor while fixing.

---


## Project Overview

**Wathbah Manufacturing System (v4.0.10)** — a full-stack TypeScript monorepo that manages aluminum & glass manufacturing projects from first customer contact through warranty.

Built in two layers:
- **Layer 1 (v1.0):** QR Asset Manager — processes Orgadata DOCX files, generates QR codes, tracks customer service requests
- **Layer 2 (v3.x):** ERP System — full 15-stage project lifecycle (leads → warranty), vendors/POs, procurement, manufacturing, delivery phases, customer QR confirmation, warranty auto-check

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

- Entry: `src/index.ts` — runs DB migrations, seeds admin account + dropdown options, starts server; runs warranty expiry check on startup and every 6h
- App: `src/app.ts` — middleware, CORS, global JWT auth guard, route mounting
- Auth guard skips: `POST /api/admin/requests`, `GET /api/healthz`, `GET /api/erp/options/:category`, `GET /api/erp/phases/:id`, `POST /api/erp/phases/:id/confirm`, `GET /api/qr/download/:id`
- DB tables auto-created on startup via Drizzle (all tables idempotent)
- Default seed credentials: `admin` / `admin123`
- Startup migrations (all idempotent `ADD COLUMN IF NOT EXISTS`):
  - Renames `'User'` role → `'Employee'`
  - `dropdown_options`: adds `active`, `sort_order`
  - `project_files`: adds `is_active`
  - `payment_milestones`: adds `linked_event`, `linked_phase_id`, `paid_amount`
  - `project_phases`: adds `delivered_at`, `installed_at`, `customer_confirmed`, `customer_confirmed_at`
- ERP routes: `routes/erp.ts` (65+ routes), mounted at `/api/erp/`
- File detection: `lib/file-detector.ts` — auto-detects Orgadata file type from filename
- Auth middleware: `requireAuth` + `requireRole(...roles)` in `src/lib/auth.ts`

### Frontend (`artifacts/qr-manager/`)

- Entry: `src/main.tsx` — sets API base URL, monkey-patches global `fetch` to inject JWT from localStorage
- Routing: wouter (not React Router)
- Public routes: `/login`, `/scan`, `/confirm/:phaseId` (customer QR confirmation — no auth)
- ERP pages: `src/pages/erp/` — Leads, LeadDetail, Projects, ProjectDetail, ContractPage, Payments, Vendors, AdminSettings, PhaseConfirm
- Sidebar: `AdminLayout.tsx` — includes ERP nav + overdue lead badge + overdue payment badge

### ⚠️ Critical: API Base URL in Every Page

All ERP fetch calls MUST use `API_BASE`. Bare paths break silently in production (caused Issue #3 — entire ERP non-functional on first deploy).

```typescript
import { API_BASE } from '@/lib/api-base';
fetch(`${API_BASE}/api/erp/leads`)   // ✅ correct
fetch('/api/erp/leads')              // ❌ breaks in production
```

Already applied to: `Leads.tsx`, `LeadDetail.tsx`, `Projects.tsx`, `ProjectDetail.tsx`, `Payments.tsx`, `Vendors.tsx`, `AdminSettings.tsx`, `AdminUsers.tsx`, `AdminLayout.tsx`.
**Every new ERP page MUST import and use `API_BASE`. Exception: `PhaseConfirm.tsx` is a public page (no JWT) — it uses bare `/api/` paths intentionally.**

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
| `QOYOD_API_KEY` | Future | Qoyod accounting API key — see `QOYOD_INTEGRATION_PLAN.md` |
| `QOYOD_BASE_URL` | Future | `https://api.qoyod.com/2.0` — see `QOYOD_INTEGRATION_PLAN.md` |

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

## FILE UPLOAD RULES (MANDATORY — READ BEFORE TOUCHING ANY UPLOAD CODE)

These rules are permanent. They apply to every session, every stage, every hotfix.
Violating any of these rules corrupts data. No exceptions.

### The 5 Never Rules

1. NEVER modify `customers.name` from any file upload, parser, or detection logic.
   Customer name changes only from: manual edit on Customer Records page, or Qoyod sync (v4.3.0) with explicit user confirmation.

2. NEVER modify `projects.name` silently from any file upload.
   If a file's project name differs from the system project name, show the unified NameMismatchModal.
   Default button must always be "Keep current name". User must explicitly click "Update" to overwrite.

3. NEVER upload files outside of a project context.
   The standalone /qr/upload page was killed in v4.0.10. All uploads happen inside Project Detail → Files tab.
   There are no orphan files. Every file has a project_id. Every project has a customer_id.

4. NEVER add per-file-type special cases to the mismatch modal.
   All 6 Orgadata file types (glass_order, quotation, section, assembly_list, cut_optimisation, material_analysis)
   use the same unified NameMismatchModal with the same two buttons. No Glass-specific modal. No Quotation-specific modal.

5. NEVER silently replace a file in a single-file slot.
   Always show ReUploadConfirmModal first. Default button is "Cancel". User must click "Replace" to proceed.
   Multi-file slots (vendor_order, qoyod, other) are exempt — they accumulate by design.

### The Upload Config (Single Source of Truth)

File type behavior is defined in FILE_SLOT_CONFIG in lib/db/src/constants/file-types.ts.
Before adding logic for a specific file type anywhere in the codebase, check the config first.
If the behavior you need isn't in the config, add it to the config — not as an if/else in the handler.

### What the Upload Handler Is Allowed to Do

✅ Insert file into project_files
✅ Run Glass parser to inject QR codes (parseAndInjectQR) — output unchanged
✅ Save HTML report to processed_docs (with project_id set — never NULL)
✅ Trigger autoAdvanceStage
✅ Return 409 with mismatch info so the frontend can show the unified modal
✅ Return 400 with specific error message for validation failures

### What the Upload Handler Is NOT Allowed to Do

❌ UPDATE projects SET name = anything
❌ UPDATE customers SET name = anything
❌ UPDATE projects SET customer_name = anything
❌ INSERT into processed_docs WHERE project_id IS NULL
❌ Read customer name from any file field
❌ Read "Person in Charge" and use it as a project or customer identifier

---

## Version & Phase Status

- **Current:** v4.0.10 — Stage 6.5 complete (upload safety hardening, unified name-mismatch modal)
- **Previous:** v3.1.0 — Phase 3 complete (Vendors, Purchase Orders, Manufacturing)
- **Baseline:** v1.0 (tag `v1.0`, commit `c3ee916`) — original QR Asset Manager, safe rollback point

### ERP Phase Status — ALL COMPLETE
| Phase | Version | Status | Description |
|-------|---------|--------|-------------|
| Phase 1 | v2.2 | ✅ Complete | Leads CRM, Projects, File Upload, Contact Log, Dropdown Editor |
| Phase 2 | v2.6.0 | ✅ Complete | Contracts (A4 print), Payment Milestones, Accountant role, File versioning |
| Phase 3 | v3.1.0 | ✅ Complete | Vendors, Purchase Orders, PO Items, Manufacturing Orders |
| Phase 4 | v3.2.0 | ✅ Complete | Delivery Phases, Customer QR Confirmation, Warranty auto-check, Project close |

### Future Enhancements (not yet planned)
- Qoyod API integration — see `QOYOD_INTEGRATION_PLAN.md`
- UI/UX redesign for mobile-first factory floor use
- Price visibility for Employee role (currently blocked — default: hidden)

---

## Quality & Security Summary

### Before every commit — all 13 gates must pass (QUALITY_GATES.md):
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

## File Upload System — Architecture (Audited April 2026)

The file upload system has THREE separate flows. Never mix them. See CODE_STRUCTURE.md §3 for full detail.

| Flow | Trigger | Detection | Endpoint field |
|------|---------|-----------|----------------|
| A — Individual slot | Click upload on a specific slot | **None** — uses slot's `fileType` directly | `file` (single) |
| B — Multi-file slot | Click "+ Add file" inside vendor_order / qoyod / other slot | **None** — same as Flow A | `file` (single) |
| C — Batch | Click "Select files" button | **Yes** — `detectFileType(filename)` from `file-detector.ts` | `file` (single, per item in sequence) |

**Golden rule: The slot determines the file type. The filename does NOT.**

Key implementation details (all in `ProjectDetail.tsx`):
- `triggerUpload(fileType)` sets `accept='.docx'` for single-file slots; `accept='*/*'` for `vendor_order`, `qoyod`, `other`
- `handleFileChange` always calls `uploadFile(file, pendingFileType)` — no detection ever runs here
- `deleteFile` calls `loadProject()` + `loadAllFiles()` + `loadExpectedFiles()` — all three required
- `glass_order` upload success: `loadQrOrders()` + `loadProject()` — both required (stage may auto-advance)
- 409 for quotation OR glass_order → unified `NameMismatchModal` (2 buttons: Keep / Update) — v4.0.10
- Single-file slot re-upload → `ReUploadConfirmModal` intercepts before file picker opens — v4.0.10

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
