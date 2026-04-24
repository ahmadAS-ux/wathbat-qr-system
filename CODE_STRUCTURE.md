# CODE_STRUCTURE.md
# عقد هيكل الكود — مرجع إلزامي لكل تعديل

> **Purpose:** Eliminates guessing. Every feature maps to exact file paths, function names, and data flows.
> Claude Code must read this file before writing ANY code.
> If a pattern isn't documented here, check the existing code for the pattern — don't invent one.

---

## Why This File Exists

AI code generation fails when it guesses:
- WHERE to put code (wrong file, wrong folder)
- HOW to name things (inconsistent with existing code)
- HOW data flows (frontend calls wrong endpoint, backend returns wrong shape)
- WHAT validation exists (skips phone validation, forgets Arabic labels)

This file eliminates all 4 problems by defining exact contracts.

---

## 1. File Map — Where Everything Lives

### Backend (artifacts/api-server/src/)

```
artifacts/api-server/src/
├── index.ts              # Entry: DB migrations, seed admin + dropdown_options, start server; warranty expiry setInterval
├── app.ts                # Express app: CORS, JSON, auth guard, route mounting; public skip list
├── routes/
│   ├── index.ts          # Route aggregator — imports and mounts all routers
│   ├── auth.ts           # POST /api/auth/login, GET /api/auth/me
│   ├── admin.ts          # /api/admin/* — metrics, requests, history, users
│   ├── qr.ts             # /api/qr/* — DOCX upload, QR generation, download
│   └── erp.ts            # /api/erp/* — ALL 65+ ERP routes (leads, projects, vendors, phases, payments, etc.)
└── lib/
    ├── auth.ts           # JWT sign/verify, requireAuth, requireRole, hashPassword
    ├── logger.ts         # Pino logger instance
    ├── file-detector.ts  # Auto-detects Orgadata file type from filename (Phase 3+)
    └── stats.ts          # In-memory counters (legacy — unreliable after restart)
```

**Rules:**
- ALL new ERP routes go in `erp.ts` — do NOT create separate route files per feature
- Route mounting: `erp.ts` is mounted at `/api/erp` in `app.ts`
- Auth middleware order: `requireAuth` first, then `requireRole(...roles)`
- Public endpoints must be listed in the auth guard skip list in `app.ts`

### Frontend (artifacts/qr-manager/src/)

```
artifacts/qr-manager/src/
├── main.tsx              # Entry: API base URL, global fetch JWT patch
├── App.tsx               # Router: all routes (incl. public /confirm/:phaseId), auth/language providers
├── pages/
│   ├── Home.tsx          # DOCX upload page
│   ├── Admin.tsx         # Admin dashboard — metrics, archive preview, requests preview
│   ├── AdminHistory.tsx  # Full document archive
│   ├── AdminRequests.tsx # Full service requests table
│   ├── AdminUsers.tsx    # User management (Admin only)
│   ├── AdminDropdowns.tsx # Dropdown editor (Admin only)
│   ├── Login.tsx         # Login form
│   ├── Scan.tsx          # Public customer QR scan form
│   ├── not-found.tsx     # 404 page
│   └── erp/              # ← ALL ERP pages go here
│       ├── Leads.tsx         # Lead list — tabs, table, create modal
│       ├── LeadDetail.tsx    # Lead detail — info + contact log timeline
│       ├── Projects.tsx      # Project list — card grid with stage filters
│       ├── ProjectDetail.tsx # Project detail — stage timeline, file upload, phases, warranty
│       ├── ContractPage.tsx  # Printable A4 contract (Phase 2)
│       ├── Payments.tsx      # All payment milestones across projects (Phase 2)
│       ├── Vendors.tsx       # Vendor list + PO history (Phase 3)
│       ├── AdminSettings.tsx # Contract template editor + system settings (Admin only)
│       └── PhaseConfirm.tsx  # PUBLIC — customer QR confirmation page at /confirm/:phaseId (Phase 4)
├── components/
│   ├── layout/
│   │   ├── AdminLayout.tsx   # Sidebar nav layout — add new items here
│   │   └── Header.tsx        # Top nav bar (hidden on /scan, /confirm/*, /login)
│   ├── erp/
│   │   └── NameMismatchModal.tsx  # Modal for Orgadata project name conflict (Phase 2)
│   ├── FileUpload.tsx        # Drag-and-drop DOCX uploader
│   ├── ResultsView.tsx       # QR results table
│   ├── Toast.tsx             # Toast notification context
│   └── ui/                   # shadcn/ui components (DO NOT modify)
├── hooks/
│   ├── use-language.tsx      # Language/RTL context + localStorage
│   └── use-auth.tsx          # Auth context: login, logout, JWT
└── lib/
    ├── api-base.ts           # Resolves API base URL from VITE_API_URL
    ├── i18n.ts               # ALL translation strings — Arabic + English (506 keys)
    └── utils.ts              # cn(), formatBytes() helpers
```

