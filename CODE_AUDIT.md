# CODE_AUDIT.md — What the code ACTUALLY does (not what we planned)

> Updated: April 25, 2026
> Claude Code: UPDATE this file after every bug fix or feature change.

---

## ProjectDetail.tsx — File Upload

### Current State: WORKING

---

### Upload Flow A — Individual Slot

- **Trigger:** `triggerUpload(fileType)` — line 1071
  - Sets `accept` on `fileInputRef.current` to `.docx` for single-file types; `*/*` for `vendor_order`, `qoyod`, `other` (lines 1073–1075)
  - Sets `setPendingFileType(fileType)` (line 1076)
  - Calls `fileInputRef.current?.click()` (line 1077)
- **File input ref:** `fileInputRef` — line 914, `useRef<HTMLInputElement>(null)`
- **onChange handler:** `handleFileChange` — line 1127
  - Reads `file = e.target.files?.[0]`
  - Calls `uploadFile(file, pendingFileType)` (line 1132)
- **Upload function:** `uploadFile(file, fileType)` — line 1080
- **Endpoint called:** `POST ${API_BASE}/api/erp/projects/${id}/files`
  - Optional query string appended for glass_order/quotation conflict scenarios
- **FormData field names:** `'file'` (the binary) + `'fileType'` (the string type)
- **After success:**
  - `glass_order`: `loadQrOrders()` then `loadProject()`
  - `assembly_list` or `cut_optimisation`: `loadProject()` then `loadParsedData()`
  - All types always: `loadAllFiles()` and `loadExpectedFiles()` at the end
- **After 409:**
  - `price_quotation` / `quotation` type → `setNameMismatch({ nameInFile, nameInSystem, pendingFile, fileType })` → opens `NameMismatchModal`
  - `glass_order` type → `setGlassDetect({ orgadataName, orgadataPerson: null, pendingFile, nameMatches: false })` → opens glass conflict dialog
- **TESTED:** April 2026 — PASS (v3.2.0 deploy)

---

### Upload Flow B — Multi-file Slot

- Uses the **same** `fileInputRef` and `handleFileChange` as Flow A
- `triggerUpload(fileType)` sets `accept='*/*'` for `vendor_order`, `qoyod`, `other`
- Same `uploadFile()` call path — no detection runs
- `pendingFileType` is set to the slot's `fileType` before click — filename is never inspected
- **TESTED:** April 2026 — PASS (v3.2.0 deploy)

---

### Upload Flow C — Batch Select

- **Trigger:** `handleBatchSelect` — line 1179
  - Reads selected files from `batchInputRef`
  - Calls `POST ${API_BASE}/api/erp/projects/${id}/files/detect` (line 1187–1188)
  - FormData field: `'files'` — `files.forEach(f => fd.append('files', f))` (line 1186)
- **Batch input ref:** `batchInputRef` — line 936, `useRef<HTMLInputElement>(null)`
- **Detection:** `file-detector.ts` `detectFileType(filename)` runs server-side; returns `[{ filename, size, detectedType, confidence }]`
- **Summary dialog:** Shows count via `t('files_detect_summary').replace('{count}', ...)`, then for each file: filename, size, `detectedType`, `confidence`, and an editable `assignedType` dropdown
- **Upload:** `handleUploadAll` — line 1212
  - Iterates `detectionItems`; calls `await uploadFile(item.file, item.assignedType)` per file (line 1217)
  - After all done: `setDetectionItems([])` (line 1219) then `loadAllFiles()` (line 1220)
- **TESTED:** April 2026 — PASS (v3.2.0 deploy)

---

### Required Files Checklist

- **Data source:** Derived by comparing `FILE_SLOTS` (lines 156–166) against `allFiles` state + `qrOrders` state
  - `glass_order` slot: present if `fileFor('glass_order') !== null || qrOrders.length > 0`
  - All other slots: present if `fileFor(fileType) !== null`
- **`allFiles` populated by:** `loadAllFiles()` → `GET ${API_BASE}/api/erp/projects/${id}/files`
- **`qrOrders` populated by:** `loadQrOrders()` → `GET ${API_BASE}/api/erp/projects/${id}/qr-orders`
- **Updates when:**
  - Any upload succeeds (Flow A/B/C all call `loadAllFiles()` on success)
  - `glass_order` upload also calls `loadQrOrders()`
  - Any file delete calls `loadProject()` + `loadAllFiles()` + `loadExpectedFiles()`
  - Component mount `useEffect` (line 1247)
- **TESTED:** April 2026 — PASS (v3.2.0 deploy)

---

## AdminLayout.tsx — Sidebar

### Current State: matches design

- **Manufacturing section default state:** `mfgCollapsed` = `useState(false)` → **EXPANDED by default**
  - Persisted to `localStorage` key `'sidebar_mfg_collapsed'`
