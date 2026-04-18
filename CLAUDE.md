# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wathbah QR Asset Manager — a full-stack TypeScript monorepo that processes DOCX files to extract position data, generates QR codes, and provides a multi-role admin dashboard with JWT authentication. Frontend is a React SPA; backend is an Express API backed by PostgreSQL.

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

- Entry: `src/index.ts` — runs DB migrations, seeds admin account, starts server
- App: `src/app.ts` — middleware, global JWT auth guard, route mounting
- Auth guard skips: `POST /api/admin/requests` (public scan form) and `GET /api/healthz`
- DB tables (`users`, `processed_docs`, `requests`) are auto-created on startup via Drizzle
- Default seed credentials: `admin` / `admin123`

### Frontend (`artifacts/qr-manager/`)

- Entry: `src/main.tsx` — sets API base URL, monkey-patches global `fetch` to inject JWT token from localStorage
- Routing: wouter (not React Router)
- Protected routes handled in `src/App.tsx` via auth/language context providers
- Public routes: `/login`, `/scan` (customer QR scan form)
- UI: Radix UI + shadcn/ui + Tailwind CSS v4

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
- Deployment target: **Render.com** only (`render.yaml`). Railway was abandoned. See `DEPLOY.md` for details.

## Bilingual / RTL Rules (Mandatory for all UI work)
- Arabic font: **Tajawal** | English font: **DM Sans**
- Add `dir="rtl"` on the page root element
- Wrap any English text inside Arabic context with `<span dir="ltr" class="ltr">text</span>`
- Use `text-align: start` or `text-align: end` — never `left` or `right`
- Use `margin-inline-start/end` and `padding-inline-start/end` — never `left` or `right`
- CSS class for inline English: `.ltr { direction: ltr; display: inline-block; font-family: 'DM Sans', sans-serif; }`

## Version
- Current: **v2.1** — Phase 1 ERP (Leads, Projects, File Upload)
- Previous: v1.0 — QR Asset Manager baseline (deployed on Render.com, April 2026)
- Services: `qr-asset-manager-db` (PostgreSQL), `qr-asset-manager-api` (Express), `qr-asset-manager-web` (React static site)

## ⚠️ Known Risks & Technical Debt (v1.0)

Read this before making any changes to auth, deployment, or stats features.

### Authentication
- **`deleteSession()` is a no-op** (`artifacts/api-server/src/lib/auth.ts`). Logout does NOT invalidate JWTs server-side. Tokens are valid for 7 days after issue regardless of logout. Fix requires a token blocklist (Redis or DB table).
- **Password hashing is scrypt** (`crypto.scryptSync`), NOT SHA-256 as some docs state. The CHANGELOG and PROJECT_DOCS.md incorrectly say SHA-256 — scrypt is correct and more secure.
- `(req as any).session` unsafe type cast used in route handlers — bypasses TypeScript type checking.

### Stats / Metrics
- **`lib/stats.ts` uses in-memory counters** (`totalDocsProcessed`, `totalQRsGenerated`). These reset to zero on every server restart or Render.com redeploy. Dashboard KPIs for "Total Docs" and "Total QRs" are unreliable after cold starts. Fix: persist to DB.
- **For v1.1 stats dashboard work**: migrate counters to a PostgreSQL table first — otherwise any real-time dashboard will show zeros after every cold start.

### OpenAPI / Codegen
- **`lib/api-spec/openapi.yaml`** only covers ~3 of 19 routes. Do **NOT** run `pnpm --filter @workspace/api-spec run codegen` until the spec is fully updated — it will overwrite `lib/api-client-react/` with incomplete hooks that break any page relying on them. Use direct `fetch` calls for all undocumented routes (as the existing admin pages do).

### Build / Environment
- **`PORT` and `BASE_PATH` are strictly required** by `artifacts/qr-manager/vite.config.ts` — the build throws an error if either is missing. They are NOT optional.
- **Replit plugin residue**: `@replit/vite-plugin-runtime-error-modal` is always imported in `vite.config.ts` even in production builds. This is a Replit-specific dependency that should be removed or guarded.
- Dev proxy target `http://localhost:3001` is hardcoded in `vite.config.ts`.

### Documentation Gaps
- **`DEPLOY.md`** still lists Railway as the primary deployment option. Railway was abandoned; Render.com (`render.yaml` Blueprint) is the only supported deployment target.
- **`replit.md`** describes an old Replit-specific architecture and parsing approach that no longer matches the current codebase. It should be deleted or marked as outdated.
- **`lib/api-spec/openapi.yaml`** only documents 3 of 19 API routes. The `/qr/download/{fileId}` response type is wrong (listed as `.docx`, actual is `text/html`). Do not rely on the spec or generated React Query hooks for undocumented routes — use direct `fetch` calls as the existing admin pages do.

### Previously Missing Env Vars (now in the table above)
`LOG_LEVEL` and `QR_SCAN_BASE_URL` were previously absent from the env table — both are now documented in the Environment Variables section.

### Unused Code (safe to remove in v1.1)
- ~38 shadcn/ui components in `artifacts/qr-manager/src/components/ui/` are installed but never imported
- Custom unused components: `empty.tsx`, `field.tsx`, `item.tsx`, `spinner.tsx`, `button-group.tsx`, `input-group.tsx`
- Unused hook: `hooks/use-mobile.tsx`
- Unused npm packages: `embla-carousel-react`, `react-icons`, `input-otp`, `date-fns`, `next-themes`, `react-resizable-panels`, `recharts`, `cmdk`, `@radix-ui/react-context-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-navigation-menu`
## ERP System Reference
Read WORKFLOW_REFERENCE_v3.md before working on any ERP feature.
It contains: DB schema, API contracts, permissions, and Claude Code prompts per phase.