**Rules:**
- ALL new ERP pages go in `src/pages/erp/` — do NOT put them in `src/pages/`
- New routes are added in `App.tsx` under the ERP section
- Sidebar items are added in `AdminLayout.tsx`
- ALL user-facing strings go in `i18n.ts` — never hardcode text in JSX
- New shared components go in `src/components/` — not inside page files

### Database (lib/db/src/schema/)

```
lib/db/src/schema/
├── index.ts              # Re-exports ALL table schemas — update when adding tables
├── users.ts              # users table
├── requests.ts           # requests table (QR service requests)
├── processed_docs.ts     # processed_docs table (QR reports)
├── leads.ts              # leads table (Phase 1)
├── lead_logs.ts          # lead_logs table (Phase 1)
├── projects.ts           # projects table (Phase 1)
├── project_files.ts      # project_files table (Phase 1)
├── dropdown_options.ts       # dropdown_options table (Phase 1) — has active, sort_order
├── system_settings.ts        # system_settings table (Phase 2) — key-value for contract template
├── payment_milestones.ts     # payment_milestones table (Phase 2) — has linked_event, linked_phase_id, paid_amount
├── parsed_quotations.ts      # parsed Orgadata quotation data (Phase 2)
├── parsed_sections.ts        # parsed section drawings parent row (Phase 2)
├── parsed_section_drawings.ts # individual drawing images from section DOCX (Phase 2)
├── parsed_assembly_lists.ts  # parsed assembly list positions (Phase 2+)
├── parsed_cut_optimisations.ts # parsed cut optimisation profiles (Phase 2+)
├── vendors.ts                # vendors table (Phase 3)
├── purchase_orders.ts        # purchase_orders table (Phase 3)
├── po_items.ts               # po_items table (Phase 3)
├── manufacturing_orders.ts   # manufacturing_orders table (Phase 3)
└── project_phases.ts         # project_phases table (Phase 3 + v3.2: customer_confirmed columns)
```

**Rules:**
- One file per table — named exactly as the table name in snake_case
- Every new schema file must be imported and re-exported from `index.ts`
- Table creation is handled in `artifacts/api-server/src/index.ts` startup sequence
- Use `CREATE TABLE IF NOT EXISTS` — must be idempotent

---

## 2. Naming Conventions

### Database Columns
- Use `snake_case`: `customer_name`, `created_at`, `stage_display`
- Drizzle field names use `camelCase`: `customerName`, `createdAt`, `stageDisplay`
- Drizzle maps camelCase → snake_case automatically via column name parameter

### API Endpoints
- Prefix: `/api/erp/`
- Resources are plural: `/leads`, `/projects`, `/vendors`, `/options`
- Nested resources: `/projects/:id/files`, `/leads/:id/logs`
- Actions: `/leads/:id/convert`, `/leads/:id/lose`, `/delivery/:id/confirm`

### API Response Shape
Every list endpoint returns an array:
```json
[{ "id": 1, "customerName": "...", ... }]
```

Every detail endpoint returns a single object:
```json
{ "id": 1, "customerName": "...", "logs": [...] }
```

Every create/update returns the created/updated object:
```json
{ "id": 1, "customerName": "...", ... }
```

Errors return:
```json
{ "error": "Error message in English" }
```

### Frontend Component Names
- Pages: `PascalCase.tsx` — `Leads.tsx`, `LeadDetail.tsx`, `ProjectDetail.tsx`
- Components: `PascalCase.tsx` — `FileUpload.tsx`, `ResultsView.tsx`
- Hooks: `use-kebab-case.tsx` — `use-language.tsx`, `use-auth.tsx`

