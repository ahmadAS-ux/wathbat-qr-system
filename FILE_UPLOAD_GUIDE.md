# FILE_UPLOAD_GUIDE.md — Complete File Upload Mechanism Reference

> Last updated: April 2026 — v4.1.0
> Source files: `artifacts/qr-manager/src/pages/erp/ProjectDetail.tsx` · `artifacts/api-server/src/routes/erp.ts` · `artifacts/api-server/src/lib/docx-extractor.ts` · `artifacts/qr-manager/src/components/erp/FileSlot.tsx` · `artifacts/api-server/src/app.ts` (isPublic list)
> Claude Code: Update this file when upload logic changes.

---

## Table of Contents

1. [File Slots — The 9 Types](#1-file-slots)
2. [Frontend — Input Elements and Refs](#2-frontend-input-elements)
3. [Frontend — Flow A: Individual Slot Upload](#3-flow-a-individual-slot)
4. [Frontend — Flow B: Multi-file Slot Upload](#4-flow-b-multi-file-slot)
5. [Frontend — Flow C: Batch Select Upload](#5-flow-c-batch-select)
6. [Frontend — 409 Name Mismatch Dialog (Quotation)](#6-409-quotation-mismatch)
7. [Frontend — 409 Glass Order Conflict Dialog](#7-409-glass-conflict)
8. [Frontend — After Upload Success](#8-after-upload-success)
9. [Frontend — Delete Flow](#9-delete-flow)
10. [Frontend — Required Files Checklist](#10-required-files-checklist)
11. [Frontend — Glass/Panel Order Dual Display](#11-glass-panel-dual-display)
12. [Backend — Multer Configuration](#12-multer-configuration)
13. [Backend — POST /files (single upload)](#13-post-files-single)
14. [Backend — POST /files (batch path)](#14-post-files-batch)
15. [Backend — POST /files/detect](#15-post-files-detect)
16. [Backend — GET /files](#16-get-files)
17. [Backend — GET /files/expected](#17-get-files-expected)
18. [Backend — DELETE /files/:fileId](#18-delete-file)
19. [Backend — File Versioning (is_active)](#19-file-versioning)
20. [Backend — autoAdvanceStage](#20-auto-advance-stage)
21. [Backend — Orgadata Name Mismatch Logic](#21-name-mismatch-logic)
22. [Database Schemas](#22-database-schemas)
23. [Data Flow Diagrams](#23-data-flow-diagrams)

---

## 0. Core Architecture (v4.0.11+)

### The two-layer model

The upload system has two layers that must be understood separately:

**LAYER 1 — Upload mechanism (unchanged since v3.x):**
`triggerUpload()` → `handleFileChange()` → `uploadFile()` → `POST /files`
This is identical for all 9 file types. The slot determines the `fileType`. The filename is never used to determine type.

**LAYER 2 — UI rendering (added in Stage 6.6 / v4.0.11):**
Every file slot renders via the `<FileSlot>` component (`artifacts/qr-manager/src/components/erp/FileSlot.tsx`).
- **Empty state:** one centered `رفع ملف` button + hint text "لم يتم رفع ملف بعد"
- **Filled state:** 2 preview tiles (EXTRACTED | ORIGINAL) + 3 buttons (`معاينة` / `تنزيل` / `استبدال`) in RTL order

The 3 buttons always operate on the Original file for every slot type. No file type changes this.

### The Original vs Extracted artifact (v4.0.11+)

Every file slot stores two artifacts in `project_files`:

| Column | Purpose |
|--------|---------|
| `file_data` (BYTEA) | The Original — exactly what the user uploaded |
| `extracted_file` (BYTEA) | The Extracted — server-derived on every upload/replace |
| `extracted_mime` | MIME type of the Extracted |

**Extracted artifact by file type:**

| Slot type | Extracted artifact |
|-----------|-------------------|
| `glass_order` | QR-enhanced HTML (v1 parser output, dual-written to both `processed_docs` and `project_files` in v4.0.11+) |
| `qoyod` | Byte-identical copy of original (no transformation until v4.3.0) |
| Other 7 types | PDF via `extractDocxToPdf()` in `artifacts/api-server/src/lib/docx-extractor.ts` (LibreOffice headless DOCX→PDF, v4.1.0) |

### Public file-serving endpoints (v4.0.12+)

Two GET endpoints are public (no auth required). Listed in the `isPublic` check in `artifacts/api-server/src/app.ts`. This mirrors the existing `/api/qr/download/:fileId` public pattern:

| Endpoint | Serves | isPublic regex |
|----------|--------|----------------|
| `GET /api/erp/projects/:id/files/:fileId` | `file_data` (Original) inline with stored `fileMime` | `/^\/erp\/projects\/\d+\/files\/\d+$/` |
| `GET /api/erp/projects/:id/files/:fileId/extracted` | `extracted_file` inline with `extractedMime` | `/^\/erp\/projects\/\d+\/files\/\d+\/extracted$/` |

Both are GET-only — POST and DELETE still require auth.

### Delete permissions (v4.0.11+, Rule 10)

File deletion is **Admin-only**. This supersedes the v4.0.10 behavior where FactoryManager could also delete files.
The `canDeleteFile(role)` helper in `lib/permissions.ts` returns `true` for Admin only.
The backend `DELETE /files/:fileId` endpoint enforces this server-side.

---

## 1. File Slots

Defined in `ProjectDetail.tsx` lines 155–165 as `FILE_SLOTS`:

```typescript
const FILE_SLOTS = [
  { fileType: 'glass_order',       labelAr: 'طلبية زجاج / ألواح', labelEn: 'Glass / Panel Order',  multiFile: false },
  { fileType: 'quotation',         labelAr: 'عرض السعر',           labelEn: 'Quotation',             multiFile: false },
  { fileType: 'section',           labelAr: 'المقاطع',             labelEn: 'Section',               multiFile: false },
  { fileType: 'assembly_list',     labelAr: 'قائمة التجميع',       labelEn: 'Assembly List',         multiFile: false },
  { fileType: 'cut_optimisation',  labelAr: 'تحسين القص',          labelEn: 'Cut Optimisation',      multiFile: false },
  { fileType: 'material_analysis', labelAr: 'تحليل المواد',        labelEn: 'Material Analysis',     multiFile: false },
  { fileType: 'vendor_order',      labelAr: 'أمر مورد',            labelEn: 'Vendor Order',          multiFile: true  },
  { fileType: 'qoyod',             labelAr: 'قيود',                labelEn: 'Qoyod',                 multiFile: true  },
  { fileType: 'other',             labelAr: 'أخرى',               labelEn: 'Other',                 multiFile: true  },
];
```

**Rules:**
- `multiFile: false` — only one active version at a time; re-upload supersedes old file (`isActive = false`)
- `multiFile: true` — all uploaded files coexist as active; no versioning

**Orgadata files** (require `.docx`): `glass_order`, `quotation`, `section`, `assembly_list`, `cut_optimisation`, `material_analysis`

**Multi-file types** (accept any file format): `vendor_order`, `qoyod`, `other`

---

## 2. Frontend — Input Elements

Two hidden `<input type="file">` elements are rendered at `ProjectDetail.tsx` line 1434:

```tsx
// Flow A & B — individual slot uploads
<input
  ref={fileInputRef}
  type="file"
  className="hidden"
  accept=".docx"
  onChange={handleFileChange}
/>

// Flow C — batch select
<input
  ref={batchInputRef}
  type="file"
  className="hidden"
  accept=".docx"
  multiple
  onChange={handleBatchSelect}
/>
```

**Key refs** (declared at lines 914–936):
```typescript
const fileInputRef = useRef<HTMLInputElement>(null);  // line 914 — Flows A & B
const batchInputRef = useRef<HTMLInputElement>(null);  // line 936 — Flow C
```

**Key state** for tracking upload in progress:
```typescript
const [pendingFileType, setPendingFileType] = useState<string>('');  // which slot is being uploaded to
const [uploadingFor, setUploadingFor] = useState<string | null>(null);  // shows spinner on that slot
const [allFiles, setAllFiles] = useState<ProjectFile[]>([]);  // all project files including inactive
```

---

## 3. Flow A — Individual Slot Upload

**Trigger:** User clicks the upload icon button on a single-file slot (glass_order, quotation, section, assembly_list, cut_optimisation, material_analysis).

### Step-by-step function chain

**Step 1 — `triggerUpload(fileType)` (line 1071):**
```typescript
const triggerUpload = (fileType: string) => {
  if (fileInputRef.current) {
    const isMulti = ['vendor_order', 'qoyod', 'other'].includes(fileType);
    fileInputRef.current.accept = isMulti ? '*/*' : '.docx';  // set accept dynamically
  }
  setPendingFileType(fileType);          // remember which slot this is for
  fileInputRef.current?.click();        // programmatically open the OS file picker
};
```

`accept` is set dynamically — `.docx` for Orgadata slots, `*/*` for multi-file types.

**Step 2 — User selects a file in the OS picker → `handleFileChange` fires (line 1129):**
```typescript
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || !pendingFileType) return;
  if (fileInputRef.current) fileInputRef.current.value = '';  // reset input so same file can be re-selected
  // Always use the slot's fileType directly — never auto-detect from filename
  await uploadFile(file, pendingFileType);
};
```

**CRITICAL RULE:** `pendingFileType` (set in step 1) is always used. The filename is NEVER inspected to determine file type. The slot determines the type.

**Step 3 — `uploadFile(file, fileType, extraQuery='')` (line 1080):**
```typescript
const uploadFile = async (file: File, fileType: string, extraQuery = '') => {
  setUploadingFor(fileType);              // show spinner on this slot
  try {
    const fd = new FormData();
    fd.append('file', file);              // multer field name: 'file'
    fd.append('fileType', fileType);      // tells backend which slot

    const res = await fetch(
      `${API_BASE}/api/erp/projects/${id}/files${extraQuery}`,
      { method: 'POST', body: fd }
    );

    // 409 for quotation/price_quotation → unified NameMismatchModal (v4.0.10)
    if (res.status === 409 && (fileType === 'price_quotation' || fileType === 'quotation')) {
      const conflict = await res.json();
      setNameMismatch({ nameInFile: conflict.nameInFile, nameInSystem: conflict.nameInSystem, pendingFile: file, fileType });
      return;
    }

    // 409 for glass_order → same unified NameMismatchModal (v4.0.10 — glass-specific dialog removed)
    if (res.status === 409 && fileType === 'glass_order') {
      const conflict = await res.json();
      setNameMismatch({ nameInFile: conflict.orgadataName ?? '', nameInSystem: conflict.systemName ?? '', pendingFile: file, fileType });
      return;
    }

    // Success path — save scroll, refresh data
    const scrollY = window.scrollY;
    if (fileType === 'glass_order') {
      await loadQrOrders();               // glass_order goes to processed_docs, needs QR reload
      await loadProject();               // stage may have advanced
    } else {
      await loadProject();               // stage may have advanced
      if (fileType === 'assembly_list' || fileType === 'cut_optimisation') {
        await loadParsedData();          // refresh parsed data preview
      }
    }
    await loadAllFiles();               // always refresh file list
    requestAnimationFrame(() => window.scrollTo(0, scrollY));  // restore scroll position

  } finally {
    setUploadingFor(null);              // hide spinner
    setPendingFileType('');             // clear pending type
  }
};
```

---

## 4. Flow B — Multi-file Slot Upload

Multi-file slots (`vendor_order`, `qoyod`, `other`) use the **same `fileInputRef`** and **same `handleFileChange`** as Flow A. The only difference:

- `triggerUpload(fileType)` sets `fileInputRef.current.accept = '*/*'` (not `.docx`)
- The file is uploaded with the slot's `fileType` directly — no detection
- On the backend: `isActive` is NOT set to false for existing files — all versions coexist

**The upload path is identical to Flow A after the file is selected.** Same `uploadFile()` call, same refresh chain.

---

## 5. Flow C — Batch Select Upload

**Trigger:** User clicks the "Select files" button, which calls `batchInputRef.current?.click()`.

### Step 1 — `handleBatchSelect` fires (line 1187):

```typescript
const handleBatchSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files ?? []);
  if (!files.length) return;
  if (batchInputRef.current) batchInputRef.current.value = '';  // reset

  setDetectingBatch(true);
  try {
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));  // field name: 'files' (array)

    const res = await fetch(`${API_BASE}/api/erp/projects/${id}/files/detect`, {
      method: 'POST',
      body: fd,
    });

    if (res.ok) {
      const results = await res.json();
      // results: [{ filename, size, detectedType: string|null, confidence: 'high'|'low' }]
      const items: DetectionItem[] = results.map((r, i) => ({
        filename: r.filename,
        size: r.size,
        file: files[i],
        detectedType: r.detectedType,
        confidence: r.confidence,
        assignedType: r.detectedType ?? 'other',  // default to 'other' if undetected
      }));
      setDetectionItems(items);  // show detection summary panel
    }
  } finally {
    setDetectingBatch(false);
  }
};
```

### Step 2 — Detection summary panel renders (lines 1438–1482):

Shown when `detectionItems.length > 0`. For each file:
- Filename, size
- Confidence badge (`high` = green badge)
- `<select>` dropdown with all 9 file types — pre-selected to `assignedType`
- User can change the type before uploading

`updateDetectionItem(idx, assignedType)` (line 1216) updates a single item's assigned type:
```typescript
const updateDetectionItem = (idx: number, assignedType: string) => {
  setDetectionItems(prev => prev.map((item, i) => i === idx ? { ...item, assignedType } : item));
};
```

### Step 3 — User clicks "Upload All" → `handleUploadAll` (line 1220):

```typescript
const handleUploadAll = async () => {
  if (!detectionItems.length) return;
  setUploadingBatch(true);
  const scrollY = window.scrollY;
  try {
    for (const item of detectionItems) {
      await uploadFile(item.file, item.assignedType);  // sequential, one at a time
    }
    setDetectionItems([]);          // clear panel
    await loadAllFiles();           // final refresh
    requestAnimationFrame(() => window.scrollTo(0, scrollY));
  } finally {
    setUploadingBatch(false);
  }
};
```

**Note:** Each `uploadFile()` call itself also calls `loadAllFiles()` internally, so files appear incrementally as they upload.

---

## 6. Frontend — 409 Unified Name Mismatch Dialog (v4.0.10)

**When triggered:** `uploadFile()` receives a 409 for any Orgadata file type (`quotation`, `price_quotation`, or `glass_order`).

**State set:** `setNameMismatch({ nameInFile, nameInSystem, pendingFile, fileType })`
- Quotation 409: `nameInFile = conflict.nameInFile`, `nameInSystem = conflict.nameInSystem`
- Glass 409: `nameInFile = conflict.orgadataName`, `nameInSystem = conflict.systemName`

**Component rendered:** `<NameMismatchModal>` (`src/components/erp/NameMismatchModal.tsx`):

**What the modal shows:**
- Name in the uploaded file
- Name in the system
- **Two buttons:** **Keep** (default/focused) | **Update**
- × closes without uploading

**Handler — `handleNameMismatchChoice(choice)`:**
```typescript
const handleNameMismatchChoice = async (choice: NameMismatchChoice) => {
  if (!nameMismatch) return;
  const { pendingFile, fileType, nameInFile } = nameMismatch;
  setNameMismatch(null);
  if (choice === 'cancel') return;
  const extraQuery = fileType === 'glass_order' ? '?confirm=true' : '?confirmNameMismatch=true';
  await uploadFile(pendingFile, fileType, extraQuery);
  if (choice === 'update') {
    // Name update is now a separate PATCH call — upload endpoint no longer mutates project name
    await fetch(`${API_BASE}/api/erp/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInFile }),
    });
    await loadProject();
  }
};
```

| Button | `choice` | What happens |
|---|---|---|
| Keep (default) | `'keep'` | Confirms upload; project name unchanged |
| Update | `'update'` | Confirms upload; then PATCHes project name |
| × / backdrop | `'cancel'` | Discards upload |

**⚠️ v4.0.10 rule: The upload endpoint NEVER mutates `projects.name`. Name updates are always a separate PATCH.**

---

## 7. Frontend — Re-upload Confirmation Dialog (v4.0.10)

**When triggered:** User clicks the upload button on a single-file slot that already has an active file (`fileFor(fileType) !== null`).

**Component:** `<ReUploadConfirmModal>` (`src/components/erp/ReUploadConfirmModal.tsx`)

**Default button: Cancel** (user must explicitly click "Replace" to proceed).

**Logic in `triggerUpload()`:**
```typescript
const triggerUpload = (fileType: string) => {
  const isMulti = ['vendor_order', 'qoyod', 'other'].includes(fileType);
  if (!isMulti && fileFor(fileType) !== null) {
    setPendingReUploadFileType(fileType);  // show confirm modal
    return;
  }
  // otherwise open file picker directly
};
```

Multi-file slots (`vendor_order`, `qoyod`, `other`) are exempt — they accumulate files by design.

---

## 8. Frontend — After Upload Success

After a successful (non-409) upload, these load functions are called in order:

| File type | Functions called in order |
|---|---|
| `glass_order` | `loadQrOrders()` → `loadProject()` → `loadAllFiles()` |
| `assembly_list` / `cut_optimisation` | `loadProject()` → `loadParsedData()` → `loadAllFiles()` |
| All other types | `loadProject()` → `loadAllFiles()` |

**Load function state effects:**

```typescript
// loadProject() — line 954
const loadProject = async () => {
  if (!project) setLoading(true);   // spinner only on INITIAL load (project === null)
  try {
    const res = await fetch(`${API_BASE}/api/erp/projects/${id}`);
    if (res.ok) {
      setProject(data);             // updates stage, name, all project fields
      setNotes(data.notes ?? '');
    }
  } finally {
    setLoading(false);
  }
};

// loadAllFiles() — line 1180
const loadAllFiles = async () => {
  const res = await fetch(`${API_BASE}/api/erp/projects/${id}/files?includeInactive=true`);
  if (res.ok) setAllFiles(await res.json());  // all versions including inactive
};

// loadQrOrders() — line 968
const loadQrOrders = async () => {
  setLoadingQrOrders(true);
  const res = await fetch(`${API_BASE}/api/erp/projects/${id}/qr-orders`);
  if (res.ok) setQrOrders(await res.json());
  setLoadingQrOrders(false);
};

// loadParsedData() — line 978
// fetches both parsed-assembly-list and parsed-cut-optimisation in parallel
```

**Scroll preservation:**
```typescript
const scrollY = window.scrollY;          // captured before any load calls
// ... all awaits ...
requestAnimationFrame(() => window.scrollTo(0, scrollY));  // restored after all
```

The `if (!project) setLoading(true)` guard (line 955) prevents the loading skeleton from appearing during refresh uploads — the page content stays in DOM, content height never collapses, scroll position is never disturbed by the browser.

---

## 9. Frontend — Delete Flow

**Trigger:** User clicks delete icon on a file → confirm dialog → `deleteFile(fileId)` (line 1156):

```typescript
const deleteFile = async (fileId: number) => {
  setConfirmDeleteFileId(null);       // close confirm dialog
  setDeletingFileId(fileId);          // show spinner on this file

  try {
    await fetch(`${API_BASE}/api/erp/projects/${id}/files/${fileId}`, { method: 'DELETE' });

    const scrollY = window.scrollY;
    await loadProject();              // refresh project (stage doesn't change on delete)
    await loadAllFiles();             // remove file from list
    requestAnimationFrame(() => window.scrollTo(0, scrollY));

  } finally {
    setDeletingFileId(null);
  }
};
```

**Note:** Delete is a **hard delete** — the record is removed from the database entirely. There is no soft-delete or `isActive = false` on delete. File versioning (inactive rows) is only for re-uploads of single-file types, not deletes.

---

## 10. Frontend — Required Files Checklist

Rendered at lines 1759–1781 in the "Project Files" section. **No API call** — derived entirely from local state.

```typescript
// For each slot in FILE_SLOTS:
if (slot.fileType === 'glass_order') {
  // glass_order is special: present if EITHER a project_files entry OR a qr-orders entry exists
  checked = fileFor('glass_order') !== null || qrOrders.length > 0;
} else if (slot.multiFile) {
  // multi-file: present if at least one active file of this type exists
  checked = allFiles.some(f => f.fileType === slot.fileType && f.isActive);
} else {
  // single-file: present if there's an active file for this type
  checked = fileFor(slot.fileType) !== null;
}
```

Where `fileFor(type)` is:
```typescript
allFiles.find(f => f.fileType === type && f.isActive === true) ?? null
```

**Updates when:** `allFiles` state changes (after any `loadAllFiles()` call) or `qrOrders` state changes (after any `loadQrOrders()` call).

---

## 11. Frontend — Glass/Panel Order Dual Display

The `glass_order` slot is the only slot that shows data from **two separate sources**:

| Source | Table | What it shows |
|---|---|---|
| `project_files` | `project_files` | Uploaded `.docx` file (the raw Orgadata file) |
| `qrOrders` | `processed_docs` | The QR-processed version with position count and HTML report link |

When a glass_order `.docx` is uploaded:
1. The raw file is saved to **both** `project_files` (as `fileType = 'glass_order'`) AND `processed_docs` (after QR pipeline runs)
2. The slot shows the `project_files` entry as the "current file"
3. The QR report link is shown from `processed_docs` via `qrOrders` state

```typescript
// Glass order slot check in Required Files Checklist
checked = fileFor('glass_order') !== null || qrOrders.length > 0;
// (true if EITHER table has data)
```

A dedicated QR Orders section at the bottom of the page (line 2047) also lists all QR-processed glass orders with position count and report download links.

---

## 12. Backend — Multer Configuration

Three multer instances in `erp.ts` (lines 51–77):

```typescript
// For .docx validation (Orgadata file slots)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },   // 50MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || file.originalname.toLowerCase().endsWith('.docx')) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx files are accepted'));
    }
  },
});

// For multi/any files (vendor_order, qoyod, other, detect endpoint)
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },   // no fileFilter = accept any type
});

// For payment receipts (PDF/any)
const uploadAny = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
```

**The actual upload route uses `uploadMulti`** with `.fields()`:
```typescript
uploadMulti.fields([{ name: 'file', maxCount: 1 }, { name: 'files', maxCount: 20 }])
```

**FormData field names:**
- Flow A & B (single): `'file'` — single file + `'fileType'` string
- Flow C (batch upload): calls `uploadFile()` per item, so also `'file'` + `'fileType'`
- Detect endpoint: `'files'` array

---

## 13. Backend — POST /files (Single Upload Path)

**Route:** `POST /api/erp/projects/:id/files`
**Middleware:** `requireRole('Admin', 'FactoryManager', 'Employee')`
**Body:** `FormData` with `file` (single) + `fileType` (string)

### Glass Order path (lines 921–998):

1. Extract `orgadataName` from `.docx` with `extractProjectNameFromDocx()`
2. If `?confirm !== 'true'`:
   - Compare: `orgadataName.toLowerCase().trim() !== project.name.toLowerCase().trim()`
   - If mismatch → **409** `{ conflict: true, orgadataName, systemName, message }`
3. If `?confirm=true` and `?updateName=true` → `UPDATE projects SET name = orgadataName`
4. Run `parseAndInjectQR()` on the file buffer
5. Insert into `processed_docs` (with `projectId` link)
6. Call `autoAdvanceStage(projectId, 'glass_order', currentStage)` → may advance to stage 3
7. Return `{ fileId, projectName, totalPositions, positions }`

### Quotation path (lines 1000–1060):

1. Mark existing active quotation files `isActive = false` (versioning)
2. Insert new file as `isActive = true` → get `newFileId`
3. Parse with `parseQuotationDocx()` → extract `projectName`
4. Compare with `namesMatch(parsed.projectName, project.name)`:
   - `namesMatch()` normalizes: lowercase, strip special chars, collapse whitespace
   - If mismatch AND `?confirmNameMismatch !== 'true'`:
     - Mark new file `isActive = false` (rollback without hard delete)
     - Return **409** `{ error: 'PROJECT_NAME_MISMATCH', nameInFile, nameInSystem, hint }`
   - If `?updateProjectName=true` → `UPDATE projects SET name = parsed.projectName`
5. Call `autoAdvanceStage(projectId, 'quotation', currentStage)` → may advance to stage 4
6. Return file record

### All other single-file types (section, assembly_list, cut_optimisation, material_analysis):

1. Mark existing active files of this type `isActive = false`
2. Insert new file as `isActive = true`
3. Run post-save parsers (assembly_list → parse position data; cut_optimisation → parse profiles)
4. Call `autoAdvanceStage()` → section/assembly_list/cut_optimisation/material_analysis advance to stage 2

### Multi-file types (vendor_order, qoyod, other):

1. **Skip** the `isActive = false` step — all files coexist as active
2. Insert new file as `isActive = true`
3. Call `autoAdvanceStage()` → vendor_order advances to stage 3

---

## 14. Backend — POST /files (Batch Path)

Same route `POST /api/erp/projects/:id/files` but body has `files[]` array + `fileTypes` JSON array.

**Triggered by:** `handleUploadAll()` — which actually calls `uploadFile()` per item, so each item hits the **single** path above. The true "batch route" (lines 817–894) is for a different batch mechanism where `fileTypes` JSON array is passed.

In practice, the frontend always uses Flow C's `handleUploadAll()` which calls `uploadFile()` once per file (single path), NOT the batch path.

---

## 15. Backend — POST /files/detect

**Route:** `POST /api/erp/projects/:id/files/detect`
**Middleware:** `requireRole('Admin', 'FactoryManager', 'Employee')`
**Body:** `FormData` with `files[]` array (up to 20 files)

```typescript
const results = files.map(f => {
  const { detected, confidence } = detectFileType(f.originalname);
  return { filename: f.originalname, size: f.size, detectedType: detected, confidence };
});
res.json(results);
```

**No database writes.** Detection is filename-pattern matching only:

| Filename contains | Detected as | Confidence |
|---|---|---|
| `glass_panel_order` or `glass panel order` | `glass_order` | high |
| `quotation` | `quotation` | high |
| `section` | `section` | high |
| `assembly_list` or `assembly list` | `assembly_list` | high |
| `cut_optimisation` or `cut optimisation` | `cut_optimisation` | high |
| `material_analysis` or `material analysis` | `material_analysis` | high |
| `order_-_` or `order -` (but NOT glass) | `vendor_order` | high |
| Anything else | `null` | low |

---

## 16. Backend — GET /files

**Route:** `GET /api/erp/projects/:id/files`
**Query param:** `?includeInactive=true` (default: false, only returns active files)

```typescript
const rows = await db.select({ id, projectId, fileType, originalFilename, uploadedAt, uploadedBy, isActive })
  .from(projectFilesTable)
  .where(
    includeInactive
      ? eq(projectFilesTable.projectId, id)
      : and(eq(projectFilesTable.projectId, id), eq(projectFilesTable.isActive, true))
  )
  .orderBy(desc(projectFilesTable.uploadedAt));
```

**Frontend always calls with `?includeInactive=true`** (so Previous Versions can be shown).

**Does NOT return `fileData` (BYTEA)** — binary is excluded from list responses for performance.

---

## 17. Backend — GET /files/expected

**Route:** `GET /api/erp/projects/:id/files/expected`

Returns the 9-slot status array. For each slot in `KNOWN_FILE_TYPES`:
```typescript
{
  type: string,
  labelEn: string,
  labelAr: string,
  multi: boolean,
  uploaded: boolean,        // has any version (including inactive)
  activeFile: object|null,  // the current active file record
  versionCount: number,     // total versions including inactive
}
```

**Note:** `quotation` slot includes both `'quotation'` and `'price_quotation'` file types (legacy alias).

**Frontend does NOT currently call this endpoint.** The checklist is computed from `allFiles` state directly.

---

## 18. Backend — DELETE /files/:fileId

**Route:** `DELETE /api/erp/projects/:id/files/:fileId`
**Route-level middleware:** `requireRole('Admin', 'FactoryManager')`
**Permission as of v4.0.11 (Rule 10):** Check: role is Admin only. FactoryManager and Accountant can no longer delete files. The frontend `canDeleteFile(role)` helper in `lib/permissions.ts` enforces this at the UI layer (hides the delete option for non-Admin). The route-level middleware still lists FactoryManager to avoid breaking existing tokens; the actual deletion guard in the handler is Admin-only.

```typescript
await db.delete(projectFilesTable).where(eq(projectFilesTable.id, fileId));
res.status(204).send();
```

**Hard delete** — record removed from database entirely. Returns 204 No Content.

**No cascade** — only deletes the file record itself. Does NOT change `isActive` on other versions.

---

## 19. Backend — File Versioning (is_active)

**Applies to:** Single-file types only (`glass_order`, `quotation`, `section`, `assembly_list`, `cut_optimisation`, `material_analysis`)

**On re-upload of a single-file type:**
```typescript
if (!MULTI_FILE_TYPES.includes(fileType)) {
  await db.update(projectFilesTable)
    .set({ isActive: false })
    .where(and(
      eq(projectFilesTable.projectId, projectId),
      eq(projectFilesTable.fileType, fileType),
      eq(projectFilesTable.isActive, true)
    ));
}
// then insert new file with isActive: true
```

**Result:** Old file stays in DB with `isActive = false` (Previous Versions). New file is `isActive = true` (Current). History is preserved, never deleted.

**Multi-file types** (`vendor_order`, `qoyod`, `other`): This block is skipped. All uploaded files stay `isActive = true` indefinitely.

**On delete:** Hard delete — no `isActive` manipulation.

**Frontend display:**
- `fileFor(type)` → `allFiles.find(f => f.fileType === type && f.isActive === true)` → current active
- `inactiveFor(type)` → `allFiles.filter(f => f.fileType === type && f.isActive === false)` → old versions

---

## 20. Backend — autoAdvanceStage

Called after every successful file upload:

```typescript
async function autoAdvanceStage(projectId: number, fileType: string, currentStage: number) {
  let targetStage: number | null = null;

  if (['section', 'assembly_list', 'cut_optimisation', 'material_analysis'].includes(fileType) && currentStage < 2) {
    targetStage = 2;   // → in_study
  } else if (fileType === 'vendor_order' && currentStage < 3) {
    targetStage = 3;   // → in_study (procurement)
  } else if ((fileType === 'quotation' || fileType === 'price_quotation') && currentStage < 4) {
    targetStage = 4;   // → in_study (quotation stage)
  } else if (fileType === 'glass_order' && currentStage < 3) {
    targetStage = 3;   // → in_study
  }

  if (targetStage !== null) {
    await db.update(projectsTable)
      .set({ stageInternal: targetStage, stageDisplay: getDisplayStage(targetStage) })
      .where(eq(projectsTable.id, projectId));
  }
}
```

**Stage mapping:**
| File uploaded | Advances project to stage | Only if currently below |
|---|---|---|
| section / assembly_list / cut_optimisation / material_analysis | 2 (in_study) | < 2 |
| vendor_order | 3 (in_study / procurement) | < 3 |
| quotation / price_quotation | 4 (in_study / quotation) | < 4 |
| glass_order | 3 (in_study) | < 3 |

**Never advances backward.** `currentStage < targetStage` ensures only forward movement.

---

## 21. Backend — Orgadata Name Mismatch Logic

### Glass Order

Comparison (line 935):
```typescript
orgadataName.toLowerCase().trim() !== project.name.toLowerCase().trim()
```

Response on mismatch (409):
```json
{ "conflict": true, "orgadataName": "...", "systemName": "...", "message": "Project name in file differs from system name" }
```

Resolution query params:
- `?confirm=true` — skip check and proceed
- `?confirm=true&updateName=true` — proceed AND update `projects.name`

### Quotation

Comparison uses `namesMatch()` which calls `normalizeProjectName()`:
```typescript
function normalizeProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ\s]/g, ' ')  // keep Arabic chars
    .replace(/\s+/g, ' ')
    .replace(/\s/g, '')
    .trim();
}
```

Response on mismatch (409):
```json
{
  "error": "PROJECT_NAME_MISMATCH",
  "message": "Project name in file does not match project in system",
  "nameInFile": "...",
  "nameInSystem": "...",
  "hint": "Re-submit with ?confirmNameMismatch=true to proceed, or cancel the upload"
}
```

Resolution query params:
- `?confirmNameMismatch=true` — proceed (keep current project name)
- `?confirmNameMismatch=true&updateProjectName=true` — proceed AND update `projects.name`

---

## 22. Database Schemas

### project_files

```typescript
pgTable("project_files", {
  id:               serial("id").primaryKey(),
  projectId:        integer("project_id").notNull().references(() => projectsTable.id),
  fileType:         text("file_type").notNull(),        // glass_order|quotation|section|assembly_list|cut_optimisation|material_analysis|vendor_order|qoyod|other
  originalFilename: text("original_filename").notNull(),
  fileData:         bytea("file_data").notNull(),        // raw file bytes — excluded from list queries
  uploadedAt:       timestamp("uploaded_at").notNull().defaultNow(),
  uploadedBy:       integer("uploaded_by").notNull().references(() => usersTable.id),
  isActive:         boolean("is_active").notNull().default(true),  // false = superseded version
});
```

### processed_docs (QR pipeline output — glass_order only)

```typescript
pgTable("processed_docs", {
  id:               serial("id").primaryKey(),
  originalFilename: text("original_filename").notNull(),
  reportFilename:   text("report_filename").notNull(),  // generated HTML report filename
  projectName:      text("project_name"),               // extracted from .docx
  processingDate:   text("processing_date"),            // from QR pipeline
  positionCount:    integer("position_count").notNull().default(0),
  originalFile:     bytea("original_file").notNull(),
  reportFile:       bytea("report_file").notNull(),     // generated HTML bytes
  projectId:        integer("project_id").references(() => projectsTable.id),  // NULLable — set to NULL on project delete
  createdAt:        timestamp("created_at").notNull().defaultNow(),
});
```

---

## 23. Data Flow Diagrams

### Scenario A — User clicks upload on Quotation slot → selects file

```
User clicks upload icon on Quotation slot
  │
  ▼
triggerUpload('quotation')                  [ProjectDetail.tsx:1071]
  ├─ fileInputRef.current.accept = '.docx'  [only .docx accepted]
  ├─ setPendingFileType('quotation')
  └─ fileInputRef.current.click()           [opens OS file picker]

User selects "My Quotation.docx"
  │
  ▼
handleFileChange(e)                         [ProjectDetail.tsx:1129]
  ├─ file = e.target.files[0]
  ├─ pendingFileType = 'quotation'
  ├─ fileInputRef.current.value = ''        [reset input]
  └─ uploadFile(file, 'quotation')

uploadFile(file, 'quotation', '')           [ProjectDetail.tsx:1080]
  ├─ setUploadingFor('quotation')           [show spinner on slot]
  ├─ FormData: { file: blob, fileType: 'quotation' }
  └─ POST /api/erp/projects/42/files

    [BACKEND — erp.ts]
    ├─ Mark existing active quotation isActive = false
    ├─ INSERT project_files { fileType: 'quotation', isActive: true } → newFileId
    ├─ parseQuotationDocx(buffer) → parsed.projectName
    ├─ namesMatch(parsed.projectName, 'Project Al-Ameen')?
    │
    │  Case A — MATCH:
    │  ├─ autoAdvanceStage(42, 'quotation', 1) → sets stageInternal = 4
    │  └─ return 200 { id, fileType, originalFilename, uploadedAt, isActive }
    │
    │  Case B — MISMATCH (confirmNameMismatch not set):
    │  ├─ UPDATE project_files SET isActive = false WHERE id = newFileId  [rollback]
    │  └─ return 409 { error: 'PROJECT_NAME_MISMATCH', nameInFile, nameInSystem }
    │
    [FRONTEND]
    │
    ├─ Case A (200):
    │  ├─ const scrollY = window.scrollY
    │  ├─ await loadProject()      → setProject (stage now = 4)
    │  ├─ await loadAllFiles()     → setAllFiles (new file appears, old isActive=false)
    │  └─ requestAnimationFrame(() => window.scrollTo(0, scrollY))
    │
    └─ Case B (409):
       ├─ setNameMismatch({ nameInFile, nameInSystem, pendingFile: file, fileType: 'quotation' })
       └─ NameMismatchModal appears

User clicks "Keep Current Name"
  │
  ▼
handleNameMismatchChoice('proceed')         [ProjectDetail.tsx:1118]
  ├─ setNameMismatch(null)                  [close dialog]
  └─ uploadFile(file, 'quotation', '?confirmNameMismatch=true')

  [BACKEND receives ?confirmNameMismatch=true]
  ├─ namesMatch check is skipped
  ├─ autoAdvanceStage(42, 'quotation', 1) → sets stageInternal = 4
  └─ return 200

  [FRONTEND success path — same as Case A above]
```

---

### Scenario B — User clicks "Select files" → picks 3 files → detection → upload all

```
User clicks "Select files" button
  │
  └─ batchInputRef.current.click()          [batchInputRef, accept='.docx', multiple]

User selects: "Glass_Panel_Order.docx", "My_Quotation.docx", "unknown.pdf"
  │
  ▼
handleBatchSelect(e)                        [ProjectDetail.tsx:1187]
  ├─ files = [File, File, File]
  ├─ batchInputRef.current.value = ''
  ├─ setDetectingBatch(true)
  ├─ FormData: { files: [blob1, blob2, blob3] }
  └─ POST /api/erp/projects/42/files/detect

    [BACKEND]
    ├─ detectFileType('Glass_Panel_Order.docx') → { detected: 'glass_order', confidence: 'high' }
    ├─ detectFileType('My_Quotation.docx')      → { detected: 'quotation',   confidence: 'high' }
    ├─ detectFileType('unknown.pdf')            → { detected: null,          confidence: 'low'  }
    └─ return [ {filename, size, detectedType, confidence}, ... ]

  ├─ setDetectionItems([
  │    { filename: 'Glass_Panel_Order.docx', assignedType: 'glass_order',  confidence: 'high' },
  │    { filename: 'My_Quotation.docx',      assignedType: 'quotation',    confidence: 'high' },
  │    { filename: 'unknown.pdf',            assignedType: 'other',        confidence: 'low'  },
  │  ])
  └─ setDetectingBatch(false)

Detection summary panel renders — user sees 3 files with assigned types
User changes 'unknown.pdf' from 'other' to 'vendor_order'  →  updateDetectionItem(2, 'vendor_order')

User clicks "Upload All"
  │
  ▼
handleUploadAll()                           [ProjectDetail.tsx:1220]
  ├─ setUploadingBatch(true)
  ├─ const scrollY = window.scrollY
  │
  ├─ await uploadFile(Glass_Panel_Order.docx, 'glass_order')  → 200, loadQrOrders+loadProject+loadAllFiles
  ├─ await uploadFile(My_Quotation.docx, 'quotation')         → 200 or 409 (handled normally)
  ├─ await uploadFile(unknown.pdf, 'vendor_order')            → 200, loadProject+loadAllFiles
  │
  ├─ setDetectionItems([])                  [clear panel]
  ├─ await loadAllFiles()                   [final refresh]
  └─ requestAnimationFrame(() => window.scrollTo(0, scrollY))
```

---

### Scenario C — Upload triggers 409 → user clicks "Keep current name"

```
uploadFile(file, 'quotation') called
  └─ POST /api/erp/projects/42/files
       └─ 409 { error: 'PROJECT_NAME_MISMATCH', nameInFile: 'Al Ameen Tower', nameInSystem: 'Al-Ameen Tower' }

  ├─ setNameMismatch({ nameInFile: 'Al Ameen Tower', nameInSystem: 'Al-Ameen Tower', pendingFile: file, fileType: 'quotation' })
  └─ return (early exit from uploadFile)

NameMismatchModal renders with both names shown
User clicks "Keep Current Name"

handleNameMismatchChoice('proceed')
  ├─ setNameMismatch(null)                  [close modal]
  ├─ params = '?confirmNameMismatch=true'
  └─ uploadFile(file, 'quotation', '?confirmNameMismatch=true')

POST /api/erp/projects/42/files?confirmNameMismatch=true
  ├─ Mark old quotation isActive = false
  ├─ INSERT new quotation isActive = true
  ├─ confirmNameMismatch=true → skip 409 check
  ├─ autoAdvanceStage → stage 4
  └─ 200 OK

  loadProject() + loadAllFiles() + scroll restore
```

---

### Scenario D — User deletes a file from Vendor Order slot

```
User clicks delete icon on a vendor_order file
  │
  └─ setConfirmDeleteFileId(fileId)         [show confirm dialog]

User clicks "Confirm Delete"
  │
  ▼
deleteFile(fileId)                          [ProjectDetail.tsx:1156]
  ├─ setConfirmDeleteFileId(null)           [close dialog]
  ├─ setDeletingFileId(fileId)             [show spinner on file row]
  │
  └─ DELETE /api/erp/projects/42/files/17

    [BACKEND]
    ├─ Check: role is Admin only (Rule 10 — v4.0.11+; FactoryManager/Accountant no longer delete)
    ├─ DELETE FROM project_files WHERE id = 17
    └─ 204 No Content

  ├─ const scrollY = window.scrollY
  ├─ await loadProject()                   [no stage change, but refreshes display]
  ├─ await loadAllFiles()                  [file disappears from list]
  ├─ requestAnimationFrame(() => window.scrollTo(0, scrollY))
  └─ setDeletingFileId(null)
```

---

*This guide reflects the codebase as of v4.0.13 (April 2026) — keep in sync with STAGE_6_5_PHILOSOPHY_ALIGNMENT.md Rules 10–12. Update when upload logic changes.*
