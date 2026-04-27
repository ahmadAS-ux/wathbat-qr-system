# Wathbah Manufacturing System — Workflow Reference v3.0
# نظام وثبة لإدارة المصنع — مرجع سير العمل

> **Version:** 3.2.0 — April 2026
> **Status:** ALL 4 phases complete — v3.2.0 deployed on Render.com
> **Built on top of:** QR Asset Manager v1.1.0 (Render.com)
> **Tech stack:** TypeScript · React 19 · Express · PostgreSQL · Drizzle ORM · pnpm monorepo
> **v3.2.0:** Phase 4 complete — Delivery phases, customer QR confirmation, warranty auto-check every 6h

---

## ⚡ Quick Reference for Claude Code

Before starting any session, Claude Code must read:
1. `CLAUDE.md` — commands, monorepo structure, RTL rules
2. `SYSTEM_DESIGN_v3.md` — architecture decisions and data flow diagrams
3. This file — business logic, DB schema, API design, permissions
4. `CODE_STRUCTURE.md` — exact file paths, data flows, API_BASE rule (⚠️ critical)
5. `lib/db/src/schema/` — existing tables

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

## 2. UI Display Stages (v3.0 — 15 stages, SYSTEM_DESIGN_v3.md Section 1)

The UI shows **4 stages** on every project card. The DB tracks **15 internal stages (0–14)** for full detail.

| # | Key | English | Arabic | Display Stage |
|---|-----|---------|--------|--------------|
| 0 | lead | Lead | عميل محتمل | new |
| 1 | inquiry | Inquiry | استفسار | new |
| 2 | tech_study | Tech Study | دراسة فنية | in_study |
| 3 | procurement | Procurement | مشتريات | in_study |
| 4 | quotation | Quotation | عرض سعر | in_study |
| 5 | contract | Contract | العقد | in_production |
| 6 | deposit | Deposit | الدفعة الأولى | in_production |
| 7 | manufacturing | Manufacturing | التصنيع | in_production |
| 8 | receiving | Receiving | استلام المواد | in_production |
| 9 | delivery | Delivery | التوصيل | complete |
| 10 | installation | Installation | التركيب | complete |
| 11 | signoff | Sign-off | التسليم | complete |
| 12 | payment | Payment | المدفوعات | complete |
| 13 | warranty | Warranty | الضمان | complete |
| 14 | done | Done | مكتمل | complete |

| Display Stage | Arabic | Color | Internal Stages Covered |
|---|---|---|---|
| `new` | جديد | Gray `#6B7280` | 0–1 |
| `in_study` | قيد الدراسة | Blue `#185FA5` | 2–4 |
| `in_production` | تصنيع | Amber `#B8860B` | 5–8 |
| `complete` | مكتمل | Teal `#0F6E56` | 9–14 |

### DB columns per project
```sql
stage_display  TEXT  -- 'new' | 'in_study' | 'in_production' | 'complete'
stage_internal INTEGER -- 0 to 14
```

### Stage advancement rules (file-triggered — see autoAdvanceStage in erp.ts)
- Lead created → `stage_display = 'new'`, `stage_internal = 0`
- Converted to project → `stage_internal = 1` (display stays `new`)
- Section/Assembly/CutOpt/Material uploaded → `stage_internal = 2` (in_study)
- Vendor Order or Glass Order uploaded → `stage_internal = 3` (in_study)
- Quotation uploaded → `stage_internal = 4` (in_study)
- Contract printed → `stage_internal = 4` (stays in_study; future: 5 = contract)
- Deposit paid (first milestone) → `stage_internal = 5` → display becomes `in_production`
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
  code: text('code'),                              // WT-TYPE-RANDOM5, nullable, auto-generated on creation, unique (TYPE=first 2 chars of buildingType uppercased, RANDOM5=5 random uppercase alphanumeric)
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
  /** v3.0 valid: 'glass_order'|'quotation'|'section'|'assembly_list'|'cut_optimisation'|'material_analysis'
   *  multi-file: 'vendor_order'|'qoyod'|'other'. Legacy (hidden): 'price_quotation'|'technical_doc'|etc. */
  fileType: text('file_type').notNull(),
  originalFilename: text('original_filename').notNull(),
  fileData: bytea('file_data').notNull(),
  uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  uploadedBy: integer('uploaded_by').notNull().references(() => users.id),
  /** true = active version; false = superseded (single-file types only). Re-upload sets old to false. */
  isActive: boolean('is_active').notNull().default(true),
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

