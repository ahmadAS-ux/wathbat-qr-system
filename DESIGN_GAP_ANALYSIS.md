# DESIGN_GAP_ANALYSIS.md

> **Status:** Complete analysis — DO NOT implement anything from this file without reading it fully.
> **Date:** April 2026
> **Design source:** Claude Design export (asset-manager-wathbat bundle, 24 files)
> **Codebase version:** v3.3.0

---

## 1. Design File Inventory

| File | Maps to | Exists in codebase? | Action |
|------|---------|-------------------|--------|
| `project/Dashboard.html` | `Admin.tsx` | Yes | Compare — most components exist, some missing |
| `project/Project Detail.html` | `erp/ProjectDetail.tsx` | Yes | Compare — tab structure different |
| `project/Projects.html` | `erp/Projects.tsx` | Yes | Replace card grid → table layout |
| `project/app.jsx` | `erp/ProjectDetail.tsx` (router) | Yes (merged) | Reference only |
| `project/components/sidebar.jsx` | `components/layout/AdminLayout.tsx` | Yes | Restructure sections |
| `project/components/dashboard.jsx` | `Admin.tsx` | Yes | Several widgets missing/different |
| `project/components/header.jsx` | `erp/ProjectDetail.tsx` (ProjectHeader) | Partial | Progress bar missing |
| `project/components/primitives.jsx` | `index.css` + inline JSX | Partial | Card color mismatch |
| `project/components/icons.jsx` | `lucide-react` | Yes (different lib) | Icons match intent, lib differs |
| `project/components/tab-overview.jsx` | `erp/ProjectDetail.tsx` (tab) | Unknown | Verify tab exists |
| `project/components/tab-files.jsx` | `erp/ProjectDetail.tsx` (tab) | Partial | Smart upload panel missing |
| `project/components/tab-payments.jsx` | `erp/ProjectDetail.tsx` (tab) | Yes | Compare structure |
| `project/components/tab-procurement.jsx` | `erp/ProjectDetail.tsx` (tab) | Yes | Compare PO line item table |
| `project/components/tab-production.jsx` | `erp/ProjectDetail.tsx` (tab) | Yes | Compare workshop progress |
| `project/components/tab-contract.jsx` | `erp/ContractPage.tsx` | Partial | Design puts contract IN project tab |
| `project/components/tab-timeline.jsx` | `erp/ProjectDetail.tsx` (tab) | Unknown | Verify 5×3 grid exists |
| `project/uploads/logo.png` | `src/assets/image_*.png` | Yes | Same logo |
| `project/uploads/pasted-*.png` | Reference screenshots | No | Analysis only |
| `asset-manager-wathbat/README.md` | — | No | Read by agent |
| `asset-manager-wathbat/chats/chat1.md` | — | No | Intent transcript (read) |

---

## 2. Global Design Tokens — Exact Comparison

### Colors

| Token | Design (exact hex) | Current CSS/Tailwind | Match? | Where to fix |
|-------|-------------------|---------------------|--------|-------------|
| Page background | `#F4F2EB` | `#F4F2EB` ✅ | YES | — |
| Card background | `bg-white` = `#FFFFFF` | `bg-[#FAFAF7]` / `.dash-card { background: #FAFAF7 }` | **NO** | `index.css .dash-card`, all ERP card divs |
| Sub-section bg (paper) | `#FAFAF7` (table headers, action bars, bucket bg) | `#FAFAF7` ✅ | YES | — |
| Sub-section bg (warm) | `#FBFAF4` (action row footer of cards) | Partially used | PARTIAL | Add to design tokens |
| Card border (ring) | `ring-1 ring-[#ECEAE2]` | `border border-[#ECEAE2]` | CLOSE | Border vs ring is minor visual difference |
| Card shadow | `shadow-card: 0 1px 3px rgba(0,0,0,0.08)` | `0 1px 3px rgba(0,0,0,0.06)` inline | CLOSE | 0.08 vs 0.06 opacity |
| Card radius | `rounded-xl` = 12px | `rounded-xl` ✅ | YES | — |
| Sidebar background | `#141A24` (`bg-navy`) | `bg-[#141A24]` ✅ | YES | — |
| Sidebar active item | `bg-[#28303F]` (`bg-navy3`) | `bg-[#28303F]` ✅ | YES | — |
| Sidebar hover item | `bg-[#1E2532]` (`bg-navy2`) | `bg-[#1E2532]` ✅ | YES | — |
| Sidebar text | `text-white/70` | `text-white/70` ✅ | YES | — |
| Body text primary | `#0F1020` (body default) + `#141A24` (text-ink) | `#141A24` (ink) | CLOSE | `#0F1020` vs `#141A24` subtle difference; no action needed |
| Text secondary (mute) | `#6B6A60` | `#6B6A60` ✅ | YES | — |
| Success/green | `#1F7A4D` (ok), `#E4F1E8` (oksoft) | `#1F7A4D` / `bg-green-*` Tailwind | PARTIAL | Status badges use Tailwind semantics, not exact hex |
| Warning/amber | `#9A6B0E` (warn), `#FBF0D6` (warnsoft) | `bg-amber-*` Tailwind | **NO** | All warning badges |
| Error/red | `#A0312A` (danger), `#F7E2DF` (dangersoft) | `bg-red-*` Tailwind | **NO** | All error/danger badges |
| Info/blue | `#1E508C` (info), `#E1ECF7` (infosoft) | `bg-blue-*` Tailwind | **NO** | All info badges |
| Teal (complete) | `#0E6E6A` (teal), `#DCEFEC` (tealsoft) | `bg-teal-*` Tailwind | **NO** | Completed stage badges |
| Neutral badge | `bg-[#F1EFE7] text-[#3a3a3a] ring-[#E2E0D6]` | `bg-[#ECEAE2] text-[#6B7280]` | **NO** | Neutral/default badges |
| Primary button bg | `#141A24` (dark ink — Option A) | `#B8860B` (gold!) in `.btn-primary` | **NO** | `index.css .btn-primary` — CRITICAL |
| Primary button hover | `#0B1019` | `#9A7009` | **NO** | `index.css .btn-primary:hover` |
| Line2 (secondary border) | `#E2E0D6` | Not defined | MISSING | Add to tokens |