### Translation Keys in i18n.ts
- Use `snake_case` for keys: `lead_source`, `building_type`, `create_lead`
- Group by feature: `erp_leads_title`, `erp_projects_title`
- Every key must have BOTH `en` and `ar` values — no exceptions

---

## 3. Data Flow Contracts

### How Dropdowns Work (end-to-end)

This is the EXACT flow that must work for any dropdown in the system:

```
1. SEED (index.ts startup):
   INSERT INTO dropdown_options (category, value, label_ar, label_en, sort_order, active)
   VALUES ('lead_source', 'whatsapp', 'واتساب', 'WhatsApp', 0, true)
   — Guard: only insert if table has 0 rows for this category

2. API (erp.ts):
   GET /api/erp/options/:category → returns:
   [{ "id": 1, "category": "lead_source", "value": "whatsapp", "labelAr": "واتساب", "labelEn": "WhatsApp", "sortOrder": 0, "active": true }]

3. FRONTEND (Leads.tsx):
   — Fetch: GET /api/erp/options/lead_source
   — Map to <Select.Option>:
     const label = isArabic ? option.labelAr : option.labelEn
     <option value={option.value}>{label}</option>
   — NEVER show option.value as the display label
   — NEVER show "—" or empty string as the label

4. SUBMIT (POST /api/erp/leads):
   — Send: { source: "whatsapp" } (the value, not the label)
   — Backend stores the value in the leads.source column

5. DISPLAY (Leads table):
   — Fetch lead with source: "whatsapp"
   — Look up dropdown_options to get the display label
   — Show "واتساب" in Arabic mode, "WhatsApp" in English mode
```

**If any step in this chain breaks, the dropdown appears empty or shows dashes.**

### How Phone Validation Works (end-to-end)

```
1. FRONTEND (form component):
   — Input: type="tel", maxLength={10}, placeholder="05XXXXXXXX"
   — Validation regex: /^05\d{8}$/
   — Error message: isArabic ? "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام" : "Phone must start with 05 and be 10 digits"
   — Block form submission if invalid

2. BACKEND (erp.ts):
   — Validate: if (phone && !/^05\d{8}$/.test(phone)) return 400
   — Store: as-is (string "0536080555")
   — Return: as-is in API responses

3. DISPLAY:
   — Show in LTR direction: <span dir="ltr">0536080555</span>
   — Inside RTL context, numbers must not reverse
```

### How File Upload Works (end-to-end)

```
1. FRONTEND (ProjectDetail.tsx):
   — File input: accept=".docx"
   — FormData: field name "file", plus field "fileType" = 'glass_order' | 'technical_doc' | 'price_quotation'
   — POST /api/erp/projects/:id/files

2. BACKEND (erp.ts):
   — Multer receives file (max 50MB)
   — Validate: file.originalname ends with .docx
   — If same fileType already exists for this project → DELETE old row first
   — INSERT new row into project_files with fileData = file.buffer (BYTEA)
   — If fileType === 'glass_order' → trigger existing QR pipeline (POST /api/qr/process logic)
   — Return: { id, fileType, originalFilename, uploadedAt }

3. DISPLAY (ProjectDetail.tsx):
   — For each fileType, show: filename + upload date + download button + replace button
   — Download: GET /api/erp/projects/:id/files/:fileId → streams BYTEA as .docx
```

### How Lead → Project Conversion Works

```
1. FRONTEND (LeadDetail.tsx):
   — "Convert to Project" button (visible to Employee/Manager/Admin only)
   — POST /api/erp/leads/:id/convert

2. BACKEND (erp.ts):
   — Copy from lead: customerName, phone, location, buildingType, productInterest, estimatedValue
   — Create new project: stageDisplay='new', stageInternal=1, fromLeadId=lead.id
   — Update lead: status='converted', convertedProjectId=newProject.id
   — Return: { projectId: newProject.id }

3. FRONTEND:
   — On success: redirect to /erp/projects/:projectId
```

### How Glass Order Data Flows (cross-system)

The Glass/Panel Order is the primary cross-system handoff point between Layer 1 (QR) and Layer 2 (ERP). It can originate from two different upload paths and lands in two different tables. Both paths must remain visible in Project Detail.

