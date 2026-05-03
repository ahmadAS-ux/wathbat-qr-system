# STAGE_6_5_PHILOSOPHY_ALIGNMENT.md
# مواءمة الفلسفة — قواعد دائمة للنظام

> **Purpose:** This is the foundational rule lock for Wathbah ERP.
> Every feature, every refactor, every Claude Code prompt must respect these rules.
> This file is mandatory reading at the start of any session.

> **Last updated:** v4.1.1 (Upload simplification — Rule 11 revised: EXTRACTED tile deprecated for the 7 Orgadata .docx slot types)

---

## The Locked Philosophy

**Customer is the parent. Projects belong to customers. Files belong to projects. There are no orphans. There is no second upload path.**

---

## The 12 Permanent Rules

### Rule 1 — Customer must exist before project
A project cannot be created without first selecting or creating a customer.
Enforced via the `CustomerPicker` component. No orphan projects.

### Rule 2 — Every project links to a customer at creation
Every project row has a `customer_id` foreign key.
After Stage 7, this column is `NOT NULL` with a foreign key constraint.

### Rule 3 — All file uploads happen inside a project
The standalone `/qr/upload` page is dead.
Every file in the system has a `project_id`. No orphan files.

### Rule 4 — Glass file QR generation continues unchanged
Same parser, same HTML output, same QR codes as v1.
Glass extraction is a solved problem and is not re-engineered.

### Rule 5 — Customer name is NEVER touched by any file upload
Only manual edit by an authorized user, or Qoyod sync (with explicit
confirmation), can change `customers.name`.
No parser, no extractor, no upload handler may write to this column.

### Rule 6 — NameMismatchModal is unified across all 6 Orgadata file types
Same modal. Same two buttons.
Default: **Keep current name**. Deliberate click: **Update project name**.

### Rule 7 — Re-upload to single-file slot shows confirmation warning
Cancel is the default. Replace is deliberate.
Old version is kept as "Previous version" in the audit log.

### Rule 8 — Document Archive is a read-only audit log
Admin-only. Shows all files across all projects with project link.
No edits, no deletes from this view.

### Rule 9 — Qoyod is the only exception to Rule 5
Handled in v4.3.0 with explicit user confirmation flow.
Until then, Qoyod files are uploaded as-is and customer name is never touched.

---

### Rule 10 — One File Slot Component, One Vocabulary

Every file slot in the system (single-file or multi-file bucket)
renders through a single shared component (`<FileSlot>`) that exposes
exactly these states:

**Empty state** — one primary button only:
- `رفع ملف` / `Upload File`

**Filled state** — three action buttons, always in this order (RTL):
- `معاينة` (Preview) — opens Original in browser viewer
- `تنزيل` (Download) — downloads Original file
- `استبدال` (Replace) — triggers `ReUploadConfirmModal`, then re-uploads

**Filled state additional anatomy:**
- Status badge: `مرفوع` (Uploaded)
- Type icon + type label (e.g., `QUOTATION`, `GLASS ORDER`)
- Filename + upload date
- Preview tile(s) — varies by slot type (see Rule 11):
  - **Glass and Qoyod:** two tiles side-by-side: **EXTRACTED** | **ORIGINAL**
    - Click `ORIGINAL` tile → opens original in browser viewer (no download)
    - Click `EXTRACTED` tile → opens extracted artifact in browser viewer (no download)
  - **All other 7 slots:** single full-width **ORIGINAL** tile only

**Loading state** — inline skeleton or spinner.

**Error state** — toast notification (never silent — see Lesson 5).

**Delete action** — triggers `DeleteConfirmModal`. Cancel is default.
No file is ever deleted in one click. Admin-only.

**The 3 buttons always operate on the Original file. Always.**
No file type changes this — not Glass, not Qoyod, not Other.

No page may render its own custom upload button, download icon, or
replace flow. Custom behavior is passed via props, not re-implemented.

---

### Rule 11 — Original vs Extracted: Artifacts by Slot Type (v4.1.1)

Every file slot stores the Original artifact. Select slot types also
store a server-derived Extracted artifact.

1. **Original** — exactly what the user uploaded. Untouched. The 3
   buttons (Preview, Download, Replace) always act on this.