### 3.14 `payment_milestones` table (v3.0 — updated)

```typescript
// lib/db/src/schema/payment_milestones.ts
export const paymentMilestonesTable = pgTable('payment_milestones', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id),
  label: text('label').notNull(),       // e.g. 'دفعة أولى 50%' | 'قبل التسليم 40%' | 'بعد التركيب 10%'
  percentage: integer('percentage'),    // 50 | 40 | 10
  amount: integer('amount'),            // SAR — calculated from contract total
  paidAmount: integer('paid_amount'),   // actual amount received (may differ from amount)
  dueDate: date('due_date'),
  status: text('status').notNull().default('pending'), // 'pending'|'due'|'paid'|'overdue'
  paidAt: timestamp('paid_at'),
  qoyodDocFileId: integer('qoyod_doc_file_id').references(() => projectFilesTable.id),
  /** Event that triggers this milestone becoming 'due': 'deposit'|'delivery'|'final' */
  linkedEvent: text('linked_event'),
  /** Phase sign-off that triggers this milestone — set on PATCH /phases/:id/signoff */
  linkedPhaseId: integer('linked_phase_id').references(() => projectPhasesTable.id),
  notes: text('notes'),
});
```

**Default milestones created on project creation:**
| label | percentage | linkedEvent |
|-------|-----------|-------------|
| دفعة أولى (Deposit) | 50% | `deposit` |
| قبل التسليم (Before Delivery) | 40% | `delivery` |
| بعد التركيب (After Sign-off) | 10% | `final` |

### 3.15 `project_phases` table (v3.0 + v3.2 columns)

Tracks delivery/installation phases per project. Each phase steps through `pending → delivered → installed → signed_off`. Sign-off triggers linked payment milestones and (when ALL phases are signed off) starts the warranty.

```typescript
// lib/db/src/schema/project_phases.ts
export const projectPhasesTable = pgTable('project_phases', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projectsTable.id),
  phaseNumber: integer('phase_number').notNull(),  // 1, 2, 3 ...
  label: text('label'),                            // optional custom label
  status: text('status').notNull().default('pending'), // 'pending'|'manufacturing'|'delivered'|'installed'|'signed_off'
  deliveredAt: timestamp('delivered_at'),          // set by PATCH /deliver
  installedAt: timestamp('installed_at'),          // set by PATCH /install
  signedOffAt: timestamp('signed_off_at'),         // set by PATCH /signoff
  customerConfirmed: boolean('customer_confirmed').notNull().default(false), // v3.2
  customerConfirmedAt: timestamp('customer_confirmed_at'),                   // v3.2
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

**Phase flow (v3.2):**

| Endpoint | What it does |
|----------|-------------|
| `PATCH /phases/:id/deliver` | Sets `status='delivered'`, `deliveredAt=now()`, advances project to stage 9 |
| `PATCH /phases/:id/install` | Sets `status='installed'`, `installedAt=now()`, advances project to stage 10 |
| `PATCH /phases/:id/signoff` | Sets `status='signed_off'`, `signedOffAt=now()`. Triggers linked payment milestones → `'due'`. If ALL project phases are now signed off → sets `warrantyStartDate`, `warrantyEndDate` (from `warrantyMonths`, default 12), advances project to stage 13. |
| `GET /phases/:id` (public) | Returns phase info + `projectName` + `customerName` — used by customer confirm page |
| `POST /phases/:id/confirm` (public) | Sets `customerConfirmed=true`, `customerConfirmedAt=now()` |

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
| Create / view projects | ✅ | ✅ | ✅ | ❌ † | ❌ |
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

† SalesAgent can view the contract tab of a project (read-only). All other project actions remain blocked.

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
GET    /api/erp/projects                         — list all projects (with filter: stage_display)
POST   /api/erp/projects                         — create project (direct, no lead)
GET    /api/erp/projects/:id                     — full project detail + files (isActive=true) + phases
PATCH  /api/erp/projects/:id                     — update project fields or stage
DELETE /api/erp/projects/:id                     — Admin/FactoryManager only

POST   /api/erp/projects/:id/files               — upload file(s); supports field 'file' (single) or 'files' (batch)
GET    /api/erp/projects/:id/files               — list files; ?includeInactive=true shows all versions
GET    /api/erp/projects/:id/files/expected      — 9-slot status array (one entry per KNOWN_FILE_TYPE)
POST   /api/erp/projects/:id/files/detect        — auto-detect file types from filenames (no DB write)
DELETE /api/erp/projects/:id/files/:fileId       — soft-delete (sets isActive=false)
GET    /api/erp/projects/:id/files/:fileId       — download file

GET    /api/erp/projects/:id/phases              — list delivery phases
POST   /api/erp/projects/:id/phases              — create delivery phase
PATCH  /api/erp/phases/:id                       — update phase notes/label
DELETE /api/erp/phases/:id                       — Admin/FactoryManager only
PATCH  /api/erp/phases/:id/deliver               — mark phase delivered + advance project to stage 9
PATCH  /api/erp/phases/:id/install               — mark phase installed + advance project to stage 10
PATCH  /api/erp/phases/:id/signoff               — sign off + trigger payment milestones → 'due'; if ALL signed off → start warranty + stage 13
GET    /api/erp/phases/:id                       — PUBLIC: phase info for customer confirm page
POST   /api/erp/phases/:id/confirm               — PUBLIC: customer confirms receipt (no auth required)

GET    /api/erp/projects/:id/contract            — render printable HTML contract (Admin/FM/SalesAgent)
POST   /api/erp/projects/:id/contract/mark-printed — advance stageInternal → 5
POST   /api/erp/projects/:id/contract/override-log — log print override (integrity check bypass)

GET    /api/erp/projects/:id/qr-orders           — list QR orders (processed_docs) linked to project
GET    /api/erp/projects/:id/parsed-quotation    — parsed quotation data
GET    /api/erp/projects/:id/parsed-section      — parsed section drawings
GET    /api/erp/projects/:id/parsed-assembly-list — parsed assembly list positions
GET    /api/erp/projects/:id/parsed-cut-optimisation — parsed cut optimisation profiles
```

