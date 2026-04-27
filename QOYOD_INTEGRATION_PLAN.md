# QOYOD_INTEGRATION_PLAN.md (Updated v2.0)
# خطة ربط نظام قيود — Qoyod API Integration Plan

> **Version:** 2.0 — April 2026
> **Status:** Planning — not yet implemented
> **API Docs:** https://apidoc.qoyod.com/
> **API Base URL:** https://api.qoyod.com/2.0/
> **Approach:** PULL-ONLY — read invoices from Qoyod, employee manually links to projects
> **Current state:** Manual Qoyod document upload (Word files) in Wathbah system

---

## 1. Design Philosophy

**Wathbah does NOT push data to Qoyod.** The accountant continues creating invoices in Qoyod as they always have. Wathbah only reads (pulls) invoice data and lets employees link invoices to projects manually.

**Why pull-only:**
- Zero risk of creating bad data in the accounting system
- No workflow change for the accountant — they keep working in Qoyod normally
- Wathbah gets payment visibility without being the source of truth for accounting
- Simpler to build, test, and maintain

**The employee's job:** When a new invoice appears in the Qoyod sync list, link it to the correct project. That's it.

---

## 2. Qoyod API Overview

**Base URL:** `https://api.qoyod.com/2.0/`
**Auth:** `API-KEY` header on every request
**Response format:** JSON
**Search:** ransack-style (e.g. `?q[status_eq]=paid`)

### Endpoints We Use (read-only)

| Endpoint | Method | What we get |
|----------|--------|-------------|
| `/invoices` | GET | All invoices — number, customer, amount, status, dates |
| `/invoices/:id` | GET | Single invoice with line items |
| `/invoice_payments` | GET | Payment records — which invoices are paid, amounts, dates |
| `/customers` | GET | Customer list — for matching to Wathbah leads/projects |
| `/vendors` | GET | Vendor list — for matching to Wathbah vendors |

### Invoice Data Structure (from real Wathbah invoices)

```json
{
  "invoice": {
    "id": 277,
    "reference": "INV277",
    "customer_name": "مؤسسة عبدالرحمن فهد بن هويشل للمقاولات",
    "issue_date": "2026-04-13",
    "due_date": "2026-04-13",
    "status": "Paid",
    "total": "120000.00",
    "paid_amount": "120000.00",
    "due_amount": "0.00",
    "description": "مشروع فيلا 204",
    "payments": [
      {
        "reference": "PYT2849",
        "date": "2026-04-12",
        "amount": "120000.00"
      }
    ]
  }
}
```

---

## 3. Database Changes

### New table: `qoyod_invoice_links`