```
PATH A — QR Upload (Home.tsx → processed_docs table):
  1. User uploads a .docx on the QR Upload page (Home.tsx)
  2. POST /api/qr/process → parseAndInjectQR() → saves to processed_docs
     — Columns used: originalFilename, reportFilename, projectName, projectId (nullable),
       positionCount, reportFile (HTML blob), originalFile (docx blob)
  3. If the user selected a project before uploading: projectId is set in processed_docs
  4. ERP Project Detail fetches:
     GET /api/erp/projects/:id/qr-orders → returns rows from processed_docs WHERE project_id = :id
  5. "Glass/Panel Order" file slot in ProjectDetail.tsx:
     — Checks project_files first (fileFor('glass_order'))
     — If no project_files entry: falls back to qrOrders[0] (most recent)
     — Shows filename + "QR" badge; download opens GET /api/qr/download/:reportFileId
     — GET /api/qr/download/:id is PUBLIC (no JWT) — added to app.ts skip list in v2.6.2

PATH B — ERP Upload (ProjectDetail.tsx → project_files table):
  1. User clicks Upload on the Glass/Panel Order slot in Project Detail
  2. POST /api/erp/projects/:id/files with fileType='glass_order'
  3. Backend saves to project_files: projectId, fileType, fileData (bytea), originalFilename
  4. "Glass/Panel Order" slot shows the project_files entry (fileFor('glass_order') is non-null)
  5. Download: GET /api/erp/projects/:id/files/:fileId (JWT-protected, uses global fetch patch)

PRECEDENCE: project_files entry takes priority over qrOrders fallback.
If both exist, the project_files entry is shown (the QR section at the bottom still lists all QR orders).

KEY CONSTRAINT — Download link auth:
  - project_files downloads go through the ERP endpoint (JWT added by global fetch patch in main.tsx)
  - processed_docs downloads open /api/qr/download/:id in a new tab — MUST be a public endpoint
    because <a target="_blank"> and window.open() do NOT send the JWT from localStorage
  - NEVER add a target="_blank" link pointing to a JWT-protected endpoint
```

**Tables involved:**
| Table | Layer | Populated by | Read by |
|-------|-------|-------------|---------|
| `processed_docs` | QR (Layer 1) | `POST /api/qr/process` | `GET /api/erp/projects/:id/qr-orders` |
| `project_files` | ERP (Layer 2) | `POST /api/erp/projects/:id/files` | `GET /api/erp/projects/:id` (nested in `.files[]`) |

### How Role Permissions Work (end-to-end)

```
1. BACKEND (erp.ts):
   — Every route: router.get('/leads', requireAuth, requireRole('Admin','FactoryManager','Employee','SalesAgent'), handler)
   — requireAuth: checks JWT token → sets req.session = { id, username, role }
   — requireRole: checks req.session.role against allowed roles → 403 if not in list

2. FRONTEND (App.tsx / AdminLayout.tsx):
   — useAuth() hook returns { user: { role } }
   — Sidebar items conditionally rendered based on role
   — SalesAgent: only sees "Leads" nav item — no "Projects", "Vendors", "Payments"
   — Buttons like "Convert to Project" hidden for SalesAgent

3. BOTH:
   — Backend is the source of truth — frontend hides UI but backend enforces
   — If frontend forgets to hide a button, backend still returns 403
```

---

## 4. Form Field Specifications

Every form in the system must follow these exact field specs. Claude Code must not skip or invent fields.

### Lead Creation Form

| Field | Type | Required | Validation | Placeholder / Default |
|-------|------|----------|------------|----------------------|
| customerName | text input | ✅ Yes | min 2 chars | "اسم العميل" |
| phone | tel input | ✅ Yes | `/^05\d{8}$/`, maxLength=10 | "05XXXXXXXX" |
| source | select dropdown | ✅ Yes | must match dropdown_options.lead_source | "مصدر العميل" |
| buildingType | select dropdown | ✅ Yes | must match dropdown_options.building_type | "نوع المبنى" |
| productInterest | select dropdown | ✅ Yes | must match dropdown_options.product_interest | "المنتج المطلوب" |
| location | text input | Optional | any string (Google Maps link or text) | "الموقع" |
| assignedTo | select dropdown | Optional | must match a user ID | "المسؤول" |
| budgetRange | select dropdown | Optional | must match dropdown_options.budget_range | "الميزانية" |
| estimatedValue | number input | Optional | positive integer, SAR | "القيمة التقديرية (ريال)" |
| firstFollowupDate | date input | ✅ Yes | must be today or future | "تاريخ أول متابعة" |
| notes | textarea | Optional | max 2000 chars | "ملاحظات" |

