# USERS_AND_PERMISSIONS.md
# هيكل المستخدمين والصلاحيات — Wathbah v4.0.0

> **Purpose:** Single source of truth for user roles, what each role can see, what each role can do, and how to hide information cleanly in the UI.
> **Read before:** building any new page, adding any new button, exposing any new data field.
> **Audience:** Claude Code, Ahmad, future developers.
> **Last updated:** April 2026 — synced for v4.0.0 stabilization release

---

## Table of Contents

0. [Current Implementation Status](#0-current-implementation-status)
1. [The 5 Roles](#1-the-5-roles)
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

---

## 1. The 5 Roles

| Role | Arabic Name | DB Value | Scope |
|---|---|---|---|
| Admin | المدير العام | `'Admin'` | Full system control — settings, users, all data, delete |
| Factory Manager | مدير المصنع | `'FactoryManager'` | Operations — projects, manufacturing, vendors, can delete |
| Employee | الموظف | `'Employee'` | Day-to-day — leads, projects, files, receiving |
| Sales Agent | مندوب المبيعات | `'SalesAgent'` | Sales only — own leads, contract view |
| Accountant | المحاسب | `'Accountant'` | Money only — payments, Qoyod, invoices |

**Default user on first startup:** `admin` / `admin123` — Admin role. Change password immediately.

---

## 1.5. Quick Reference Cheat Sheet

> At-a-glance access map. For full detail see Section 2. "Own only" means the role is scoped to records assigned to them.

| Feature | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| Leads | ✅ | ✅ | ✅ | Own only | ❌ |
| Projects | ✅ | ✅ | ✅ | ❌ | ❌ |
| Contract view | ✅ | ✅ | ❌ | ✅ | ❌ |
| Prices / quotations | ✅ | ✅ | ❌ | ❌ | ✅ |
| Payments | ✅ | ❌ | ❌ | ❌ | ✅ |
| Vendors | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manufacturing | ✅ | ✅ | ✅ | ❌ | ❌ |
| QR Upload | ✅ | ❌ | ❌ | ❌ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Users management | ✅ | ❌ | ❌ | ❌ | ❌ |
| Qoyod sync | ✅ | ❌ | ❌ | ❌ | ✅ |
| Delete records | ✅ | ✅ | ❌ | ❌ | ❌ |
| Dashboard KPIs (financial) | ✅ | ✅ | ❌ | ❌ | ✅ |

---

## 2. Permissions Matrix — Full Detail

### Leads & Customers (العملاء)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| View all leads | ✅ | ✅ | ✅ | ✅ | ❌ |
| View own leads only | — | — | — | ✅ (filtered) | ❌ |
| Create new lead | ✅ | ✅ | ✅ | ✅ | ❌ |
| Edit any lead | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit own leads | ✅ | ✅ | ✅ | ✅ | ❌ |
| Add contact log entry | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| Mark lead as lost | ✅ | ✅ | ✅ | ✅ (own) | ❌ |
| Convert lead → project | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete lead | ✅ | ✅ | ❌ | ❌ | ❌ |

> **Additional lead-level restrictions (live code):** `GET /erp/leads/search` excludes SalesAgent (Admin, FM, Employee only). `GET /erp/leads/:id/linked-projects` is Admin and FactoryManager only.

> **Future improvement:** Add a backend endpoint column to each row linking the permission to its `requireRole()` call in `erp.ts`. This makes audits mechanical. Not done yet — pending `lib/permissions.ts` creation.

### Projects (المشاريع)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| View projects list | ✅ | ✅ | ✅ | ❌* | ❌ |
| View project detail | ✅ | ✅ | ✅ | ❌* | ❌ |
| Create project directly | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit project info | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete project | ✅ | ✅ | ❌ | ❌ | ❌ |
| Upload Orgadata files | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete files | ✅ | ✅ | ❌ | ❌ | ✅ (Qoyod files) |
| Edit project notes | ✅ | ✅ | ✅ | ❌ | ❌ |

> \* SalesAgent has no general project access, but DOES have access to view contracts (see Contracts row below). This is the only project-related visibility they have.

### Contracts (العقود)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| View contract page | ✅ | ✅ | ❌ | ✅ | ❌ |
| Print contract | ✅ | ✅ | ❌ | ✅ | ❌ |
| Edit contract template | ✅ | ❌ | ❌ | ❌ | ❌ |
| View integrity check | ✅ | ✅ | ❌ | ✅ | ❌ |

### Pricing & Quotations (الأسعار والعروض)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| **View prices in projects** | ✅ | ✅ | ❌ | ❌ | ✅ |
| **View prices in contracts** | ✅ | ✅ | ❌ | ✅ | ✅ |
| Edit estimated value | ✅ | ✅ | ❌ | ❌ | ❌ |
| View quotation totals | ✅ | ✅ | ❌ | ✅ | ✅ |

> **CRITICAL:** Employees should NEVER see prices in the project detail page. This is a deliberate business rule — prevents internal price leaks.

### Vendors & Purchase Orders (الموردين والمشتريات)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| View vendor list | ✅ | ✅ | ✅ | ❌ | ❌ |
| Create vendor | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create purchase order | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark items received | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete vendor/PO | ✅ | ✅ | ❌ | ❌ | ❌ |

### Manufacturing (التصنيع)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| View manufacturing orders | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send to manufacturing | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update workshop progress | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark phase delivered | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mark phase installed | ✅ | ✅ | ✅ | ❌ | ❌ |
| Sign-off phase | ✅ | ✅ | ❌ | ❌ | ❌ |

### Payments & Money (المدفوعات والمالية)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| View payments page | ✅ | ❌ | ❌ | ❌ | ✅ |
| View payment milestones in project | ✅ | ✅ | ❌ | ❌ | ✅ |
| Create payment milestone | ✅ | ❌ | ❌ | ❌ | ✅ |
| Mark milestone as paid | ✅ | ❌ | ❌ | ❌ | ✅ |
| Upload Qoyod document | ✅ | ❌ | ❌ | ❌ | ✅ |
| View Qoyod sync page | ✅ | ❌ | ❌ | ❌ | ✅ |
| Link Qoyod invoice to project | ✅ | ❌ | ❌ | ❌ | ✅ |

### QR System (نظام المستندات)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| Upload .docx for QR processing | ✅ | ✅ | ✅ | ❌ | ❌ |
| View document archive | ✅ | ✅ | ✅ | ❌ | ❌ |
| View service requests (from QR scans) | ✅ | ✅ | ✅ | ❌ | ❌ |

### System Administration (الإعدادات)

| Action | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| Manage users (create/edit/delete) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit dropdown lists | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit contract template | ✅ | ❌ | ❌ | ❌ | ❌ |
| View system settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Change own password | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 3. What Each Role Sees on Each Page

### Dashboard (/admin)

| Element | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| KPI: Active Projects | ✅ | ✅ | ✅ | ✅ | ✅ |
| KPI: Revenue MTD | ✅ | ✅ | ❌ | ❌ | ✅ |
| KPI: Outstanding | ✅ | ✅ | ❌ | ❌ | ✅ |
| KPI: QR Documents | ✅ | ✅ | ✅ | ✅ | ❌ |
| Stage Funnel | ✅ | ✅ | ✅ | ✅ | ❌ |
| Cashflow Snapshot | ✅ | ✅ | ❌ | ❌ | ✅ |
| Activity Feed | ✅ | ✅ | ✅ | ✅ (own only) | ✅ |
| Maintenance Requests | ✅ | ✅ | ✅ | ❌ | ❌ |
| Attention List (overdue) | ✅ | ✅ | ✅ | ✅ (own leads) | ✅ (own payments) |

### Project Detail Page Tabs

| Tab | Admin | FactoryManager | Employee | SalesAgent | Accountant |
|---|---|---|---|---|---|
| Overview | ✅ | ✅ | ✅ | ❌ | ❌ |
| Files | ✅ | ✅ | ✅ | ❌ | ❌ |
| Payments | ✅ | ✅ | ❌ | ❌ | ✅ |
| Procurement | ✅ | ✅ | ✅ | ❌ | ❌ |
| Production | ✅ | ✅ | ✅ | ❌ | ❌ |
| Contract | ✅ | ✅ | ❌ | ✅ | ❌ |
| Timeline | ✅ | ✅ | ✅ | ❌ | ❌ |

> Tabs the user cannot access must be **hidden entirely** from the tab bar — never shown as disabled with empty content.

---

## 4. Sidebar Navigation by Role

### Admin sees:
```
الإدارة
├─ Dashboard (لوحة التحكم)
└─ Service Requests (طلبات الصيانة)

نظام التصنيع
├─ Clients (العملاء)
├─ Projects (المشاريع)
├─ Payments (المدفوعات)
├─ Vendors (الموردون)
├─ Qoyod (قيود) — when integration is live
└─ Settings (الإعدادات)

نظام المستندات
├─ QR Upload (رفع ملف QR)
└─ Document Archive (أرشيف المستندات)
```

### Factory Manager sees:
```
الإدارة
├─ Dashboard
└─ Service Requests

نظام التصنيع
├─ Clients
├─ Projects
├─ Vendors
└─ (no Payments, no Settings, no Qoyod)

نظام المستندات
└─ (no access — QR Upload and Document Archive restricted to Admin in live code)
```

> **Note (live code, v4.0.0):** QR sidebar links (Upload, Archive, Users, Dropdowns) are gated with `canViewQRSystem(user?.role)`. `canViewQRSystem` returns `true` for Admin only — FM has no QR nav. This matches current backend scope and is the intended design decision (Admin-only QR system access).

### Employee sees:
```
الإدارة
├─ Dashboard
└─ Service Requests

نظام التصنيع
├─ Clients
├─ Projects
└─ Vendors

نظام المستندات
└─ (no access — QR Upload and Document Archive restricted to Admin via canViewQRSystem)
```

> **Note (live code, v4.0.0):** QR sidebar links gated with `canViewQRSystem(user?.role)`. Admin only — same scope as FM above.

### Sales Agent sees:
```
الإدارة
└─ Dashboard (no Service Requests)

نظام التصنيع
└─ Clients (العملاء only — Projects and Service Requests hidden)
```

> **Live code (v4.0.0):** SalesAgent sidebar explicitly gated with `canViewLeads()` for Clients and `canCreateProject()` for Projects. Service Requests (`/admin/requests`) gated with `canCreateProject()`. SalesAgent gets Dashboard + Clients only — no Projects, no Service Requests.

### Accountant sees:
```
الإدارة
└─ Dashboard (financial KPIs only)

نظام التصنيع
├─ Payments
├─ Qoyod (when integration is live)
└─ (no Clients, no Projects list, no Vendors)
```

---

## 5. Field-Level Visibility Rules

These are the specific data fields that must be hidden from certain roles even when the page is otherwise accessible:

### Project Information

| Field | Hidden From |
|---|---|
| `estimatedValue` (القيمة التقديرية) | Employee |
| `quotation.subtotalNet` | Employee |
| `quotation.grandTotal` | Employee |
| `quotation.positions[].unitPrice` | Employee |
| `quotation.positions[].lineTotal` | Employee |
| `paidAmount` on milestones | Employee, FactoryManager |
| `vendor.unitCost` on PO items | Employee |

### Customer Information

| Field | Hidden From |
|---|---|
| `customerPhone` | Hidden in print exports for all roles (privacy) |
| `customerName` (full) | SalesAgent sees only own customers |

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

**Why:** Some pages need to be visually consistent across roles (like a project header card). Replacing with `—` keeps the layout intact without revealing the value.

**Strategy 3 — Filter at data fetch (preferred for lists)**

Used for: tables of leads, projects, payments — where the user should see only a subset.

```tsx
// ✅ CORRECT — backend filters by role; frontend just renders what it gets
useEffect(() => {
  fetch(`${API_BASE}/api/erp/leads`)
    // Backend returns ONLY this user's leads if role === 'SalesAgent'
    .then(r => r.json())
    .then(setLeads);
}, []);
```

```tsx
// ❌ WRONG — fetch all then filter on frontend
useEffect(() => {
  fetch(`${API_BASE}/api/erp/leads`)
    .then(r => r.json())
    .then(allLeads => {
      const myLeads = allLeads.filter(l => l.assignedTo === user.id);
      setLeads(myLeads);
    });
}, []);
```

**Why:** Frontend filtering is a security hole — the data was already sent over the network. Always filter at the backend.

### 6.2 Specific UI Patterns

**Pattern: Single source of truth for role checks**

Define role groups once at the top of each component, never inline:

```tsx
// ✅ CORRECT — defined once, used everywhere
const canDelete = user?.role === 'Admin' || user?.role === 'FactoryManager';
const canViewPrices = user?.role === 'Admin' || user?.role === 'FactoryManager' || user?.role === 'Accountant';
const canEditTemplate = user?.role === 'Admin';

return (
  <>
    {canDelete && <DeleteButton />}
    {canViewPrices && <PriceField />}
    {canEditTemplate && <TemplateEditor />}
  </>
);
```

```tsx
// ❌ WRONG — repeated inline checks (drift risk)
return (
  <>
    {(user?.role === 'Admin' || user?.role === 'FactoryManager') && <DeleteButton />}
    {(user?.role === 'Admin' || user?.role === 'FM') && <PriceField />}  {/* typo not caught */}
    {(user?.role === 'admin') && <TemplateEditor />}  {/* casing bug */}
  </>
);
```

**Pattern: Hide tabs entirely, never show empty content**

```tsx
// ✅ CORRECT — tab list filtered before render
const tabs = [
  { key: 'overview', label: t('tab_overview'), allowedRoles: ['Admin','FactoryManager','Employee'] },
  { key: 'payments', label: t('tab_payments'), allowedRoles: ['Admin','FactoryManager','Accountant'] },
  { key: 'contract', label: t('tab_contract'), allowedRoles: ['Admin','FactoryManager','SalesAgent'] },
];

const visibleTabs = tabs.filter(tab => tab.allowedRoles.includes(user.role));
```

**Pattern: Replace empty state with helpful message**

When a list is empty *because* of the user's role (not because there's no data), show a helpful message:

```tsx
// ✅ CORRECT
{leads.length === 0 ? (
  user.role === 'SalesAgent'
    ? <EmptyState message={t('no_assigned_leads')} cta={t('contact_admin')} />
    : <EmptyState message={t('no_leads_yet')} cta={t('create_first_lead')} />
) : (
  <LeadsTable leads={leads} />
)}
```

**Pattern: Separate read-only and editable views**

Don't show edit fields in disabled state — render plain text instead:

```tsx
// ✅ CORRECT
{canEditNotes ? (
  <textarea value={notes} onChange={e => setNotes(e.target.value)} />
) : (
  <p className="text-slate-700">{notes || t('no_notes')}</p>
)}

// ❌ WRONG
<textarea value={notes} disabled={!canEditNotes} />
```

### 6.3 Visual Cues Done Right

**Use color and icons to communicate role context, not to mark restrictions:**

```tsx
// ✅ CORRECT — small badge in user menu showing current role
<UserMenu>
  <span>{user.username}</span>
  <Badge>{t(`role_${user.role.toLowerCase()}`)}</Badge>
</UserMenu>

// ✅ CORRECT — when an action requires a specific role, route them to the right person
<EmptyState
  icon={<Lock />}
  title={t('admin_only_feature')}
  description={t('contact_your_admin_to_request')}
/>
```

### 6.4 Anti-Patterns to Avoid

| ❌ Anti-pattern | Why bad | ✅ Do instead |
|---|---|---|
| Disabled buttons | Reveals feature existence | Hide entirely |
| "You don't have permission" | Frustrating; accusatory | Hide entirely or show "ask admin" |
| Greyed-out menu items | Visual noise; reveals structure | Filter from menu |
| Tooltip "Admin only" on hover | Tempts users to seek workaround | Hide entirely |
| Empty tabs with placeholder | Wastes screen space | Hide tab from tab bar |
| Frontend-only filtering | Security hole | Filter at backend |
| Inline role checks scattered | Drift, typos | Define role groups once |
| Disabled form fields with values | Leaks data via inspect element | Render as plain text |

---

## 7. Backend Enforcement Rules

> **The frontend is for UX. The backend is for security.** A missing frontend check is a UX bug. A missing backend check is a security breach.

### Every API route must have:

```typescript
router.get(
  '/api/erp/projects/:id',
  requireAuth,                                    // step 1: must be logged in
  requireRole('Admin', 'FactoryManager', 'Employee', 'Accountant'),  // step 2: role check
  async (req, res) => {
    // step 3: data-level check
    const project = await db.select().from(projects).where(eq(projects.id, req.params.id));

    // SalesAgent: filter by assigned_to
    if (req.session.role === 'SalesAgent' && project.assignedTo !== req.session.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // step 4: field-level filtering
    const safeProject = filterFieldsByRole(project, req.session.role);

    res.json(safeProject);
  }
);
```

### Field filtering helper

```typescript
// lib/permissions.ts
export function filterFieldsByRole(project: Project, role: Role): SafeProject {
  const safe = { ...project };

  if (role === 'Employee') {
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

### Three layers must all agree

For every protected feature:

1. **Sidebar nav** — does this role see the link?
2. **Frontend route guard** — if they navigate directly via URL, does the page render?
3. **Backend route guard** — if they POST/GET via API, does the endpoint respond?

If any one of these is missing, the security is broken.

---

## 8. Implementation Patterns

### Pattern 1 — useAuth() returns the role

```tsx
// hooks/use-auth.tsx
export function useAuth() {
  return {
    user: { id, username, role },  // role is 'Admin' | 'FactoryManager' | etc.
    login,
    logout,
  };
}
```

### Pattern 2 — Permission helper file

```tsx
// lib/permissions.ts (NEW FILE — recommended)
import type { Role } from './types';

export const canViewPrices = (role: Role) =>
  ['Admin', 'FactoryManager', 'Accountant'].includes(role);

export const canDeleteProject = (role: Role) =>
  ['Admin', 'FactoryManager'].includes(role);

export const canEditContract = (role: Role) =>
  role === 'Admin';

export const canViewProjectDetail = (role: Role) =>
  ['Admin', 'FactoryManager', 'Employee', 'Accountant'].includes(role);

export const canViewPayments = (role: Role) =>
  ['Admin', 'Accountant'].includes(role);

// Use in components:
import { canViewPrices, canDeleteProject } from '@/lib/permissions';

const { user } = useAuth();
{canViewPrices(user.role) && <PriceField />}
{canDeleteProject(user.role) && <DeleteButton />}
```

### Pattern 3 — Sidebar filtering

```tsx
// components/layout/AdminLayout.tsx
const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: '/admin', icon: Layout, roles: ['Admin', 'FactoryManager', 'Employee', 'Accountant'] },
  { key: 'leads', label: 'Clients', path: '/erp/leads', icon: Users, roles: ['Admin', 'FactoryManager', 'Employee', 'SalesAgent'] },
  { key: 'projects', label: 'Projects', path: '/erp/projects', icon: Folder, roles: ['Admin', 'FactoryManager', 'Employee', 'Accountant'] },
  { key: 'payments', label: 'Payments', path: '/erp/payments', icon: CreditCard, roles: ['Admin', 'Accountant'] },
  { key: 'vendors', label: 'Vendors', path: '/erp/vendors', icon: Box, roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'settings', label: 'Settings', path: '/erp/settings', icon: Settings, roles: ['Admin'] },
];

