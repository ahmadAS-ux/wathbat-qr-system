# Wathbah Manufacturing System — Workflow Reference v3.0
# نظام وثبة لإدارة المصنع — مرجع سير العمل

> **Version:** 3.0 — April 2026
> **Status:** Phase 1 Complete — v2.2 deployed on Render.com (3 production bugs fixed)
> **Built on top of:** QR Asset Manager v1.1.0 (Render.com)
> **Tech stack:** TypeScript · React 19 · Express · PostgreSQL · Drizzle ORM · pnpm monorepo
> **Primary change from v2.2:** Restructured for Claude Code — added DB schemas, API contracts, component specs, and ready-to-use prompts per phase

---

## ⚡ Quick Reference for Claude Code

Before starting any session, Claude Code must read:
1. `CLAUDE.md` — commands, monorepo structure, RTL rules
2. This file — business logic, DB schema, API design, permissions
3. `CODE_STRUCTURE.md` — exact file paths, data flows, API_BASE rule (⚠️ critical)
4. `lib/db/src/schema/` — existing tables (users, requests, processed_docs)

**Golden rule for every prompt:** Claude Code runs fully autonomously — no confirmation steps, commits and pushes all changes automatically.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [UI Display Stages](#2-ui-display-stages)
3. [Complete DB Schema (all new tables)](#3-complete-db-schema)
4. [Roles & Permissions](#4-roles--permissions)
5. [API Contracts (all new endpoints)](#5-api-contracts)
6. [Project Lifecycle — Stage by Stage](#6-project-lifecycle)
7. [Orgadata File Types](#7-orgadata-file-types)
8. [Navigation Structure](#8-navigation-structure)
9. [Phased Build Plan with Claude Code Prompts](#9-phased-build-plan)
10. [Key Design Decisions](#10-key-design-decisions)
11. [What Stays Unchanged](#11-what-stays-unchanged)
12. [Open Items (Blockers)](#12-open-items)

---

## 1. System Overview

**Wathbah Manufacturing System** manages aluminum & glass manufacturing projects from first customer contact through installation, payment, and warranty.

**Scale:** ~5 active projects at a time. Small team. Employees wear multiple hats.

**Core principle:** Simple enough to use without training — WhatsApp-level simplicity.

**Architecture:** New pages and routes are added to the existing monorepo. The existing QR system (`/scan`, service requests, document archive) is **not touched**.

---

## 2. UI Display Stages

The UI shows **4 stages** on every project card. The DB tracks **13 internal stages** for full detail.

| Display Stage | Arabic | Color | Internal Stages Covered |
|---|---|---|---|
| `new` | جديد | Gray `#6B7280` | 0 (Lead), 1 (Inquiry) |
| `in_study` | قيد الدراسة | Blue `#185FA5` | 2 (Tech Study), 3 (Quotation), 4 (Contract), 5 (Deposit) |
| `in_production` | تصنيع | Amber `#B8860B` | 6 (Procurement), 7 (Receiving), 8 (Manufacturing) |
| `complete` | مكتمل | Teal `#0F6E56` | 9 (Delivery), 10 (Installation), 11 (Payment), 12 (Warranty), 13 (Done) |

### DB columns per project
```sql
stage_display  TEXT  -- 'new' | 'in_study' | 'in_production' | 'complete'
stage_internal INTEGER -- 0 to 13
```

### Stage advancement rules
- Lead created → `stage_display = 'new'`, `stage_internal = 0`
- Converted to project → `stage_internal = 1` (display stays `new`)
- Files uploaded + quotation sent → `stage_internal = 3` → display becomes `in_study`
- Deposit confirmed → `stage_internal = 5` → display becomes `in_production`
- Manufacturing ready → `stage_internal = 8` → display becomes `complete` (temporarily)
- Warranty expired → `stage_internal = 13` → project archived

---

## 3. Complete DB Schema

> Add all new tables to `lib/db/src/schema/`. Import and export from `lib/db/src/schema/index.ts`. Run `pnpm run typecheck` after every schema change.

### 3.1 `leads` table

```typescript
// lib/db/src/schema/leads.ts
export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  source: text('source').notNull(),           // 'WhatsApp'|'Phone'|'Walk-in'|'Referral'|'Social media'
  productInterest: text('product_interest').notNull(), // 'Windows'|'Doors'|'Curtain wall'|'Facades'|'Shower glass'|'Other'
  buildingType: text('building_type').notNull(),       // 'Villa'|'Apartment'|'Commercial'|'Tower'
  location: text('location'),                 // Google Maps link or city/neighborhood text
  assignedTo: integer('assigned_to').references(() => users.id),
  budgetRange: text('budget_range'),          // 'Low'|'Medium'|'High'|'Premium' — optional
  estimatedValue: integer('estimated_value'), // SAR amount — optional
  firstFollowupDate: date('first_followup_date').notNull(),
  status: text('status').notNull().default('new'), // 'new'|'followup'|'converted'|'lost'
  lostReason: text('lost_reason'),            // filled when status = 'lost'
  convertedProjectId: integer('converted_project_id'), // filled when status = 'converted'
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: integer('created_by').references(() => users.id),
});
```

### 3.2 `lead_logs` table

```typescript
// lib/db/src/schema/lead_logs.ts
export const leadLogs = pgTable('lead_logs', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull().references(() => leads.id),
  note: text('note').notNull(),               // free text — what happened
  nextFollowupDate: date('next_followup_date'), // required if lead is active
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  // NOTE: log entries cannot be deleted. They can only be edited by their author.
});
```

### 3.3 `projects` table

```typescript
// lib/db/src/schema/projects.ts
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),               // project/customer name
  customerName: text('customer_name').notNull(),
  phone: text('phone'),
  location: text('location'),
  buildingType: text('building_type'),
  productInterest: text('product_interest'),
  estimatedValue: integer('estimated_value'),  // SAR
  stageDisplay: text('stage_display').notNull().default('new'),     // 4 display stages
  stageInternal: integer('stage_internal').notNull().default(1),    // 0–13
  fromLeadId: integer('from_lead_id').references(() => leads.id),  // null if created directly
  assignedTo: integer('assigned_to').references(() => users.id),
  deliveryDeadline: date('delivery_deadline'),  // set in contract stage
  warrantyMonths: integer('warranty_months'),   // set after installation confirmed
  warrantyStartDate: date('warranty_start_date'),
  warrantyEndDate: date('warranty_end_date'),   // auto-calculated from start + months
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: integer('created_by').notNull().references(() => users.id),
});
```

### 3.4 `project_files` table

```typescript
// lib/db/src/schema/project_files.ts
export const projectFiles = pgTable('project_files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  fileType: text('file_type').notNull(), // v2.5.0 valid: 'glass_order'|'price_quotation'|'section'|'assembly_list'|'cut_optimisation'|'qoyod' (multi-file). Legacy (hidden): 'technical_doc'|'qoyod_deposit'|'qoyod_payment'|'attachment'
  originalFilename: text('original_filename').notNull(),
  fileData: customType<{ data: Buffer }>({   // BYTEA
    dataType() { return 'bytea'; },
  })('file_data').notNull(),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  // One file per fileType per project (re-upload replaces old). Exception: 'qoyod' is multi-file (accumulates).
});
```

### 3.5 `parsed_quotations` table (v2.5.1)

```typescript
// lib/db/src/schema/parsed_quotations.ts
export const parsedQuotationsTable = pgTable('parsed_quotations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),   // "ROSE VILLA - A111"
  quotationNumber: text('quotation_number'),          // "6162" (digits only)
  quotationDate: text('quotation_date'),              // "18/04/2026" (DD/MM/YYYY)
  currency: text('currency').notNull().default('SAR'),
  positions: jsonb('positions').notNull(),            // Array<{ position, quantity, description, unitPrice, lineTotal }>
  subtotalNet: text('subtotal_net'),                  // "361,496.0"
  taxRate: text('tax_rate'),                          // "15.00"
  taxAmount: text('tax_amount'),                      // "54,224.4"
  grandTotal: text('grand_total'),                    // "415,720.4"
  rawPositionCount: integer('raw_position_count').notNull(),
  dedupedPositionCount: integer('deduped_position_count').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 3.6 `parsed_sections` + `parsed_section_drawings` tables (v2.5.1)

```typescript
// lib/db/src/schema/parsed_sections.ts
export const parsedSectionsTable = pgTable('parsed_sections', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),   // "ROSE VILLA A111"
  system: text('system'),                             // "PRESTIGE ALINCO Italian Series (BETA)"
  drawingCount: integer('drawing_count').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const parsedSectionDrawingsTable = pgTable('parsed_section_drawings', {
  id: serial('id').primaryKey(),
  parsedSectionId: integer('parsed_section_id').notNull().references(() => parsedSectionsTable.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),       // preserves document order
  positionCode: text('position_code'),                // null in v2.5.1 — matched in v2.5.2
  mediaFilename: text('media_filename').notNull(),
  mimeType: text('mime_type').notNull().default('image/png'),
  imageData: bytea('image_data').notNull(),
  widthPx: integer('width_px'),
  heightPx: integer('height_px'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 3.7 `system_settings` table (v2.5.2)

Key-value store for admin-editable settings (contract template, future: warranty default, etc.).

```typescript
// lib/db/src/schema/system_settings.ts
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
```

Seeded on startup (idempotent): 6 contract template keys — `contract_cover_intro_ar/en`, `contract_terms_ar/en`, `contract_signature_block_ar/en`.

---

### 3.8 `parsed_assembly_lists` table (v2.5.3)

Parsed output from Orgadata Assembly List DOCX. Replaced on every re-upload (one row per project).

```typescript
// lib/db/src/schema/parsed_assembly_lists.ts
export const parsedAssemblyListsTable = pgTable('parsed_assembly_lists', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),
  positionCount: integer('position_count').notNull().default(0),
  positions: jsonb('positions').notNull().$type<AssemblyPosition[]>(), // [{ positionCode, quantity, system, widthMm, heightMm, glassItems }]
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 3.9 `parsed_cut_optimisations` table (v2.5.3)

Parsed output from Orgadata Cut Optimisation DOCX. Replaced on every re-upload (one row per project).

```typescript
// lib/db/src/schema/parsed_cut_optimisations.ts
export const parsedCutOptimisationsTable = pgTable('parsed_cut_optimisations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id, { onDelete: 'cascade' }),
  sourceFileId: integer('source_file_id').notNull().references(() => projectFilesTable.id, { onDelete: 'cascade' }),
  projectNameInFile: text('project_name_in_file'),
  profileCount: integer('profile_count').notNull().default(0),
  profiles: jsonb('profiles').notNull().$type<CutProfile[]>(), // [{ number, description, colour, quantity, lengthMm, wastageMm, wastagePercent }]
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 3.10 `vendors` table

```typescript
// lib/db/src/schema/vendors.ts
export const vendors = pgTable('vendors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'),
  category: text('category'),  // 'Aluminum'|'Glass'|'Accessories'|'Other'
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 3.11 `purchase_orders` table

```typescript
// lib/db/src/schema/purchase_orders.ts
export const purchaseOrders = pgTable('purchase_orders', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  vendorId: integer('vendor_id').notNull().references(() => vendors.id),
  status: text('status').notNull().default('pending'), // 'pending'|'sent'|'received'|'partial'
  totalAmount: integer('total_amount'),        // SAR — from vendor quotation
  amountPaid: integer('amount_paid').default(0),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: integer('created_by').notNull().references(() => users.id),
});
```

### 3.12 `po_items` table

```typescript
// lib/db/src/schema/po_items.ts
export const poItems = pgTable('po_items', {
  id: serial('id').primaryKey(),
  poId: integer('po_id').notNull().references(() => purchaseOrders.id),
  description: text('description').notNull(),
  category: text('category'),   // 'Aluminum'|'Glass'|'Accessories'|'Special Parts'
  quantity: integer('quantity').notNull(),
  unit: text('unit'),            // 'pcs'|'m²'|'kg'|'m'
  unitPrice: integer('unit_price'),
  receivedQuantity: integer('received_quantity').default(0),
  status: text('status').default('pending'), // 'pending'|'partial'|'received'
});
```

### 3.13 `manufacturing_orders` table

```typescript
// lib/db/src/schema/manufacturing_orders.ts
export const manufacturingOrders = pgTable('manufacturing_orders', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  status: text('status').notNull().default('pending'), // 'pending'|'in_progress'|'ready'
  technicalDocFileId: integer('technical_doc_file_id').references(() => projectFiles.id),
  deliveryDeadline: date('delivery_deadline'),  // copied from project
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  createdBy: integer('created_by').notNull().references(() => users.id),
  updatedAt: timestamp('updated_at'),
  updatedBy: integer('updated_by').references(() => users.id),
});
```

### 3.14 `payment_milestones` table

```typescript
// lib/db/src/schema/payment_milestones.ts
export const paymentMilestones = pgTable('payment_milestones', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  label: text('label').notNull(),      // e.g. 'دفعة أولى 30%' | 'قبل التسليم 40%'
  percentage: integer('percentage'),   // 30 | 40 | 30
  amount: integer('amount'),           // SAR — calculated from contract total
  dueDate: date('due_date'),
  status: text('status').notNull().default('pending'), // 'pending'|'paid'|'overdue'
  paidAt: timestamp('paid_at'),
  qoyodDocFileId: integer('qoyod_doc_file_id').references(() => projectFiles.id),
  notes: text('notes'),
});
```

### 3.15 `delivery_phases` table

```typescript
// lib/db/src/schema/delivery_phases.ts
export const deliveryPhases = pgTable('delivery_phases', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  phaseNumber: integer('phase_number').notNull(),   // 1, 2, 3 ...
  deliveryDate: date('delivery_date'),
  installerStatus: text('installer_status').default('pending'), // 'pending'|'in_progress'|'done'
  customerConfirmed: boolean('customer_confirmed').default(false),
  customerConfirmedAt: timestamp('customer_confirmed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### 3.16 `dropdown_options` table

```typescript
// lib/db/src/schema/dropdown_options.ts
export const dropdownOptions = pgTable('dropdown_options', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(), // 'lead_source'|'product_interest'|'building_type'|'budget_range'
  value: text('value').notNull(),
  labelAr: text('label_ar').notNull(),
  labelEn: text('label_en').notNull(),
  sortOrder: integer('sort_order').default(0),
  active: boolean('active').default(true),
});
```

**Default seed data for `dropdown_options`:**
```sql
-- lead_source
('lead_source', 'whatsapp', 'واتساب', 'WhatsApp')
('lead_source', 'phone', 'هاتف', 'Phone')
('lead_source', 'walk_in', 'زيارة مباشرة', 'Walk-in')
('lead_source', 'referral', 'توصية', 'Referral')
('lead_source', 'social', 'سوشال ميديا', 'Social media')

-- product_interest
('product_interest', 'windows', 'نوافذ', 'Windows')
('product_interest', 'doors', 'أبواب', 'Doors')
('product_interest', 'curtain_wall', 'واجهات زجاجية', 'Curtain wall')
('product_interest', 'facades', 'واجهات', 'Facades')
('product_interest', 'shower', 'زجاج حمامات', 'Shower glass')
('product_interest', 'other', 'أخرى', 'Other')

-- building_type
('building_type', 'villa', 'فيلا', 'Villa')
('building_type', 'apartment', 'شقة', 'Apartment')
('building_type', 'commercial', 'تجاري', 'Commercial')
('building_type', 'tower', 'برج', 'Tower')

-- budget_range
('budget_range', 'low', 'منخفض', 'Low')
('budget_range', 'medium', 'متوسط', 'Medium')
('budget_range', 'high', 'مرتفع', 'High')
('budget_range', 'premium', 'بريميوم', 'Premium')
```

---

## 4. Roles & Permissions

5 roles. The existing `users.role` column currently holds `'Admin'|'User'`. Extend to support all 5 roles.

| Role | Value in DB |
|---|---|
| Admin (المدير العام) | `'Admin'` |
| Factory Manager (مدير المصنع) | `'FactoryManager'` |
| Employee (الموظف) | `'Employee'` |
| Sales Agent (مندوب المبيعات) | `'SalesAgent'` |
| Accountant (المحاسب) | `'Accountant'` |

> **Migration note:** existing `'User'` role → treat as `'Employee'` for now. Add a migration that renames `'User'` to `'Employee'` in the DB.

### Permissions by action

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| View leads | ✅ | ✅ | ✅ | ✅ (all, edit own) | ❌ |
| Create / edit leads | ✅ | ✅ | ✅ | ✅ (own only) | ❌ |
| Convert lead → project | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark lead as lost | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| Create / view projects | ✅ | ✅ | ✅ | ❌ | ❌ |
| Upload Orgadata files | ✅ | ✅ | ✅ | ❌ | ❌ |
| View prices / quotations | ✅ | ✅ | ❌ | ❌ | ✅ |
| Create vendor POs | ✅ | ✅ | ✅ | ❌ | ❌ |
| Receive items (mark PO received) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send manufacturing order | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload Qoyod documents | ✅ | ❌ | ❌ | ❌ | ✅ |
| Mark payment milestones | ✅ | ❌ | ❌ | ❌ | ✅ |
| Delete records | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit dropdown lists | ✅ | ❌ | ❌ | ❌ | ❌ |
| System settings | ✅ | ❌ | ❌ | ❌ | ❌ |

### Middleware pattern (Express)

```typescript
// Use existing requireAuth + add role check
const requireRole = (...roles: string[]) => (req, res, next) => {
  if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

// Usage
router.post('/leads', requireAuth, requireRole('Admin','FactoryManager','Employee','SalesAgent'), createLead);
router.post('/projects', requireAuth, requireRole('Admin','FactoryManager','Employee'), createProject);
router.post('/manufacturing', requireAuth, requireRole('Admin','FactoryManager'), createMfgOrder);
```

---

## 5. API Contracts

All new routes under `/api/erp/`. This keeps them separate from existing `/api/admin/` and `/api/qr/` routes.

### 5.1 Leads

```
GET    /api/erp/leads                     — list all leads (with filters: status, assignedTo, overdue)
POST   /api/erp/leads                     — create lead
GET    /api/erp/leads/:id                 — get lead detail + contact log
PATCH  /api/erp/leads/:id                 — update lead fields or status
DELETE /api/erp/leads/:id                 — Admin/FactoryManager only

POST   /api/erp/leads/:id/logs            — add contact log entry
PATCH  /api/erp/leads/:id/logs/:logId     — edit own log entry (author only)

POST   /api/erp/leads/:id/convert         — convert to project (returns new project id)
PATCH  /api/erp/leads/:id/lose            — mark as lost (body: { reason })
```

### 5.2 Projects

```
GET    /api/erp/projects                  — list all projects (with filter: stage_display)
POST   /api/erp/projects                  — create project (direct, no lead)
GET    /api/erp/projects/:id              — full project detail + files + timeline
PATCH  /api/erp/projects/:id             — update project fields or stage
DELETE /api/erp/projects/:id             — Admin/FactoryManager only

POST   /api/erp/projects/:id/files        — upload file (multipart, field: file, fileType)
DELETE /api/erp/projects/:id/files/:fileId — delete / replace file (replaces same fileType)
GET    /api/erp/projects/:id/files/:fileId — download file
```

### 5.3 Vendors & Purchase Orders

```
GET    /api/erp/vendors                   — list all vendors
POST   /api/erp/vendors                   — create vendor
PATCH  /api/erp/vendors/:id              — update vendor
DELETE /api/erp/vendors/:id              — Admin/FactoryManager only

GET    /api/erp/projects/:id/pos          — list POs for project
POST   /api/erp/projects/:id/pos          — create PO
PATCH  /api/erp/pos/:id                  — update PO status or amount paid
DELETE /api/erp/pos/:id                  — Admin/FactoryManager only

PATCH  /api/erp/pos/:id/items/:itemId    — update item received quantity
```

### 5.4 Manufacturing

```
GET    /api/erp/projects/:id/manufacturing  — get manufacturing order for project
POST   /api/erp/projects/:id/manufacturing  — create manufacturing order
PATCH  /api/erp/manufacturing/:id          — update status (pending→in_progress→ready) + notes
```

### 5.5 Payments

```
GET    /api/erp/projects/:id/payments      — list payment milestones
POST   /api/erp/projects/:id/payments      — create milestone
PATCH  /api/erp/payments/:id              — mark as paid + upload Qoyod doc
```

### 5.6 Delivery

```
GET    /api/erp/projects/:id/delivery      — list delivery phases
POST   /api/erp/projects/:id/delivery      — create delivery phase
PATCH  /api/erp/delivery/:id              — update installer status
POST   /api/erp/delivery/:id/confirm      — customer confirms phase (public — no auth required)
```

### 5.7 Dropdown Options

```
GET    /api/erp/options/:category          — get options for a category (public — used in forms)
POST   /api/erp/options                    — create option (Admin only)
PATCH  /api/erp/options/:id              — update label or order (Admin only)
DELETE /api/erp/options/:id              — Admin only
```

---

## 6. Project Lifecycle

### Stage 0–1: Lead → Project

**Lead fields (required):** customerName, phone, source, productInterest, buildingType, location, assignedTo, firstFollowupDate

**Lead status flow:**
```
new → followup → converted (→ project created)
              ↘ lost
```

**Contact log rules:**
- Cannot be deleted — acts as audit trail
- Author can edit their own entries only
- `nextFollowupDate` required when lead is `new` or `followup`
- `nextFollowupDate` not required when `converted` or `lost`
- Dashboard shows overdue badge: follow-up date passed + no new log entry

**Convert to project:** copies customerName, phone, location, buildingType, productInterest, estimatedValue, all contact log entries → new project. Sets `leads.status = 'converted'` and `leads.convertedProjectId`.

---

### Stage 2–3: Technical Study + Quotation

**Actions:** upload Orgadata Section + Price Quotation `.docx` files (v2.5.0+ slots)

**File upload rules:**
- Re-uploading same `fileType` deletes old file from DB and stores new one (single-file slots)
- Glass/Panel Order (`glass_order`) triggers **existing QR generation pipeline** automatically
- **Quotation upload (`price_quotation`)** triggers parser → extracts positions/prices/totals into `parsed_quotations`. Returns **409 Conflict** if project name in file doesn't match system name — frontend shows `NameMismatchModal` (Proceed / Proceed & update name / Cancel)
- **Section upload (`section`)** triggers parser → extracts all embedded drawings into `parsed_section_drawings` (261 drawings typical). Name mismatch is warning-only (non-blocking)

**Stage advance:** after quotation sent to customer → `stage_internal = 3`, `stage_display = 'in_study'`

---

### Stage 4: Contract

**Actions:** system renders branded contract as a printable HTML page. User prints or saves as PDF via browser.

**Contract fields pulled from project:** customerName, projectName, deliveryDeadline, productInterest + parsed_quotations data

**Template sections:** stored in `system_settings` table — 6 keys:
- `contract_cover_intro_ar`, `contract_cover_intro_en` — cover page intro text
- `contract_terms_ar`, `contract_terms_en` — terms and conditions
- `contract_signature_block_ar`, `contract_signature_block_en` — signature lines
- All support `{{placeholder}}` syntax (customerName, projectName, quotationNumber, quotationDate, deliveryDeadline, grandTotal, subtotalNet, taxRate, taxAmount, today, companyName)

**Contract page:** `/erp/projects/:id/contract` — cover → positions table → drawings (1 per page) → terms + signature
**Print CSS:** `@page size: A4` + `page-break-after: always` — no PDF library
**Drawings:** loaded via `<img src="/api/erp/drawings/:id">` — lazy, no base64 blobs
**Integrity check:** runs on page load, blocks print if errors (name mismatch, missing files, unresolved placeholders, totals mismatch)
**Override:** user can override with confirmation + backend log
**Stage advance:** `POST /contract/mark-printed` advances stageInternal → 4 on print
**Permissions:** Admin, FactoryManager, SalesAgent
**Template editor:** Admin Settings page at `/erp/settings`

---

### Stage 5: Deposit Confirmed

**Actions:** Accountant uploads Qoyod document to the **Qoyod slot** (multi-file) → marks first payment milestone as paid → project activates

**Note (v2.5.0):** `qoyod_deposit` and `qoyod_payment` slots were merged into a single multi-file `qoyod` slot. Optional metadata `{ milestoneId, purpose: 'deposit'|'partial'|'final' }` links uploads to a specific payment milestone (Phase 2).

**Stage advance:** deposit marked paid → `stage_internal = 5`, `stage_display = 'in_production'`

---

### Stage 6–7: Procurement + Receiving

**Vendor quotation:** manual table entry (vendor name, items, qty, unit price). File upload optional attachment.

**PO rules:**
- Max 10 vendors per project
- Partial receiving: `receivedQuantity` updated per item
- PO status auto-updates: all items received → `status = 'received'`

**Categories for items:** Aluminum | Glass | Accessories | Special Parts

---

### Stage 8: Manufacturing Order

**3-status flow:** Pending → In Progress → Ready

**Stage advance:** status set to `ready` → `stage_internal = 8`, `stage_display = 'complete'`

**Manufacturing order shows:**
- Link to Technical Document download
- Delivery deadline from project (from contract stage)
- Free-text notes field for status updates (visible to team)

---

### Stage 9–10: Delivery + Installation

**Delivery phases:** project can have multiple delivery phases (1, 2, 3...)

**Each phase tracked:** deliveryDate, installerStatus (pending/in_progress/done), customerConfirmed

**Customer confirmation flow:**
1. Customer scans QR code on any delivered item
2. QR opens delivery confirmation page (new public page: `/confirm/:deliveryPhaseId`)
3. Page shows full phase summary (all items delivered)
4. Button: "تأكيد الاستلام عبر واتساب" → opens `wa.me` link with pre-filled message
5. System also records confirmation: `customerConfirmed = true`, timestamp stored
6. Admin receives in-app notification (badge on sidebar)

---

### Stage 11: Payment Tracking

**Milestones set at contract stage** (e.g. 30% deposit, 40% pre-delivery, 30% post-install)

**Each milestone:** label, percentage, amount (SAR), dueDate, status (pending/paid/overdue)

**Overdue logic:** `dueDate < today AND status = 'pending'` → show warning on dashboard

**Accountant marks paid:** uploads Qoyod document to the **Qoyod slot** (multi-file) → milestone status = 'paid'. Optional metadata `{ milestoneId, purpose: 'deposit'|'partial'|'final' }` links the upload to a specific milestone (Phase 2).

---

### Stage 12–13: Warranty + Complete

**Warranty starts:** automatically after customer confirms installation in Stage 10

**Warranty duration:** set in `system_settings` (default: 12 months — TBD with Ahmad)

**`warrantyEndDate`** = `warrantyStartDate + warrantyMonths`

**Project closes:** `warrantyEndDate < today` → `stage_internal = 13`, project moves to archive view

---

## 7. Orgadata File Types

v2.5.0 — 6-slot layout (5 Orgadata + 1 Qoyod multi-file bucket)

| File | `fileType` value | Multi-file? | Parsed? | How used |
|---|---|---|---|---|
| Glass / Panel Order | `glass_order` | No | ✅ Yes (QR pipeline) | Triggers QR code generation |
| Quotation | `price_quotation` | No | ✅ Parsed (v2.5.1) | Extracts positions, prices, totals → `parsed_quotations`. 409 on project name mismatch. |
| Section | `section` | No | ✅ Parsed (v2.5.1) | Extracts all embedded drawings in document order → `parsed_section_drawings`. |
| Assembly List | `assembly_list` | No | ✅ Parsed (v2.5.3) | Extracts positions (positionCode, qty, system, dimensions, glass items) → `parsed_assembly_lists`. Badge + panel in ProjectDetail. |
| Cut Optimisation | `cut_optimisation` | No | ✅ Parsed (v2.5.3) | Extracts profile summary (number, description, colour, qty, length, wastage) from Summary section → `parsed_cut_optimisations`. Badge + compact table in ProjectDetail. |
| Qoyod | `qoyod` | **Yes** | N/A | Multi-file bucket for all payment proof documents (deposits, partial payments, final payments) |

**Rules:**
- All Orgadata files are `.docx`. Re-uploading a single-file slot replaces the old row.
- `qoyod` is multi-file — new uploads accumulate (no replacement). Each file is individually deletable.
- Legacy types `technical_doc`, `qoyod_deposit`, `qoyod_payment`, `attachment` are no longer accepted for new uploads (returns 400). Existing DB rows are preserved but hidden from UI.

---

## 8. Navigation Structure

5 sidebar sections. The existing sidebar in `AdminLayout.tsx` gets 4 new items.

```
Sidebar (existing + new):
├── 📊 Dashboard          — existing (keep as-is)
├── 📁 QR & Requests      — existing (keep as-is)
├── ─────────── (divider — "النظام الجديد")
├── 👥 المشاريع والعملاء  — NEW: Leads tab + Projects tab
├── 🏭 الموردين            — NEW: Vendors + POs
├── 💰 المدفوعات          — NEW: Payment milestones + warnings
└── ⚙️ الإعدادات          — Admin only: dropdown editor, contract template editor (v2.5.2) at `/erp/settings`
```

**Project page is the heart of the system.** Timeline view shows internal stages 0–13 scrolling down. Next action always at top.

---

## 9. Phased Build Plan

## 🔄 Active Sub-Phase Work

Some Phases are broken into smaller versioned releases.  
Current active work is always documented in `CLAUDE.md` under 
"Current Active Work" section — read that before starting any session.

### ✅ Phase 1: Leads + Projects + File Upload — COMPLETE (v2.2)

**Goal:** Team can register leads, track follow-ups, convert to projects, upload Orgadata files.

**Scope:**
- All DB tables: `leads`, `lead_logs`, `projects`, `project_files`, `dropdown_options`
- Roles: extend `users.role` to support all 5 roles + migrate `'User'` → `'Employee'`
- New API routes: `/api/erp/leads/**` + `/api/erp/projects/**` + `/api/erp/options/**`
- New pages: Leads list, Lead detail (with contact log timeline), Project list (cards), Project detail (stage timeline), Project file upload
- Sidebar badge: overdue leads count
- Existing QR system untouched

**Blocked by:** Orgadata Technical Document and Price Quotation samples (can build UI, defer parsing)

**v2.2 Production fixes (all resolved):**
- Issue #1: Dropdown labels showing "—" — active filter excluded NULL rows; fixed with `ne(active, false)` + idempotent column migration
- Issue #2: Phone field accepted any text — added `/^05\d{8}$/` validation on frontend + backend
- Issue #3: ALL ERP fetch calls used bare `/api/erp/...` paths — worked in dev (Vite proxy), failed in production (static site has no proxy). Fixed by prepending `${API_BASE}` to all 21 fetch calls across 6 files. **This is now enforced in CODE_STRUCTURE.md Section 8.**

#### 🤖 Claude Code Prompt — Phase 1

```
You are working in the Wathbah QR Asset Manager monorepo (TypeScript, React 19, Express, PostgreSQL, Drizzle ORM, pnpm workspaces). Read CLAUDE.md and WORKFLOW_REFERENCE_v3.md fully before starting.

Implement Phase 1 of the Wathbah Manufacturing System ERP — Leads, Projects, and File Upload.

--- DB SCHEMA (lib/db/src/schema/) ---
Create these new files using Drizzle ORM pgTable syntax:
- leads.ts — see WORKFLOW_REFERENCE_v3.md Section 3.1
- lead_logs.ts — see WORKFLOW_REFERENCE_v3.md Section 3.2
- projects.ts — see WORKFLOW_REFERENCE_v3.md Section 3.3
- project_files.ts — see WORKFLOW_REFERENCE_v3.md Section 3.4
- dropdown_options.ts — see WORKFLOW_REFERENCE_v3.md Section 3.11

Update lib/db/src/schema/index.ts to export all new tables.

Seed dropdown_options table with default values from WORKFLOW_REFERENCE_v3.md Section 3.11.

--- ROLES MIGRATION ---
In artifacts/api-server/src/index.ts startup sequence, add a migration that renames role 'User' → 'Employee' in the users table.

Add requireRole() middleware to artifacts/api-server/src/lib/auth.ts (see Section 4 pattern).

--- API ROUTES (artifacts/api-server/src/routes/) ---
Create erp.ts with all routes from Section 5.1 (Leads) and 5.2 (Projects) and 5.7 (Dropdown Options).

Mount at /api/erp in app.ts.

Apply permissions per WORKFLOW_REFERENCE_v3.md Section 4.

For /api/erp/projects/:id/files POST: when fileType = 'glass_order', call the existing QR processing pipeline automatically (same logic as POST /api/qr/process).

--- FRONTEND (artifacts/qr-manager/src/) ---
Add 2 new pages to the sidebar (after the divider "النظام الجديد"):
1. "المشاريع والعملاء" (/erp/leads and /erp/projects)
2. Sidebar badge showing count of leads with overdue follow-up

Create pages:
- src/pages/erp/Leads.tsx — tabs: Active Leads / All Leads. Table with: customer name, product interest, building type, assigned agent, last contact, next follow-up, status badge (New=blue, Follow-up=amber, Overdue=red). Click row → lead detail.
- src/pages/erp/LeadDetail.tsx — lead info + contact log timeline (chronological, bottom-to-top). Add log entry form at top. "Convert to Project" button (Employee/Manager only). "Mark Lost" button with reason modal.
- src/pages/erp/Projects.tsx — card grid view. Each card: project name, customer, stage_display badge (colors from Section 2), assigned user. Filter by stage_display.
- src/pages/erp/ProjectDetail.tsx — internal stage timeline (0–13). Each stage shows status and relevant actions. File upload section per Orgadata file type. Notes field.

All pages: bilingual Arabic/English, RTL by default, follow CLAUDE.md RTL rules. Use Tajawal font for Arabic, DM Sans for English. Wrap ALL English text in <span dir="ltr" className="ltr">.

--- TRANSLATION ---
Add all new strings to src/lib/i18n.ts in both Arabic and English.

--- AFTER IMPLEMENTATION ---
Run pnpm run typecheck. Fix all TypeScript errors.
Commit all changes with message: "feat: Phase 1 — Leads, Projects, File Upload (ERP foundation)"
Push to GitHub.
```

---

### 🟡 Phase 2: Contracts + Payments — Partially Complete

**Goal:** Generate branded contracts. Track payment milestones. Accountant role.

**What's done (v2.5.2):**
- ✅ `system_settings` table — seeded with 6 contract template keys
- ✅ Contract page at `/erp/projects/:id/contract` — printable A4 HTML (no PDF library; browser print/Save as PDF)
- ✅ `GET/PUT /api/erp/settings/contract-template` — Admin-only template editor
- ✅ Admin Settings page at `/erp/settings` — 6 textarea fields (Arabic + English), placeholder reference
- ✅ Contract Integrity Check — green/amber/red, blocks print on errors, override flow with backend log
- ✅ `POST /contract/mark-printed` — advances stageInternal → 4

**What remains (next):**
- ⏳ `payment_milestones` table + CRUD endpoints
- ⏳ Payment milestones section in ProjectDetail (Accountant marks paid, uploads Qoyod doc)
- ⏳ `/erp/payments` page — all milestones across projects, overdue in red
- ⏳ Sidebar badge for overdue payment count
- ⏳ Accountant role fully activated for payment flows

**Blocked by:** Qoyod document format sample (Ahmad). Payment milestone defaults confirmation (30/40/30?).

#### 🤖 Claude Code Prompt — Phase 2 (remaining: Payments only)

```
Implement the remaining Phase 2 work for the Wathbah ERP: Payment Milestones.

Prerequisite: v2.5.2 is deployed. system_settings and contract page are already built.
Read CLAUDE.md, WORKFLOW_REFERENCE_v3.md Section 6 (Stage 5 + Stage 11), Section 5.5 (Payments API), and Section 3.14 (payment_milestones schema).

--- DB ---
Add payment_milestones table (WORKFLOW_REFERENCE_v3.md Section 3.14).
Export from lib/db/src/schema/index.ts.
Create startup migration: CREATE TABLE IF NOT EXISTS payment_milestones (...).

--- API ---
Add to erp.ts:
- GET  /api/erp/projects/:id/payments — list milestones. Auto-update overdue: dueDate < today AND status = 'pending' → status = 'overdue'.
- POST /api/erp/projects/:id/payments — create milestone (Admin/FactoryManager/SalesAgent)
- PATCH /api/erp/payments/:id — mark paid + optional Qoyod doc upload (Accountant/Admin)

--- FRONTEND ---
Add payment milestones section inside ProjectDetail.tsx (below file upload section).
- List milestones: label, percentage, amount (SAR), due date, status badge (pending/paid/overdue)
- Accountant/Admin: "Mark Paid" button → opens modal: upload Qoyod doc (optional) + confirm
- Overdue milestones shown in red

Add "المدفوعات / Payments" page (/erp/payments): all milestones across all projects grouped by project. Accountant can mark paid from here too.

Add sidebar badge for overdue payment count (red dot with count).

Add i18n keys for all new strings (ar + en).

Run pnpm run typecheck. Fix all errors.
Commit: "feat: Phase 2 — Payment milestones"
Push to GitHub.
```

---

### 🟠 Phase 3: Procurement + Manufacturing

**Goal:** Vendors, purchase orders, receiving items, manufacturing orders.

**Scope:**
- New tables: `vendors`, `purchase_orders`, `po_items`, `manufacturing_orders`
- New API routes: Section 5.3 + 5.4
- New pages: Vendors list, PO detail, Manufacturing order view
- Factory Manager role: can send manufacturing orders

#### 🤖 Claude Code Prompt — Phase 3

```
Implement Phase 3 of the Wathbah ERP: Procurement and Manufacturing.

Read CLAUDE.md and WORKFLOW_REFERENCE_v3.md Section 6 (Stage 6–8) and Sections 5.3 and 5.4.

--- DB ---
Create: vendors.ts, purchase_orders.ts, po_items.ts, manufacturing_orders.ts (schemas in WORKFLOW_REFERENCE_v3.md Sections 3.5–3.8).
Export all from lib/db/src/schema/index.ts.

--- API ---
Add to erp.ts all routes from Sections 5.3 (Vendors + POs) and 5.4 (Manufacturing).

PO auto-status: when all po_items.receivedQuantity >= quantity → set po.status = 'received'.

Manufacturing order: when status changes to 'ready' → update project: stage_internal = 8, stage_display = 'complete'.

--- FRONTEND ---
Add "الموردين" page (/erp/vendors): vendor list + create vendor form. Per vendor: list their POs across projects.

Inside ProjectDetail.tsx, add:
- Procurement section: list POs for this project. Button to create PO (select vendor, add items). Per PO: update received quantities per item.
- Manufacturing section: create manufacturing order button (FactoryManager/Admin only). Show status (Pending/In Progress/Ready) with update controls and notes field.

Run pnpm run typecheck. Fix all errors.
Commit: "feat: Phase 3 — Procurement and Manufacturing"
Push to GitHub.
```

---

### 🟢 Phase 4: Delivery + Installation + Warranty

**Goal:** Delivery phases, customer QR confirmation, warranty tracking, project close.

**Scope:**
- New table: `delivery_phases`
- New public page: `/confirm/:deliveryPhaseId`
- WhatsApp deep link for customer confirmation
- Warranty auto-start after customer confirms
- Project auto-close when warranty expires

#### 🤖 Claude Code Prompt — Phase 4

```
Implement Phase 4 of the Wathbah ERP: Delivery, Installation, and Warranty.

Read CLAUDE.md and WORKFLOW_REFERENCE_v3.md Section 6 (Stage 9–13) and Section 5.6.

--- DB ---
Create: delivery_phases.ts (schema in WORKFLOW_REFERENCE_v3.md Section 3.10).
Export from schema/index.ts.

--- API ---
Add to erp.ts all routes from Section 5.6 (Delivery).
POST /api/erp/delivery/:id/confirm is PUBLIC (no auth) — called from customer confirmation page.
When confirm is called: set customerConfirmed = true, customerConfirmedAt = now(). Then check if all phases for project confirmed → start warranty: set project.warrantyStartDate = today, project.warrantyEndDate = today + warrantyMonths.

Also add a startup cron job (runs daily at midnight): check all projects where warrantyEndDate < today AND stage_internal < 13 → set stage_internal = 13 (project complete).

--- FRONTEND ---
New public page src/pages/erp/DeliveryConfirm.tsx (route: /confirm/:deliveryPhaseId, no auth required):
- Show delivery phase summary: project name, phase number, delivered items list
- Big green button: "تأكيد الاستلام عبر واتساب" → opens wa.me link with pre-filled message: "تم استلام التوصيل رقم [phase] لمشروع [projectName] بتاريخ [today]"
- Also POST to /api/erp/delivery/:id/confirm to record confirmation in system
- Success screen after confirmation

Inside ProjectDetail.tsx, add:
- Delivery section: list delivery phases. Button to add phase (select date, notes). Per phase: installer status update, customer confirmation status.
- Warranty section: show warranty start/end date, months remaining.

Add admin notification: when customer confirms a delivery phase, show a badge/toast to admin.

Run pnpm run typecheck. Fix all errors.
Commit: "feat: Phase 4 — Delivery, Installation, and Warranty"
Push to GitHub.
```

---

## 10. Key Design Decisions

| Decision | Choice | Why |
|---|---|---|
| Routes prefix | `/api/erp/` | Keeps new ERP routes cleanly separate from existing `/api/admin/` and `/api/qr/` — zero risk of collision |
| DB migration strategy | Drizzle auto-migration on startup | Already used in project — consistent approach |
| File storage | BYTEA in PostgreSQL | Already used for QR reports and DOCX files — no new infrastructure |
| Orgadata parsing | Deferred until sample files received | Can build 100% of UI and API without it — one focused task when files arrive |
| Contact log deletion | Not allowed | Audit trail — accountability for sales team |
| Manufacturing statuses | Only 3 (Pending / In Progress / Ready) | Simple enough for factory floor. Notes field handles detail. |
| Price visibility for Employee | ❌ Blocked | Confirm with Ahmad — default to NOT showing prices to Employee |
| Customer delivery confirmation | QR + WhatsApp | WhatsApp is universal in Saudi Arabia. No app download required for customer. |
| Sidebar structure | Add divider + new sections | Clean separation between existing QR system and new ERP |
| Public routes | `/confirm/:id` only | All other ERP routes require auth |

---

## 11. What Stays Unchanged

- `POST /api/qr/process` — DOCX upload + QR generation
- `GET /api/qr/download/:fileId` — HTML report download
- `GET/POST /api/admin/requests` — service requests
- `/scan` page — customer QR scan form
- `Admin.tsx`, `AdminHistory.tsx`, `AdminRequests.tsx`, `AdminUsers.tsx` — existing pages
- `render.yaml` — deployment config unchanged
- All existing DB tables: `users`, `processed_docs`, `requests`

The new ERP is **additive only** — no existing code is modified.

---

## 12. Open Items (Blockers)

| Item | Blocks | Action needed |
|---|---|---|
| Orgadata Technical Document sample `.docx` | Price quotation parsing, Contract generation | Ahmad uploads file |
| Orgadata Price Quotation sample `.docx` | Price quotation parsing | Ahmad uploads file |
| Contract template / example | Phase 2 PDF generation | Ahmad shares current paper contract |
| Qoyod document format | Phase 2 payment upload | Ahmad shares sample Word file |
| Wathbah logo (high-res) | Contract PDF, delivery notes | Ahmad uploads PNG/SVG |
| Employee sees prices? | Permissions table | Ahmad confirms yes/no |
| Warranty default duration | Phase 4 warranty auto-start | Ahmad confirms (typical: 12 months?) |
| Payment milestone defaults | Phase 2 contract generation | Ahmad confirms (typical: 30/40/30?) |

---

*Last updated: April 2026 — v3.0 (restructured for Claude Code execution)*
*Changes from v2.2: Added full DB schema, API contracts, component specs, and ready-to-paste Claude Code prompts per phase*
*Wathbat Aluminum — wathbat.sa*