2. **Extracted** — a derived artifact, where applicable. Used for QR
   scanning (Glass), Qoyod filing, and future contract generation.

**Extracted artifact and UI tile visibility by file type:**

| Slot type | Original format | Extracted artifact | EXTRACTED tile shown? |
|---|---|---|---|
| Glass Order | `.docx`, PDF, or HTML | QR-enhanced HTML (existing v1 parser, dual-written to `processed_docs` and `project_files`) | ✅ Yes |
| Qoyod | `.pdf` only | Byte-identical copy of original (no transformation until v4.3.0) | ✅ Yes |
| Quotation | `.docx` only | NULL — no upload-time extraction | ❌ No |
| Sections | `.docx` only | NULL — no upload-time extraction | ❌ No |
| Assembly List | `.docx` only | NULL — no upload-time extraction | ❌ No |
| Cut Optimisation | `.docx` only | NULL — no upload-time extraction | ❌ No |
| Material Analysis | `.docx` only | NULL — no upload-time extraction | ❌ No |
| Vendor Orders | `.docx` only | NULL — no upload-time extraction | ❌ No |
| Other | `.docx` only | NULL — no upload-time extraction | ❌ No |

**Why no extraction for the 7 Orgadata .docx slots (v4.1.1 decision):**
After design review, the EXTRACTED preview tile for these slots provides
no business value. The forthcoming contract feature will use the
Quotation file converted to PDF at contract-generation time using the
same LibreOffice infrastructure (`extractDocxToPdf` in
`docx-extractor.ts`), not a pre-extracted upload-time artifact. The
LibreOffice infrastructure is retained for that purpose.

**Format enforcement:** The 7 non-Glass, non-Qoyod slots accept
**only `.docx`**. Uploads of any other format are rejected by the
backend with a clear error message. Glass accepts `.docx`, PDF, or
HTML. Qoyod accepts `.pdf` only.

**UI layout rule (v4.1.1):**
- Glass and Qoyod slots: two-column grid — EXTRACTED tile | ORIGINAL tile.
- All other 7 slots: single full-width ORIGINAL tile. No "Pending
  extraction" placeholder is shown. The `showsExtractedTile()` helper
  in `FileSlot.tsx` (whitelist: `['glass', 'qoyod']`) controls this.

---

### Rule 12 — One Manual Upload Entry Per Slot; SmartUpload is Primary

The primary upload path is **SmartUpload** at the top of the project's
Files tab. Users drop multiple files into the zone, the system detects
each file's type by filename pattern matching, and routes each file to
the correct slot or bucket automatically.

The per-slot/per-bucket `رفع ملف` button is a **manual fallback** for:
- When SmartUpload's filename detection fails
- When the user wants direct control over a specific slot
- Single-file upload to a known slot

**A multi-file bucket has exactly one manual upload entry point per
state:**

- **Empty bucket** → one centered `رفع ملف` button. Nothing else.
- **Filled bucket** → list of file rows + one `+ إضافة ملف` button at
  the bottom of the expanded list. Nothing else.

**The dual-button pattern (top `+ إضافة ملف` pill + inner `رفع ملف`
button in the empty card) is forbidden.** It was a bug in v4.0.10.

SmartUpload routing logic and per-slot manual uploads share the same
backend endpoints. The frontend may not invent a parallel API.

---

## What the Upload Handler is ALLOWED to Do

- Insert file into `project_files`
- Run the appropriate extractor based on file type and write the
  result to `project_files.extracted_file`
- For Glass: run the QR parser to inject QR codes into the HTML
- For Qoyod: copy original bytes verbatim to the extracted slot
- For other 7 types: no extraction at upload time (v4.1.1 — `extracted_file` stays NULL)
- Save processed HTML report to `processed_docs` (with `project_id` set,
  never NULL)
- Trigger `autoAdvanceStage`
- Return 409 with mismatch info for the unified `NameMismatchModal`
- Return 400 with specific validation errors (including format
  rejection: `"This slot accepts .docx only"`)

## What the Upload Handler is FORBIDDEN to Do

