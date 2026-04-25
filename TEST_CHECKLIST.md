# TEST_CHECKLIST.md — Verify before EVERY commit
# Claude Code must check items related to the current change before committing.

## File Upload (check if change touches ProjectDetail, erp.ts file routes, or file-detector)
- [ ] Upload to Glass Order slot → file appears with filename + date
- [ ] Upload to Quotation slot → file appears + 409 mismatch dialog works
- [ ] Upload to Section slot → file appears
- [ ] Upload to Assembly List slot → file appears + parsed badge shows
- [ ] Upload to Cut Optimisation slot → file appears
- [ ] Upload to Material Analysis slot → file appears
- [ ] Upload to Vendor Order → file in list, add second → both show
- [ ] Upload to Qoyod → file in list
- [ ] Upload to Other → file in list
- [ ] Re-upload single slot → old inactive, new shows, Previous versions (N)
- [ ] Delete from multi-file slot → removed
- [ ] "Select files" batch → detection summary → upload all → correct slots
- [ ] Required files checklist updates when file exists
- [ ] Individual slot uses slot fileType, NOT auto-detection
- [ ] Batch uses auto-detection from file-detector.ts

## Sidebar (check if change touches AdminLayout)
- [ ] Manufacturing System expanded by default
- [ ] Service Requests is second item after Dashboard
- [ ] All ERP items visible: Clients, Projects, Payments, Vendors, Settings
- [ ] Document System collapsible
- [ ] Mobile hamburger menu works

## Theme (check if change touches CSS, index.css, or any page styling)
- [ ] ALL pages use #F4F2EB body background
- [ ] ALL cards use #FAFAF7 bg, #ECEAE2 border, rounded-xl
- [ ] No bg-white, bg-gray-50, border-gray-200 remnants
- [ ] Dashboard matches design reference

## Core ERP (check if change touches leads, projects, payments, vendors)
- [ ] Create lead → convert to project works
- [ ] Stage advances on file upload
- [ ] Payment milestones: create, mark paid, overdue badge
- [ ] Vendors: create, delete blocked if active POs
- [ ] POs: create with items, receive, auto-status
- [ ] Manufacturing: send, start, complete
- [ ] Phases: deliver, install, sign-off, QR confirm
- [ ] Contract: generate, print
- [ ] Warranty: auto-start, auto-expiry

## Build (ALWAYS check)
- [ ] pnpm run typecheck — zero errors
- [ ] pnpm run build — passes
- [ ] All fetch calls use API_BASE