### 5.3 Vendors & Purchase Orders

```
GET    /api/erp/vendors                            — list all vendors
POST   /api/erp/vendors                            — create vendor
PATCH  /api/erp/vendors/:id                        — update vendor
DELETE /api/erp/vendors/:id                        — Admin/FactoryManager only
GET    /api/erp/vendors/:id/purchase-orders        — list all POs for a specific vendor

GET    /api/erp/projects/:id/purchase-orders       — list POs for project
POST   /api/erp/projects/:id/purchase-orders       — create PO (select vendor + notes)
GET    /api/erp/purchase-orders/:id                — get PO detail + items
PATCH  /api/erp/purchase-orders/:id                — update PO status or amount paid
DELETE /api/erp/purchase-orders/:id                — Admin/FactoryManager only

POST   /api/erp/purchase-orders/:id/items          — add item to PO
PATCH  /api/erp/po-items/:id                       — update item received quantity (auto-computes PO status rollup)
DELETE /api/erp/po-items/:id                       — Admin/FactoryManager only
```

### 5.4 Manufacturing

```
GET    /api/erp/projects/:id/manufacturing   — get manufacturing order for project
POST   /api/erp/projects/:id/manufacturing   — create manufacturing order (Admin/FactoryManager only)
PATCH  /api/erp/manufacturing/:id            — update status (pending→in_progress→ready) + notes
                                               status='ready' → advances project to stageInternal=8
```

### 5.5 Payments

```
GET    /api/erp/projects/:id/payments        — list payment milestones for project
POST   /api/erp/projects/:id/payments        — create milestone (Admin/Accountant)
PATCH  /api/erp/payments/:id                 — mark as paid + optional Qoyod doc upload (Admin/Accountant)
GET    /api/erp/payments/all                 — all milestones across all projects (Accountant/Admin)
GET    /api/erp/payments/overdue-count       — count of overdue milestones (for sidebar badge)
```

### 5.6 Settings

```
GET    /api/erp/settings/contract-template   — get contract template (Admin only)
PUT    /api/erp/settings/contract-template   — update contract template (Admin only)
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

> v3.0 — 15 internal stages (0–14). `autoAdvanceStage()` in `erp.ts` automatically advances `stageInternal` when files are uploaded. `getDisplayStage()` maps internal → display (see Section 2).

### Stages 0–1: Lead → Project (`display: new`)

**Lead fields (required):** customerName, phone, source, productInterest, buildingType, location, assignedTo, firstFollowupDate

**Lead status flow:**
```
new → followup → converted (→ project created, stageInternal = 1)
              ↘ lost
