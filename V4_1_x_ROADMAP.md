# V4_1_x_ROADMAP.md

**Last updated:** May 2026 (after v4.1.4 ship)
**Current production version:** v4.1.4
**Author context:** Three patches planned in sequence. Each independent, each safe to ship on its own. Designed during overnight session that produced v4.1.0 → v4.1.1 → v4.1.2.

---

## Roadmap order (locked)

The three patches must be done in this order because each builds on the last:

1. ~~**v4.1.3** — Preview modal~~ ✅ shipped
2. ~~**v4.1.4** — Download save-as dialog~~ ✅ shipped
3. **v4.1.5** — Multi-file Replace button (adds new backend endpoint)

Stage 7 (drop legacy customer columns) follows after these, with prep work first.

---

## v4.1.3 — Preview Modal Feature

### Background

When user clicks the Preview button on a slot:

- **Current behavior:** Opens the file URL in a new tab. For .docx files this forces a download (browsers can't preview Word natively).
- **New behavior:** If parsed data exists for that slot type, show parsed data inside a modal popup. If no parsed data, fall back to current "open file URL" behavior.

This idea came from Ahmad's observation in v4.1.2 planning: parsing already happens in the backend, but auto-displayed tables were just dumped on the page. Instead of showing them automatically, surface them on user click via Preview button.

### Slot types and their parsed data

Codex investigation (during v4.1.2 planning) confirmed which slots have parsed data available:

| Slot | Parsed table | Backend endpoint | What's in it |
|---|---|---|---|
| Glass / Panel Order | (none — uses QR HTML pipeline, EXTRACTED tile) | n/a | n/a |
| Quotation | parsed_quotations | `/api/erp/projects/:id/parsed-quotation` | positions, totals, quotation number, date |
| Section | parsed_sections + parsed_section_drawings | `/api/erp/projects/:id/parsed-section` | section data + drawings |
| Assembly List | parsed_assembly_lists | `/api/erp/projects/:id/parsed-assembly-list` | positions with codes, dimensions, glass items |
| Cut Optimisation | parsed_cut_optimisations | `/api/erp/projects/:id/parsed-cut-optimisation` | profile codes, descriptions, quantities, wastage % |
| Material Analysis | (none — no parser exists) | n/a | n/a |
| Vendor Order | (none) | n/a | n/a |
| Qoyod | (none — direct PDF byte copy) | n/a | n/a |
| Other | (none) | n/a | n/a |

So v4.1.3 affects 4 slot types: Quotation, Section, Assembly List, Cut Optimisation.

### Locked design decisions

- **Modal popup** that opens over the page, close to dismiss (decided during v4.1.2 planning)
- Modal width: probably 700-900px on desktop, full-width on mobile
- Show loading spinner while data fetches (could be 200-500ms)
- Empty state: "No parsed data available yet — click Download to view the original file"
- Error state: "Could not load preview — click Download to view original"
- Keyboard escape closes modal
- Click outside modal closes it
- Bilingual + RTL support (Tajawal font for Arabic)

### Pre-work needed before writing prompt

Before writing the v4.1.3 implementation prompt, ask Codex to investigate:

1. **Modal component pattern in the codebase**
   - Does the project already have a modal/dialog component? (Possibly shadcn/ui Dialog)
   - If yes, what's its API?
   - If no, recommend the smallest modal pattern to add

2. **Existing parsed-data render code (for reuse)**
   - The v4.1.2 patch removed the auto-displayed tables but the JSX itself was good
   - Could be reused inside the modal — same display, different trigger
   - Look at git history for the deleted blocks: ProjectDetail.tsx commit 91a8e4d (or whichever was Commit 1 of v4.1.2)

3. **Preview button current onClick handler in FileSlot.tsx**
   - Where to wire the conditional logic ("if parsed data, open modal; else use existing URL")
   - Current handler around FileSlot.tsx:140-160 (depending on current state)

4. **Bilingual considerations**
   - i18n strings for modal title, close button, empty state, error state
   - RTL flip for the modal content (especially tables)

### Estimated scope

- Time: 6-10 hours
- Commits: 3-5
  - Commit 1: Add modal component (or import existing)
  - Commit 2: Wire Preview button to open modal for slots with parsed data
  - Commit 3: Build modal content for each of the 4 slot types
  - Commit 4: i18n strings + RTL polish
  - Commit 5: Docs + version bump

### What stays unchanged in v4.1.3

- Parsed tables stay HIDDEN on the Files tab (don't auto-display)
- Backend parsing pipeline unchanged
- Download button behavior unchanged (deferred to v4.1.4)
- Multi-file Replace button still missing (deferred to v4.1.5)
- Logo asset unchanged (still the v4.1.2 stopgap)

---

## v4.1.4 — Download Save-As Dialog

### Background

Today's Download button hits the same `/api/erp/projects/:id/files/:fileId` endpoint that Preview uses, which serves files with `Content-Disposition: inline`. Browser decides whether to display inline or download — inconsistent behavior across files and browsers.

User wants Download to ALWAYS trigger a "Save As" dialog. That requires `Content-Disposition: attachment` from the backend.

### Codex investigation findings (during v4.1.2 planning)

- Current endpoint at `artifacts/api-server/src/routes/erp.ts:2146` serves with `Content-Disposition: inline`
- The QR subsystem already has attachment-style download endpoints — they show the right pattern (`artifacts/api-server/src/routes/qr.ts:688, 711`)
- Frontend Download in FileSlot.tsx calls `onDownload(file.id)` which goes through ProjectDetail.tsx:1239 (creates `<a>` with `download=filename` and clicks it)
- Frontend-only changes are NOT sufficient — the `download` attribute on `<a>` is a hint, not a guarantee

### Locked design decisions

- Add a query parameter to the existing endpoint: `/api/erp/projects/:id/files/:fileId?download=1`
- When `download=1`, backend serves with `Content-Disposition: attachment; filename="<original-name>"`
- When no query param, backend keeps current `inline` behavior (Preview unchanged)
- Frontend Download button updates to use `?download=1`
- Frontend Preview button keeps current behavior (no query param)

This pattern is the smallest change that satisfies both:
- Preview = inline (Glass HTML reports load, PDFs preview in browser)
- Download = attachment (always Save-As dialog)

### Pre-work needed before writing prompt

1. **Confirm endpoint location**
   - Currently at erp.ts:2146 (per Codex finding)
   - Check that line is still accurate after v4.1.2 (probably yes since no api-server changes shipped)

2. **Confirm the QR subsystem pattern**
   - Look at qr.ts:688 and 711 for the existing attachment pattern
   - Reuse the same code style

3. **Confirm the frontend Download handler location**
   - ProjectDetail.tsx:1239 (downloadFile function)
   - Find where it constructs the URL — that's where the query param goes

### Estimated scope

- Time: 2-3 hours
- Commits: 3
  - Commit 1: Backend — add `?download=1` query handling to file route
  - Commit 2: Frontend — update Download handler to include `?download=1`
  - Commit 3: Docs + version bump

### What stays unchanged in v4.1.4

- All v4.1.3 work (Preview modal) preserved
- Multi-file Replace still missing (deferred to v4.1.5)
- Preview button unchanged
- All other slot UI unchanged

---

## v4.1.5 — Multi-File Slot Replace Button

### Background

Multi-file slots (vendor_order, qoyod, other) currently show only Preview + Download buttons per file. Single-file slots show Preview + Download + Replace File. Inconsistency.

User explicitly wants Replace File button on every file card, single OR multi-file.

### Codex investigation findings (during v4.1.2 planning)

- Multi-file slots use FileSlot component in "bucket mode" (not ad-hoc JSX) — verified in ProjectDetail.tsx:1680
- Each bucket file card uses `renderFileRow()` from FileSlot.tsx:159
- Replace button is hidden because ProjectDetail.tsx:1695 explicitly passes `canReplace={false}` for bucket slots
- **The deeper problem:** simply flipping `canReplace` to true would NOT work properly. Current `onReplace` for bucket slots calls `uploadFile()` which **appends** a new file (current backend behavior at erp.ts:1613, 1905)
- **No "replace file by ID" backend endpoint exists.** There's POST for upload and DELETE for deletion, but no PUT/PATCH for replace.

### Why this is harder than it looks

A naive fix would just remove `canReplace={false}` and ship the button. That would create a worse UX:
- Button labeled "Replace File"
- Clicks open file picker
- After upload, the slot has both the OLD file AND the new file (5 files instead of 4)
- User confused — "Replace" did not replace, it appended

The fix requires NEW backend behavior.

### Locked design decisions

**Backend:**
- Add new endpoint: `PUT /api/erp/projects/:id/files/:fileId`
- Body: multipart/form-data with `file` field (same as upload)
- Behavior: replace the file content of the file with given ID
  - Update the file's binary content
  - Update filename and mimetype
  - Update updated_at
  - Keep the same file ID
  - Re-trigger any parsing for that slot type if applicable
- Authorization: same as existing upload (admin, factory_manager, employee, sales_agent for some slots)

**Frontend:**
- For multi-file slots: enable Replace File button (`canReplace={true}`)
- onReplace handler for multi-file slots: hits the new PUT endpoint with the specific fileId
- For single-file slots: existing Replace behavior unchanged (it's already wired correctly via DELETE-then-POST or however it currently works)

**UX:**
- Replace File on multi-file = replace ONLY this specific file in the slot (decided in v4.1.2 planning)
- Confirmation dialog before destructive replace? (Decide during planning — probably yes, "Are you sure? Original file will be replaced.")
- After replace, refresh just this card or full slot

### Pre-work needed before writing prompt

1. **Codex investigation:**
   - Read the existing Replace handler for single-file slots — how does it currently work? DELETE + POST, or PUT, or something else?
   - The frontend onReplace flow needs to be understood end-to-end before duplicating for multi-file
   - Authorization rules at the existing upload endpoint

2. **Edge cases to think about:**
   - What if upload fails partway? File ID still exists with old content?
   - Re-parsing: if user replaces an Assembly List file, the parsed_assembly_lists row needs to be updated (or deleted and re-created)
   - File version history: does the system track versions? If yes, Replace might need to preserve the old version

3. **Backend route placement:**
   - Should be near existing file routes in erp.ts
   - Might need shared utility extracted from existing upload handler

### Estimated scope

- Time: 4-6 hours
- Commits: 4-5
  - Commit 1: Backend — new PUT endpoint with replace logic
  - Commit 2: Frontend — enable Replace button for multi-file slots
  - Commit 3: Frontend — wire new onReplace handler to PUT endpoint
  - Commit 4 (optional): Confirmation dialog
  - Commit 5: Docs + version bump

### What stays unchanged in v4.1.5

- All v4.1.3 (Preview modal) and v4.1.4 (Download dialog) preserved
- Single-file slot Replace behavior unchanged (already works)
- Glass and Qoyod EXTRACTED tile pipelines unchanged
- Backend parsing pipelines unchanged

---

## After v4.1.5 — Stage 7 and Contract Feature

These are the next two big items, planned but not yet scoped:

### Stage 7 — Drop legacy customer columns

- Drop `customer_name` and `phone` from leads and projects tables
- Remove COALESCE(...) fallbacks from 6+ places in erp.ts
- Update create/update flows for leads and projects
- This is destructive — needs prep work first to remove all reads/writes of legacy columns
- Codex audit during v4.1.2 found 6+ places still depend on these columns:
  - erp.ts:175, 195 (shared select projections)
  - erp.ts:749, 972, 1371, 1528 (create/update flows)
- DO NOT ship until those are cleaned up

### Contract Feature

Locked design from v4.1.0/v4.1.1 planning:

- Reuses existing AdminSettings contract template (cover + terms + signature blocks, bilingual placeholders)
- Combines with project's Quotation .docx file (converted to PDF via LibreOffice infrastructure shipped in v4.1.0)
- Adds logo + company footer + page numbers via pdf-lib (need to install)
- Public URL with token (same pattern as QR HTML reports — no login required)
- Plan for e-signing later (Saudi government Tawqea/Nafath integration), build URL system now

Estimated scope: 24-40 hours, 4-6 commits, separate from v4.1.x cleanup work.

---

## How to use this roadmap

When ready to work on the next patch:

1. Open this file
2. Find the section for the next version (v4.1.3, then v4.1.4, then v4.1.5)
3. Read the "Pre-work needed before writing prompt" section
4. Ask Codex to investigate the items listed there
5. Codex returns findings → review with Claude (planner)
6. Claude writes the implementation prompt
7. Codex reviews the prompt
8. Paste to Claude Code
9. Approve restatement → execute commits → verify deploy

This is the same pattern that produced v4.1.0, v4.1.1, and v4.1.2 successfully on May 1-2, 2026.

---

## Reference: anchor commits for rollback

If anything ships and breaks, here are the safe rollback points:

| Tag/Commit | What | Rollback command |
|---|---|---|
| v4.1.4 | Current production | n/a (this is current) |
| v4.1.3 | Pre-v4.1.4 (no save-as download) | `git reset --hard v4.1.3` then force-push |
| v4.1.2 (174ab0e) | Pre-v4.1.3 (no preview modal) | `git reset --hard v4.1.2` then force-push |
| v4.1.1 (daa946f) | Pre-v4.1.2 (parsed tables visible, broken logo) | `git reset --hard v4.1.1` then force-push |
| v4.1.0 (e98a79f) | Pre-simplification (EXTRACTED tile for everything) | `git reset --hard v4.1.0` then force-push |
| v4.0.14 | Pre-LibreOffice infrastructure | `git reset --hard v4.0.14` then force-push |

**Use force-push only as last resort.** First try `git revert <commit>` for non-destructive rollback.

---

## Notes for future planning sessions

- **Trust calibration learned during v4.1.x work:**
  - Codex: high trust for code claims (verifies before reporting), reads actual code
  - Antigravity: medium trust — finds visual bugs accurately, invents technical specifics
  - Claude Code: high trust when prompts are precise, executes deterministically
  - Your own eyes: highest trust for visual verification (always faster than tools)
- **Pattern that worked:** small patches, Codex review before AND after, restatement gate, frontend-only when possible, version bump only files that actually changed
- **Pattern that failed:** big bundled patches (v4.1.0 had lockfile regression because mammoth removal + LibreOffice install were combined), trusting tool reports without verification (Antigravity report claimed dashboard was broken, it wasn't)
