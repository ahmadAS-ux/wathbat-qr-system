# Design Audit — AdminLayout & Sidebar
**File audited:** `artifacts/qr-manager/src/components/layout/AdminLayout.tsx`
**Supporting files:** `artifacts/qr-manager/src/index.css`, `artifacts/qr-manager/src/lib/i18n.ts`
**Date:** 2026-05-06 | **Version:** v4.1.1 | **Auditor:** Claude Code

---

## 1. Summary

AdminLayout is a solid first build — it handles mobile/desktop layouts, bilingual section labels, role-gated nav, collapsible sections, overdue badges, and search in a single file. The dark navy sidebar (`#141A24`) against the warm off-white content area (`#F4F2EB`) creates a good tonal separation and the motion library is used tastefully for the mobile overlay. However, the shell has several issues that prevent it from meeting a production-grade bilingual admin bar. The most critical: the entire English font stack defaults to **Inter instead of DM Sans** (a project rule violation baked into `index.css`); a `SidebarContent` nested function component causes **full sidebar remounting on every poll cycle**, breaking scroll position and focus; the layout root has **no `dir` attribute** despite the CLAUDE.md RTL-first mandate; and the brand accent color (golden amber `#c8962a`) is absent from the sidebar entirely, making it feel generic. RTL correctness is partial — logical Tailwind utilities are used in most places, but the section chevrons and search input both lack `dir`-aware handling.

---

## 2. What's Working

- **Logical padding throughout the sidebar nav** — `ps-8 pe-3`, `ms-auto`, `start-3`, `end-3` are used correctly on search input and badges. (`AdminLayout.tsx:171–178, 273, 302`)
- **Mobile slide direction is RTL-aware** — `initial={{ x: isRtl ? '100%' : '-100%' }}` and `end-0`/`start-0` positioning adapts to reading direction. (`AdminLayout.tsx:444–446`)
- **Close button is RTL-aware** — `${isRtl ? 'start-4' : 'end-4'}` correctly flips. (`AdminLayout.tsx:450`)
- **Section collapse state persists** — all four sections write to `localStorage` on toggle. (`AdminLayout.tsx:108–129`)
- **Overdue count badges** — both leads and payments fetch counts on mount and display red pill badges with `ms-auto shrink-0`. (`AdminLayout.tsx:273–274, 301–305`)
- **Full i18n coverage** — all section labels (`admin_section_label`, `erp_section_label`, `qr_section_label`, `settings_section_label`), role labels, and search placeholder are defined in both `en` and `ar`. (`i18n.ts:158–160, 376–377, 436–440, 456`)
- **Search dropdown uses `bg-[#FAFAF7]` / `#ECEAE2`** — matches the content-area design tokens rather than an off-brand white. (`AdminLayout.tsx:182`)
- **Role permission gates** — `canViewLeads`, `canCreateProject`, `canViewPayments`, `canViewVendors`, `canManageUsers` are used consistently rather than role string comparisons inline. (`AdminLayout.tsx:66–72`)
- **Backdrop blur on mobile overlay** — `backdrop-blur-sm` gives the overlay a professional feel. (`AdminLayout.tsx:439`)
- **Scrollbar hidden on sidebar nav** — `[scrollbar-width:none]` utility applied correctly. (`AdminLayout.tsx:214, 425`)
- **Search result type badge** uses brand-adjacent colors (`#1a3a5c/10`, `amber-50`). (`AdminLayout.tsx:200–202`)

---

## 3. Findings

---

### F-01 · CRITICAL · `index.css:25, 118–122`

**Wrong English font — Inter instead of DM Sans everywhere**

```css
/* index.css:25 */
--font-sans: 'Inter', 'Tajawal', sans-serif;

/* index.css:118–122 */
[dir="rtl"] { font-family: 'Tajawal', sans-serif; }
[dir="ltr"] { font-family: 'Inter', sans-serif; }
```

`CLAUDE.md` is explicit: *"Arabic font: Tajawal | English font: DM Sans"* and *"Never mix Arabic and English fonts"*. The global font fallback chain puts Inter first, and the `[dir="ltr"]` block hard-codes Inter for all English content including the sidebar brand label, nav items, search input, and user card. DM Sans is only applied in isolated utility classes (`.eyebrow`, `.num`).

