# STAGE_6_5_PHILOSOPHY_ALIGNMENT.md
# مواءمة الفلسفة — قواعد دائمة للنظام

> **Purpose:** This is the foundational rule lock for Wathbah ERP.
> Every feature, every refactor, every Claude Code prompt must respect these rules.
> This file is mandatory reading at the start of any session.

> **Last updated:** v4.0.11 (Stage 6.6 — added Rules 10–12 for file slot visual contract)

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
- Two preview tiles side-by-side: **EXTRACTED** | **ORIGINAL**
  - Click `ORIGINAL` tile → opens original in browser viewer (no download)
  - Click `EXTRACTED` tile → opens extracted HTML in browser viewer (no download)

**Loading state** — inline skeleton or spinner.

**Error state** — toast notification (never silent — see Lesson 5).

**Delete action** — triggers `DeleteConfirmModal`. Cancel is default.
No file is ever deleted in one click. Admin-only.

**The 3 buttons always operate on the Original file. Always.**
No file type changes this — not Glass, not Qoyod, not Other.

No page may render its own custom upload button, download icon, or
replace flow. Custom behavior is passed via props, not re-implemented.

---

### Rule 11 — Original vs Extracted: Two Artifacts Per Slot

Every file slot stores **two artifacts**:

1. **Original** — exactly what the user uploaded. Untouched. The 3
   buttons (Preview, Download, Replace) always act on this.

2. **Extracted** — a derived artifact produced automatically by the
   server on every upload and every replace. Used for embedding into
   contracts (future feature) and, for Glass, for QR scanning.

**The Extracted artifact differs by file type as follows:**

| Slot type | Original format | Extracted artifact |
|---|---|---|
| Glass Order | PDF or HTML | HTML with QR codes injected (existing v1 parser) |
| Quotation | `.docx` only | PDF — LibreOffice headless DOCX→PDF (v4.1.0) |
| Sections | `.docx` only | PDF — LibreOffice headless DOCX→PDF (v4.1.0) |
| Assembly List | `.docx` only | PDF — LibreOffice headless DOCX→PDF (v4.1.0) |
| Cut Optimisation | `.docx` only | PDF — LibreOffice headless DOCX→PDF (v4.1.0) |
| Material Analysis | `.docx` only | PDF — LibreOffice headless DOCX→PDF (v4.1.0) |
| Vendor Orders | `.docx` only | PDF — LibreOffice headless DOCX→PDF (v4.1.0) |
| Other | `.docx` only | PDF — LibreOffice headless DOCX→PDF (v4.1.0) |
| Qoyod | PDF only | Identical copy of original (no transformation, until v4.3.0) |

**Format enforcement:** The 7 non-Glass, non-Qoyod slots accept
**only `.docx`**. Uploads of any other format are rejected by the
backend with a clear error message. Glass accepts PDF/HTML. Qoyod
accepts PDF.

**Re-extraction on replace:** When the user replaces a file, the
server automatically re-runs the appropriate extractor on the new
Original. Old Original and old Extracted are kept as previous versions
per Rule 7.

**The two preview tiles in the filled-state UI are visual indicators
that both artifacts exist. They are clickable to open the respective
artifact in a browser viewer. They never trigger a download — only the
Download button does that.**

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
  result to `project_files.extracted_artifact` (or equivalent column)
- For Glass: run the QR parser to inject QR codes into the HTML
- For Qoyod: copy original bytes verbatim to the extracted slot
- For other 7 types: run the `.docx` → PDF extractor (LibreOffice headless, v4.1.0)
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
- Skip the extraction step on replace

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

### Filled state (every file type — single-file slot)

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

The only visual variation between file types is what is **drawn inside
the EXTRACTED tile**:
- Glass Order → QR code thumbnail (the HTML output)
- Qoyod → thumbnail identical to ORIGINAL tile (since extracted is a copy)
- All others → thumbnail of the header-stripped HTML

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