```

**Contact log rules:**
- Cannot be deleted — acts as audit trail
- Author can edit their own entries only
- `nextFollowupDate` required when lead is `new` or `followup`
- Dashboard shows overdue badge: follow-up date passed + no new log entry

**Convert to project:** copies customerName, phone, location, buildingType, productInterest, estimatedValue → new project. Sets `stageInternal = 1`, `stageDisplay = 'new'`. Creates default Phase 1 and 3 payment milestones (50% deposit, 40% before delivery, 10% after sign-off).

---

### Stages 2–4: Technical Study + Quotation (`display: in_study`)

**File-triggered advances (autoAdvanceStage):**
- Upload `section`, `assembly_list`, `cut_optimisation`, or `material_analysis` → `stageInternal` advances to `2` if currently ≤ 1
- Upload `vendor_order` or `glass_order` → advances to `3` if currently ≤ 2
- Upload `quotation` → advances to `4` if currently ≤ 3

**File upload rules:**
- Re-uploading a single-file type sets old row `isActive = false` and inserts new row (version history preserved)
- `glass_order` triggers **existing QR generation pipeline** automatically
- `quotation` triggers parser → extracts positions/prices/totals into `parsed_quotations`. Returns **409 Conflict** if project name in file doesn't match system name — frontend shows `NameMismatchModal` (Proceed / Proceed & update name / Cancel)
- `section` triggers parser → extracts all embedded drawings into `parsed_section_drawings`. Name mismatch is warning-only (non-blocking)
- `assembly_list` → `parsed_assembly_lists`, `cut_optimisation` → `parsed_cut_optimisations`

---

### Stage 5: Contract (`display: in_production`)

**Actions:** system renders branded contract as a printable HTML page. User prints or saves as PDF via browser.

**Contract fields:** customerName, projectName, deliveryDeadline, productInterest + parsed_quotations data

**Template:** stored in `system_settings` table — 6 keys (`contract_cover_intro_ar/en`, `contract_terms_ar/en`, `contract_signature_block_ar/en`). Supports `{{placeholder}}` syntax.

**Contract page:** `/erp/projects/:id/contract` — cover → positions table → drawings → terms + signature
**Print CSS:** `@page size: A4` + `page-break-after: always` — no PDF library
**Integrity check:** blocks print on errors (name mismatch, missing files, unresolved placeholders, totals mismatch)
**Stage advance:** `POST /contract/mark-printed` → `stageInternal = 5`, `stageDisplay = 'in_production'`
**Permissions:** Admin, FactoryManager, SalesAgent

---

### Stage 6: Deposit (`display: in_production`)

**Actions:** Accountant uploads Qoyod document → marks first payment milestone (`linkedEvent = 'deposit'`) as paid → project activates manufacturing

**Stage advance:** deposit milestone marked paid → `stageInternal = 6`

---

### Stage 7: Manufacturing (`display: in_production`)

**3-status flow:** Pending → In Progress → Ready

**Manufacturing order shows:** delivery deadline, free-text notes field
**Create:** Admin or FactoryManager only (`POST /api/erp/projects/:id/manufacturing`)
**Stage advance:** MO created → `stageInternal = 7`; status set to `ready` → `stageInternal = 8`

---

### Stage 8: Receiving (`display: in_production`)

**Actions:** Receive vendor purchase orders — track per-item quantities received.

**PO rules:**
- Partial receiving: `receivedQuantity` updated per item
- PO status auto-updates: all items received → `status = 'received'`
- Categories for items: Aluminum | Glass | Accessories | Special Parts

**Stage advance:** all POs received → `stageInternal = 8`

---

### Stages 9–11: Delivery + Installation + Sign-off (`display: complete`)

**Delivery phases (`project_phases` table):** project can have multiple phases (1, 2, 3...).

**Phase status flow:** `pending` → `delivered` → `installed` → `signed_off`

**Phase actions (v3.2):**
- `PATCH /phases/:id/deliver` → sets `deliveredAt = now()`, `status = 'delivered'`. First delivery → project `stageInternal = 9`.
- `PATCH /phases/:id/install` → sets `installedAt = now()`, `status = 'installed'`. First install → `stageInternal = 10`.
- `PATCH /phases/:id/signoff` → sets `signedOffAt = now()`, `status = 'signed_off'`. Updates linked payment milestones → `'due'`. If ALL phases signed off → starts warranty (see Stage 13) + `stageInternal = 11 → 13`.

**Customer QR confirmation:** each phase has a public link `/confirm/:phaseId`. Customer opens QR code, taps confirm → `POST /api/erp/phases/:id/confirm` sets `customerConfirmed = true`. Page then opens WhatsApp with pre-filled confirmation message.

---

### Stage 12: Payment (`display: complete`)

**Milestones** created automatically on project creation: Deposit 50%, Before Delivery 40%, After Sign-off 10%.

**Each milestone:** label, percentage, amount (SAR), paidAmount, dueDate, status (`pending`|`due`|`paid`|`overdue`), linkedEvent, linkedPhaseId

**Milestone becomes `due`:** either by `linkedEvent` matching a project lifecycle event, or by phase sign-off (via `linkedPhaseId`).

**Overdue logic:** `dueDate < today AND status IN ('pending','due')` → show warning on dashboard

**Accountant marks paid:** uploads Qoyod document → `status = 'paid'`, `paidAt = now()`.

**Stage advance:** all milestones paid → `stageInternal = 12`

---

### Stage 13: Warranty (`display: complete`)

**Warranty starts automatically (v3.2):** when ALL project phases are signed off, the sign-off endpoint sets:
- `warrantyStartDate = today`
- `warrantyEndDate = today + warrantyMonths` (default: 12 months from `projects.warrantyMonths`)
- `stageInternal = 13`

**Warranty expiry check:** runs on server startup and every 6 hours via `setInterval`. Any project with `warrantyEndDate < today AND stageInternal < 14` → automatically advances to stage 14.

**WarrantySection** in ProjectDetail shows: start date, end date, months remaining, active/expired badge.

---

### Stage 14: Done (`display: complete`)

**Project closes automatically:** warranty expiry check advances `stageInternal = 14` when `warrantyEndDate < today`. Project moves to archive view.

---

## 7. Orgadata File Types

v3.0 — 9-slot layout (6 Orgadata single-file + 3 multi-file buckets)

| File | `fileType` value | Multi-file? | Parsed? | How used |
|---|---|---|---|---|
| Glass / Panel Order | `glass_order` | No | ✅ Yes (QR pipeline) | Triggers QR code generation |
| Quotation | `quotation` | No | ✅ Parsed (v2.5.1) | Extracts positions, prices, totals → `parsed_quotations`. 409 on project name mismatch. |
| Section | `section` | No | ✅ Parsed (v2.5.1) | Extracts all embedded drawings in document order → `parsed_section_drawings`. |
| Assembly List | `assembly_list` | No | ✅ Parsed (v2.5.3) | Extracts positions (positionCode, qty, system, dimensions, glass items) → `parsed_assembly_lists`. Badge + panel in ProjectDetail. |
| Cut Optimisation | `cut_optimisation` | No | ✅ Parsed (v2.5.3) | Extracts profile summary (number, description, colour, qty, length, wastage) from Summary section → `parsed_cut_optimisations`. Badge + compact table in ProjectDetail. |
| Material Analysis | `material_analysis` | No | ❌ Stored only | Orgadata material analysis report — stored for reference |
| Vendor Order | `vendor_order` | **Yes** | ❌ Stored only | Multi-file bucket for vendor purchase orders / RFQs |
| Qoyod | `qoyod` | **Yes** | ❌ Stored only | Multi-file bucket for all payment proof documents (deposits, partial payments, final payments) |
| Other | `other` | **Yes** | ❌ Stored only | General attachments bucket |

**File versioning rules (v3.0):**
- **Single-file types** (`glass_order`, `quotation`, `section`, `assembly_list`, `cut_optimisation`, `material_analysis`): re-uploading sets `isActive = false` on the old row and inserts a new row with `isActive = true`. Old versions are preserved in DB but hidden from UI.
- **Multi-file types** (`vendor_order`, `qoyod`, `other`): all uploads are always `isActive = true`. Accumulate; never replaced. Each file is individually deletable.

**Auto-detection (`POST /api/erp/projects/:id/files/detect`):**
```
Filename contains → detectedType
glass_panel_order / glass panel order → glass_order
quotation → quotation
section → section
assembly_list / assembly list → assembly_list
cut_optimisation / cut optimisation → cut_optimisation
material_analysis / material analysis → material_analysis
order_-_ / order - (not glass panel) → vendor_order
anything else → null (confidence: low)
```

**Legacy:** `price_quotation` is accepted as an alias for `quotation` (backward compat). Types `technical_doc`, `qoyod_deposit`, `qoyod_payment`, `attachment` are no longer accepted for new uploads (returns 400). Existing DB rows are preserved but hidden from UI.

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

### ✅ Phase 1: Leads + Projects + File Upload — COMPLETE (v2.2, April 2026)

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

### ✅ Phase 2: Contracts + Payments — COMPLETE (v2.6.0, April 2026)

**Goal:** Generate branded contracts. Track payment milestones. Accountant role.

**Complete:**
- ✅ `system_settings` table — seeded with 6 contract template keys
- ✅ Contract page at `/erp/projects/:id/contract` — printable A4 HTML (no PDF library; browser print/Save as PDF)
- ✅ `GET/PUT /api/erp/settings/contract-template` — Admin-only template editor
- ✅ Admin Settings page at `/erp/settings` — 6 textarea fields (Arabic + English), placeholder reference
- ✅ Contract Integrity Check — green/amber/red, blocks print on errors, override flow with backend log
- ✅ `POST /contract/mark-printed` — advances stageInternal → 5
- ✅ `payment_milestones` table + CRUD endpoints
- ✅ Payment milestones section in ProjectDetail (Accountant marks paid, uploads Qoyod doc)
- ✅ `/erp/payments` page — all milestones across projects, overdue in red
- ✅ Sidebar badge for overdue payment count
- ✅ Accountant role fully activated for payment flows
- ✅ File versioning: `is_active` on `project_files` — re-upload preserves history

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

### ✅ Phase 3: Procurement + Manufacturing — COMPLETE (v3.1.0, April 2026)

**Goal:** Vendors, purchase orders, receiving items, manufacturing orders.

**Complete:**
- ✅ `vendors`, `purchase_orders`, `po_items`, `manufacturing_orders` tables
- ✅ Full CRUD for vendors and POs — see Section 5.3 + 5.4
- ✅ Vendors page at `/erp/vendors` — card list, search, category filter, PO history, create/edit/delete
- ✅ Procurement section in ProjectDetail — create PO, add/receive items, auto PO status rollup
- ✅ Manufacturing section in ProjectDetail — send to manufacturing (FM/Admin), start/complete controls
- ✅ `lib/file-detector.ts` — auto-detects Orgadata file types from filenames
- ✅ Sidebar: Vendors nav item (Admin, FM, Employee)

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

### ✅ Phase 4: Delivery + Installation + Warranty — COMPLETE (v3.2.0, April 2026)

**Goal:** Delivery phases, customer QR confirmation, warranty tracking, project close.

**Complete:**
- ✅ `customer_confirmed` / `customer_confirmed_at` columns on `project_phases` (v3.2 addition)
- ✅ `PATCH /phases/:id/deliver` + `/install` — phase status progression, auto-advance project stages
- ✅ Enhanced `PATCH /phases/:id/signoff` — triggers warranty when ALL phases signed off
- ✅ `GET /phases/:id` + `POST /phases/:id/confirm` — public endpoints for customer QR page
- ✅ Warranty expiry background check — runs on startup + every 6h; auto-advances to stage 14
- ✅ `PhaseConfirm.tsx` — public mobile page at `/confirm/:phaseId`, WhatsApp confirmation flow
- ✅ `PhasesSection` in ProjectDetail — full phase management UI
- ✅ `WarrantySection` in ProjectDetail — warranty dates, months remaining, active/expired badge
- ✅ `.docx` validation on Orgadata file uploads (audit fix: multi-file path now validates extension)

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

## 12. Future Enhancements

All 4 phases are complete as of v3.2.0. The following are candidate next steps — not yet scoped or started:

| Enhancement | Description | Reference |
|---|---|---|
| **Qoyod API integration** | Replace manual Word doc uploads with live API: pull payment status, push invoices/customers | `QOYOD_INTEGRATION_PLAN.md` — start with Phase A (read-only) |
| **Employee price visibility** | Currently hidden for Employee role — decision deferred | Add toggle in Admin Settings; default: hidden |
| **Mobile-first UI redesign** | Factory floor usage needs larger touch targets, simplified navigation | Assess after 3 months of real usage |
| **Contract PDF export** | True PDF generation (browser print works but formatting varies) | Requires Arabic-capable PDF library (Puppeteer or similar) |
| **Overdue warranty notifications** | Proactive alerts when warranty is about to expire (60/30/7 day warnings) | Add to warranty expiry background job |
| **OpenAPI spec completion** | Only 3 of 65+ routes documented in `openapi.yaml` | Complete before enabling codegen |

---

*Last updated: April 2026 — v3.2.0 (all 4 phases complete)*
*Wathbat Aluminum — wathbat.sa*