const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(user.role));
```

### Pattern 4 — Tab filtering

```tsx
// In ProjectDetail.tsx
const TABS = [
  { key: 'overview', label: t('tab_overview'), roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'files', label: t('tab_files'), roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'payments', label: t('tab_payments'), roles: ['Admin', 'FactoryManager', 'Accountant'] },
  { key: 'procurement', label: t('tab_procurement'), roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'production', label: t('tab_production'), roles: ['Admin', 'FactoryManager', 'Employee'] },
  { key: 'contract', label: t('tab_contract'), roles: ['Admin', 'FactoryManager', 'SalesAgent'] },
  { key: 'timeline', label: t('tab_timeline'), roles: ['Admin', 'FactoryManager', 'Employee'] },
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

// components/RequireRole.tsx
export function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user || !roles.includes(user.role)) {
      setLocation('/admin');  // redirect to dashboard
    }
  }, [user, roles, setLocation]);

  if (!user || !roles.includes(user.role)) return null;
  return <>{children}</>;
}
```

---

## 9. Testing Checklist

Before deploying any new feature, verify the visibility rules are correctly applied:

### Per-role smoke test

For each of the 5 roles, log in and verify:

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

---

---

## 10. Known Permission Gaps

> **v4.0.0 — All prior gaps resolved.** Gaps 1–7 were fixed across Stages 1–2 of the stabilization plan. Gap 8 was evaluated and resolved as a design decision. The list below is a closed audit log.

### Resolved gaps (closed in v3.5.0 – v3.6.0)

1. ✅ **`lib/permissions.ts` created** (Stage 1) — 13 named helpers; no inline role strings in any component. Located at `artifacts/qr-manager/src/lib/permissions.ts`.

2. ✅ **`RequireRole` component created** (Stage 1) — located at `artifacts/qr-manager/src/components/RequireRole.tsx`. Redirects unauthorised roles to `/admin`.

3. ✅ **Tab-level filtering implemented for all tabs** (Stage 2) — `ProjectDetail.tsx` hides Payments tab from Employee; all non-Contract tabs are hidden from SalesAgent and Accountant via role guards.

4. ✅ **Field-level price hiding implemented** (Stage 2) — `estimatedValue` in ProjectDetail Overview section guarded by `canViewPrices(user?.role)`. Hidden for Employee.

5. ✅ **`canCreateMilestone` corrected** (Stage 2) — now calls `canCreateMilestoneHelper()` → Admin|Accountant only. FM and SalesAgent no longer see the button; Accountant now sees it.

6. ✅ **Accountant navigation path to project detail** (Stage 2) — `GET /erp/projects/:id` backend now allows Accountant. `Payments.tsx` project-row click deep-links to `/erp/projects/:id?tab=payments`. `ProjectDetail.tsx` reads `?tab=` on load.

7. ✅ **SalesAgent sidebar scoped** (Stage 2) — `canViewLeads()` gates Clients; `canCreateProject()` gates Projects and Service Requests. SalesAgent sees Dashboard + Clients only.

8. ✅ **QR sidebar Admin-only — confirmed design decision** (Stage 2) — `isAdmin` guard replaced with `canViewQRSystem()` (semantically equivalent). Current backend scope (Admin-only for QR routes) is intentional and consistent with `canViewQRSystem`. No change to access level; helper usage is the fix.

### Open items (post-v4.0.0)

- `isErpUser` and `isPaymentsUser` composite checks in `Admin.tsx` and `AdminLayout.tsx` have no dedicated helpers yet. `isPaymentsUser` has a known discrepancy between the two files (Admin.tsx includes FactoryManager; AdminLayout.tsx does not). Both carry TODO comments — address in next stabilization pass.

---

*Last reviewed: April 2026 (v4.0.0) — keep in sync with WORKFLOW_REFERENCE_v3.md Section 4 and CODE_STRUCTURE.md role permissions section.*
