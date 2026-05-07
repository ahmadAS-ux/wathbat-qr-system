# Pre-Handover QA Audit Report: Wathbah QR Asset Manager
**Date:** May 1, 2026  
**Auditor:** Senior QA Engineer (AI Audit)  
**Status:** 🔴 CRITICAL BLOCKERS FOUND

---

## 1. Executive Summary
The Wathbah QR Asset Manager application is functionally rich but currently **unstable** and **not production-ready** for client handover. While the core QR generation pipeline has been successfully integrated into the ERP Project system, multiple backend 500 errors render the main dashboard and activity feeds unusable. Significant bilingual and asset-loading issues also detract from the premium feel expected by the client.

---

## 2. Critical Blockers (Handover Stoppers)

### 2.1 Backend API Instability (500 Internal Server Errors)
The application suffers from persistent 500 errors on key dashboard endpoints. This is caused by SQL query errors referencing non-existent columns in the database schema.
*   **Stats Trends (`/api/erp/stats/trends`):** Fails because it attempts to join `payment_milestones` on a non-existent `created_at` column (should likely be `paid_at` or a new `created_at` needs to be added).
*   **Activity Feed (`/api/erp/activity`):** Fails because it references `pf.created_at` in the `project_files` table, whereas the actual column name is `uploaded_at`.
*   **Impact:** The dashboard is completely broken for Admin and Factory Manager roles, showing infinite loaders or empty states.

### 2.2 Missing/Retired Standalone QR Flow
The standalone "Process QR" menu item from the v1.0 design has been retired in favor of the ERP Project integration. However:
*   The transition is not explained to the user.
*   The `/qr` routes in the frontend occasionally trigger 404s because the sidebar logic for `canViewQRSystem` is inconsistent with the new Project-based workflow.

### 2.3 Broken Static Assets
*   Company logos in the **Auth (Login)** and **Sidebar** components are broken (`404 Not Found`).
*   **Impact:** High negative impact on "first impression" and brand trust.

---

## 3. UI/UX & Bilingual Audit

### 3.1 Localization (i18n) Defects
*   **Hardcoded Headers:** Dashboard card headers (e.g., "ACTIVE PROJECTS", "TOTAL REVENUE") remain in English even when the Arabic toggle is active.
*   **Mixed Languages:** Success/Error toast messages for project creation are inconsistently translated.
*   **RTL Alignment:** Several table columns in the "Project Details" view do not properly align for RTL, leading to text/icon overlaps.

### 3.2 Navigation & Feedback
*   **Silent Failures:** When creating a project, if the API returns a 500 error, the UI remains in a "Loading" state indefinitely with no error toast.
*   **Mobile Sidebar:** On mobile resolutions (375px), the sidebar occasionally fails to close after selecting a menu item, obstructing the main content.

---

## 4. Functional Test Results

| Feature | Test Case | Status | Notes |
| :--- | :--- | :--- | :--- |
| **Auth** | Login with valid credentials | ✅ Pass | Bilingual toggle works on login page. |
| **Dashboard** | View KPIs and Trends | ❌ Fail | 500 Internal Server Error (Column Mismatch). |
| **Projects** | Create new project | ✅ Pass | Functional, but lacks feedback on failure. |
| **QR System** | Upload .docx to "Glass Order" slot | ✅ Pass | Correctly triggers QR generation and HTML report. |
| **QR Report** | Download/View QR Report | ✅ Pass | Links are correct; report renders in new tab. |
| **Payments** | Mark milestone as paid | ✅ Pass | Updates status and adds file proof correctly. |

---

## 5. Technical Recommendations

1.  **Backend Schema Sync:** Update `artifacts/api-server/src/routes/erp.ts` to use correct column names:
    *   Change `pf.created_at` to `pf.uploaded_at`.
    *   Add a `created_at` column to `payment_milestones` or update the stats query to use a fallback.
2.  **Asset Restoration:** Verify the existence of `logo.png` and `wathbat-logo.png` in the `public` directory and ensure paths are relative (e.g., `/logo.png` instead of hardcoded dev paths).
3.  **i18n Implementation:** Audit `artifacts/qr-manager/src/lib/i18n.ts` and ensure all dashboard titles are mapped.
4.  **Error Handling:** Implement a global interceptor or update `fetch` calls to include `timeout` and `onError` callbacks to prevent "stuck" loading states.

---
**Audit Decision:** ⛔ **NOT READY FOR HANDOVER**
