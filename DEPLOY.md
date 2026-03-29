# Deployment Guide — QR Asset Manager

This guide explains how to deploy the QR Asset Manager (front-end) and the API Server (back-end) to **Railway** or **Render.com** using the exported ZIP.

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
├── railway.toml
└── DEPLOY.md                # This file
```

---

## Required Environment Variables

| Variable       | Description                                                                 | Example                          |
|----------------|-----------------------------------------------------------------------------|----------------------------------|
| `DATABASE_URL` | PostgreSQL connection string (required by the API)                          | `postgresql://user:pass@host/db` |
| `PORT`         | Port the API server listens on (set automatically by hosting platforms)     | `3000`                           |
| `NODE_ENV`     | Node environment — set to `production` for live deployments                 | `production`                     |
| `BASE_PATH`    | URL base path for the front-end Vite build (use `/` for root deployments)   | `/`                              |

> **Note:** The front-end (`artifacts/qr-manager/dist/public/`) is a static site and does not require a Node.js process. It just needs to be served by a web server or CDN.

---

## Option 1: Deploy to Railway

Railway can host both the API and the front-end from a single project.

### Prerequisites
- A Railway account at [railway.app](https://railway.app)
- A PostgreSQL add-on provisioned in Railway (or an external DB URL)

### Steps

#### 1. Upload or connect the project
- **From ZIP:** Extract the ZIP, push the contents to a new GitHub repository, then in Railway click **New Project → Deploy from GitHub Repo**.
- **Or:** Use the Railway CLI: `railway init && railway up` from the extracted folder.

#### 2. Configure the API Service

The repository includes a `railway.toml` that configures the API build and start commands automatically:

```toml
[build]
buildCommand = "pnpm install --no-frozen-lockfile && pnpm --filter @workspace/api-server build"

[deploy]
startCommand = "pnpm --filter @workspace/api-server start"
```

In Railway's **Variables** tab for the API service, set:

| Variable       | Value                                  |
|----------------|----------------------------------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (or your own) |
| `NODE_ENV`     | `production`                           |

Railway sets `PORT` automatically — the API server reads it via `process.env.PORT`.

#### 3. Serve the front-end

The front-end build output is in `artifacts/qr-manager/dist/public/`. Add a Static Service in Railway:

1. In your Railway project, add a new **Static** service.
2. Set the root directory to `artifacts/qr-manager`.
3. Set the build command: `pnpm install --no-frozen-lockfile && pnpm --filter @workspace/qr-manager build`
4. Set the publish directory: `dist/public`
5. Set environment variables: `BASE_PATH=/`, `NODE_ENV=production`

#### 4. Deploy

Railway will automatically build and deploy. Check the **Logs** tab for any errors.

---

## Option 2: Deploy to Render.com

Render separates back-end (Web Service) and front-end (Static Site) into two services.

### Prerequisites
- A Render account at [render.com](https://render.com)
- A PostgreSQL database (use Render's built-in Postgres or an external URL)

### Service 1: API Server (Web Service)

1. In Render, click **New → Web Service**.
2. Connect your GitHub repository (push the extracted ZIP contents first).
3. Configure the service:

| Field              | Value                                                       |
|--------------------|-------------------------------------------------------------|
| **Name**           | `qr-asset-manager-api`                                      |
| **Environment**    | `Node`                                                      |
| **Root Directory** | *(leave blank — uses repo root)*                            |
| **Build Command**  | `pnpm install --no-frozen-lockfile && pnpm --filter @workspace/api-server build` |
| **Start Command**  | `pnpm --filter @workspace/api-server start`                 |

4. Add environment variables:

| Variable       | Value                         |
|----------------|-------------------------------|
| `DATABASE_URL` | Your PostgreSQL connection URL |
| `NODE_ENV`     | `production`                  |

Render sets `PORT` automatically.

### Service 2: QR Manager Front-end (Static Site)

1. In Render, click **New → Static Site**.
2. Connect the same repository.
3. Configure the site:

| Field                  | Value                                                        |
|------------------------|--------------------------------------------------------------|
| **Name**               | `qr-asset-manager-web`                                       |
| **Root Directory**     | `artifacts/qr-manager`                                       |
| **Build Command**      | `cd ../.. && pnpm install --no-frozen-lockfile && pnpm --filter @workspace/qr-manager build` |
| **Publish Directory**  | `dist/public`                                                |

4. Add environment variables:

| Variable    | Value           |
|-------------|-----------------|
| `BASE_PATH` | `/`             |
| `NODE_ENV`  | `production`    |

> **Note:** Render Static Sites do not use `PORT` — Render manages the serving automatically.

5. Under **Redirects/Rewrites**, add a rewrite rule for SPA routing:
   - Source: `/*`
   - Destination: `/index.html`
   - Action: `Rewrite`

### Connecting front-end to the API

In the front-end's environment variables, set the API base URL to point to your Render API service URL. Check `artifacts/qr-manager/src/` for the API client configuration and update accordingly.

---

## Running the Built Output Locally

To test the exported build locally before deploying:

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

The project uses Drizzle ORM. To run migrations on a fresh database:

```bash
DATABASE_URL=your_connection_string pnpm --filter @workspace/db run migrate
```

Check `lib/db/` for migration files and configuration.

---

## Troubleshooting

| Problem                        | Solution                                                               |
|-------------------------------|------------------------------------------------------------------------|
| `DATABASE_URL` not set         | Ensure the env var is configured in your hosting platform dashboard    |
| `PORT` conflicts               | Let the platform assign `PORT` automatically; don't hardcode it        |
| Front-end shows blank page     | Check `BASE_PATH` matches the path where the site is served            |
| API returns 500 errors         | Check server logs; ensure DB is reachable and migrations have been run |
| `pnpm: command not found`      | The build environment needs Node 18+ and pnpm. Install: `npm i -g pnpm` |
