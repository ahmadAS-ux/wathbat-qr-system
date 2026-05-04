# UI_UX_CHECKLIST.md
# قائمة فحص واجهة المستخدم — إلزامي لكل تعديل على الواجهة

> **Purpose:** Claude Code must read this file before modifying any frontend component.
> Covers visual quality, interaction design, and bilingual rendering.

> **Last updated:** v4.0.11 (Stage 6.6 — added File Slot Consistency section)

---

## Visual Quality Checks

### Typography
- [ ] Arabic text uses **Tajawal** font family — never system fonts
- [ ] English text uses **DM Sans** font family
- [ ] Font sizes are readable: minimum 12px for body text, 11px for hints
- [ ] Bold weight used for headings and labels only — not mid-sentence
- [ ] Numbers display correctly in both languages (Arabic numerals ١٢٣ not required — Western 123 is fine)

### Colors & Status Badges
- [ ] Status badges use consistent colors across all pages:
  - **New / جديد** → Gray
  - **In Study / قيد الدراسة** → Blue
  - **In Production / تصنيع** → Amber
  - **Complete / مكتمل** → Teal
  - **Overdue / متأخر** → Red
  - **Lost / غير مهتم** → Gray (muted)
- [ ] Text on colored backgrounds has sufficient contrast (WCAG AA minimum)
- [ ] No pure black (#000) text on colored badges — use the darkest shade from the same color family

### Layout & Spacing
- [ ] No content is cut off or hidden behind other elements
- [ ] No horizontal scrollbar on any page at standard desktop width (1280px+)
- [ ] Cards and tables have consistent padding (16px minimum)
- [ ] Sidebar doesn't overlap main content
- [ ] Modal dialogs are centered and have visible close button

### Empty States
- [ ] Every list/table shows a meaningful empty state message when no data exists:
  - Leads page: "لا يوجد عملاء محتملين — أنشئ عميل جديد" (not a blank page)
  - Projects page: "لا يوجد مشاريع بعد" (not a blank page)
  - Contact log: "لم يتم تسجيل أي تواصل بعد"
- [ ] Empty states show in the current language (Arabic or English)

---

## Interaction Quality Checks

### Loading States
- [ ] Every API call shows a loading indicator (spinner, skeleton, or disabled button)
- [ ] Buttons show loading state while their action is processing — prevent double-click
- [ ] Page transitions show loading state, not a white flash
- [ ] First load after Render cold start (15-60s) shows "connecting..." not a crash screen

### Error Handling
- [ ] Network errors show a user-friendly message in current language — not raw error codes
- [ ] API 401 errors redirect to login page
- [ ] API 403 errors show "ليس لديك صلاحية" (not a blank screen or crash)
- [ ] API 500 errors show "حدث خطأ — حاول مرة أخرى" (not a stack trace)
- [ ] Form submission errors show which field has the problem

### Navigation
- [ ] Browser back button works on every page (no broken history)
- [ ] Clicking a project card navigates to project detail (not a dead link)
- [ ] Clicking a lead navigates to lead detail
- [ ] Sidebar active state highlights the current page
- [ ] Sidebar badge counter updates when data changes (without full page reload)

### Forms
- [ ] Tab key moves between fields in logical order (top-to-bottom, right-to-left in Arabic)
- [ ] Enter key submits the form (or moves to next field)
- [ ] Date picker works and shows dates in correct format
- [ ] Dropdown opens on click and closes when option is selected
- [ ] File upload shows filename after selection, allows removal before submit
- [ ] After successful submission: success feedback (toast or redirect), form resets

### Tables & Lists
- [ ] Tables are sortable by clicking column headers (if applicable)
- [ ] Filter tabs show correct counts (All: 15, New: 8, Follow-up: 5, Overdue: 2)
- [ ] Search/filter results update without full page reload
- [ ] Pagination works if list exceeds page size
- [ ] Status dropdowns in tables update inline (no page reload)

---

## Bilingual Rendering Checks

### Language Switch
- [ ] Language toggle switches ALL text on the page — no mixed languages
- [ ] Language persists after page reload (stored in localStorage)
- [ ] Language preference carries to all pages (set on `document.documentElement`)

### RTL-Specific
- [ ] Flex containers flow right-to-left in Arabic mode
- [ ] Icon positions (chevrons, arrows, close buttons) mirror correctly
- [ ] Progress bars / timelines flow right-to-left in Arabic
- [ ] Breadcrumbs read right-to-left: الرئيسية > المشاريع > تفاصيل المشروع
- [ ] Number inputs and phone fields maintain LTR direction inside RTL context

### Translation Completeness
- [ ] Every new i18n key added in BOTH `en` and `ar` objects in `i18n.ts`
- [ ] Placeholder text in inputs is translated
- [ ] Button labels are translated
- [ ] Validation error messages are translated
- [ ] Toast/notification messages are translated
- [ ] Modal titles and descriptions are translated
- [ ] Table column headers are translated
- [ ] Empty state messages are translated

---

## Mobile Responsiveness (if applicable)

- [ ] Pages are usable on 375px width (iPhone SE)
- [ ] Sidebar collapses to hamburger menu on small screens
- [ ] Tables switch to card view or horizontal scroll on mobile
- [ ] Touch targets are minimum 44x44px
- [ ] Modal dialogs are full-width on mobile, not overflowing

---

## File Slot Consistency (added v4.0.11 — Stage 6.6)

> **Why this section exists:** Live v4.0.10 had four different visual
> treatments for file slots, all doing the same thing. Philosophy
> Rules 10–12 lock the visual contract. This section is the manual
> verification checklist for that contract.

### Component Unification
- [ ] Every file slot on the project detail page renders through the
      shared `<FileSlot>` component — `grep` for ad-hoc upload buttons,
      download icons, or replace handlers outside `<FileSlot>` returns
      zero results
- [ ] No page invents its own upload, download, replace, or delete UI
- [ ] Custom per-type behavior is passed via props (e.g., `fileType`,
      `extractorType`), never re-implemented

### Empty State (every file type)
- [ ] Empty slot shows exactly one centered primary button: `رفع ملف`
- [ ] No upload icon in the corner (the v4.0.10 Treatment A pattern is removed)
- [ ] No dual-button pattern in multi-file buckets (the v4.0.10
      Treatment B pattern is removed)
- [ ] Hint text reads `لم يتم رفع ملف بعد` in Arabic / `No file uploaded
      yet` in English

### Filled State (every file type)
- [ ] Status badge `مرفوع` visible at top-left of card
- [ ] Type icon + uppercase type label visible (e.g., `QUOTATION`,
      `GLASS ORDER`)
- [ ] Filename + upload date displayed below the type label
- [ ] Two preview tiles displayed side-by-side: `EXTRACTED` and
      `ORIGINAL`
- [ ] Three action buttons displayed in this exact RTL order:
      `معاينة` (Preview) → `تنزيل` (Download) → `استبدال` (Replace)
- [ ] Button order, labels, and icons are identical for every file type
      (no Glass exception, no Qoyod exception)

### Action Behavior — All 3 Buttons Operate on the Original
- [ ] Click `معاينة` → opens **Original** in browser viewer (no
      download)
- [ ] Click `تنزيل` → downloads the **Original** file
- [ ] Click `استبدال` → triggers `ReUploadConfirmModal` with Cancel
      as default action; on confirm, re-uploads new Original AND
      regenerates Extracted artifact server-side

### Preview Tile Behavior
- [ ] Click `ORIGINAL` tile → opens Original in browser viewer
      (no download)
- [ ] Click `EXTRACTED` tile → opens Extracted artifact in browser
      viewer (no download)
- [ ] Tile content varies correctly by file type:
  - Glass Order: EXTRACTED tile shows QR code thumbnail
  - Qoyod: EXTRACTED tile shows the same content as ORIGINAL tile
  - Other 7 types: EXTRACTED tile shows header-stripped HTML thumbnail

### Format Enforcement (Rule 11)
- [ ] The 7 non-Glass, non-Qoyod slots accept **only `.docx`** — try
      uploading a `.pdf`, `.doc`, or `.xlsx` to a Quotation slot →
      backend rejects with a clear error message displayed as a toast
- [ ] Glass Order slot accepts PDF/HTML
- [ ] Qoyod slot accepts PDF only
- [ ] Format rejection error message is bilingual

### Multi-file Bucket Behavior (Rule 12)
- [ ] Empty Vendor Orders / Qoyod / Other bucket shows exactly one
      centered `رفع ملف` button — no top pill button, no inner empty-state
      duplicate
- [ ] Filled bucket shows file rows + one `+ إضافة ملف` at the bottom
      of the expanded list
- [ ] Each file row in a filled bucket has the same 3 buttons + 2 tiles
      vocabulary as a single-file slot
- [ ] SmartUpload routing at the top of the Files tab is unchanged and
      still routes filenames to the correct bucket

### Delete Action
- [ ] Delete is Admin-only (the role check is enforced on both frontend
      and backend)
- [ ] Click delete → triggers `DeleteConfirmModal` with Cancel as the
      default action — no file deletes in one click
- [ ] Confirmation modal text: `هل أنت متأكد من حذف هذا الملف؟ لا يمكن
      التراجع عن هذا الإجراء`

### Replace Re-extraction
- [ ] After Replace on a Glass Order slot, the QR-enhanced HTML is
      regenerated from the new file
- [ ] After Replace on a `.docx` slot, the A4 HTML extracted artifact
      is regenerated from the new file
- [ ] After Replace on a Qoyod slot, the extracted copy is updated to
      the new PDF bytes
- [ ] Old Original and old Extracted are kept as previous versions
      (Rule 7)

### Error Surfacing (Lesson 5 — no silent failures)
- [ ] Every upload error surfaces as a toast with a clear message
- [ ] Format rejection errors are visible (not silent 400)
- [ ] Network failures during upload show a retry option
- [ ] Permission failures (403) show `ليس لديك صلاحية` and do not
      silently no-op

---

## Quick Test Flow

After every frontend change, test this flow end-to-end:

1. **Login** → admin/admin123 → should redirect to dashboard
2. **Switch language** to Arabic → all text should change
3. **Navigate to Leads** → sidebar badge visible → leads table loads
4. **Create new lead** → fill all fields → dropdowns show options → submit
5. **Open lead detail** → contact log shows → add a log entry with follow-up date
6. **Navigate to Projects** → cards display with stage badges
7. **Switch language** back to English → everything switches
8. **Logout** → returns to login page → visiting protected URL redirects to login

If any step fails → there's a bug. Fix before committing.

### File Slot test flow (added v4.0.11)

After Stage 6.6 ships, also test:

1. **Open a project detail page** → Files tab → every empty slot shows
   single `رفع ملف` button only
2. **Upload a `.docx` to Quotation slot** → success toast → card flips
   to filled state with 2 tiles + 3 buttons
3. **Click ORIGINAL tile** → opens the .docx in browser viewer
4. **Click EXTRACTED tile** → opens the A4 HTML extract in browser viewer
5. **Click `تنزيل`** → downloads the original .docx
6. **Click `استبدال`** → modal appears with Cancel as default → confirm
   replace → new file uploaded and Extracted regenerated
7. **Try uploading a .pdf to Quotation slot** → rejected with toast error
8. **Upload a Glass Order PDF** → filled state shows QR thumbnail in
   EXTRACTED tile, original in ORIGINAL tile
9. **Upload a Qoyod PDF** → filled state shows identical thumbnails in
   both tiles
10. **Multi-file bucket (Vendor Orders) when empty** → single `رفع ملف`
    button only
11. **Multi-file bucket when filled** → file rows + one `+ إضافة ملف`
    at the bottom

---

## Change Log for This File

- **v4.0.11** — Added "File Slot Consistency" section with verification
  items mapping to Philosophy Rules 10–12. Added File Slot test flow
  to Quick Test section.