### Typography

| Token | Design | Current | Match? |
|-------|--------|---------|--------|
| Arabic font | Tajawal (400, 500, 700, 800) | Tajawal (300, 400, 500, 700) | CLOSE — weight 800 missing |
| English/numbers font | DM Sans (400, 500, 600, 700) | DM Sans (400, 500, 600, 700) ✅ | YES |
| Monospace font | JetBrains Mono (400, 500) | **MISSING — not imported** | **NO** |
| Eyebrow class | DM Sans, 10.5px, tracking .14em, uppercase, `#6B6A60`, weight 600 | Same ✅ | YES |
| `.num` class | DM Sans, `tnum` + `lnum` features | Same ✅ | YES |
| `.mono` class | JetBrains Mono | Not defined — `font-mono` Tailwind fallback | **NO** |
| H1 size | 26px, font-extrabold | Varies (24px–30px inline) | PARTIAL |
| Body size | 13px–14px | 13px–14px ✅ | YES |
| Small/caption | 10.5px–12px | 10.5px–12px ✅ | YES |

### Spacing

| Token | Design | Current | Match? |
|-------|--------|---------|--------|
| Card padding (padded) | `p-5` = 20px | `p-5` or `p-4` varies | PARTIAL |
| Section gap | `gap-5` or `gap-6` | `gap-4` to `gap-6` | CLOSE |
| Page horizontal margin | `px-8` = 32px | `px-4` to `px-8` varies | PARTIAL |
| Table cell padding | `px-5 py-3.5` (data) / `px-5 py-2.5` (head) | `px-5 py-3` | CLOSE |
| Max page width | `max-w-[1400px] mx-auto` | `max-w-7xl` (1280px) | **NO** — 120px narrower |

---

## 3. Sidebar — Line by Line Comparison

| Element | Design (final from chat) | Current Code (AdminLayout.tsx) | Match? | Change needed | Risk |
|---------|--------------------------|-------------------------------|--------|---------------|------|
| Logo area | `<img>` logo + "Wathbat" bold + "wathbat.sa" dim | Same ✅ (line 134–146) | YES | — | LOW |
| Search bar | `bg-[#1E2532]` rounded-lg, `ring-1 ring-white/5` | `bg-white/[0.07] border border-white/10 rounded-xl` | CLOSE | Color differs slightly | LOW |
| **Section: الإدارة** | **Collapsible section header** containing لوحة التحكم + طلبات الصيانة | **Does NOT exist as section** | **NO** | Add الإدارة as collapsible parent | MEDIUM |
| Nav: لوحة التحكم | Under الإدارة section | **Standalone first item** (no section) | **NO** | Move inside الإدارة section | MEDIUM |
| Nav: طلبات الصيانة | Under الإدارة section | **Standalone SECOND item** (prominent, no section) | **NO** | Move inside الإدارة section | MEDIUM |
| Section: نظام التصنيع | Collapsible, `t('erp_section_label')` | Collapsible, same label ✅ | YES | — | — |
| Nav: العملاء | Under نظام التصنيع | Under manufacturing section ✅ (`/erp/leads`) | YES | — | — |
| Nav: المشاريع | Under نظام التصنيع | Under manufacturing section ✅ (`/erp/projects`) | YES | — | — |
| Nav: المدفوعات | Under نظام التصنيع | Under manufacturing section ✅ (`/erp/payments`) | YES | — | — |
| Nav: الموردين | Under نظام التصنيع | Under manufacturing section ✅ (`/erp/vendors`) | YES | — | — |
| Nav: الإعدادات | Under نظام التصنيع | Under manufacturing section ✅ (`/erp/settings`) | YES | — | — |
| **Section name: نظام المستندات** | "نظام المستندات" | `t('qr_section_label')` → likely "نظام QR" | **NO** | Update i18n key `qr_section_label` | LOW |
| Nav: رفع ملف QR | Under نظام المستندات | Under QR section ✅ (`/qr/upload`) | YES | — | — |
| Nav: أرشيف المستندات | Under نظام المستندات | `archive_title` → under QR section ✅ | YES | — | — |
| Nav: المستخدمون | Under نظام المستندات | Under QR section ✅ | YES | — | — |
| Nav: القوائم المنسدلة | Under نظام المستندات | `dropdown_editor_title` → under QR section ✅ | YES | — | — |
| Language toggle | "English" text + globe icon | Language toggle ✅ (line 344) | YES | — | — |
| User row | Avatar `bg-white/10 ring-1 ring-white/15` + username + role + logout | Avatar `bg-[#B8860B]/20 border border-[#B8860B]/30 text-[#B8860B]` | **NO** | Remove gold from avatar | LOW |
| Active item style | `bg-[#28303F] text-white` | `bg-[#28303F] text-white` ✅ | YES | — | — |
| Hover item style | `hover:text-white hover:bg-[#1E2532]` | Same ✅ | YES | — | — |
| Section header style | `text-[10.5px] tracking-[.14em] text-white/40 font-bold` | Same ✅ | YES | — | — |
| Collapse/expand behavior | Chevron, `open/close` state, space-y-0.5 items | Same (uses localStorage persist) ✅ | YES | — | — |
| Width | `w-[260px]` | `w-[260px]` ✅ | YES | — | — |
| Overdue badges | Not in design | Exists in current (red pill count) | N/A | Keep — it's a useful addition | — |
| Sidebar position (RTL) | Right side (first flex child in RTL parent) | Left-side visually due to `flex` without RTL override? | VERIFY | Confirm RTL order renders sidebar on right | MEDIUM |