- **Nav item order (exact):**
  1. Dashboard → `/admin`
  2. Service Requests → `/admin/requests`
  3. **Manufacturing System** (collapsible header)
     - Clients → `/erp/leads` (Admin, FactoryManager, Employee, SalesAgent)
     - Projects → `/erp/projects` (Admin, FactoryManager, Employee)
     - Payments → `/erp/payments` (Admin, Accountant)
     - Vendors → `/erp/vendors` (Admin, FactoryManager, Employee)
     - Settings → `/erp/settings` (Admin only)
  4. **QR / Document System** (collapsible header)
     - Upload → `/qr/upload` (Admin only)
     - Archive → `/admin/history`
     - Users → `/admin/users` (Admin only)
     - Dropdowns → `/admin/dropdowns` (Admin only)
- **Active item CSS:** `bg-[#28303F] text-white` (full class: `flex items-center gap-3 px-3 h-10 rounded-lg text-[13.5px] font-medium transition cursor-pointer group bg-[#28303F] text-white`)
- **Inactive item CSS:** `text-white/70 hover:text-white hover:bg-[#1E2532]`
- **Sidebar background:** `bg-[#141A24]`
- **Main content background:** `bg-[#F4F2EB]`

---

## Pages — Theme Compliance

> Body background comes from AdminLayout's main content div: `bg-[#F4F2EB]` — all pages inherit this.
> Each page is responsible for card/panel styling only.

| Page | Body BG | Card BG | Card Border | Card Shadow | Remnants | Status |
|------|---------|---------|-------------|-------------|----------|--------|
| Admin.tsx | `#F4F2EB` (inherited) | `#FAFAF7` | `#ECEAE2` | `0_1px_3px_rgba(0,0,0,0.08)` | None | ✅ |
| Leads.tsx | `#F4F2EB` (inherited) | `#FAFAF7` | `#ECEAE2` | — | None | ✅ |
| LeadDetail.tsx | `#F4F2EB` (inherited) | `#FAFAF7` | `#ECEAE2` | `0_1px_3px_rgba(0,0,0,0.08)` | None | ✅ |
| Projects.tsx | `#F4F2EB` (inherited) | `#FAFAF7` | `#ECEAE2` | — | None | ✅ |
| ProjectDetail.tsx | `#F4F2EB` (inherited) | `#FAFAF7` | `#ECEAE2` | `0_1px_3px_rgba(0,0,0,0.08)` | None | ✅ |
| Payments.tsx | `#F4F2EB` (inherited) | `#FAFAF7` | `#ECEAE2` | `0_1px_3px_rgba(0,0,0,0.08)` | `slate-300` dashed border on "add milestone" button | ⚠️ |
| Vendors.tsx | `#F4F2EB` (inherited) | `#FAFAF7` | `#ECEAE2` | `0_1px_3px_rgba(0,0,0,0.08)` | `slate-400/500/600` text on action buttons | ⚠️ |
| AdminSettings.tsx | `#F4F2EB` (inherited) | `#FAFAF7` inputs | `#ECEAE2` | — | None | ✅ |
| ContractPage.tsx | `#E8E6DF` (print-only) | `#ffffff` (print) | — | — | Print page — no AdminLayout | ✅ |
| PhaseConfirm.tsx | Custom (public page) | — | — | — | No AdminLayout — intentional | ✅ |

### ⚠️ Minor Remnants (non-breaking)
- **Payments.tsx:** `border-dashed border-slate-300` on "add milestone" button (line 215); `text-slate-400` on close button (line 93)
- **Vendors.tsx:** `text-slate-400`, `text-slate-500`, `text-slate-600` used on secondary action buttons and category badge text

---

## erp.ts — Backend Routes

### Current State: WORKING

- All ERP routes mounted at `/api/erp/` via `routes/erp.ts`
- Public (no auth): `GET /api/erp/options/:category`, `GET /api/erp/phases/:id`, `POST /api/erp/phases/:id/confirm`
- All other ERP routes require `requireAuth` + `requireRole(...)`
- File upload: `multer` middleware, field name `'file'` (single), 50 MB limit, `.docx` + MIME validation for Orgadata slots
- Batch detect: `multer` field name `'files'` (array), no extension restriction

---

## i18n.ts — Translation Coverage

### Current State: WORKING (both AR + EN)

- All user-facing strings defined in `src/lib/i18n.ts`
- Approximately 300+ keys covering all 4 ERP phases
- No known missing keys as of v3.2.0
- Dropdown labels always use `labelAr` / `labelEn` — never raw `value`

---

## Known Issues (as of April 25, 2026)

| # | Location | Issue | Severity | Fix |
|---|----------|-------|----------|-----|
| 1 | Payments.tsx:215 | `border-slate-300` dashed remnant | Low | Replace with `border-[#ECEAE2]` |
| 2 | Vendors.tsx | `text-slate-400/500/600` on action buttons | Low | Replace with `text-[#6B7280]` or theme equivalent |
| 3 | AdminLayout.tsx | Replit plugin always imported in vite.config | Low | Guard with `if (process.env.NODE_ENV !== 'production')` |
| 4 | lib/stats.ts | In-memory counters reset on restart | Medium | Persist to DB in future version |
| 5 | auth.ts | `deleteSession()` is a no-op — JWTs valid 7d after logout | Medium | Add token blocklist (Redis or DB) |