**Impact:** Every English string in the app — nav labels, version footer, user card — renders in Inter rather than DM Sans. The brand typography rule is violated globally.

**Fix:** Change `--font-sans` to `'DM Sans', 'Tajawal', sans-serif` and replace `font-family: 'Inter', sans-serif` in the `[dir="ltr"]` block with `font-family: 'DM Sans', sans-serif`. Inter can be removed from the Google Fonts import entirely unless it is used anywhere explicitly.

---

### F-02 · CRITICAL · `AdminLayout.tsx:147–420, 427, 455`

**`SidebarContent` is a nested function component — remounts on every poll**

```tsx
// Inside AdminLayout render body:
function SidebarContent() {   // ← declared here, new function ref every render
  return <div className="flex flex-col h-full">...</div>;
}

// Used as a React component:
<SidebarContent />   // lines 427, 455
```

Declaring a component inside another component's render body means React sees a new component type on every render. This causes **full unmount + remount** of the entire sidebar tree every time `AdminLayout` re-renders — which happens every 300ms during search typing, and every time the overdue polling completes. Consequences:
- Sidebar scroll position resets to top
- Search input loses focus mid-typing when a poll fires
- All sidebar DOM state is lost silently

**Fix:** Extract `SidebarContent` to module scope (outside `AdminLayout`), passing required props. Alternatively, replace `<SidebarContent />` with `{sidebarContent}` where `sidebarContent` is a JSX expression (not a component), though the extracted component approach is cleaner.

---

### F-03 · HIGH · `AdminLayout.tsx:423, 425, 446`

**Layout root and both `<aside>` elements have no `dir` attribute**

```tsx
// line 423 — layout root, no dir
<div className="flex min-h-screen bg-[#F4F2EB]">

// line 425 — desktop sidebar, no dir
<aside className="hidden md:flex flex-col w-[260px] ...">

// line 446 — mobile sidebar, no dir
<motion.aside className={`fixed top-0 ${isRtl ? 'end-0' : 'start-0'} ...`}>
```

`CLAUDE.md` rule: *"Arabic containers must use `dir='rtl'`"* and *"The main HTML tag must be `<html dir='rtl' lang='ar'>`"*. Without an explicit `dir` on the layout shell, bidi behaviour depends on whatever the app shell sets. The sidebar's internal text, flex order, and logical properties will only work correctly if the document `dir` is set upstream. This should be explicit at the layout level.

**Fix:** Add `dir={isRtl ? 'rtl' : 'ltr'}` to the outer `<div className="flex min-h-screen">` wrapper. The sidebar `<aside>` elements inherit it automatically.

---

### F-04 · HIGH · `AdminLayout.tsx:108–129` (partial)

**Collapse state inconsistency — only `qrCollapsed` reads from localStorage on init**

```tsx
const [adminCollapsed, setAdminCollapsed] = useState(false);          // ← no localStorage read
const [mfgCollapsed, setMfgCollapsed] = useState(false);              // ← no localStorage read
const [qrCollapsed, setQrCollapsed] = useState(
  () => localStorage.getItem('sidebar_qr_collapsed') === 'true'       // ← reads localStorage ✓
);
const [settingsCollapsed, setSettingsCollapsed] = useState(false);    // ← no localStorage read
```

All four sections write their state to `localStorage` on toggle, but only `qrCollapsed` initialises from it. On page reload: Administration, Manufacturing, and Settings sections always expand, ignoring the user's saved preference. This is a usability regression for power users who collapse sections they don't need.

**Fix:** Add the same lazy initialiser pattern to all four `useState` calls. Use a helper: `const readLS = (key: string) => () => localStorage.getItem(key) === 'true'`.

---

### F-05 · MEDIUM · `AdminLayout.tsx:139–141`

**`navItemStyle` is a dead function — both branches return `{}`**

```tsx
const navItemStyle = (active: boolean): React.CSSProperties =>
  active ? {} : {};
```

This function is called on every nav item (`style={navItemStyle(...)}`) but produces no output in any case. It carries cognitive overhead, implies unfinished work, and adds a pointless function call per render. It was likely scaffolded for inline active-state overrides that ended up in the Tailwind class string instead.