---

## 4. Dashboard (Admin.tsx) — Component by Component

| Component | Design | Current Code | Match? | Change needed | Backend data exists? | Risk |
|-----------|--------|-------------|--------|---------------|---------------------|------|
| Page header bg | `bg-white border-b border-[#ECEAE2]` | Check current `<header>` in Admin.tsx | VERIFY | Change to `bg-white` if currently `bg-[#FAFAF7]` | — | LOW |
| Header eyebrow | `DASHBOARD · 2026 · Q2` | Unknown | VERIFY | Add eyebrow with quarter label | — | LOW |
| Header h1 | `text-[26px] font-extrabold` "لوحة التحكم — وثبة للألمنيوم" | Unknown | VERIFY | Match size/weight | — | LOW |
| Header subtitle | Last sync time + "النظام يعمل" green dot | Exists (sync indicator) | PARTIAL | Add system status dot | — | LOW |
| Quick action buttons | "بحث سريع", "تقرير اليوم", "مشروع جديد" | Unknown | VERIFY | Add buttons if missing | — | LOW |
| **KPI Card 1** | Active Projects — `34 مشروع` + ok sparkline | Exists with sparkline | YES | Verify metric is active count | Yes (ERP) | — |
| **KPI Card 2** | Revenue MTD — `2.84 مليون ر.س` + ok sparkline | Exists | YES | Verify real data | Partial (payments sum) | — |
| **KPI Card 3** | Outstanding — `687 ألف ر.س` + ok sparkline (declining good) | Exists | YES | Verify real data | Partial (payments sum) | — |
| **KPI Card 4** | QR Codes Issued — `1,248 رمز` + QR icon | Exists | YES | Verify metric | Yes (processed_docs) | — |
| KPI card layout | eyebrow(en) + Arabic label + large `.num` + sparkline top-right | Compare exact layout | VERIFY | Match font sizes/weights | — | LOW |
| **KPI sparklines** | SVG path lines with color-coded tone (ok/danger/mute) | Exists in current | YES | Verify SVG rendering matches design | Hardcoded points | LOW |
| **Stage Funnel** | 15-bar horizontal bars, bar width = count/max, canonical stage names | Exists with 15 stages | YES | Verify canonical stage labels match | Yes (count by stage) | LOW |
| **Recent Projects table** | Customer + project name sub-line + code, stage pill, value, time, arrow | Exists | PARTIAL | Column order: Customer first (rightmost RTL) | Yes (ERP projects) | LOW |
| Recent Projects stage pills | `ring-1 ring-inset` colored pills with stage number + label | Uses Tailwind semantic colors | **NO** | Replace with design hex colors + ring pattern | — | MEDIUM |
| **Cashflow widget** | Collected vs Outstanding progress bar + 2-col breakdown (محصّل/معلّق) | **MISSING from current** | **NO** | Add CashflowSnapshot component | Partial (payment_milestones) | MEDIUM |
| **Activity Feed** | User + action verb + target + meta + timestamp, icon circle | Exists in current | YES | Compare exact structure | Partial (may be static) | LOW |
| **Maintenance Requests** | Table with ID, client, phone, site, message, date, status badge | Exists in current | YES | Compare columns | Yes (admin requests) | LOW |
| **AttentionList** | 4 items: overdue payment, pending signature, pending QR, scheduled delivery | "Needs attention" exists | YES | Verify structure matches | Partial | LOW |
| Document archive preview | 4 recent documents | **Removed in design** | N/A | Consider removing from dashboard (design intentionally dropped it) | — | LOW |
| Max content width | `max-w-[1400px]` | `max-w-7xl` (1280px) | **NO** | Change to `max-w-[1400px]` | — | LOW |
| Layout grid | `grid-cols-12`, left col-8 (projects+maintenance), right col-4 (funnel+cashflow+attention) | 12-col grid exists | PARTIAL | Verify column ratios | — | LOW |

---

## 5. Project Detail (ProjectDetail.tsx)

### 5a. Project Header (always visible)

