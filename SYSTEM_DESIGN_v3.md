# SYSTEM_DESIGN_v3.md
# التصميم النهائي للنظام — الإصدار الثالث

> **Version:** 3.0 — April 2026
> **Status:** Approved by Ahmad + Factory Manager
> **Replaces:** Previous 14-stage workflow
> **This file:** Definitive design reference for all implementation

---

## 1. Project Lifecycle — 15 Stages (0–14)

| # | Key | English | Arabic | Type |
|---|-----|---------|--------|------|
| 0 | lead | Lead | عميل محتمل | Linear |
| 1 | inquiry | Inquiry | استفسار | Linear |
| 2 | tech_study | Tech Study | دراسة فنية | Iterative ⟷ 3,4 |
| 3 | procurement | Procurement | مشتريات | Iterative ⟷ 2,4 |
| 4 | quotation | Quotation | عرض سعر | Iterative ⟷ 2,3 |
| 5 | contract | Contract | العقد | Linear |
| 6 | deposit | Deposit | الدفعة الأولى | Linear |
| 7 | manufacturing | Manufacturing | التصنيع | Parallel ↔ 8 |
| 8 | receiving | Receiving | استلام المواد | Parallel ↔ 7 |
| 9 | delivery | Delivery | التوصيل | Per phase |
| 10 | installation | Installation | التركيب | Per phase |
| 11 | signoff | Sign-off | التسليم | Per phase |
| 12 | payment | Payment | المدفوعات | Continuous from stage 6 |
| 13 | warranty | Warranty | الضمان | Linear |
| 14 | done | Done | مكتمل | Linear |

### Stage Rules

**Iteration loop (2-3-4):**
- Customer rejects quotation → can go back to Tech Study or Procurement
- Re-uploading files keeps old versions (is_active = false), new is active
- Stage only advances past 4 when customer approves (contract)

**Parallel (7-8):**
- Manufacturing and Receiving happen simultaneously
- Materials arrive one by one while factory works

**Per phase (9-10-11):**
- Each project phase moves through Delivery → Installation → Sign-off independently
- Project overall stage = the least advanced phase

**Continuous (12):**
- Payment tracking starts from Deposit (stage 6)
- Runs alongside all other stages

### Display Stage Mapping (4 UI badges)

| Display | Internal Stages | Color |
|---------|----------------|-------|
| New | 0, 1 | Gray |
| In Study | 2, 3, 4 | Blue |
| In Production | 5, 6, 7, 8 | Amber |
| Complete | 9, 10, 11, 12, 13, 14 | Teal |

---

## 2. Project Phases (مراحل المشروع)

A project can have 1 or more phases. Typically 1-3, can be more.

Each phase represents a batch of work that gets:
- Manufactured together
- Delivered together
- Installed together
- Signed off together
- Paid for together (linked payment milestone)

### Phase Data Model

```
project_phases table:
  id              SERIAL PRIMARY KEY
  project_id      INTEGER FK → projects.id
  phase_number    INTEGER (1, 2, 3...)
  label           TEXT ("Ground floor windows", "First floor", etc.)
  status          TEXT ('pending' | 'manufacturing' | 'delivered' | 'installed' | 'signed_off')
  delivered_at    TIMESTAMP
  installed_at    TIMESTAMP
  signed_off_at   TIMESTAMP
  notes           TEXT
  created_at      TIMESTAMP DEFAULT NOW()
```

### Phase Status Flow

```
pending → manufacturing → delivered → installed → signed_off
```

### Phase → Project Stage Mapping

The project's overall stage is determined by its phases:
- If ANY phase is in 'manufacturing' → project stage = 7 (manufacturing)
- If ANY phase is in 'delivered' but not all signed off → project stage = 9 (delivery)
- If ALL phases are 'signed_off' → project stage = 11 (sign-off complete)
- The project stage = the LOWEST stage across all active phases

### Default Phase

Every project starts with 1 default phase: "Phase 1 / المرحلة 1"
Employee can add more phases as needed.

---

## 3. Payment Milestones (مراحل الدفع)

Payment milestones are **custom per project** — defined by the employee in the contract.

### Payment Milestone Data Model

```
payment_milestones table:
  id              SERIAL PRIMARY KEY
  project_id      INTEGER FK → projects.id
  label           TEXT ("Deposit", "Phase 1 sign-off", etc.)
  percentage      INTEGER (50, 10, 10, etc.)
  amount          INTEGER (SAR — calculated from total × percentage)
  linked_event    TEXT ('deposit' | 'phase_signoff:1' | 'phase_signoff:2' | 'delivery' | 'final' | 'custom')
  linked_phase_id INTEGER FK → project_phases.id (NULL if not phase-linked)
  status          TEXT ('pending' | 'due' | 'paid' | 'overdue')
  due_date        DATE
  paid_at         TIMESTAMP
  paid_amount     INTEGER
  qoyod_file_id   INTEGER FK → project_files.id
  notes           TEXT
```

