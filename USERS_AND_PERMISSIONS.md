# USERS_AND_PERMISSIONS.md
# هيكل المستخدمين والصلاحيات — Wathbah v4.4.0

> **Purpose:** Single source of truth for user roles, what each role can see, what each role can do, and how to hide information cleanly in the UI.
> **Read before:** building any new page, adding any new button, exposing any new data field.
> **Audience:** Claude Code, Ahmad, future developers.
> **Last updated:** April 2026 — extended for v4.4.0 (7-role dashboard + capabilities granularity)

---

## Table of Contents

0. [Current Implementation Status](#0-current-implementation-status)
1. [The 7 Roles](#1-the-7-roles)
1.5. [Quick Reference Cheat Sheet](#15-quick-reference-cheat-sheet)
2. [Permissions Matrix — Full Detail](#2-permissions-matrix--full-detail)
3. [What Each Role Sees on Each Page](#3-what-each-role-sees-on-each-page)
4. [Sidebar Navigation by Role](#4-sidebar-navigation-by-role)
5. [Field-Level Visibility Rules](#5-field-level-visibility-rules)
6. [UI/UX Best Practices for Hiding Information](#6-uiux-best-practices-for-hiding-information)
7. [Backend Enforcement Rules](#7-backend-enforcement-rules)
8. [Implementation Patterns](#8-implementation-patterns)
9. [Testing Checklist](#9-testing-checklist)
10. [Known Permission Gaps](#10-known-permission-gaps)
11. [Capabilities Granularity (v4.4.0)](#11-capabilities-granularity-v440)
12. [Permissions Dashboard (v4.4.0)](#12-permissions-dashboard-v440)

---

## 0. Current Implementation Status

> **Read this first.** The sections below describe the intended permissions design. This section tracks what is actually built vs. what is not yet implemented.

| Feature | Designed | Built | Notes |
|---|---|---|---|
| Backend role enforcement | ✅ | ✅ | `requireAuth` + `requireRole` on all protected routes |
| Sidebar filtering by role | ✅ | ✅ | All 5 roles correctly scoped — `canViewLeads`, `canCreateProject`, `canViewQRSystem` helpers used |
| Tab filtering by role | ✅ | ✅ | All tabs gated: Payments hidden from Employee; all non-Contract tabs hidden from SalesAgent/Accountant |
| Field-level price hiding | ✅ | ✅ | `estimatedValue` guarded with `canViewPrices(user?.role)` in `ProjectDetail.tsx` |
| `lib/permissions.ts` helper | ✅ | ✅ | **CREATED** — 13 named helpers; single source of truth for all role checks (`artifacts/qr-manager/src/lib/permissions.ts`) |
| `RequireRole` route component | ✅ | ✅ | **CREATED** — redirects unauthorised roles to `/admin` (`artifacts/qr-manager/src/components/RequireRole.tsx`) |
| Accountant → project detail path | ✅ | ✅ | `GET /erp/projects/:id` now allows Accountant; `Payments.tsx` deep-links to `?tab=payments` |
| File deletion = Admin only (Rule 10) | ✅ | ✅ | **v4.0.11 (Stage 6.6)** — `<FileSlot>`'s "..." menu uses Admin-only check, not `canDeleteProject` |
| **7-role schema** | ✅ | ❌ | **v4.4.0 target** — adds Collaborator + Customer to existing 5 |
| **Capabilities granularity** | ✅ | ❌ | **v4.4.0 target** — `lib/capabilities.ts` constant + `role_capabilities` DB table |
| **Permissions dashboard (3 pages)** | ✅ | ❌ | **v4.4.0 target** — Admin-editable role matrix + user management |
| **Per-user permission overrides** | ✅ | ❌ | **v4.4.1 target** — `user_capability_overrides` table |

---

## 1. The 7 Roles

| Role | DB Value | UI Label (EN) | UI Label (AR) | Scope |
|---|---|---|---|---|
| Admin | `'Admin'` | Admin | المدير العام | Full system control — settings, users, all data, delete |
| Manager *(was Factory Manager)* | `'FactoryManager'` | **Manager** | **المدير** | Operations — projects, manufacturing, vendors. **Cannot delete anything (v4.4.0 change).** |
| Employee | `'Employee'` | Employee | الموظف | Day-to-day — leads, **active projects only** (`stage_internal < 14`), files, receiving |
| Sales Agent | `'SalesAgent'` | Sales Agent | مندوب المبيعات | Sales — all leads (filtered to own when relevant), contract view, stages 11–14 for own-origin projects |
| Accountant | `'Accountant'` | Accountant | المحاسب | Money only — payments, Qoyod, invoices, project detail via Payments deep-link |
| **Collaborator** *(new in v4.4.0)* | `'Collaborator'` | Collaborator | مندوب خارجي | External partner — **own leads only**, stages 11–14 for own-origin projects |
| **Customer** *(new in v4.4.0, grayed out)* | `'Customer'` | Customer | عميل | Future contract-signing only. No functional code paths yet. |

**v4.4.0 Note on labels:** The DB role string `'FactoryManager'` is unchanged. Only the user-facing label changes from "Factory Manager / مدير المصنع" to "Manager / المدير". Code, helpers, and `lib/permissions.ts` are not affected by this rename.

**Default user on first startup:** `admin` / `admin123` — Admin role. Change password immediately.

---

## 1.5. Quick Reference Cheat Sheet

> At-a-glance access map. For full detail see Section 2. "Own only" means the role is scoped to records assigned to them.
> **Customer** column is included for completeness — all values are ❌ until contract-signing feature ships.

| Feature | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| Leads | ✅ | ✅ | ✅ | All / own when filtered | **Own only** | ❌ | ❌ |
| Projects (active) | ✅ | ✅ | ✅ (active only) | ❌ | ❌ | ❌ | ❌ |
| Projects (warranty-complete) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Contract view | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | Own contract only |
| Prices in projects | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Prices in contracts | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Payments | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Vendors | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manufacturing | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Stages 11–14 (delivery/install/signoff/warranty) | ✅ | ✅ | ✅ | Own-origin only | Own-origin only | ❌ | ❌ |
| QR Upload | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Users management | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Permissions dashboard | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Qoyod sync | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Delete projects** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Delete leads** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Delete files** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Dashboard KPIs (financial) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Sign contract | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (future) |

**v4.4.0 behavior change:** Manager (FactoryManager) loses delete privileges across the board. Pre-v4.4.0 they could delete projects, leads, and files; post-v4.4.0 they cannot. This is captured explicitly in Section 10's transition log.

---

## 2. Permissions Matrix — Full Detail

### Leads & Customers (العملاء)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| View all leads | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| View own leads only | — | — | — | ✅ (filtered) | ✅ (filtered) | ❌ | ❌ |
| Create new lead | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit any lead | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit own leads | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Add contact log entry | ✅ | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ |
| Mark lead as lost | ✅ | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ |
| Convert lead → project | ✅ | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ | ❌ |
| **Delete lead** | ✅ | **❌** | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Additional lead-level restrictions:** `GET /erp/leads/search` excludes SalesAgent and Collaborator (Admin, Manager, Employee only). `GET /erp/leads/:id/linked-projects` is Admin and Manager only.

### Projects (المشاريع)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| View projects list (active) | ✅ | ✅ | ✅ | ❌* | ❌* | ❌ | ❌ |
| View projects list (incl. warranty-complete) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View project detail | ✅ | ✅ | ✅ (active only) | ❌* | ❌* | ✅ (via Payments deep-link) | ❌ |
| Create project directly | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit project info | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Delete project** | ✅ | **❌** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Upload Orgadata files | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Delete files (Rule 10)** | ✅ | **❌** | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit project notes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage stages 0–10 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage stages 11–14 (delivery / installation / signoff / warranty) | ✅ | ✅ | ✅ | ✅ (own-origin) | ✅ (own-origin) | ❌ | ❌ |

> \* Sales Agent and Collaborator have no general project access, but DO have access to view contracts (see Contracts row below) AND to manage stages 11–14 for projects originating from their own leads (`projects.from_lead_id` resolves to a lead they own).
>
> **v4.4.0 row-level enforcement:** "own-origin" means the route handler filters projects by `from_lead_id IN (SELECT id FROM leads WHERE assigned_to = current_user_id)`. SalesAgent sees all leads list-side but only own-origin projects in the stages 11–14 management. Collaborator is filtered to own at every layer.
>
> **"active project" definition for Employee scope:** `stage_internal < 14`. Stages 0–13 are active; stage 14+ (warranty-complete) is hidden from Employee.

### Contracts (العقود)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| View contract page | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ (own only, future) |
| Print contract | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Edit contract template | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View integrity check | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Sign contract** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (future) |

### Pricing & Quotations (الأسعار والعروض)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| **View prices in projects** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **View prices in contracts** | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Edit estimated value | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View quotation totals | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |

> **CRITICAL:** Employees, Collaborators, and Customers should NEVER see prices in the project detail page. This is a deliberate business rule — prevents internal price leaks and protects sensitive customer information.

### Vendors & Purchase Orders (الموردين والمشتريات)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| View vendor list | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create vendor | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Create purchase order | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mark items received | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Delete vendor/PO** | ✅ | **❌** | ❌ | ❌ | ❌ | ❌ | ❌ |

### Manufacturing (التصنيع)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| View manufacturing orders | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Send to manufacturing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Update workshop progress | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mark phase delivered | ✅ | ✅ | ✅ | ✅ (own-origin) | ✅ (own-origin) | ❌ | ❌ |
| Mark phase installed | ✅ | ✅ | ✅ | ✅ (own-origin) | ✅ (own-origin) | ❌ | ❌ |
| Sign-off phase | ✅ | ✅ | ❌ | ✅ (own-origin) | ❌ | ❌ | ❌ |

### Payments & Money (المدفوعات والمالية)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| View payments page | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View payment milestones in project | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Create payment milestone | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Mark milestone as paid | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Upload Qoyod document | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| View Qoyod sync page | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Link Qoyod invoice to project | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### QR System (نظام المستندات)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| Upload .docx for QR processing | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View document archive | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View service requests (from QR scans) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

> **v4.0.0 design decision (preserved):** QR Upload and Document Archive are Admin-only via `canViewQRSystem(user?.role)`. Service Requests is broader (Admin + Manager + Employee) because it's the customer-facing scan results, not the upload tooling.

### System Administration (الإعدادات)

| Action | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| Manage users (create/edit/disable) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Edit role permissions (v4.4.0 dashboard)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Override per-user permissions (v4.4.1)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit dropdown lists | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit contract template | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View system settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 3. What Each Role Sees on Each Page

### Dashboard (/admin)

| Element | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| KPI: Active Projects | ✅ | ✅ | ✅ | ✅ | ✅ (own-origin) | ✅ | ❌ |
| KPI: Revenue MTD | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| KPI: Outstanding | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| KPI: QR Documents | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Stage Funnel | ✅ | ✅ | ✅ | ✅ | ✅ (own-origin) | ❌ | ❌ |
| Cashflow Snapshot | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Activity Feed | ✅ | ✅ | ✅ | ✅ (own only) | ✅ (own only) | ✅ | ❌ |
| Maintenance Requests | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Attention List (overdue) | ✅ | ✅ | ✅ | ✅ (own leads) | ✅ (own leads) | ✅ (own payments) | ❌ |

### Project Detail Page Tabs

| Tab | Admin | Manager | Employee | Sales Agent | Collaborator | Accountant | Customer |
|---|---|---|---|---|---|---|---|
| Overview | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Files | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Payments | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Procurement | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Production | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Contract | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ (own, future) |
| Timeline | ✅ | ✅ | ✅ | ✅ (own-origin, stages 11–14 only) | ✅ (own-origin, stages 11–14 only) | ❌ | ❌ |

> Tabs the user cannot access must be **hidden entirely** from the tab bar — never shown as disabled with empty content.

---

## 4. Sidebar Navigation by Role

### Admin sees:
```
الإدارة
├─ Dashboard (لوحة التحكم)
└─ Service Requests (طلبات الصيانة)

نظام التصنيع
├─ Customer Records (سجل العملاء)
├─ Clients (العملاء)
├─ Projects (المشاريع)
├─ Payments (المدفوعات)
├─ Vendors (الموردون)
└─ Qoyod (قيود) — when integration is live

نظام المستندات
└─ Document Archive (أرشيف المستندات)

الإعدادات
├─ Users (المستخدمون)
├─ Permissions (الصلاحيات) — v4.4.0
├─ Dropdown Lists (القوائم المنسدلة)
└─ Language (English / العربية)
```

### Manager sees:
```
الإدارة
├─ Dashboard
└─ Service Requests

نظام التصنيع
├─ Customer Records
├─ Clients
├─ Projects
└─ Vendors
   (no Payments, no Settings, no Qoyod, no Permissions)

نظام المستندات
└─ (no access — Document Archive is Admin-only via canViewQRSystem)
```

### Employee sees:
```
الإدارة
├─ Dashboard
└─ Service Requests

نظام التصنيع
├─ Clients
├─ Projects (active only — stage_internal < 14)
└─ Vendors
```

### Sales Agent sees:
```
الإدارة
└─ Dashboard

نظام التصنيع
├─ Clients (all leads)
└─ Stage 11–14 view for own-origin projects only
```

### Collaborator sees:
```
الإدارة
└─ Dashboard (limited — own leads only)

نظام التصنيع
├─ Clients (own leads only — filtered list)
└─ Stage 11–14 view for own-origin projects only
```

### Accountant sees:
```
الإدارة
└─ Dashboard (financial KPIs only)

نظام التصنيع
├─ Payments
└─ Qoyod (when integration is live)
   (no Clients, no Projects list, no Vendors — but DOES have Payments → project deep-link)
```

### Customer sees (future, v4.4.0+):
```
(No sidebar — Customer logs in via magic-link OTP and is taken
directly to their contract page. No general system navigation.)
```

---

## 5. Field-Level Visibility Rules

These are the specific data fields that must be hidden from certain roles even when the page is otherwise accessible:

### Project Information

| Field | Hidden From |
|---|---|
| `estimatedValue` (القيمة التقديرية) | Employee, SalesAgent, Collaborator, Customer |
| `quotation.subtotalNet` | Employee, Collaborator, Customer |
| `quotation.grandTotal` | Employee, Collaborator, Customer |
| `quotation.positions[].unitPrice` | Employee, Collaborator, Customer |
| `quotation.positions[].lineTotal` | Employee, Collaborator, Customer |
| `paidAmount` on milestones | Employee, Manager, Collaborator, Customer |
| `vendor.unitCost` on PO items | Employee, Collaborator, Customer |

### Customer Information

| Field | Hidden From |
|---|---|
| `customerPhone` | Hidden in print exports for all roles (privacy) |
| `customerName` (full) | SalesAgent and Collaborator see only own customers |

### User Information

| Field | Hidden From |
|---|---|
| `password_hash` | ALL roles (never returned by API) |
| `users[].email` | Non-Admin |
| `users[].role` | Non-Admin (visible only on user's own profile) |

### Audit / System

| Field | Hidden From |
|---|---|
| `auditLog` entries | Non-Admin |
| `sessionTokens` | All roles (server-side only) |
| `JWT_SECRET`, `DATABASE_URL` | Never appears in any API response |

---

## 6. UI/UX Best Practices for Hiding Information

> **The golden rule:** A user should never see something they cannot use. Disabled buttons, empty tabs, and "no permission" placeholders are all ANTI-PATTERNS in this system.

### 6.1 The Three Hiding Strategies

**Strategy 1 — Hide completely (preferred for navigation, tabs, sections)**

Used for: sidebar items, project tabs, action buttons, entire page sections.

```tsx
// ✅ CORRECT — element is not rendered at all
{user.role === 'Admin' && (
  <button onClick={deleteProject}>Delete Project</button>
)}

// ✅ CORRECT — sidebar nav filtered before render
const navItems = ALL_NAV_ITEMS.filter(item =>
  item.allowedRoles.includes(user.role)
);
```

```tsx
// ❌ WRONG — element exists but disabled
<button disabled={user.role !== 'Admin'} onClick={deleteProject}>
  Delete Project
</button>

// ❌ WRONG — element exists but shows "no access"
<div>{user.role === 'Admin' ? <DeleteUI /> : <p>No access</p>}</div>
```

**Why:** Disabled buttons and "no access" messages tell users that a feature exists but they're locked out. This creates frustration and reveals the system's structure to people who don't need to know.

**Strategy 2 — Replace with role-appropriate alternative (preferred for fields)**

Used for: data fields like prices, where the field exists for some users but not others.

```tsx
// ✅ CORRECT — field replaced with neutral indicator
{canViewPrices(user) ? (
  <span>{project.estimatedValue.toLocaleString()} SAR</span>
) : (
  <span className="text-slate-400">—</span>
)}

// ✅ CORRECT — entire row hidden for roles that shouldn't see the data
{canViewPrices(user) && (
  <tr>
    <td>Estimated Value</td>
    <td>{project.estimatedValue}</td>
  </tr>
)}
```

**Strategy 3 — Filter at data fetch (preferred for lists)**

Used for: tables of leads, projects, payments — where the user should see only a subset.

Server-side filter applied based on role. The client never sees data they shouldn't.

```typescript
// In erp.ts route handler
const userRole = req.user.role;
const userId = req.user.id;

let leads = await db.select().from(leadsTable);

if (userRole === 'SalesAgent' || userRole === 'Collaborator') {
  leads = leads.filter(l => l.assignedTo === userId);
}
// Admin / Manager / Employee see all
```

---

## 7. Backend Enforcement Rules

### Three layers must all agree

For every protected feature:

1. **Sidebar nav** — does this role see the link?
2. **Frontend route guard** — if they navigate directly via URL, does the page render?
3. **Backend route guard** — if they POST/GET via API, does the endpoint respond?

If any one of these is missing, the security is broken.

### Backend filtering for "own only" scope

For Sales Agent and Collaborator:

```typescript
// In every list/detail endpoint that exposes leads or own-origin projects:
const filterToOwn = (rows, userId) => rows.filter(r => r.assignedTo === userId);

if (req.user.role === 'Collaborator') {
  return filterToOwn(rows, req.user.id);
}
if (req.user.role === 'SalesAgent') {
  // SalesAgent sees all leads but only own-origin projects
  return endpoint === 'leads' ? rows : filterToOwn(rows, req.user.id);
}
```

### Sensitive field stripping

Apply at the API layer before sending to client:

```typescript
function stripSensitive(project, role) {
  const safe = { ...project };

  if (!canViewPrices(role)) {
    delete safe.estimatedValue;
    delete safe.quotation?.subtotalNet;
    delete safe.quotation?.grandTotal;
    safe.quotation?.positions?.forEach(p => {
      delete p.unitPrice;
      delete p.lineTotal;
    });
  }

  return safe;
}
```

---

## 8. Implementation Patterns

### Pattern 1 — useAuth() returns the role

```tsx
// hooks/use-auth.tsx
export function useAuth() {
  return {
    user: { id, username, role },  // role is one of the 7 DB values
    login,
    logout,
  };
}
```

### Pattern 2 — Permission helper file

```tsx
// lib/permissions.ts (existing — extends to support 7 roles)
import type { Role } from './types';

// 7-role union type
export type Role =
  | 'Admin'
  | 'FactoryManager'   // UI label: 'Manager'
  | 'Employee'
  | 'SalesAgent'
  | 'Accountant'
  | 'Collaborator'      // new in v4.4.0
  | 'Customer';         // new in v4.4.0, future

export const canViewPrices = (role: Role) =>
  ['Admin', 'FactoryManager', 'Accountant'].includes(role);

export const canDeleteProject = (role: Role) =>
  role === 'Admin';   // v4.4.0: was Admin + FactoryManager, now Admin only

export const canDeleteFile = (role: Role) =>
  role === 'Admin';   // v4.0.11 / Stage 6.6 — Rule 10

export const canEditContract = (role: Role) =>
  role === 'Admin';

export const canViewProjectDetail = (role: Role) =>
  ['Admin', 'FactoryManager', 'Employee', 'Accountant'].includes(role);

export const canViewPayments = (role: Role) =>
  ['Admin', 'Accountant'].includes(role);

export const canEditPermissions = (role: Role) =>
  role === 'Admin';   // new in v4.4.0

// ... etc
```

### Pattern 3 — Sidebar filtering

```tsx
// components/layout/AdminLayout.tsx
const NAV_ITEMS = [
  { key: 'dashboard', path: '/admin', roles: ['Admin', 'FactoryManager', 'Employee', 'SalesAgent', 'Collaborator', 'Accountant'] },
  { key: 'leads',     path: '/erp/leads',    roles: ['Admin', 'FactoryManager', 'Employee', 'SalesAgent', 'Collaborator'] },
  { key: 'projects',  path: '/erp/projects', roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'payments',  path: '/erp/payments', roles: ['Admin', 'Accountant'] },
  { key: 'vendors',   path: '/erp/vendors',  roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'permissions', path: '/admin/permissions', roles: ['Admin'] },  // new in v4.4.0
  { key: 'settings',  path: '/erp/settings', roles: ['Admin'] },
];

const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user.role));
```

### Pattern 4 — Tab filtering

```tsx
// In ProjectDetail.tsx
const TABS = [
  { key: 'overview',   roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'files',      roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'payments',   roles: ['Admin', 'FactoryManager', 'Accountant'] },
  { key: 'procurement',roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'production', roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'contract',   roles: ['Admin', 'FactoryManager', 'SalesAgent'] },
  { key: 'timeline',   roles: ['Admin', 'FactoryManager', 'Employee', 'SalesAgent', 'Collaborator'] },
];

const visibleTabs = TABS.filter(tab => tab.roles.includes(user.role));
```

### Pattern 5 — Route-level guard

```tsx
// App.tsx
<Route path="/erp/payments">
  <RequireRole roles={['Admin', 'Accountant']}>
    <Payments />
  </RequireRole>
</Route>

<Route path="/admin/permissions">
  <RequireRole roles={['Admin']}>
    <PermissionsDashboard />
  </RequireRole>
</Route>
```

---

## 9. Testing Checklist

Before deploying any new feature, verify the visibility rules are correctly applied:

### Per-role smoke test

For each of the 7 roles (Customer skipped until contract-signing ships), log in and verify:

- [ ] Sidebar shows only the nav items they should see
- [ ] Direct URL navigation to a forbidden page redirects to dashboard
- [ ] API call to a forbidden endpoint returns 403, not 500
- [ ] Forbidden tabs are not visible (not just empty)
- [ ] Forbidden buttons are not visible (not just disabled)
- [ ] Hidden fields don't appear in the API response (check Network tab)
- [ ] Hidden fields don't appear in the page source (check inspect element)
- [ ] No "you don't have permission" messages appear during normal use

### Role consistency check

For every component that shows role-conditional UI:

- [ ] Role check uses a named constant or helper, not inline string comparison
- [ ] Backend enforces the same restriction (test with curl + JWT)
- [ ] Sidebar, route guard, AND backend all agree on access rules
- [ ] No `disabled={!canX}` patterns — use conditional rendering instead

### Field visibility check

For every data field:

- [ ] If hidden, it's filtered out at the backend (not just the frontend)
- [ ] Replacement display (`—`) is consistent across all places the field appears
- [ ] PDF/print exports respect the same visibility rules as the screen

### v4.4.0 specific tests

- [ ] Manager (FactoryManager) sees no delete buttons anywhere — projects, leads, files, vendors, POs
- [ ] Manager attempts to call DELETE endpoints via curl → 403
- [ ] Collaborator sees only own leads in /erp/leads
- [ ] Collaborator attempts to GET another user's lead → 403
- [ ] Collaborator can manage stages 11–14 ONLY for own-origin projects
- [ ] Customer role exists in DB but no UI flows are reachable (all routes return 403 or 404)
- [ ] Permissions dashboard is reachable only by Admin
- [ ] Capabilities dashboard reflects current `role_capabilities` table state

---

## 10. Known Permission Gaps

> **v4.0.0 — All prior gaps resolved.** Gaps 1–7 were fixed across Stages 1–2 of the stabilization plan. Gap 8 was evaluated and resolved as a design decision.
>
> **v4.0.11 (Stage 6.6) — Rule 10 enforced.** File deletion is now Admin-only via the new `canDeleteFile` helper, replacing the old `canDeleteProject` reuse.

### Resolved gaps (closed in v3.5.0 – v4.0.11)

1. ✅ **`lib/permissions.ts` created** (Stage 1) — 13 named helpers; no inline role strings in any component.
2. ✅ **`RequireRole` component created** (Stage 1) — redirects unauthorised roles to `/admin`.
3. ✅ **Tab-level filtering implemented for all tabs** (Stage 2).
4. ✅ **Field-level price hiding implemented** (Stage 2).
5. ✅ **`canCreateMilestone` corrected** (Stage 2) — Admin|Accountant only.
6. ✅ **Accountant navigation path to project detail** (Stage 2) — deep-link via Payments.
7. ✅ **SalesAgent sidebar scoped** (Stage 2) — Dashboard + Clients only.
8. ✅ **QR sidebar Admin-only** (Stage 2, design decision).
9. ✅ **File deletion = Admin only (Rule 10)** (Stage 6.6, v4.0.11) — `canDeleteFile` helper added.

### v4.4.0 transitions (planned breaking changes)

| Item | Pre-v4.4.0 | v4.4.0 | Reason |
|---|---|---|---|
| Manager (FactoryManager) deleting projects | ✅ allowed | ❌ blocked | User-stated rule: Manager cannot delete anything |
| Manager deleting leads | ✅ allowed | ❌ blocked | Same |
| Manager deleting vendors / POs | ✅ allowed | ❌ blocked | Same |
| Manager deleting files | already ❌ in v4.0.11 | ❌ continues | Rule 10 |
| `canDeleteProject` helper return values | Admin + FactoryManager | Admin only | Manager scope tightening |
| New role: Collaborator | does not exist | added | External partner support |
| New role: Customer | does not exist | added (grayed out) | Schema slot for future contract signing |
| UI label "Factory Manager" | shown | becomes "Manager" | User-stated relabel; DB unchanged |

### Open items (post-v4.4.0)

- Audit log for permission changes (who granted what override and when) — slated for v4.5.0
- Time-bounded permission grants (e.g., "Sara has prices.view for 30 days") — not in v4.4.x
- Permission groups / bundles — not in v4.4.x
- Customer authentication (magic link + OTP) — Customer Portal stage, v4.6.0+

---

## 11. Capabilities Granularity (v4.4.0)

> **What this section adds:** v4.4.0 introduces a finer-grained permission system on top of the role system above. Roles are still the primary grouping; capabilities are the atomic units the dashboard manipulates.

### Why capabilities, not just roles

The role system above answers "what can a Manager do?" with a static yes/no per feature. The capabilities system answers the same question with a list of named permissions, stored in the database, editable by Admin.

This matters because:
- The Admin can adjust the matrix without a code deploy
- Per-user overrides (v4.4.1) need a unit smaller than "role" to apply against
- Adding a new role in the future doesn't require touching every helper file

### The capability list (hardcoded constant)

Capabilities live in code, not in the database. The database stores **which roles have which capabilities granted**, but the capability names themselves are a hardcoded constant.

This is intentional — a capability that exists in the dashboard but isn't checked anywhere in code is a lie. New capabilities are added by:

1. Adding the entry to `lib/capabilities.ts`
2. Adding the check in the relevant route guard / UI condition
3. Deploying

The dashboard automatically picks up new capabilities because it iterates over the constant.

```typescript
// lib/capabilities.ts (NEW FILE in v4.4.0)
export const CAPABILITIES = {
  // Project capabilities
  'projects.view_active': { label_en: 'View active projects', label_ar: 'عرض المشاريع النشطة', category: 'projects' },
  'projects.view_all':    { label_en: 'View all projects (incl. warranty-complete)', label_ar: 'عرض جميع المشاريع', category: 'projects' },
  'projects.create':      { label_en: 'Create projects', label_ar: 'إنشاء مشاريع', category: 'projects' },
  'projects.edit':        { label_en: 'Edit projects', label_ar: 'تعديل المشاريع', category: 'projects' },
  'projects.delete':      { label_en: 'Delete projects', label_ar: 'حذف المشاريع', category: 'projects' },

  // Lead capabilities
  'leads.view_own':   { label_en: 'View own leads', label_ar: 'عرض العملاء المحتملين الخاصين', category: 'leads' },
  'leads.view_all':   { label_en: 'View all leads', label_ar: 'عرض جميع العملاء المحتملين', category: 'leads' },
  'leads.create':     { label_en: 'Create leads', label_ar: 'إنشاء عميل محتمل', category: 'leads' },
  'leads.convert':    { label_en: 'Convert leads to projects', label_ar: 'تحويل عميل محتمل إلى مشروع', category: 'leads' },
  'leads.delete':     { label_en: 'Delete leads', label_ar: 'حذف العملاء المحتملين', category: 'leads' },

  // File capabilities
  'files.upload':  { label_en: 'Upload files', label_ar: 'رفع ملفات', category: 'files' },
  'files.replace': { label_en: 'Replace files', label_ar: 'استبدال ملفات', category: 'files' },
  'files.delete':  { label_en: 'Delete files', label_ar: 'حذف ملفات', category: 'files' },

  // Financial
  'prices.view':     { label_en: 'View prices', label_ar: 'عرض الأسعار', category: 'financial' },
  'payments.manage': { label_en: 'Manage payment milestones', label_ar: 'إدارة دفعات المشاريع', category: 'financial' },
  'qoyod.access':    { label_en: 'Access Qoyod sync', label_ar: 'الوصول إلى مزامنة قيود', category: 'financial' },

  // Vendor / manufacturing
  'vendors.view':         { label_en: 'View vendors', label_ar: 'عرض الموردين', category: 'manufacturing' },
  'vendors.manage':       { label_en: 'Manage vendors', label_ar: 'إدارة الموردين', category: 'manufacturing' },
  'manufacturing.manage': { label_en: 'Manage manufacturing orders', label_ar: 'إدارة أوامر التصنيع', category: 'manufacturing' },

  // Stages 11–14 (delivery/installation/sign-off)
  'phases.manage':  { label_en: 'Manage delivery phases', label_ar: 'إدارة مراحل التوصيل', category: 'phases' },
  'phases.signoff': { label_en: 'Sign off on phases', label_ar: 'اعتماد المراحل', category: 'phases' },

  // Contract
  'contracts.view':     { label_en: 'View contracts', label_ar: 'عرض العقود', category: 'contracts' },
  'contracts.edit':     { label_en: 'Edit contract template', label_ar: 'تعديل قالب العقد', category: 'contracts' },
  'contracts.sign':     { label_en: 'Sign contracts (customer)', label_ar: 'توقيع العقود (عميل)', category: 'contracts' },

  // Admin / system
  'users.manage':       { label_en: 'Manage users', label_ar: 'إدارة المستخدمين', category: 'admin' },
  'permissions.manage': { label_en: 'Edit role permissions', label_ar: 'تعديل صلاحيات الأدوار', category: 'admin' },
  'dropdowns.edit':     { label_en: 'Edit dropdown lists', label_ar: 'تعديل القوائم المنسدلة', category: 'admin' },
  'archive.view':       { label_en: 'View document archive', label_ar: 'عرض أرشيف المستندات', category: 'admin' },
} as const;

export type Capability = keyof typeof CAPABILITIES;
```

### How a capability check resolves at runtime

```typescript
// lib/permissions.ts — extended in v4.4.0
export async function userHasCapability(
  user: User,
  capability: Capability,
  context?: { recordOwnerId?: number }
): Promise<boolean> {
  // 1. Per-user override wins if it exists (v4.4.1+)
  const override = await getUserOverride(user.id, capability);
  if (override !== null) return override.granted;

  // 2. Otherwise consult role-level grant from role_capabilities table
  const granted = await getRoleCapability(user.role, capability);
  if (!granted) return false;

  // 3. If capability is "(own)" scoped, check ownership
  if (isOwnScopedCapability(capability) && context?.recordOwnerId) {
    return context.recordOwnerId === user.id;
  }

  return true;
}
```

### Default role-capability matrix (seed data for v4.4.0 deploy)

This is the seed data that gets inserted into `role_capabilities` on first deploy. The Admin can edit any of these via the dashboard afterwards. It must match the matrices in Section 2 above — they describe the same rules at different levels of granularity.

(Matrix omitted here for brevity — see Section 2 for the authoritative version. The migration script generates this seed from Section 2 directly.)

---

## 12. Permissions Dashboard (v4.4.0)

> **Three pages, accessible only to Admin (`permissions.manage` capability).**

### Page 1: Role Permissions

**Path:** `/admin/permissions/roles`

**Layout:**
- Top: 7 role tabs — Admin, Manager, Employee, Sales Agent, Collaborator, Accountant, Customer
- Selected role: capabilities grouped by category (Projects, Leads, Files, Financial, Manufacturing, Phases, Contracts, Admin)
- Each capability is a checkbox (default state from `role_capabilities` row)
- Save button at bottom — writes to `role_capabilities` table

**Special handling:**
- Admin tab: all checkboxes shown checked AND disabled (defensive UI to prevent accidental lockout)
- Customer tab: grayed out with banner: "Customer role is reserved for future contract-signing feature. Capabilities cannot be edited until that feature ships."

### Page 2: Users

**Path:** `/admin/users` (existing path; rebuilt for v4.4.0)

**Layout:**
- Header: `Users (N)` + `[+ Add user]` button + role filter dropdown + search box
- Table: Name | Email | Role | Last active | Status | Actions
- Status: Active / Disabled (soft-disable; no hard delete from this page)
- Actions: `[Edit]` button per row
- Row indicator: small ⓘ badge next to users with custom overrides (clickable → goes to Edit User page)

### Page 3: Edit User

**Path:** `/admin/users/:id/edit`

**Layout:**
- User info: name, email, role dropdown
- Capabilities section (two groups):
  - **Inherited from role** — read-only checkboxes showing current state
  - **Custom overrides** — editable list (v4.4.1 only)
- Status toggle: Active / Disabled
- Save button

### Behavior rules

- Changing a user's role from the dropdown immediately changes which capabilities are inherited; existing overrides are preserved
- Changing a role's default capabilities does NOT silently override per-user overrides
- Saving requires confirmation if any change reduces a user's permissions (defensive)
- All permission changes are logged in an audit table (v4.5.0 — table exists in v4.4.0 but the UI to view it ships in v4.5.0)

---

*Last reviewed: April 2026 (v4.4.0 design) — keep in sync with WORKFLOW_REFERENCE_v3.md Section 4 and CODE_STRUCTURE.md role permissions section.*
