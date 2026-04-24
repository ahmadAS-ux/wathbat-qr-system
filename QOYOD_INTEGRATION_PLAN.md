# QOYOD_INTEGRATION_PLAN.md
# خطة ربط نظام قيود — Qoyod API Integration Plan

> **Version:** 1.0 — April 2026
> **Status:** Planning — not yet implemented
> **API Docs:** https://apidoc.qoyod.com/
> **Current state:** Manual Qoyod document upload (Word files) in Wathbah system

---

## 1. Qoyod API Overview

Qoyod is a Saudi accounting SaaS with a REST API covering **19 resource types**:

| # | Resource | Relevant to Wathbah? |
|---|----------|---------------------|
| 1 | Accounts | ❌ Internal accounting |
| 2 | Products | ⚠️ Maybe — could sync aluminum/glass products |
| 3 | Inventories | ⚠️ Maybe — track raw materials |
| 4 | Product Categories | ❌ |
| 5 | Product Units | ❌ |
| 6 | **Vendors** | ✅ **Yes** — sync vendor data between systems |
| 7 | **Purchase Orders** | ✅ **Yes** — push POs from Wathbah to Qoyod |
| 8 | **Bills** | ✅ **Yes** — vendor invoices |
| 9 | **Bill Payments** | ✅ **Yes** — track payments to vendors |
| 10 | Simple Bills | ❌ |
| 11 | Simple Bill Payments | ❌ |
| 12 | Debit Notes | ❌ |
| 13 | **Customers** | ✅ **Yes** — sync customer data from leads/projects |
| 14 | **Quotes** | ✅ **Yes** — push quotations from Wathbah |
| 15 | **Invoices** | ✅ **Yes** — create invoices from payment milestones |
| 16 | **Invoice Payments** | ✅ **Yes** — pull payment status to verify deposits |
| 17 | Credit Notes | ❌ |
| 18 | **Receipts** | ✅ **Yes** — pull payment receipts as proof |
| 19 | Journal Entries | ❌ Internal accounting |

### Authentication
- Header: `API-KEY: your_api_key`
- Base URL: `https://api.qoyod.com/2.0/`
- Generate from: Qoyod Dashboard → General Settings
- All requests return JSON

### Search & Sort
- All list endpoints support ransack-style searching
- Default sort: by ID ascending
- Example: `GET /invoices?q[status_eq]=paid&s=created_at+desc`

---

## 2. Integration Points for Wathbah

### 2.1 Customer Sync (Leads → Qoyod Customers)

**What:** When a lead is converted to a project in Wathbah, auto-create the customer in Qoyod.

**Qoyod endpoint:** `POST /customers`
**Data mapping:**
| Wathbah Field | Qoyod Field |
|--------------|-------------|
| customerName | name |
| phone | phone |
| location | address |
| — | contact_email (if available) |

**Direction:** Wathbah → Qoyod (push)
**When:** On lead conversion to project
**Fallback:** If Qoyod is down, create project anyway, queue sync for later

---

### 2.2 Invoice Creation (Payment Milestones → Qoyod Invoices)

**What:** When a payment milestone is created in Wathbah (contract stage), auto-create an invoice in Qoyod.

**Qoyod endpoint:** `POST /invoices`
**Data mapping:**
| Wathbah Field | Qoyod Field |
|--------------|-------------|
| milestone.label | description |
| milestone.amount | total |
| milestone.dueDate | due_date |
| project.customerName | customer_id (lookup first) |
| project.name | reference / notes |

**Direction:** Wathbah → Qoyod (push)
**When:** When contract is finalized and milestones are created
**Store:** Save `qoyod_invoice_id` on the payment_milestones record for future lookup

---

### 2.3 Payment Verification (Qoyod Invoice Payments → Wathbah)

**What:** Instead of manually uploading Qoyod Word documents, pull payment status from Qoyod API.

**Qoyod endpoint:** `GET /invoice_payments?q[invoice_id_eq]=:id`
**Flow:**
1. Wathbah has `qoyod_invoice_id` stored on each payment milestone
2. Periodically (or on button click), call Qoyod API to check payment status
3. If payment found → auto-mark milestone as "paid" with amount and date
4. Show notification to Admin/Accountant

**Direction:** Qoyod → Wathbah (pull)
**When:** Background check every 6 hours + manual "Check Qoyod" button per milestone
**This replaces:** Manual Qoyod Word document upload for payment confirmation

---

### 2.4 Vendor Sync (Wathbah Vendors → Qoyod Vendors)

**What:** Keep vendor list in sync between both systems.