### Default Payment Template

When creating a contract, the system suggests a default:
- Milestone 1: "Deposit / دفعة مقدمة" — 50% — linked to 'deposit'
- Milestone 2: "Before delivery / قبل التوصيل" — 40% — linked to 'delivery'
- Milestone 3: "After sign-off / بعد التسليم" — 10% — linked to 'final'

Employee can:
- Change percentages (must total 100%)
- Add more milestones (e.g., per phase sign-off)
- Change the linked event
- Remove milestones

### Auto-Trigger: Sign-off → Payment Due

When a phase sign-off happens:
1. System looks for payment milestones linked to that phase (linked_event = 'phase_signoff:N' or linked_phase_id = phase.id)
2. Changes milestone status from 'pending' to 'due'
3. Shows notification to Admin and Accountant
4. Dashboard shows "Payment due: Phase N sign-off — XX,XXX SAR"

### Payment in Contract

The contract document includes the payment schedule:
- Table showing: Milestone name | Percentage | Amount (SAR) | Linked to
- This is printed as part of the contract for customer signature

---

## 4. File Management

### 9 File Types

| Type | Key | Single/Multi | Auto-detect pattern |
|------|-----|-------------|-------------------|
| Glass / Panel Order | glass_order | Single | "Glass_Panel_Order" |
| Quotation | quotation | Single | "Quotation" |
| Section | section | Single | "Section" |
| Assembly List | assembly_list | Single | "Assembly_List" |
| Cut Optimisation | cut_optimisation | Single | "Cut_Optimisation" |
| Material Analysis | material_analysis | Single | "Material_Analysis" |
| Vendor Order | vendor_order | Multi | "Order_-_" (not Glass) |
| Qoyod | qoyod | Multi | — |
| Other | other | Multi | — |

### File Versioning

- Single-file types: re-upload sets old file to `is_active = false`, new file to `is_active = true`
- Old versions kept in database for future analysis
- UI shows active file in slot, with "Previous versions (N)" expandable
- Multi-file types: all files are `is_active = true` (no replacement logic)

### Smart Detection

1. Employee drops one or multiple files
2. System reads each filename, matches against detection patterns
3. Shows detection summary: "Glass Order ✅, Quotation ✅, Unknown File ⚠️"
4. Unknown files: employee picks category from dropdown or marks as "Other"
5. Misdetected files: employee can correct the category
6. "Upload All" button saves the batch

### Glass Order — Dual Display

The Glass/Panel Order slot shows TWO versions:
- **Original Orgadata file** — download .docx
- **QR Enhanced version** — view HTML report with QR codes added

### File → Stage Auto-Advance

| File uploaded | Advance to (if current < target) |
|--------------|--------------------------------|
| Section, Assembly List, Cut Optimisation, Material Analysis | Stage 2 (Tech Study) |
| Vendor Order | Stage 3 (Procurement) |
| Quotation | Stage 4 (Quotation) |
| Glass Order | Stage 3 (Procurement) |
| Contract printed | Stage 5 (Contract) |
| First Qoyod payment | Stage 6 (Deposit) |

Never auto-advance backwards.

---

## 5. Contract Document

The contract is a professional branded document (browser print → PDF):
- Wathbah logo (once, on cover)
- No Orgadata headers — this is Wathbah's contract
- Project name mentioned once at the top
- Customer info, project details
- Positions table (from Orgadata quotation)
- Drawings (from Section file)
- **Payment schedule table** (milestones with percentages and linked events)
- Terms and conditions (editable template from Settings)
- Signature block — space for customer signature
- Clean, professional layout suitable for WhatsApp sharing

---

## 6. Implementation Priority

### Prompt 1: Database + Backend (run first)
- is_active column on project_files
- project_phases table
- Update payment_milestones with linked_event and linked_phase_id
- Stage reorder (15 stages)
- File detection endpoint
- Multi-file upload endpoint
- Expected files endpoint
- Phase CRUD endpoints
- Auto-advance logic
- Sign-off → payment trigger

### Prompt 2: Frontend — Files + Stages (run second)
- Smart file upload UI (drag-drop multiple, detection summary, category picker)
- File versioning display (active + previous versions)
- Glass Order dual display (original + QR)
- 15-stage timeline with loop/parallel indicators
- Missing files checklist

### Prompt 3: Frontend — Phases + Payments (run third)
- Phase management UI (add/remove phases, status tracking)
- Payment milestone editor (link to events/phases, set percentages)
- Auto-trigger notification when phase signed off
- Updated contract template with payment schedule table