### Contact Log Entry Form

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| note | textarea | ✅ Yes | min 5 chars, max 2000 chars |
| nextFollowupDate | date input | ✅ if lead status is 'new' or 'followup' | must be today or future |

### Project Creation Form (direct, not from lead)

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| name | text input | ✅ Yes | min 2 chars |
| customerName | text input | ✅ Yes | min 2 chars |
| phone | tel input | Optional | `/^05\d{8}$/` if provided |
| location | text input | Optional | any string |
| buildingType | text input | Optional | any string |
| productInterest | text input | Optional | any string |
| notes | textarea | Optional | max 2000 chars |

---

## 5. Stage Display Mapping

Claude Code must use these EXACT values — no variations.

```typescript
// The 4 display stages shown on project cards
type StageDisplay = 'new' | 'in_study' | 'in_production' | 'complete';

// Display stage colors (for badges)
const STAGE_COLORS: Record<StageDisplay, { bg: string; text: string; labelAr: string; labelEn: string }> = {
  new:            { bg: '#F1EFE8', text: '#5F5E5A', labelAr: 'جديد',        labelEn: 'New' },
  in_study:       { bg: '#E6F1FB', text: '#185FA5', labelAr: 'قيد الدراسة',  labelEn: 'In study' },
  in_production:  { bg: '#FAEEDA', text: '#B8860B', labelAr: 'تصنيع',       labelEn: 'In production' },
  complete:       { bg: '#E1F5EE', text: '#0F6E56', labelAr: 'مكتمل',       labelEn: 'Complete' },
};

// Internal stage → display stage mapping (15 stages: 0–14)
// 0–1: new | 2–4: in_study | 5–8: in_production | 9–14: complete
function getDisplayStage(internal: number): StageDisplay {
  if (internal <= 1) return 'new';
  if (internal <= 4) return 'in_study';
  if (internal <= 8) return 'in_production';
  return 'complete'; // 9–14
}
```

---

## 6. Seed Data Contract

The EXACT seed data that must exist after first startup. If any row is missing, the corresponding dropdown will show empty.

```sql
-- dropdown_options table — 18 rows total
-- lead_source (5 rows)
('lead_source', 'whatsapp',  'واتساب',           'WhatsApp',     0, true)
('lead_source', 'phone',     'هاتف',             'Phone',        1, true)
('lead_source', 'walk_in',   'حضوري',            'Walk-in',      2, true)
('lead_source', 'referral',  'تحويل',            'Referral',     3, true)
('lead_source', 'social',    'تواصل اجتماعي',    'Social media', 4, true)

-- product_interest (6 rows)
('product_interest', 'windows',      'نوافذ',           'Windows',       0, true)
('product_interest', 'doors',        'أبواب',           'Doors',         1, true)
('product_interest', 'curtain_wall', 'واجهات ستائرية',  'Curtain wall',  2, true)
('product_interest', 'facades',      'واجهات',          'Facades',       3, true)
('product_interest', 'shower',       'زجاج شاور',      'Shower glass',  4, true)
('product_interest', 'other',        'أخرى',            'Other',         5, true)

-- building_type (4 rows)
('building_type', 'villa',      'فيلا',   'Villa',       0, true)
('building_type', 'apartment',  'شقة',    'Apartment',   1, true)
('building_type', 'commercial', 'تجاري',  'Commercial',  2, true)
('building_type', 'tower',      'برج',    'Tower',       3, true)

-- budget_range (4 rows) — note: not 3, exactly 4
('budget_range', 'low',     'منخفض',  'Low',     0, true)
('budget_range', 'medium',  'متوسط',  'Medium',  1, true)
('budget_range', 'high',    'عالي',   'High',    2, true)
('budget_range', 'premium', 'ممتاز',  'Premium', 3, true)
```