- `UPDATE projects SET name = ...` from any parser
- `UPDATE customers SET name = ...` ever, period
- `UPDATE projects SET customer_name = ...` ever
- `INSERT INTO processed_docs WHERE project_id IS NULL`
- Read customer name from any file field
- Use "Person in Charge" as a project or customer identifier
- Accept non-`.docx` files for the 7 .docx-only slot types
- Accept non-PDF files for the Qoyod slot

---

## Visual Anatomy Reference

### Empty state (every file type)

```
┌─────────────────────────────────────────┐
│ [type icon]   TYPE LABEL                │
│               لم يتم رفع ملف بعد        │
│                                         │
│           [ ⬆ رفع ملف ]                 │
└─────────────────────────────────────────┘
```

### Filled state — Glass Order or Qoyod slot

```
┌─────────────────────────────────────────┐
│ [مرفوع badge]   [icon] TYPE LABEL       │
│                       filename-v2.docx  │
│                       Apr 12 · 11:08    │
│                                         │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  EXTRACTED   │  │   ORIGINAL   │    │
│  │  (preview)   │  │  (preview)   │    │
│  └──────────────┘  └──────────────┘    │
│                                         │
│   [استبدال] [⬇ تنزيل] [👁 معاينة]       │
└─────────────────────────────────────────┘
```

### Filled state — all other 7 .docx slot types (v4.1.1)

```
┌─────────────────────────────────────────┐
│ [مرفوع badge]   [icon] TYPE LABEL       │
│                       filename-v2.docx  │
│                       Apr 12 · 11:08    │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │           ORIGINAL               │  │
│  │           (preview)              │  │
│  └──────────────────────────────────┘  │
│                                         │
│   [استبدال] [⬇ تنزيل] [👁 معاينة]       │
└─────────────────────────────────────────┘
```

The arrangement, button order, and labels never change.

---

## Stage 7 — The Destructive Cleanup (Pending)

Stage 7 drops the legacy `customer_name` and `phone` columns from
`leads` and `projects`. This is the only destructive stage in v4.1.0
and requires:
- Stage 6.6 verification passing on live site
- 24-hour soft-launch test before final approval
- Backup of database before column drops

---

## How These Rules are Enforced

- **Code-level:** `<FileSlot>` is the single rendering point. Grep for
  ad-hoc upload buttons should return zero results outside the
  component.
- **Schema-level:** Foreign keys, NOT NULL constraints, format
  validators on upload endpoints.
- **Documentation-level:** This file. Mandatory reading. Updated only
  by explicit user-authored commits, never by Claude Code mid-stage.
- **Process-level:** Stage boundary commits with version bumps. No
  bundling. No scope expansion mid-stage.

---

## Change Log for This File

- **v4.0.10** — Original Stage 6.5 Philosophy Alignment (Rules 1–9).
- **v4.0.11** — Stage 6.6 update: added Rules 10, 11, 12 covering the
  file slot visual contract, Original-vs-Extracted artifact rule, and
  SmartUpload-primary / per-slot-fallback rule. Added visual anatomy
  reference. Format enforcement (`.docx` only) locked for the 7
  non-Glass, non-Qoyod slot types.
- **v4.1.0** — Rule 11 updated: extracted artifact for the 7 Orgadata
  `.docx` slot types changed from A4 HTML (mammoth) to PDF (LibreOffice
  headless DOCX→PDF). Resolves H-5.
- **v4.1.1** — Rule 11 revised: upload-time extraction deprecated for
  the 7 Orgadata `.docx` slot types. `extracted_file` stays NULL on
  new uploads. EXTRACTED tile and "Pending extraction" placeholder
  hidden in FileSlot UI for those slots (whitelist: `['glass', 'qoyod']`).
  Full-width ORIGINAL tile shown instead. LibreOffice infrastructure
  retained for future contract-generation feature. Rule 10 visual anatomy
  updated to show two distinct filled-state layouts. "Skip the extraction
  step on replace" removed from FORBIDDEN list (no longer applicable).
- **v4.1.2** — No rule changes. Frontend-only patch: auto-displayed parsed
  tables (Assembly List, Cut Optimisation) removed from Files tab UI per
  Rule 11 alignment (user never requested inline display). Backend parsing
  pipeline preserved for v4.1.3 on-demand Preview modal. Logo asset
  replaced (transparent background stopgap).
