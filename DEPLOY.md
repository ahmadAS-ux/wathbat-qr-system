# Deployment Guide — Wathbah Manufacturing System

> **Deployment: Render.com only. Railway was abandoned.**

This guide explains how to deploy the API server and frontend to **Render.com** using the `render.yaml` Blueprint.

---

## Project Structure

```
qr-asset-manager-export.zip
├── artifacts/
│   ├── api-server/          # Express API (Node.js)
│   │   ├── src/
│   │   └── dist/            # Built output (esbuild bundle)
│   └── qr-manager/         # React front-end (Vite)
│       ├── src/
│       └── dist/public/     # Built static assets
├── lib/                     # Shared libraries (api-zod, db, api-client-react, api-spec)
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── render.yaml              # Render Blueprint (infrastructure as code)
└── DEPLOY.md                # This file
```

---

## Required Environment Variables

| Variable       | Description                                                                 | Example                          |
|----------------|-----------------------------------------------------------------------------|----------------------------------|
| `DATABASE_URL` | PostgreSQL connection string (required by the API)                          | `postgresql://user:pass@host/db` |
| `PORT`         | Port the API server listens on (set automatically by Render)                | `3000`                           |
| `NODE_ENV`     | Node environment — set to `production` for live deployments                 | `production`                     |
| `BASE_PATH`    | URL base path for the front-end Vite build (use `/` for root deployments)   | `/`                              |
| `VITE_API_URL` | Full API URL baked into the frontend bundle at build time                   | `https://qr-asset-manager-api.onrender.com` |

> **Note:** The front-end (`artifacts/qr-manager/dist/public/`) is a static site served by Render as a Static Site resource.

---

## Deploy to Render.com

Render separates back-end (Web Service) and front-end (Static Site) into two services, plus a managed PostgreSQL database. All three are defined in `render.yaml`.

### Prerequisites
- A Render account at [render.com](https://render.com)
- The repository pushed to GitHub

### Step 1: Create Blueprint

1. Go to [render.com](https://render.com) → **New → Blueprint**
2. Connect your GitHub repository
3. Render detects `render.yaml` and creates 3 resources:
   - `qr-asset-manager-db` — managed PostgreSQL database
   - `qr-asset-manager-api` — Express API (Web Service)
   - `qr-asset-manager-web` — React SPA (Static Site)

### Step 2: Set VITE_API_URL (Critical)

After the first deploy completes:

1. Copy the API service URL from `qr-asset-manager-api` (e.g. `https://qr-asset-manager-api.onrender.com`)
2. Go to `qr-asset-manager-web` → **Environment**
3. Add variable: `VITE_API_URL` = `https://qr-asset-manager-api.onrender.com`
4. Click **Save Changes**
5. Click **Manual Deploy → Deploy latest commit**

> Without this step the frontend will show a blank page / connection error because it cannot reach the API.

### Step 3: Set QR Scan URL (for working QR codes)

1. Copy the frontend URL from `qr-asset-manager-web` (e.g. `https://qr-asset-manager-web.onrender.com`)
2. Go to `qr-asset-manager-api` → **Environment**
3. Add variable: `QR_SCAN_BASE_URL` = `https://qr-asset-manager-web.onrender.com/scan`
4. Click **Save Changes** (service restarts automatically)

> Without this step QR codes will embed `/scan` (relative URL) which phone cameras cannot follow.

### Environment Variables Summary

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

## Service Configuration (Manual, without render.yaml)

If you need to configure services manually instead of using the Blueprint:

### API Server (Web Service)

| Field              | Value                                                       |
|--------------------|-------------------------------------------------------------|
| **Name**           | `qr-asset-manager-api`                                      |
| **Environment**    | `Node`                                                      |
| **Root Directory** | *(leave blank — uses repo root)*                            |
| **Build Command**  | `pnpm install --no-frozen-lockfile && pnpm --filter @workspace/api-server build` |
| **Start Command**  | `pnpm --filter @workspace/api-server start`                 |

### Frontend (Static Site)

| Field                  | Value                                                        |
|------------------------|--------------------------------------------------------------|
| **Name**               | `qr-asset-manager-web`                                       |
| **Root Directory**     | `artifacts/qr-manager`                                       |
| **Build Command**      | `cd ../.. && pnpm install --no-frozen-lockfile && pnpm --filter @workspace/qr-manager build` |
| **Publish Directory**  | `dist/public`                                                |

Under **Redirects/Rewrites**, add a rewrite rule for SPA routing:
- Source: `/*`
- Destination: `/index.html`
- Action: `Rewrite`

---

## Running the Built Output Locally

```bash
# Install dependencies
pnpm install

# Start the API server
DATABASE_URL=postgresql://localhost/qrdb PORT=3001 NODE_ENV=production pnpm --filter @workspace/api-server start

# Serve the front-end (in another terminal)
BASE_PATH=/ PORT=5173 NODE_ENV=production pnpm --filter @workspace/qr-manager serve
```

---

## Database Migrations

Tables are auto-created on server startup via Drizzle ORM. No manual migration step is needed for fresh deployments.

---

## Troubleshooting

| Problem                        | Solution                                                               |
|-------------------------------|------------------------------------------------------------------------|
| `DATABASE_URL` not set         | Ensure the env var is configured in your Render dashboard              |
| `PORT` conflicts               | Let Render assign `PORT` automatically; don't hardcode it              |
| Front-end shows blank page     | Set `VITE_API_URL` in Render dashboard and trigger a Manual Deploy     |
| API returns 500 errors         | Check server logs; ensure DB is reachable and started correctly        |
| `pnpm: command not found`      | The build environment needs Node 18+ and pnpm. Install: `npm i -g pnpm` |
| pnpm lockfile conflict         | Build commands use `--no-frozen-lockfile` to handle this automatically |