```sql
CREATE TABLE IF NOT EXISTS qoyod_invoice_links (
  id SERIAL PRIMARY KEY,
  qoyod_invoice_id INTEGER NOT NULL,
  qoyod_reference TEXT NOT NULL,
  qoyod_customer_name TEXT,
  qoyod_total NUMERIC(12,2),
  qoyod_status TEXT,
  qoyod_paid_amount NUMERIC(12,2),
  qoyod_issue_date DATE,
  qoyod_due_date DATE,
  qoyod_description TEXT,
  qoyod_payment_reference TEXT,
  qoyod_payment_date DATE,
  project_id INTEGER REFERENCES projects(id),
  milestone_id INTEGER REFERENCES payment_milestones(id),
  linked_by INTEGER REFERENCES users(id),
  linked_at TIMESTAMP,
  last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

---

## 4. Backend Architecture

### New file: `artifacts/api-server/src/lib/qoyod-client.ts`

- `getInvoices(page?)` — pull all invoices paginated
- `getInvoice(id)` — single invoice with line items
- `getInvoicePayments(invoiceId?)` — payment records
- `testConnection()` — verify API key works

### API Endpoints

```
GET    /api/erp/qoyod/status              — connection test (Admin only)
POST   /api/erp/qoyod/sync                — trigger manual sync (Admin/Accountant)
GET    /api/erp/qoyod/invoices            — list all synced invoices with link status
GET    /api/erp/qoyod/invoices/unlinked   — unlinked invoices only
GET    /api/erp/qoyod/invoices/:id        — single invoice detail
POST   /api/erp/qoyod/invoices/:id/link   — link to project + milestone
DELETE /api/erp/qoyod/invoices/:id/link   — unlink
GET    /api/erp/qoyod/unlinked-count      — badge count for sidebar
```

### Background Sync

On startup + every 6 hours:
1. If QOYOD_API_KEY not set → skip
2. Pull all invoices from Qoyod
3. For each: update existing row or insert new (unlinked)
4. Log: "Synced 45 invoices, 3 new unlinked"

---

## 5. Frontend UX Design

### 5.1 Sidebar

- New item: "قيود / Qoyod" — between Payments and Settings
- Icon: Lucide `Receipt`
- Badge: red circle with unlinked count
- Visible to: Admin, Accountant
- Route: /erp/qoyod

### 5.2 Qoyod Dashboard Page (/erp/qoyod)

**Connection status bar (top):**
- Green: "متصل بنظام قيود ✅ — آخر مزامنة: قبل 3 ساعات" + [مزامنة الآن] button
- Amber: "غير متصل — أضف مفتاح API في الإعدادات" if no key configured

**Unlinked invoices section (priority — amber border):**
Each card shows:
- Invoice reference (INV277)
- Customer name from Qoyod
- Total amount (SAR)
- Status: مدفوعة (green) / غير مدفوعة (red) / مدفوعة جزئياً (amber)
- Issue date
- Description (if exists — helps employee match to project)
- "ربط بمشروع" / "Link to Project" button → dropdown:
  - Search projects by name
  - Select project → optionally select payment milestone
  - Save

**Linked invoices section (below):**
Table with: Invoice # | Project Name | Amount | Status | Linked by | Date
Click row → expand to show line items from Qoyod

### 5.3 Project Detail — Payments Enhancement

Each payment milestone shows:
- If linked to Qoyod invoice: "INV277 ✅ مدفوعة — 120,000 SAR"
- If not linked: small "ربط بفاتورة قيود" link
- Payment status auto-updates on every sync

### 5.4 Main Dashboard — Notification Card

Admin/Accountant see a card:
```
📋 قيود
3 فواتير غير مربوطة
[عرض ←]
```
Clickable → /erp/qoyod

### 5.5 Toast Notifications

After auto-sync finds new invoices:
- Bottom-right toast (5 seconds): "تم العثور على 2 فواتير جديدة في قيود"
- Sidebar badge updates immediately

---

## 6. Environment Variables

```
QOYOD_API_KEY=your_api_key_here
QOYOD_BASE_URL=https://api.qoyod.com/2.0
QOYOD_SYNC_INTERVAL_HOURS=6
```

---

## 7. Implementation Phases

### Phase A: Connection + Pull + Display (2-3 days)
- QoyodClient class
- qoyod_invoice_links table
- Background sync job
- Qoyod dashboard page with unlinked/linked sections
- Sidebar nav + badge
- Sync Now button + connection status

### Phase B: Linking + Project Integration (1-2 days)
- Link/unlink endpoints
- Project search dropdown in link dialog
- Milestone linking
- Project Detail Qoyod indicator
- Dashboard notification card

### Phase C: Smart Matching (future)
- Auto-suggest projects from customer name fuzzy match
- Auto-suggest from invoice description containing project name
- Amount matching to milestones
- Bulk link multiple invoices

---

## 8. Security

| Concern | Mitigation |
|---------|-----------|
| API key | Env var only — never frontend or Git |
| Read-only | Only GET endpoints — cannot modify Qoyod |
| Rate limiting | Max 60 requests per sync, 1s between |
| Failure | Log + retry next cycle — never crash |
| Trust | "from Qoyod" label — employee verifies |

---

## 9. Prerequisites

- [ ] Owner generates Qoyod API key
- [ ] Owner confirms plan supports API
- [ ] Ahmad adds QOYOD_API_KEY to Render
- [ ] Test GET /invoices returns 200
- [ ] At least 1 invoice in Qoyod for testing