**Fix:** Delete `navItemStyle`, remove all `style={navItemStyle(...)}` props from nav items.

---

### F-06 · MEDIUM · `AdminLayout.tsx:218–249, 329–351`

**Section chevrons don't adapt rotation direction for RTL**

```tsx
<ChevronDown className={`... ${collapsed ? '-rotate-90' : ''}`} />
```

`-rotate-90` rotates the chevron to point **left (◀)** when the section is collapsed. In an RTL interface, a collapsed indicator conventionally points **right (▶)** to match the reading direction. The same `class` is applied regardless of `isRtl`. An Arabic user sees a chevron pointing the wrong direction.

**Fix:** Replace `-rotate-90` with `${isRtl ? 'rotate-90' : '-rotate-90'}` to make the chevron point in the correct direction per locale.

---

### F-07 · MEDIUM · `AdminLayout.tsx:100–106`

**`handleNavClick` does a full page reload for already-active routes**

```tsx
const handleNavClick = (href: string, exact: boolean) => {
  setMobileOpen(false);
  const active = exact ? location === href : location.startsWith(href);
  if (active) {
    window.location.href = href;  // ← full reload in an SPA
  }
};
```

`window.location.href` triggers a full browser navigation: React state tears down, fonts re-download, JWT is re-read from localStorage, the API is re-queried for overdue counts. In a SPA, re-clicking an active nav link should be a no-op or use the client router's navigation.

**Fix:** Replace `window.location.href = href` with `navigate(href)` (already available from `useLocation`). Or simply remove the `if (active)` branch — clicking an already-active route via wouter is already a no-op.

---

### F-08 · MEDIUM · `AdminLayout.tsx:147–420` + design system

**Brand accent color (golden amber `#c8962a`) is unused in the sidebar**

The project design system defines two brand colors: Navy `#1a3a5c` (sidebar background) and Golden Amber `#c8962a` (accent). The sidebar uses neither for active state — the active nav item is a muted dark fill (`bg-[#28303F]`, a slightly lighter navy). There is no accent indicator: no left border stripe, no icon tint, no active dot. The result is a generic "dark sidebar" with no Wathbat brand identity in the navigation.

**Fix:** Add a 2px `border-inline-start` in amber/golden to the active nav item, or tint the active icon to `text-[#c8962a]`. Even a subtle accent line (`border-l-2 border-amber-500`) on the active item would give the sidebar a distinctive branded feel without visual noise.

---

### F-09 · LOW · `AdminLayout.tsx:176–178`

**Search input missing `dir` attribute — LTR assumed by browser**

```tsx
<input
  type="text"
  value={searchQ}
  onChange={...}
  placeholder={t('sidebar_search_placeholder')}
  className="... ps-8 pe-3 ..."
/>
```

The input has no `dir` attribute. Browsers default to LTR for form inputs unless explicitly set. In Arabic mode, the placeholder `"بحث..."` renders correctly (RTL text), but typed characters and cursor position default to LTR behaviour. User types Arabic and the caret moves incorrectly.

**Fix:** Add `dir={isRtl ? 'rtl' : 'ltr'}` to the `<input>` element.

---

### F-10 · LOW · `AdminLayout.tsx:190`

**Search results use conditional `flex-row-reverse` instead of dir-aware flex**

```tsx
<button className={`... ${isRtl ? 'flex-row-reverse' : ''}`}>
```

The CLAUDE.md RTL-first mandate means the default layout should be RTL, not LTR with a conditional flip. `flex-row-reverse` is a visual hack that also affects DOM tab order. The correct approach is to wrap the search dropdown in a `dir` context and let logical flex order follow naturally.

**Fix:** Add `dir={isRtl ? 'rtl' : 'ltr'}` to the search results `<div>` (line 182). Remove the `flex-row-reverse` conditional from each result `<button>`. The `text-start` alignment handles text automatically.

---

### F-11 · LOW · `AdminLayout.tsx:464–476`

**Mobile topbar logo centering uses a non-semantic spacer div**

```tsx
<button onClick={() => setMobileOpen(true)}>...</button>   {/* hamburger, w-9 */}
<Link href="/"><img ... /></Link>                           {/* logo */}
<div className="w-9" />                                    {/* ← visual hack spacer */}
```

