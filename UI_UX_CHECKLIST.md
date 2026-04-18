# UI_UX_CHECKLIST.md
# قائمة فحص واجهة المستخدم — إلزامي لكل تعديل على الواجهة

> **Purpose:** Claude Code must read this file before modifying any frontend component.
> Covers visual quality, interaction design, and bilingual rendering.

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