**Qoyod endpoint:** `GET /vendors`, `POST /vendors`
**Flow:**
1. When creating a vendor in Wathbah, also create in Qoyod
2. Store `qoyod_vendor_id` on the vendors record
3. When creating a PO in Wathbah, optionally create a Purchase Order in Qoyod too

**Direction:** Wathbah → Qoyod (push), with optional pull for existing vendors
**When:** On vendor creation + PO creation

---

### 2.5 Receipt Download (Qoyod Receipts → Wathbah)

**What:** Instead of uploading payment proof manually, pull the receipt PDF from Qoyod.

**Qoyod endpoint:** `GET /receipts?q[invoice_id_eq]=:id`
**Flow:**
1. After payment is verified (2.3), fetch the receipt
2. Store receipt as a file in the Qoyod multi-file slot on the project
3. Link to the payment milestone

**Direction:** Qoyod → Wathbah (pull)
**When:** After payment verification confirms a payment exists

---

## 3. Implementation Architecture

### New Environment Variables
```
QOYOD_API_KEY=your_api_key_here
QOYOD_BASE_URL=https://api.qoyod.com/2.0
```

### New Backend File
```
artifacts/api-server/src/lib/qoyod-client.ts
```

Contains:
- `QoyodClient` class with methods for each integration point
- Axios/fetch wrapper with API-KEY header
- Error handling and retry logic
- Rate limiting (respect Qoyod's limits)

### Modified Files
```
erp.ts — new endpoints:
  POST /api/erp/qoyod/sync-customer/:projectId   — push customer to Qoyod
  POST /api/erp/qoyod/create-invoice/:milestoneId — create invoice in Qoyod
  POST /api/erp/qoyod/check-payment/:milestoneId  — pull payment status
  GET  /api/erp/qoyod/status                       — connection status check
```

### Database Changes
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS qoyod_customer_id INTEGER;
ALTER TABLE payment_milestones ADD COLUMN IF NOT EXISTS qoyod_invoice_id INTEGER;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS qoyod_vendor_id INTEGER;
```

### Frontend Changes
- Settings page: "Qoyod API Key" input field (Admin only)
- Payment milestone card: "Check Qoyod" button (instead of manual upload)
- Status indicator: "Connected to Qoyod ✅" or "Not connected ⚠️"

---

## 4. Implementation Priority

### Phase A: Read-Only (lowest risk) — do this first
- Pull payment status from Qoyod (verify if customer paid)
- Pull receipts as payment proof
- "Check Qoyod" button on each payment milestone
- **Benefit:** Eliminates manual Word document upload for payment verification
- **Risk:** Low — read-only, doesn't modify Qoyod data
- **Effort:** 1-2 days

### Phase B: Write — Customer + Invoice (medium risk)
- Push customer data to Qoyod on project creation
- Create invoices in Qoyod from payment milestones
- **Benefit:** Single source of truth for invoicing — no double-entry
- **Risk:** Medium — creates records in Qoyod
- **Effort:** 2-3 days

### Phase C: Full Sync (highest complexity)
- Two-way vendor sync
- Push Purchase Orders to Qoyod
- Auto-reconcile payments (background job)
- **Benefit:** Full accounting automation
- **Risk:** High — data consistency between two systems
- **Effort:** 5-7 days

### Recommended: Start with Phase A, then B after testing

---

## 5. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| API key exposure | Store in `QOYOD_API_KEY` env var on Render — never in frontend code or Git |
| Rate limiting | Implement client-side rate limiter (max 60 requests/minute) |
| Data trust | Validate all Qoyod responses before updating Wathbah records |
| Downtime handling | Qoyod being down must not block Wathbah operations — queue and retry |
| Audit trail | Log every Qoyod API call (endpoint, status, timestamp) for debugging |
| Data mismatch | If Qoyod amount differs from Wathbah amount, flag for manual review — don't auto-correct |

---

## 6. Testing Plan

Before going live:
1. Create a test customer in Qoyod → verify sync
2. Create a test invoice → verify it appears in Qoyod
3. Record a payment in Qoyod → verify Wathbah pulls it
4. Test with Qoyod API key revoked → verify graceful error handling
5. Test with network offline → verify queue and retry works

---

## 7. Prerequisites Before Starting

- [ ] Ahmad generates a Qoyod API key from General Settings
- [ ] Ahmad confirms which Qoyod account/tenant to connect
- [ ] Ahmad creates a test invoice in Qoyod so we can verify the API response format
- [ ] Decide: should Qoyod integration be mandatory or optional per project?

---

*This plan is documentation only — no code has been implemented.*
*Add to Claude Code prompt when ready to build: "Read QOYOD_INTEGRATION_PLAN.md before starting."*