The empty `<div className="w-9" />` exists only to optically center the logo between the hamburger and the right edge. This is fragile — if the button size changes, the logo shifts. It also adds a meaningless DOM node.

**Fix:** Use CSS grid on the topbar: `grid grid-cols-3 items-center`. Place the hamburger in col 1, the logo in col 2 (`justify-self-center`), and remove the spacer div.

---

### F-12 · LOW · `AdminLayout.tsx:375–381`

**Language toggle is inside the Settings section — gated by `canViewQRSystem`**

```tsx
{canViewQRSystem(user?.role) && (
  <>
    ...
    <button onClick={() => setLanguage(...)}>
      <Globe />
      <span>{language === 'en' ? 'العربية' : 'English'}</span>
    </button>
  </>
)}
```

The language toggle is a universal UX control — it should be accessible to all roles, not only those who can view the QR/document system. An Accountant (who cannot view QR system and thus never sees Settings) cannot change the UI language. This is a UX access gap.

**Fix:** Move the language toggle outside the role-gated sections — either into the footer area next to the user card, or always-visible at the top of the Settings section with its own visibility check removed.

---

### F-13 · LOW · `AdminLayout.tsx:218, 245, 329, 349`

**Section collapse buttons missing `aria-expanded`**

```tsx
<button onClick={toggleAdmin} className={sectionBtn}>
  <span className="flex-1 text-start">{t('admin_section_label')}</span>
  <ChevronDown ... />
</button>
```

No `aria-expanded` attribute. Screen readers cannot communicate the collapsed/expanded state to assistive technology users. Also: the language toggle button at line 376 has no `aria-label`.

**Fix:** Add `aria-expanded={!adminCollapsed}` (and equivalents for other sections). Add `aria-label={t('toggle_language')}` to the language button.

---

### F-14 · LOW · `AdminLayout.tsx:347–385`

**Users and Dropdown Editor links are visible to non-admin QR users**

```tsx
{canViewQRSystem(user?.role) && (
  <>
    {isAdmin && <Link href="/erp/settings">...</Link>}    {/* ← admin-gated ✓ */}
    <Link href="/admin/users">...</Link>                  {/* ← no role gate */}
    <Link href="/admin/dropdowns">...</Link>              {/* ← no role gate */}
  </>
)}
```

`/admin/users` and `/admin/dropdowns` are admin-only pages but their nav links have no role gate inside the section. Any user who passes `canViewQRSystem` (which includes roles beyond Admin) sees these links and gets a permission-denied error when clicking. This is a UX dead-end.

**Fix:** Wrap both links with `{isAdmin && ...}` guards, matching the pattern already used for the Settings link above them.

---

## 4. Priority Matrix

| ID | Severity | Category | Fix Effort |
|----|----------|----------|------------|
| F-01 | CRITICAL | Font / Brand | Low — 2 CSS lines |
| F-02 | CRITICAL | React architecture | Medium — extract component |
| F-03 | HIGH | RTL / a11y | Low — add `dir` prop |
| F-04 | HIGH | UX / State | Low — 3 useState changes |
| F-05 | MEDIUM | Dead code | Trivial — delete function |
| F-06 | MEDIUM | RTL / Visual | Low — conditional class |
| F-07 | MEDIUM | SPA navigation | Low — one-line change |
| F-08 | MEDIUM | Brand / Design | Low — add accent class |
| F-09 | LOW | RTL / a11y | Trivial — add dir prop |
| F-10 | LOW | RTL idiom | Low — add dir, remove class |
| F-11 | LOW | Layout | Low — grid instead of spacer |
| F-12 | LOW | Permissions / UX | Low — move language toggle |
| F-13 | LOW | Accessibility | Trivial — add aria attrs |
| F-14 | LOW | Permissions / UX | Trivial — add isAdmin guard |

---

## 5. Skill Conflict Notes

The `frontend-design` skill recommends avoiding Inter as a body font and favors distinctive, intentional typography choices. This aligns with — and is superseded by — the project's explicit rule (DM Sans for English, Tajawal for Arabic). No conflict. The `frontend-design` recommendation for accent color use in navigation (F-08) is consistent with the project's defined amber accent and is noted as an improvement opportunity, not a conflict.
