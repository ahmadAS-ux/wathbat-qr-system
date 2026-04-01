# Project Guidelines

## Code Style
- TypeScript: Strict mode enabled, composite projects. Use `emitDeclarationOnly` for declarations; bundle JS with esbuild/Vite.
- Formatting: Follow consistent indentation; reference tsconfig.base.json for configuration.
- Naming: Standard conventions (camelCase for variables, PascalCase for components/classes).

## Architecture
- Monorepo managed with pnpm workspaces: `artifacts/api-server` (Express backend), `artifacts/qr-manager` (React frontend), shared libraries in `lib/`.
- Boundaries: Backend handles API/auth/QR processing; frontend consumes via generated React Query hooks; shared libs provide schema, validation, and specs.
- Database: PostgreSQL with Drizzle ORM; schema in `lib/db/src/schema/`.

## Build and Test
- Install: `pnpm install`
- Build: `pnpm run build` (typechecks and builds all packages)
- Typecheck: `pnpm run typecheck` (run from root for composite projects)
- Dev servers: `pnpm --filter @workspace/api-server dev` (backend), `pnpm --filter @workspace/qr-manager dev` (frontend)
- Export: `pnpm run export-zip` (creates deployable ZIP)

Agents will attempt to run these automatically for validation.

## Conventions
- API codegen: Update `lib/api-spec/openapi.yaml`, then run `pnpm --filter @workspace/api-spec run codegen` to regenerate clients and schemas.
- Environment variables: Required for builds - DATABASE_URL, JWT_SECRET, PORT, BASE_PATH, NODE_ENV.
- Package commands: Use `pnpm --filter @workspace/<package> <command>` for package-specific tasks.
- Auth: JWT tokens for protected routes; password hashing with scrypt.

Potential pitfalls: Always run `pnpm run typecheck` from root before commits; set env vars before building frontend; PostgreSQL required for schema work.

See [DEPLOY.md](DEPLOY.md) for deployment details.