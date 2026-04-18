# SECURITY_BASELINE.md
# أساسيات الأمان — الحد الأدنى المطلوب

> **Purpose:** Basic security rules for a small factory system.
> Claude Code must follow these rules when writing backend code.
> This is NOT a full security audit — it covers the critical risks only.

---

## 5 Critical Security Rules

### Rule 1: Authentication on Every Protected Route

- Every `/api/erp/*` route (except dropdown options GET) must use `requireAuth` middleware
- Every role-restricted route must use `requireRole(...roles)` after `requireAuth`
- Public routes are ONLY: `/api/healthz`, `POST /api/admin/requests` (scan form), `GET /api/erp/options/:category`
- **Test:** call a protected endpoint without a token → must return 401, not 200 or 500

```typescript
// CORRECT
router.get('/leads', requireAuth, requireRole('Admin','FactoryManager','Employee','SalesAgent'), getLeads);

// WRONG — missing auth
router.get('/leads', getLeads);
```

### Rule 2: No SQL Injection

- NEVER build SQL queries with string concatenation
- ALWAYS use Drizzle ORM query builder or parameterized queries
- User input must never appear directly in a SQL string

```typescript
// CORRECT — Drizzle ORM
const lead = await db.select().from(leads).where(eq(leads.id, parseInt(req.params.id)));

// WRONG — SQL injection risk
const lead = await db.execute(`SELECT * FROM leads WHERE id = ${req.params.id}`);
```

### Rule 3: File Upload Safety

- Accept ONLY `.docx` files for Orgadata uploads
- Check file extension AND content type (MIME type)
- Maximum file size: 50MB (already enforced by multer)
- Store files as BYTEA in PostgreSQL — never write to filesystem
- Never execute or serve uploaded files directly

```typescript
// File type check
if (!file.originalname.endsWith('.docx')) {
  return res.status(400).json({ error: 'Only .docx files are accepted' });
}
```

### Rule 4: Input Validation

- Validate all user input on the SERVER — not just the frontend
- Phone numbers: validate Saudi format (05XXXXXXXX) — reject invalid
- IDs in URL params: always `parseInt()` and check `isNaN()` before DB query
- String inputs: trim whitespace, limit length (e.g., notes max 2000 chars)
- Dates: validate format before storing

```typescript
// CORRECT
const id = parseInt(req.params.id);
if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });

// WRONG — could crash or behave unexpectedly
const lead = await db.select().from(leads).where(eq(leads.id, req.params.id));
```

### Rule 5: Sensitive Data Protection

- Passwords are hashed with **scrypt** (`crypto.scryptSync`) — NEVER stored or logged in plain text
- JWT secret must be a strong random string in production — NOT `'secret'` or `'123'`
- Never log request bodies that contain passwords
- Never return `password_hash` in any API response
- Database connection string (`DATABASE_URL`) must never appear in frontend code or client-side logs

---

## Known Security Debt (v1.0 — documented in CLAUDE.md)

These are existing issues that should be fixed when time allows:

| Issue | Risk | Fix |
|-------|------|-----|
| `deleteSession()` is a no-op | Logout doesn't invalidate JWT — token valid for 7 days | Add token blocklist (DB table or Redis) |
| `(req as any).session` pattern | Bypasses TypeScript type safety | Create typed `AuthenticatedRequest` interface |
| No rate limiting on login | Brute force attack possible | Add `express-rate-limit` on `/api/auth/login` |
| No HTTPS enforcement | Data transmitted unencrypted if accessed via HTTP | Render provides HTTPS by default — add `Strict-Transport-Security` header |
| JWT stored in localStorage | Vulnerable to XSS | Acceptable for internal tool — would need httpOnly cookie for public-facing |

**Do NOT fix these during Phase 2-4 unless specifically asked.** They are documented for awareness.

---

## Quick Security Check for Claude Code

Before committing any backend code, verify:

```
1. Every new route has requireAuth (unless intentionally public)
2. Every role-restricted route has requireRole with correct roles
3. No string concatenation in SQL queries
4. File uploads validate extension and size
5. URL params are parsed to integers with NaN check
6. No passwords or secrets in logs or responses
```