**Seed guard pattern:**
```typescript
const count = await db.execute(sql`SELECT COUNT(*) as count FROM dropdown_options`);
if (parseInt(count.rows[0].count) === 0) {
  // Insert all 18 rows
}
```

---

## 7. Error Handling Pattern

Every backend route handler must follow this pattern:

```typescript
router.post('/leads', requireAuth, requireRole('Admin','FactoryManager','Employee','SalesAgent'), async (req, res) => {
  try {
    // 1. Validate input
    const { customerName, phone, source } = req.body;
    if (!customerName || customerName.trim().length < 2) {
      return res.status(400).json({ error: 'Customer name is required (min 2 characters)' });
    }
    if (phone && !/^05\d{8}$/.test(phone)) {
      return res.status(400).json({ error: 'Phone must be Saudi format: 05XXXXXXXX' });
    }

    // 2. Execute DB operation
    const [lead] = await db.insert(leads).values({ ... }).returning();

    // 3. Return created object
    return res.status(201).json(lead);
  } catch (err) {
    logger.error(err, 'Failed to create lead');
    return res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Rules:**
- Always wrap in try/catch
- Validate ALL inputs before DB operations
- Return specific 400 errors for bad input (not generic 500)
- Log errors with `logger.error` (pino), not `console.log`
- Return the created/updated object on success

---

## 8. Frontend API Call Pattern

> ⚠️ **CRITICAL — Production will break without this**
>
> Bare paths like `fetch('/api/erp/...')` work in dev (Vite proxy forwards them to localhost:3001).
> In production on Render.com, they resolve to the **static frontend site**, which has no proxy and returns 404/HTML.
> This was Issue #3 — caused the **entire ERP system to be non-functional in production**.
>
> **Every file that calls the API MUST import and prepend `API_BASE`:**
> ```typescript
> import { API_BASE } from '@/lib/api-base';
> // Then: fetch(`${API_BASE}/api/erp/leads`)
> // NEVER: fetch('/api/erp/leads')   ← breaks in production
> ```
> `API_BASE` is `''` (empty string) in dev → paths stay relative, Vite proxy handles them.
> `API_BASE` is `https://qr-asset-manager-api.onrender.com` in production → full URL hits the API server.

Every frontend API call must follow this pattern:

```typescript
import { API_BASE } from '@/lib/api-base';   // ← MANDATORY — add to every ERP page

// In a page component
const [data, setData] = useState<Lead[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/erp/leads`);  // ← prefix every call
      if (!res.ok) {
        if (res.status === 401) { /* redirect to login */ }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      logger.error(err, 'Failed to load leads');
      setError(isArabic ? 'حدث خطأ في تحميل البيانات' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);

// In JSX:
// if (loading) → show spinner
// if (error) → show error message in current language
// if (data.length === 0) → show empty state message in current language
// else → render data
```

**Rules:**
- **Import `API_BASE` in EVERY page/component that makes API calls** — missing this is a production-only silent failure
- Always show loading state while fetching
- Always handle errors with user-friendly message in current language — never swallow errors with `.catch(() => {})`
- Always handle empty state (don't show a blank page)
- The global fetch patch in `main.tsx` adds the JWT token automatically — don't add it manually
- `API_BASE` already imported in: `Admin.tsx`, `AdminHistory.tsx`, `AdminRequests.tsx`, `AdminUsers.tsx`, `AdminLayout.tsx`, `Leads.tsx`, `LeadDetail.tsx`, `Projects.tsx`, `ProjectDetail.tsx`

---

## 9. Pre-Implementation Checklist

Before writing ANY code, Claude Code must answer these questions:

```
1. Which FILE am I editing? (check Section 1 file map)
2. What ENDPOINT am I hitting? (check Section 3 data flow)
3. What FIELDS does this form have? (check Section 4 specifications)
4. What VALIDATION rules apply? (check Section 4)
5. What ROLES can access this? (check WORKFLOW_REFERENCE_v3.md Section 4)
6. Does this need i18n strings? (yes if any text is visible to users)
7. Does this need RTL handling? (yes if any layout or text direction matters)
8. Does the seed data exist for dropdowns? (check Section 6)
9. What does the loading state look like?
10. What does the error state look like?
11. What does the empty state look like?
```

If ANY answer is "I'm not sure" → read the relevant section before writing code. Don't guess.
