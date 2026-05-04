# DESIGN_GAP_ANALYSIS.md
# تحليل فجوات التصميم — Wathbah ERP

> **Purpose:** Catalogue of known visual and behavioral gaps between
> the approved design mockups and the live application. Updated as
> gaps are identified or resolved.

> **Last updated:** v4.0.11 (Stage 6.6 — added File Slot Visual Drift section)

---

## File Slot Visual Drift (Identified v4.0.10 — Resolved in v4.0.11)

### The Gap

The live v4.0.10 site renders the same conceptual action — "manage a
file in a project slot" — using **at least four different visual
treatments** across the project detail page. This violates the
single-component / single-vocabulary principle and creates user
confusion about which buttons do what.

### The Four Treatments Observed (live v4.0.10)

**Treatment A — Single-file slot, empty state (6 cards: Glass Order,
Quotation, Sections, Assembly, Cut Optimisation, Material Analysis)**
- Beige rounded card, type label + "لم يتم رفع ملف" hint
- Tiny upload icon button in the top-left corner
- No clear primary action; the icon is easy to miss

**Treatment B — Multi-file bucket, empty state (Vendor Orders, Qoyod,
Other)**
- Same beige card style as Treatment A
- Plus a black `+ إضافة ملف` pill button in the top-left
- Plus an inner empty-state box containing a second `رفع ملف` button
- **Two upload entry points for the same action** — redundant and
  confusing

**Treatment C — Mockup design (Image 1, REQUIRED FILES section)**
- Clean black `رفع ملف` button as the primary action on each empty slot
- Filled state shows a row with تنزيل / استبدال / معاينة actions
- This is the target style

**Treatment D — Mockup design (Image 2, MULTI-FILE BUCKETS section)**
- Folder-style accordion
- Each file row has size badge, download icon, and a `...` menu
- Single `+ إضافة ملف` at the bottom of the expanded folder
- This is the target style for filled buckets

### Why It Drifted

Stage 6.5 (v4.0.10) locked the **data integrity rules** for file
uploads (Rules 1–9 in Philosophy) but did not lock the **visual
contract**. As a result, each component author re-invented the
buttons, layout, and empty-state pattern. The mockup vocabulary
(Images 1 and 2) was never enforced in code.

### The Target State (locked in v4.0.11)

Every file slot — single or bucket, every file type — renders through
a single `<FileSlot>` component with a fixed vocabulary defined in
Philosophy Rules 10, 11, 12.

**Empty state:** one centered `رفع ملف` button. Nothing else.

**Filled state:** type label, filename, date, dual preview tiles
(EXTRACTED + ORIGINAL), and three buttons in fixed RTL order:
`معاينة` → `تنزيل` → `استبدال`.

The 3 buttons always operate on the Original file. The two preview
tiles are clickable to open their respective artifact in a browser
viewer (no download).

The only visual variation between file types is what is drawn inside
the EXTRACTED tile.

### Resolution Path

- **Philosophy update:** Rules 10–12 added in v4.0.11 (this version)
- **Code unification:** Stage 6.6 builds `<FileSlot>` and refactors
  every file rendering on the project detail page to use it
- **Verification:** UI/UX Checklist updated with explicit File Slot
  Consistency section; manual verification on live site after deploy

### Status

- ✅ **Philosophy locked** (v4.0.11, Rules 10–12)
- ✅ **Design Gap documented** (this file, v4.0.11)
- ✅ **UI/UX Checklist updated** (v4.0.11)
- ⏳ **Code refactor pending** (Stage 6.6 commits 2–7)
- ⏳ **Live verification pending** (post-deploy)

---

## Original-vs-Extracted Artifact Concept (Identified v4.0.10 — Locked in v4.0.11)

### The Gap

The system has historically had only one artifact per file slot — the
Original — except for Glass Order, which has had a derived "QR-Enhanced
HTML" artifact since v1. This special-casing of Glass meant that:

- Other file types could not be embedded into contracts cleanly because
  they include project headers and footers
- The visual UI had no way to indicate that a derived artifact exists
- Replace flow had no concept of "regenerate the derived artifact"

### The Decision (locked in v4.0.11)

Every file slot now has **two artifacts**: Original + Extracted.

- **Glass Order:** Extracted = the existing QR-enhanced HTML (no change)
- **Qoyod:** Extracted = byte-identical copy of Original (no transformation
  until v4.3.0 Qoyod API integration)
- **Other 7 file types (`.docx` only):** Extracted = A4-sized HTML with
  header/footer stripped, ready to embed into a contract document

The dual-tile UI (EXTRACTED | ORIGINAL) makes both artifacts visible
to the user without forcing them to download either. The 3 action
buttons continue to operate on the Original — keeping the user's
mental model simple.

### Implementation Scope

The `.docx` → A4 HTML extractor is a **single piece of server code**
applied uniformly to 7 slot types. Extraction runs automatically on
every upload and every replace. No manual trigger.

For initial scope, only `.docx` is accepted by the 7 non-Glass
non-Qoyod slots. PDF, XLSX, DXF, DOC, and other formats are rejected
at the upload endpoint with a clear error message.

### Status

- ✅ **Concept locked** (Philosophy Rule 11)
- ⏳ **`.docx` extractor implementation pending** (Stage 6.6 commit 2)
- ⏳ **Pipeline wiring pending** (Stage 6.6 commit 3)

---

## Other Tracked Design Gaps

(This section preserves any other gaps documented in earlier versions
of this file. If this file was previously empty or thin, additional
gaps will be added as they are identified.)

---

## Change Log for This File

- **v4.0.11** — Added "File Slot Visual Drift" section documenting the
  4 treatments observed on live v4.0.10 and the target state. Added
  "Original-vs-Extracted Artifact Concept" section documenting the
  Rule 11 decision.