| Component | Design | Current Code | Match? | Change needed | Risk |
|-----------|--------|-------------|--------|---------------|------|
| Header wrapper | `bg-white rounded-xl shadow-card ring-1 ring-[#ECEAE2]` | Likely `bg-[#FAFAF7]` | VERIFY | Change to `bg-white` if needed | LOW |
| Breadcrumb | المشاريع > قيد الدراسة > PRJ-YYYY-XXXX | Exists | PARTIAL | Verify structure | LOW |
| Project title size | `text-[26px] font-extrabold` | Verify | VERIFY | Match size | LOW |
| Stage badge in title | `Badge tone="info" dot` with stage name | Exists | PARTIAL | Verify badge uses design hex | LOW |
| Customer info meta | phone + location + product type + "عرض العميل المحتمل" link | Exists | PARTIAL | Verify "عرض العميل المحتمل" label (not "Lead") | LOW |
| Right stats | Estimated Value + Days Open + edit/delete buttons | Exists | PARTIAL | Verify stat layout | LOW |
| **15-stage progress bar** | 15 segments, done=dark fill, current=half-fill, labels at 4 points | **VERIFY** — may not have segment bar | VERIFY | Add visual segment progress if missing | MEDIUM |
| Stage bar direction | Fills right-to-left in RTL (stage 1 on right) | **VERIFY** | VERIFY | RTL direction must be correct | MEDIUM |

### 5b. Tab Navigation

| Tab | Design | Current Code | Match? | Change needed | Risk |
|-----|--------|-------------|--------|---------------|------|
| Overview (نظرة عامة) | Tab with info icon | VERIFY exists | VERIFY | — | — |
| Files (الملفات) | Tab with folder icon, badge "6/9" | Exists | YES | Verify badge format | LOW |
| Payments (المدفوعات) | Tab with card icon, badge "2/4" | Exists | YES | Verify badge format | LOW |
| Procurement (المشتريات) | Tab with cart icon, badge "3" | Exists | YES | — | LOW |
| Production (التصنيع) | Tab with factory icon, no badge | Exists | YES | — | LOW |
| Contract (العقد) | Tab with doc icon, no badge | **Currently separate page** (ContractPage.tsx) | **NO** | Add as tab OR keep as link | HIGH |
| Timeline (المراحل) | Tab with clock icon, no badge | VERIFY exists | VERIFY | — | — |
| Tab bar style | `bg-white rounded-xl shadow-card ring-1 ring-[#ECEAE2] px-2` | VERIFY current tab bar bg | VERIFY | Match white bg | LOW |
| Active tab | `text-ink font-semibold tab-active` with bottom underline via `::after` | VERIFY | VERIFY | Add `tab-active` CSS class | LOW |
| Badge in tab | `bg-goldsoft text-[#7A5A07]` when active, `bg-[#F1EFE7] text-mute` when inactive | VERIFY | VERIFY | Colors need updating to ink-based | LOW |

### 5c. Tab: Files

| Component | Design | Current Code | Match? | Risk |
|-----------|--------|-------------|--------|------|
| **Smart Upload panel** | Batch upload with AI detection table (filename / detected type / destination / confidence % / accept-change buttons) | **Batch select exists** — detection panel exists | PARTIAL | LOW |
| Smart upload drag zone | Dot-grid bg, `stripes-gold` inner, dashed ring | Exists but simpler | PARTIAL | LOW |
| Single file slots (6 named) | 2-col grid of FileSlot cards: icon + name + filename + date + status badge + action buttons | Exists | PARTIAL | LOW |
| Glass Order dual display | Original PDF preview + QR Enhanced preview, side by side | Exists | YES | — |
| Empty slot state | "لم يتم الرفع بعد" + dark "رفع ملف" button | Exists | YES | — |
| Filled slot actions | Preview + Download + Replace buttons | Exists | PARTIAL | LOW |
| Multi-file buckets | Expandable Vendor Orders / Qoyod Files / Other buckets | Exists | YES | — |
| **Files checklist sidebar** | Right rail: large "6/9" counter + progress bar + checklist with ok/pending dots | VERIFY exact layout | VERIFY | LOW |
| Quick actions sidebar | Download ZIP / Generate QR / Sync Qoyod buttons | VERIFY | VERIFY | LOW |

### 5d. Tab: Payments

| Component | Design | Current Code | Match? | Risk |
|-----------|--------|-------------|--------|------|
| Summary stats row | 4-col divide: Total / Collected / Due Now / Outstanding — all as Stat components | VERIFY exists | VERIFY | LOW |
| Progress bar | `linear-gradient(90deg, #141A24, #28303F)` fill | Exists | YES | LOW |
| Milestone cards | Padded cards with sequential number, milestone name, status badge, pct, date, method, progress bar, action row | Exists | PARTIAL | LOW |
| Milestone action row | `bg-[#FBFAF4]` footer with buttons per status | VERIFY | VERIFY | LOW |
| Right rail: Qoyod sync | Status + sync button | VERIFY | VERIFY | LOW |
| Right rail: Collection schedule | Timeline with dots and dates | VERIFY | VERIFY | LOW |

### 5e. Tabs: Procurement, Production, Timeline, Contract

> These tabs exist in current code. The design adds specific sub-components that need verification:

| Tab | Design addition to verify |
|-----|--------------------------|
| Procurement | PO line item expandable table (item / unit / qty-requested / qty-received / price / total) |
| Production | Manufacturing order with workshop progress bars (قص/تجميع/تركيب/فحص) + 4-step delivery phase flow indicator |
| Timeline | 5×3 grid of 15 stages with connecting lines, loop badge (stages 2-3-4), parallel badge (stages 7-8), animated pulse on current stage |
| Contract | Integrity check sidebar (7 checks with ok/warn/danger), contract preview iframe, version history |

---

## 6. Projects Page (Projects.tsx)

| Element | Design | Current Code | Match? | Change needed | Risk |
|---------|--------|-------------|--------|---------------|------|
| **Layout** | **Table with rows** | **Card grid** (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3`) | **NO** | Replace card grid with table | HIGH |
| Page header | `bg-white border-b` with breadcrumb + h1 + count summary | VERIFY current header | VERIFY | Match white bg | LOW |
| Filter tabs | Pill tabs: الكل/نشط/في الانتظار/مغلق/متأخر with counts | Stage filter tabs exist | PARTIAL | Add الكل/نشط/مغلق/متأخر tabs | MEDIUM |
| Search input | `ring-1 ring-line rounded-lg h-9 pr-9 w-72` with search icon | Exists | PARTIAL | Match design width/style | LOW |
| Filter buttons | Stage filter + Period filter + more icon | Exists | PARTIAL | — | LOW |
| Table columns | Project name + code, Client, Stage pill, Progress bar, Value (SAR), Delivery date, Arrow | Card shows subset | **NO** | New columns: progress bar, delivery date, project code | HIGH |
| Stage pills | ring-1 ring-inset with stage number + label | Tailwind semantics | **NO** | Replace with design hex | MEDIUM |
| Mini progress bar | `w-20 h-1.5` bar with % label | Not in current cards | MISSING | Add to table rows | MEDIUM |
| Overdue row indicator | `Badge tone="danger" dot` badge | VERIFY | VERIFY | — | LOW |
| VIP badge | `Badge tone="warn"` | Exists | YES | — | — |
| Pagination | Pager with prev/next + page numbers | VERIFY — current might use "show more" | VERIFY | Add pagination component | MEDIUM |
| Project code (WT-YYYY-XXXX) | Shown in sub-line | VERIFY if projects have codes | **VERIFY** | May need new DB column | HIGH |

---

## 7. New i18n Keys Required

| Key | Arabic | English | Used where |
|-----|--------|---------|-----------|
| `qr_section_label` (UPDATE) | نظام المستندات | Document System | Sidebar section header |
| `dashboard_eyebrow` | لوحة التحكم | DASHBOARD | Dashboard page header |
| `cashflow_title` | التدفق النقدي | Cashflow | Dashboard cashflow widget |
| `cashflow_collected` | محصّل | Collected | Cashflow widget |
| `cashflow_outstanding_label` | معلّق | Pending | Cashflow widget |
| `cashflow_status_ok` | سليم | Healthy | Cashflow badge |
| `stage_funnel_title` | توزيع المراحل | Stage Distribution | Dashboard funnel |
| `attention_title` | يحتاج متابعة | Needs Attention | Dashboard attention list |
| `activity_title` | سجل النشاط | Activity Log | Dashboard feed |
| `erp_section_label` (VERIFY) | نظام التصنيع | Manufacturing System | Sidebar section |
| `tab_overview` | نظرة عامة | Overview | ProjectDetail tab |
| `tab_files` | الملفات | Files | ProjectDetail tab |
| `tab_payments` | المدفوعات | Payments | ProjectDetail tab |
| `tab_procurement` | المشتريات | Procurement | ProjectDetail tab |
| `tab_production` | التصنيع | Production | ProjectDetail tab |
| `tab_contract` | العقد | Contract | ProjectDetail tab |
| `tab_timeline` | المراحل | Timeline | ProjectDetail tab |
| `smart_upload_title` | رفع ذكي للملفات | Smart Upload | Files tab |
| `smart_upload_detect_title` | نتائج التصنيف التلقائي | Auto-detection Results | Files tab |
| `smart_upload_confirm_all` | تأكيد الكل | Confirm All | Files tab |
| `smart_upload_accept` | قبول | Accept | Files tab detection row |
| `smart_upload_change` | تغيير | Change | Files tab detection row |
| `files_required_title` | الملفات الأساسية | Required Files | Files tab section |
| `files_bucket_title` | حافظات متعددة الملفات | Multi-file Buckets | Files tab section |
| `files_checklist_title` | قائمة الملفات المطلوبة | Expected Files | Files tab right rail |
| `files_quick_actions` | إجراءات سريعة | Quick Actions | Files tab right rail |
| `mo_title` | أمر التصنيع | Manufacturing Order | Production tab |
| `workshop_progress` | تقدم الورشة | Workshop Progress | Production tab |
| `delivery_phases_title` | مراحل التسليم | Delivery Phases | Production tab |
| `timeline_lifecycle_title` | دورة حياة المشروع — 15 مرحلة | Project Lifecycle | Timeline tab |
| `contract_preview_title` | معاينة العقد | Contract Preview | Contract tab |
| `contract_integrity_title` | فحص التكامل | Integrity Check | Contract tab |
| `contract_clauses_title` | بنود قابلة للتعديل | Editable Clauses | Contract tab |
| `contract_versions_title` | سجلّ الإصدارات | Versions | Contract tab |
| `projects_table_delivery` | التسليم | Delivery | Projects table column |
| `projects_table_progress` | التقدم | Progress | Projects table column |
| `projects_table_code` | الرقم | Code | Projects table sub-line |
| `stage_01` through `stage_15` | 15 canonical stage names (see below) | English equivalents | Stage funnel, progress bar |

**Canonical 15 stage names (Arabic):**
01 عميل محتمل · 02 اتصال أولي · 03 زيارة الموقع · 04 استفسار · 05 عرض السعر · 06 توقيع العقد · 07 أوامر الشراء · 08 التصنيع · 09 ضبط الجودة · 10 الشحن · 11 تسليم الموقع · 12 التركيب · 13 تسلّم العميل · 14 تسوية مالية · 15 ضمان وصيانة

---

## 8. New Backend Endpoints Required

| Design element | Data needed | Current endpoint | Sufficient? | New endpoint needed |
|---------------|-------------|-----------------|-------------|-------------------|
| KPI sparklines (trend) | Historical count per day/week (last 10 points) | None | **No** | `GET /api/erp/stats/trend` → `{ activeProjects: [n,...], revenueMtd: [n,...], outstanding: [n,...] }` |
| Stage funnel | Count of active projects per stage (1–15) | Unknown — check `/api/erp/stats` | Verify | Possibly `GET /api/erp/stats/stage-funnel` |
| Cashflow MTD | Sum of paid milestones (collected) + unpaid due (outstanding) | Partial via payments list | **No** | `GET /api/erp/stats/cashflow` → `{ collected, outstanding }` |
| Activity feed | Last N system actions (who, what, target, time) — audit log | Partial (may be constructed from multiple queries) | **No** | `GET /api/erp/activity?limit=20` — needs audit_log table or join across payment+project+file events |
| AttentionList | Overdue payments + pending signatures + stuck-stage items | `GET /api/erp/leads/overdue-count` + `/api/erp/payments/overdue-count` | PARTIAL | `GET /api/erp/attention-items` aggregated list |
| Project codes (WT-YYYY-XXXX) | Auto-generated code per project | Unknown — check projects table | **Verify** | May need `code` column in `erp_projects` + generation logic |
| Contract integrity check | Validate 7 contract fields completeness | None | **No** | `GET /api/erp/projects/:id/contract-check` |
| Production KPIs | On-time %, defects %, workshop load % | None | **No** | `GET /api/erp/stats/production` |
| Procurement summary | Total POs value, received value | Partial via PO list | PARTIAL | `GET /api/erp/projects/:id/procurement-summary` |

---

## 9. CSS Class Conflicts

All violations found in current ERP `.tsx` files — classes that conflict with the design token system:

| Class found | File(s) | Design equivalent | Action |
|------------|---------|-------------------|--------|
| `bg-white` (in ERP cards) | Many ERP pages | Design ALSO uses `bg-white` for cards | KEEP — design alignment! |
| `bg-white` (page header) | Admin.tsx DashHeader, Projects header | `bg-white border-b border-line` | KEEP — this IS the design |
| `bg-[#FAFAF7]` (in cards) | All ERP pages via `.dash-card` | Should be `bg-white` per design | **REPLACE** in `.dash-card` CSS class |
| `bg-blue-100 text-blue-700` | Leads.tsx, Projects.tsx status badges | `bg-infosoft text-info` = `bg-[#E1ECF7] text-[#1E508C]` | **Replace** — low risk |
| `bg-amber-100 text-amber-700` | Multiple files | `bg-warnsoft text-warn` = `bg-[#FBF0D6] text-[#9A6B0E]` | **Replace** |
| `bg-teal-100 text-teal-700` | Leads.tsx (converted) | `bg-tealsoft text-teal` = `bg-[#DCEFEC] text-[#0E6E6A]` | **Replace** |
| `bg-red-100 text-red-700` | Multiple files | `bg-dangersoft text-danger` = `bg-[#F7E2DF] text-[#A0312A]` | **Replace** |
| `bg-slate-200 animate-pulse` (.skeleton) | `index.css` | `bg-[#ECEAE2]` (design line color) | **Replace** in index.css |
| `.btn-primary { background: #B8860B }` | `index.css` | `#141A24` (Option A chosen in design) | **CRITICAL — Replace** |
| `.btn-primary:hover { background: #9A7009 }` | `index.css` | `#0B1019` | **Replace** |
| `bg-[#B8860B]/20 border-[#B8860B]/30 text-[#B8860B]` | AdminLayout.tsx user avatar (line 362) | `bg-white/10 ring-1 ring-white/15 text-white` | **Replace** |
| `max-w-7xl` (1280px) | Admin.tsx, possibly others | `max-w-[1400px]` (design) | Replace page wrappers |
| `border-gray-200` | Some files | `border-[#ECEAE2]` | Replace if found |
| `text-slate-*`, `text-gray-*` | Multiple files | `text-[#6B6A60]` (mute) or `text-[#141A24]` (ink) | Replace each case |

---

## 10. Breaking Risk Assessment

| Change | Scope | Risk | Why | Mitigation |
|--------|-------|------|-----|-----------|
| `.btn-primary` color: gold → ink | `index.css` | **LOW** | Gold primary button is wrong per design; one line | Test all modal confirm buttons, form submits |
| `.skeleton` color fix | `index.css` | LOW | One line | — |
| JetBrains Mono font import | `index.css` | LOW | Add import only; `.mono` class will work | Test filenames, project codes |
| Card bg: `#FAFAF7` → `bg-white` | `index.css .dash-card` + all inline card classes | **MEDIUM** | Subtle visual change on all pages; no functional impact | Compare before/after in staging |
| Status badge hex colors | All ERP page files | MEDIUM | Many files, small per-file change | Script grep-replace; test all status states |
| `qr_section_label` i18n update | `i18n.ts` + AdminLayout.tsx (if label used) | LOW | One string key | Check both AR/EN |
| Sidebar: Add الإدارة section | `AdminLayout.tsx` | **MEDIUM** | Restructures first two nav items; role-based visibility preserved | Test all 5 role views; test dashboard active state |
| Service Requests placement | `AdminLayout.tsx` | MEDIUM | Moving from standalone → under section changes discoverability | Announce to users |
| User avatar: gold → white | `AdminLayout.tsx` line 362 | LOW | One div, no function change | — |
| Max width: 1280px → 1400px | Multiple page wrappers | LOW | Wider layout on large screens; no mobile impact | Test on 1280px screen |
| **Projects page: cards → table** | `Projects.tsx` (417 lines) | **HIGH** | Complete layout replacement; must preserve all filters, create modal, role guards | Build alongside current; toggle with flag |
| **Project codes column** | `erp_projects` DB + API + frontend | **HIGH** | New DB column needed; migration required; display in multiple places | Run migration first; add as nullable |
| Activity feed backend endpoint | `api/erp/activity` | MEDIUM | New DB reads; audit log may not exist | Implement as join query first; no new tables needed |
| Cashflow endpoint | `api/erp/stats/cashflow` | LOW | Aggregate of existing payment_milestones data | — |
| Stage funnel endpoint | `api/erp/stats/stage-funnel` | LOW | Count query on erp_projects by stage | — |
| KPI sparkline endpoint | `api/erp/stats/trend` | MEDIUM | Requires historical snapshots or date-range queries | Implement as rolling count query |
| Contract tab in ProjectDetail | Restructure ContractPage.tsx as tab | **HIGH** | ContractPage.tsx is a separate route used for printing; merging into tab needs careful routing | Keep as separate route; add tab that links to it OR embed print-safe version |
| 15-segment progress bar in header | `erp/ProjectDetail.tsx` header section | MEDIUM | Pure UI addition; no data change | Add after other changes |
| Tab: Timeline (5×3 grid) | `erp/ProjectDetail.tsx` | MEDIUM | New sub-component; no backend change needed (uses existing stage data) | Build as isolated component |

---

## 11. Implementation Order (Safest First)

| Order | What | Files | Risk | Commit message |
|-------|------|-------|------|---------------|
| 1 | Fix `.btn-primary` gold → ink in CSS | `index.css` | LOW | `fix: update primary button to ink color per design (removes gold)` |
| 2 | Fix `.skeleton` palette + add JetBrains Mono import | `index.css` | LOW | `fix: add JetBrains Mono font, fix skeleton color to palette` |
| 3 | Fix sidebar user avatar: remove gold, use white/10 | `AdminLayout.tsx` line 362 | LOW | `fix: sidebar user avatar uses palette white instead of gold` |
| 4 | Update `qr_section_label` i18n key to "نظام المستندات" / "Document System" | `i18n.ts` | LOW | `fix: rename QR sidebar section to Document System per design` |
| 5 | Replace Tailwind semantic status badge colors with design hex values | All ERP pages | MEDIUM | `fix: align status badge colors to design token hex values` |
| 6 | Fix card background: `.dash-card` `#FAFAF7` → `#FFFFFF` | `index.css` | MEDIUM | `fix: card background white per design (removes cream tint)` |
| 7 | Update max-width wrappers 1280px → 1400px | `Admin.tsx` + other pages | LOW | `fix: widen page max-width to 1400px per design` |
| 8 | Sidebar restructure: add الإدارة section, move Dashboard + Service Requests under it | `AdminLayout.tsx` | MEDIUM | `feat: restructure sidebar with الإدارة parent section per design` |
| 9 | Add Cashflow endpoint + widget to dashboard | `api-server/routes/erp.ts` + `Admin.tsx` | MEDIUM | `feat: add cashflow MTD snapshot to dashboard` |
| 10 | Add Stage Funnel backend endpoint (if missing) + verify dashboard widget | `erp.ts` + `Admin.tsx` | MEDIUM | `fix: wire stage funnel to live data` |
| 11 | Add Activity Feed backend endpoint | `erp.ts` + `Admin.tsx` | MEDIUM | `feat: add activity feed endpoint and wire to dashboard` |
| 12 | 15-segment progress bar in ProjectDetail header | `erp/ProjectDetail.tsx` | MEDIUM | `feat: add 15-stage visual progress bar to project header` |
| 13 | Tab navigation redesign: ensure all 7 tabs + correct active style | `erp/ProjectDetail.tsx` | MEDIUM | `feat: implement 7-tab design with correct active styling` |
| 14 | Timeline tab: 5×3 stage grid with loop/parallel badges | `erp/ProjectDetail.tsx` | MEDIUM | `feat: timeline tab 5x3 grid with stage annotations` |
| 15 | Contract tab: embed contract preview inside project detail | `erp/ProjectDetail.tsx` + `erp/ContractPage.tsx` | HIGH | `feat: add contract preview tab in project detail` |
| 16 | ✅ DB migration: add `code` column to `erp_projects` + backend generation | `db/schema.ts` + `erp.ts` | HIGH | `feat: add project code (WT-YYYY-XXXX) to projects` |
| 17 | Projects page: replace card grid with table layout | `erp/Projects.tsx` | HIGH | `feat: projects list redesign as sortable table per design` |
| 18 | KPI sparklines: add trend endpoint + wire to live data | `erp.ts` + `Admin.tsx` | MEDIUM | `feat: KPI sparklines wired to live trend data` |

---

## 12. Rollback Points

| After step | Rollback to | Command |
|-----------|-------------|---------|
| 1–4 (CSS/i18n only) | `v3.3.0` | `git checkout v3.3.0` |
| 5–8 (badge colors + sidebar) | Step 4 commit | `git revert HEAD` (single commit) |
| 9–11 (backend + dashboard) | Step 8 commit | `git revert HEAD~2..HEAD` |
| 12–14 (ProjectDetail UI) | Step 11 commit | `git revert HEAD~2..HEAD` |
| 15 (Contract tab) | Step 14 commit | `git revert HEAD` |
| 16 (DB migration) | **No easy revert — use DB backup** | `git revert HEAD` + manual `ALTER TABLE erp_projects DROP COLUMN code` |
| 17 (Projects table) | Step 16 commit | `git revert HEAD` |
| 18 (Sparklines) | Step 17 commit | `git revert HEAD` |

---

## Appendix A: Design Token Quick Reference

These exact values come from the design files. Use them when implementing.

```
/* Backgrounds */
page-bg:       #F4F2EB
card-bg:       #FFFFFF (bg-white — NOT #FAFAF7)
paper-sub:     #FAFAF7 (table headers, action row footers)
paper-warm:    #FBFAF4 (nested section bg)

/* Borders */
line:          #ECEAE2 (ring-1 ring-[#ECEAE2] or border-[#ECEAE2])
line2:         #E2E0D6 (secondary dividers)

/* Text */
ink:           #141A24 (primary text)
mute:          #6B6A60 (secondary text)
body-default:  #0F1020 (body color — close to ink)

/* Status (use EXACT hex, NOT Tailwind semantic) */
ok:            #1F7A4D  oksoft:    #E4F1E8  ok-ring:    #CFE4D6
warn:          #9A6B0E  warnsoft:  #FBF0D6  warn-ring:  #EEDDB0
danger:        #A0312A  dangersoft:#F7E2DF  danger-ring:#EBC9C5
info:          #1E508C  infosoft:  #E1ECF7  info-ring:  #CFDEEF
teal:          #0E6E6A  tealsoft:  #DCEFEC  teal-ring:  #BFDDD9
neutral:       #3a3a3a  neutral-bg:#F1EFE7  neutral-ring:#E2E0D6

/* Sidebar */
sidebar-bg:    #141A24
sidebar-active:#28303F
sidebar-hover: #1E2532

/* Buttons (dark ink, NOT gold) */
btn-primary-bg:#141A24
btn-primary-h: #0B1019
btn-secondary:  bg-white ring-1 ring-[#E2E0D6] hover:bg-[#FBFAF4]
btn-ghost:      hover:bg-[#EFEDE4]

/* Shadows */
shadow-card:   0 1px 3px rgba(0,0,0,0.08)
shadow-card2:  0 1px 2px rgba(15,16,32,0.06), 0 8px 24px -12px rgba(15,16,32,0.12)

/* Typography */
font-ar:       Tajawal (400, 500, 700, 800)
font-en:       DM Sans (400, 500, 600, 700)
font-mono:     JetBrains Mono (400, 500) ← MISSING FROM CURRENT
eyebrow:       DM Sans 10.5px tracking-.14em uppercase #6B6A60 weight-600
num:           DM Sans, tnum, lnum features
```

---

## Appendix B: Design Decisions from Chat Transcript

These decisions were explicitly made in the Claude Design session and must NOT be reversed:

1. **No gold accent** — User chose Option A (logo-faithful). Primary = `#141A24` ink. No `#B8860B` in buttons or primary actions.
2. **Arabic-only sidebar labels** — No bilingual dual labels in sidebar items.
3. **Sidebar on RIGHT** — RTL layout; sidebar is first flex child in RTL parent (renders right in RTL).
4. **طلبات الصيانة under الإدارة** — User chose Option D; maintenance is part of admin section.
5. **نظام المستندات** — Final section name (was: نظام QR).
6. **15 canonical stage names** — Must match across funnel, project header bar, and timeline tab.
7. **"عرض العميل المحتمل"** — Not "عرض الـ Lead" — Arabic only.
8. **Customer-first in Recent Projects** — Customer name as primary, project name as sub-line.
9. **Phone numbers in `dir="ltr" unicodeBidi: isolate`** — Required for correct digit ordering.
10. **Stage progress bar direction** — In RTL: stage 01 on RIGHT, stage 15 on LEFT. Fill moves right-to-left. Do NOT use `flex-row-reverse` with `dir="rtl"` parent (they cancel out).
