import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { extractDocxToPdf } from "./docx-extractor.js";
import { htmlToPdf } from "./html-to-pdf.js";

export interface ContractMilestone {
  index: number;
  label: string;
  percentage: number | null;
  amount: number | null;
  dueDate: string | null;
  status: string;
}

export interface ContractData {
  // Output language: 'ar' or 'en'
  language: 'ar' | 'en';

  // Company info
  companyName: string;
  companyAddress: string;
  companyCr: string;
  companyVat: string;
  companyPhone: string;
  logoBase64?: string;
  logoMime?: string;

  // Project
  projectName: string;
  projectCode: string;

  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerLocation: string;

  // Contract metadata
  contractNumber: string;
  contractDate: string;
  generatedDate: string;
  quotationNumber: string;
  quotationDate: string;
  quotationFileName: string;

  // Template content
  coverIntroAr: string;
  coverIntroEn: string;
  termsAr: string;
  termsEn: string;
  signatureBlockAr: string;
  signatureBlockEn: string;

  // Payment milestones (may be empty)
  milestones: ContractMilestone[];
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Helper: convert any value to a safe display string.
// Used for nullable, numeric, or date fields before passing
// to escHtml (which expects strings).
function safeStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v instanceof Date) return v.toISOString().split('T')[0]!;
  return String(v);
}

// Format an amount in SAR with thousands separator.
function formatAmount(value: number | null, lang: 'ar' | 'en'): string {
  if (value === null || value === undefined) return '—';
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return lang === 'ar' ? `${formatted} ر.س` : `SAR ${formatted}`;
}

// Format a percentage. e.g. 30 → "30%"
function formatPercentage(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value}%`;
}

// Format a date string for display.
function formatDate(value: string | null): string {
  if (!value) return '—';
  return value;
}

// Translate milestone status code to display text.
function statusText(status: string, lang: 'ar' | 'en'): string {
  const map: Record<string, { ar: string; en: string }> = {
    pending:  { ar: 'معلّق',  en: 'Pending'  },
    due:      { ar: 'مستحق', en: 'Due'      },
    paid:     { ar: 'مدفوع', en: 'Paid'     },
    overdue:  { ar: 'متأخر', en: 'Overdue'  },
  };
  const entry = map[status];
  if (!entry) return escHtml(status);
  return entry[lang];
}

// Public dispatcher: language-aware HTML generation.
export function buildCoverHtml(data: ContractData): Buffer {
  if (data.language === 'en') return buildCoverHtmlEn(data);
  return buildCoverHtmlAr(data);
}

// ───────────────────────────────────────────────────────────
// Arabic version (RTL, single-language, 8-section template)
// ───────────────────────────────────────────────────────────
function buildCoverHtmlAr(data: ContractData): Buffer {
  const logoHtml = data.logoBase64
    ? `<img src="data:${data.logoMime};base64,${data.logoBase64}" style="max-height:80px;max-width:200px;" />`
    : '';

  const milestoneRows = data.milestones.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#999;font-style:italic;padding:12px;">لا توجد دفعات مسجلة لهذا المشروع</td></tr>`
    : data.milestones.map((m) => `
        <tr>
          <td style="text-align:center;">${m.index}</td>
          <td>${escHtml(safeStr(m.label))}</td>
          <td style="text-align:center;">${formatPercentage(m.percentage)}</td>
          <td style="text-align:center;">${formatAmount(m.amount, 'ar')}</td>
          <td style="text-align:center;">${escHtml(formatDate(m.dueDate))}</td>
        </tr>`).join('');

  const intro = data.coverIntroAr
    ? `<div class="text-block">${escHtml(data.coverIntroAr)}</div>`
    : `<div class="text-block empty-text">(لم يتم إعداد نص المقدمة)</div>`;

  const terms = data.termsAr
    ? `<div class="text-block">${escHtml(data.termsAr)}</div>`
    : `<div class="text-block empty-text">(لم يتم إعداد الشروط العامة)</div>`;

  const signatureBlock = data.signatureBlockAr
    ? `<div class="text-block">${escHtml(data.signatureBlockAr)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 1.5cm; }
  body {
    font-family: "Noto Naskh Arabic", "Noto Sans Arabic", "Liberation Sans", sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    line-height: 1.7;
    direction: rtl;
  }
  table { border-collapse: collapse; width: 100%; }
  .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
  .header img { max-height: 80px; max-width: 200px; display: block; margin-bottom: 8px; }
  .company-name { font-size: 18px; font-weight: bold; }
  .company-meta { font-size: 11px; color: #555; margin-top: 3px; }
  .doc-title {
    text-align: center;
    font-size: 22px;
    font-weight: bold;
    margin: 24px 0;
    border: 1px solid #ccc;
    padding: 12px;
  }
  .section-title {
    font-size: 14px;
    font-weight: bold;
    border-bottom: 1px solid #1a1a1a;
    margin: 24px 0 12px 0;
    padding-bottom: 4px;
  }
  .data-table { margin-bottom: 8px; }
  .data-table td {
    padding: 6px 10px;
    border: 1px solid #eee;
    vertical-align: top;
  }
  .data-table .lbl {
    font-weight: bold;
    width: 25%;
    background: #fafafa;
    color: #333;
  }
  .parties-block { margin-bottom: 8px; }
  .parties-block .party {
    border: 1px solid #eee;
    padding: 12px;
    margin-bottom: 8px;
    background: #fafafa;
  }
  .parties-block .party-title {
    font-weight: bold;
    font-size: 13px;
    color: #333;
    margin-bottom: 6px;
  }
  .milestones-table { margin-top: 8px; }
  .milestones-table th, .milestones-table td {
    padding: 6px 10px;
    border: 1px solid #ddd;
    text-align: right;
  }
  .milestones-table th {
    background: #f5f5f5;
    font-weight: bold;
    font-size: 11px;
  }
  .text-block {
    border: 1px solid #eee;
    padding: 12px;
    background: #fafafa;
    white-space: pre-wrap;
    line-height: 1.8;
  }
  .empty-text {
    color: #999;
    font-style: italic;
  }
  .signatures-table { margin-top: 16px; }
  .signatures-table td {
    width: 50%;
    padding: 16px;
    border: 1px solid #ccc;
    vertical-align: top;
  }
  .signatures-table .sig-header {
    font-weight: bold;
    margin-bottom: 12px;
    text-align: center;
  }
  .signatures-table .sig-line {
    border-bottom: 1px solid #999;
    height: 28px;
    margin: 14px 0 4px 0;
  }
  .signatures-table .sig-label {
    font-size: 10px;
    color: #555;
  }
  .attachments-line {
    border: 1px solid #eee;
    padding: 10px;
    background: #fafafa;
    font-size: 11px;
    color: #333;
  }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 10px;
    color: #555;
    text-align: center;
  }
</style>
</head>
<body>

  <div class="header">
    ${logoHtml}
    <div class="company-name">${escHtml(safeStr(data.companyName))}</div>
    <div class="company-meta">${escHtml(safeStr(data.companyAddress))}</div>
    <div class="company-meta">س.ت: ${escHtml(safeStr(data.companyCr))} | ر.ض: ${escHtml(safeStr(data.companyVat))} | هاتف: ${escHtml(safeStr(data.companyPhone))}</div>
  </div>

  <div class="doc-title">عقد توريد وتركيب</div>

  <div class="section-title">١. بيانات العقد</div>
  <table class="data-table">
    <tr>
      <td class="lbl">رقم العقد</td>
      <td>${escHtml(safeStr(data.contractNumber))}</td>
      <td class="lbl">تاريخ العقد</td>
      <td>${escHtml(safeStr(data.contractDate))}</td>
    </tr>
    <tr>
      <td class="lbl">رقم عرض السعر</td>
      <td>${data.quotationNumber ? escHtml(data.quotationNumber) : '—'}</td>
      <td class="lbl">تاريخ عرض السعر</td>
      <td>${data.quotationDate ? escHtml(data.quotationDate) : '—'}</td>
    </tr>
    <tr>
      <td class="lbl">رمز المشروع</td>
      <td>${data.projectCode ? escHtml(data.projectCode) : '—'}</td>
      <td class="lbl">اسم المشروع</td>
      <td>${escHtml(safeStr(data.projectName))}</td>
    </tr>
  </table>

  <div class="section-title">٢. الأطراف</div>
  <div class="parties-block">
    <div class="party">
      <div class="party-title">الطرف الأول (المورّد)</div>
      <div>${escHtml(safeStr(data.companyName))}</div>
      <div style="font-size:11px;color:#555;margin-top:4px;">${escHtml(safeStr(data.companyAddress))}</div>
      <div style="font-size:11px;color:#555;">س.ت: ${escHtml(safeStr(data.companyCr))} | هاتف: ${escHtml(safeStr(data.companyPhone))}</div>
    </div>
    <div class="party">
      <div class="party-title">الطرف الثاني (العميل)</div>
      <div>${escHtml(safeStr(data.customerName))}</div>
      ${data.customerPhone ? `<div style="font-size:11px;color:#555;margin-top:4px;">هاتف: <span dir="ltr">${escHtml(data.customerPhone)}</span></div>` : ''}
      ${data.customerEmail ? `<div style="font-size:11px;color:#555;"><span dir="ltr">${escHtml(data.customerEmail)}</span></div>` : ''}
      ${data.customerLocation ? `<div style="font-size:11px;color:#555;">${escHtml(data.customerLocation)}</div>` : ''}
    </div>
  </div>

  <div class="section-title">٣. المقدمة</div>
  ${intro}

  <div class="section-title">٤. جدول الدفعات</div>
  <table class="milestones-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th>الوصف</th>
        <th style="width:12%;">النسبة</th>
        <th style="width:18%;">المبلغ</th>
        <th style="width:18%;">تاريخ الاستحقاق</th>
      </tr>
    </thead>
    <tbody>${milestoneRows}</tbody>
  </table>

  <div class="section-title">٥. الشروط العامة</div>
  ${terms}

  <div class="section-title">٦. المرفقات</div>
  <div class="attachments-line">
    ملف عرض السعر الأصلي: <strong>${data.quotationFileName ? escHtml(data.quotationFileName) : '—'}</strong>
    <div style="font-size:10px;color:#777;margin-top:4px;">(مدمج في الصفحات التالية من هذا العقد)</div>
  </div>

  <div class="section-title">٧. التوقيعات</div>
  ${signatureBlock}
  <table class="signatures-table">
    <tr>
      <td>
        <div class="sig-header">الطرف الأول</div>
        <div class="sig-label">الاسم:</div>
        <div class="sig-line"></div>
        <div class="sig-label">الصفة:</div>
        <div class="sig-line"></div>
        <div class="sig-label">التوقيع:</div>
        <div class="sig-line"></div>
        <div class="sig-label">التاريخ:</div>
        <div class="sig-line"></div>
      </td>
      <td>
        <div class="sig-header">الطرف الثاني</div>
        <div class="sig-label">الاسم:</div>
        <div class="sig-line"></div>
        <div class="sig-label">الصفة:</div>
        <div class="sig-line"></div>
        <div class="sig-label">التوقيع:</div>
        <div class="sig-line"></div>
        <div class="sig-label">التاريخ:</div>
        <div class="sig-line"></div>
      </td>
    </tr>
  </table>

  <div class="footer">
    ${escHtml(safeStr(data.companyName))} · ${escHtml(safeStr(data.companyPhone))} · المملكة العربية السعودية
  </div>

</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}

// ───────────────────────────────────────────────────────────
// English version (LTR, single-language, 8-section template)
// ───────────────────────────────────────────────────────────
function buildCoverHtmlEn(data: ContractData): Buffer {
  const logoHtml = data.logoBase64
    ? `<img src="data:${data.logoMime};base64,${data.logoBase64}" style="max-height:80px;max-width:200px;" />`
    : '';

  const milestoneRows = data.milestones.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:#999;font-style:italic;padding:12px;">No payment milestones recorded for this project</td></tr>`
    : data.milestones.map((m) => `
        <tr>
          <td style="text-align:center;">${m.index}</td>
          <td>${escHtml(safeStr(m.label))}</td>
          <td style="text-align:center;">${formatPercentage(m.percentage)}</td>
          <td style="text-align:center;">${formatAmount(m.amount, 'en')}</td>
          <td style="text-align:center;">${escHtml(formatDate(m.dueDate))}</td>
        </tr>`).join('');

  const intro = data.coverIntroEn
    ? `<div class="text-block">${escHtml(data.coverIntroEn)}</div>`
    : `<div class="text-block empty-text">(Cover introduction text not configured)</div>`;

  const terms = data.termsEn
    ? `<div class="text-block">${escHtml(data.termsEn)}</div>`
    : `<div class="text-block empty-text">(General terms not configured)</div>`;

  const signatureBlock = data.signatureBlockEn
    ? `<div class="text-block">${escHtml(data.signatureBlockEn)}</div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="UTF-8">
<style>
  @page { size: A4; margin: 1.5cm; }
  body {
    font-family: "Liberation Sans", "DejaVu Sans", sans-serif;
    font-size: 12px;
    color: #1a1a1a;
    line-height: 1.6;
    direction: ltr;
  }
  table { border-collapse: collapse; width: 100%; }
  .header { border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
  .header img { max-height: 80px; max-width: 200px; display: block; margin-bottom: 8px; }
  .company-name { font-size: 18px; font-weight: bold; }
  .company-meta { font-size: 11px; color: #555; margin-top: 3px; }
  .doc-title {
    text-align: center;
    font-size: 22px;
    font-weight: bold;
    margin: 24px 0;
    border: 1px solid #ccc;
    padding: 12px;
  }
  .section-title {
    font-size: 14px;
    font-weight: bold;
    border-bottom: 1px solid #1a1a1a;
    margin: 24px 0 12px 0;
    padding-bottom: 4px;
  }
  .data-table { margin-bottom: 8px; }
  .data-table td {
    padding: 6px 10px;
    border: 1px solid #eee;
    vertical-align: top;
  }
  .data-table .lbl {
    font-weight: bold;
    width: 25%;
    background: #fafafa;
    color: #333;
  }
  .parties-block { margin-bottom: 8px; }
  .parties-block .party {
    border: 1px solid #eee;
    padding: 12px;
    margin-bottom: 8px;
    background: #fafafa;
  }
  .parties-block .party-title {
    font-weight: bold;
    font-size: 13px;
    color: #333;
    margin-bottom: 6px;
  }
  .milestones-table { margin-top: 8px; }
  .milestones-table th, .milestones-table td {
    padding: 6px 10px;
    border: 1px solid #ddd;
    text-align: left;
  }
  .milestones-table th {
    background: #f5f5f5;
    font-weight: bold;
    font-size: 11px;
  }
  .text-block {
    border: 1px solid #eee;
    padding: 12px;
    background: #fafafa;
    white-space: pre-wrap;
    line-height: 1.7;
  }
  .empty-text {
    color: #999;
    font-style: italic;
  }
  .signatures-table { margin-top: 16px; }
  .signatures-table td {
    width: 50%;
    padding: 16px;
    border: 1px solid #ccc;
    vertical-align: top;
  }
  .signatures-table .sig-header {
    font-weight: bold;
    margin-bottom: 12px;
    text-align: center;
  }
  .signatures-table .sig-line {
    border-bottom: 1px solid #999;
    height: 28px;
    margin: 14px 0 4px 0;
  }
  .signatures-table .sig-label {
    font-size: 10px;
    color: #555;
  }
  .attachments-line {
    border: 1px solid #eee;
    padding: 10px;
    background: #fafafa;
    font-size: 11px;
    color: #333;
  }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #ccc;
    font-size: 10px;
    color: #555;
    text-align: center;
  }
</style>
</head>
<body>

  <div class="header">
    ${logoHtml}
    <div class="company-name">${escHtml(safeStr(data.companyName))}</div>
    <div class="company-meta">${escHtml(safeStr(data.companyAddress))}</div>
    <div class="company-meta">CR: ${escHtml(safeStr(data.companyCr))} | VAT: ${escHtml(safeStr(data.companyVat))} | Tel: ${escHtml(safeStr(data.companyPhone))}</div>
  </div>

  <div class="doc-title">SUPPLY AND INSTALLATION CONTRACT</div>

  <div class="section-title">1. Contract Data</div>
  <table class="data-table">
    <tr>
      <td class="lbl">Contract No.</td>
      <td>${escHtml(safeStr(data.contractNumber))}</td>
      <td class="lbl">Contract Date</td>
      <td>${escHtml(safeStr(data.contractDate))}</td>
    </tr>
    <tr>
      <td class="lbl">Quotation No.</td>
      <td>${data.quotationNumber ? escHtml(data.quotationNumber) : '—'}</td>
      <td class="lbl">Quotation Date</td>
      <td>${data.quotationDate ? escHtml(data.quotationDate) : '—'}</td>
    </tr>
    <tr>
      <td class="lbl">Project Code</td>
      <td>${data.projectCode ? escHtml(data.projectCode) : '—'}</td>
      <td class="lbl">Project Name</td>
      <td>${escHtml(safeStr(data.projectName))}</td>
    </tr>
  </table>

  <div class="section-title">2. Parties</div>
  <div class="parties-block">
    <div class="party">
      <div class="party-title">First Party (Supplier)</div>
      <div>${escHtml(safeStr(data.companyName))}</div>
      <div style="font-size:11px;color:#555;margin-top:4px;">${escHtml(safeStr(data.companyAddress))}</div>
      <div style="font-size:11px;color:#555;">CR: ${escHtml(safeStr(data.companyCr))} | Tel: ${escHtml(safeStr(data.companyPhone))}</div>
    </div>
    <div class="party">
      <div class="party-title">Second Party (Client)</div>
      <div>${escHtml(safeStr(data.customerName))}</div>
      ${data.customerPhone ? `<div style="font-size:11px;color:#555;margin-top:4px;">Tel: ${escHtml(data.customerPhone)}</div>` : ''}
      ${data.customerEmail ? `<div style="font-size:11px;color:#555;">${escHtml(data.customerEmail)}</div>` : ''}
      ${data.customerLocation ? `<div style="font-size:11px;color:#555;">${escHtml(data.customerLocation)}</div>` : ''}
    </div>
  </div>

  <div class="section-title">3. Introduction</div>
  ${intro}

  <div class="section-title">4. Payment Schedule</div>
  <table class="milestones-table">
    <thead>
      <tr>
        <th style="width:5%;">#</th>
        <th>Description</th>
        <th style="width:12%;">Percentage</th>
        <th style="width:18%;">Amount</th>
        <th style="width:18%;">Due Date</th>
      </tr>
    </thead>
    <tbody>${milestoneRows}</tbody>
  </table>

  <div class="section-title">5. General Terms and Conditions</div>
  ${terms}

  <div class="section-title">6. Attachments</div>
  <div class="attachments-line">
    Original Quotation File: <strong>${data.quotationFileName ? escHtml(data.quotationFileName) : '—'}</strong>
    <div style="font-size:10px;color:#777;margin-top:4px;">(Merged in the following pages of this contract)</div>
  </div>

  <div class="section-title">7. Signatures</div>
  ${signatureBlock}
  <table class="signatures-table">
    <tr>
      <td>
        <div class="sig-header">First Party</div>
        <div class="sig-label">Name:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Title:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Signature:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date:</div>
        <div class="sig-line"></div>
      </td>
      <td>
        <div class="sig-header">Second Party</div>
        <div class="sig-label">Name:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Title:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Signature:</div>
        <div class="sig-line"></div>
        <div class="sig-label">Date:</div>
        <div class="sig-line"></div>
      </td>
    </tr>
  </table>

  <div class="footer">
    ${escHtml(safeStr(data.companyName))} · ${escHtml(safeStr(data.companyPhone))} · Kingdom of Saudi Arabia
  </div>

</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}

function stripNonWinAnsi(s: string): string {
  // Keep: tabs, newlines, CR, and basic ASCII + Latin-1 supplement (U+00A0..U+00FF)
  return s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '').trim();
}

async function stampFooter(
  pdfBuffer: Buffer,
  data: ContractData,
): Promise<Buffer> {
  const doc = await PDFDocument.load(pdfBuffer);
  const totalPages = doc.getPageCount();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontSize = 8;
  const footerY = 20;
  const lineY = footerY + fontSize + 4;
  const footerColor = rgb(0.4, 0.4, 0.4);
  const lineColor = rgb(0.8, 0.8, 0.8);

  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
  if (data.logoBase64) {
    try {
      const logoBuffer = Buffer.from(data.logoBase64, "base64");
      if (data.logoMime === "image/png") {
        logoImage = await doc.embedPng(logoBuffer);
      } else if (data.logoMime === "image/jpeg" || data.logoMime === "image/jpg") {
        logoImage = await doc.embedJpg(logoBuffer);
      }
    } catch {
      logoImage = null;
    }
  }

  const infoText = stripNonWinAnsi([
    data.companyName,
    data.companyCr ? `CR: ${data.companyCr}` : null,
    data.companyVat ? `VAT: ${data.companyVat}` : null,
    data.companyPhone ? `Tel: ${data.companyPhone}` : null,
  ]
    .filter(Boolean)
    .join("  |  "));

  for (let i = 0; i < totalPages; i++) {
    const page = doc.getPage(i);
    const { width } = page.getSize();
    const pageLabel = `${i + 1} / ${totalPages}`;
    const pageLabelWidth = font.widthOfTextAtSize(pageLabel, fontSize);

    page.drawLine({
      start: { x: 36, y: lineY },
      end: { x: width - 36, y: lineY },
      thickness: 0.5,
      color: lineColor,
    });

    if (infoText.length > 0) {
      page.drawText(infoText, {
        x: 36,
        y: footerY,
        size: fontSize,
        font,
        color: footerColor,
      });
    }

    page.drawText(pageLabel, {
      x: width - 36 - pageLabelWidth,
      y: footerY,
      size: fontSize,
      font,
      color: footerColor,
    });

    if (logoImage) {
      const logoH = 18;
      const logoW = (logoImage.width / logoImage.height) * logoH;
      page.drawImage(logoImage, {
        x: width - 36 - logoW,
        y: footerY + fontSize + 8,
        width: logoW,
        height: logoH,
      });
    }
  }

  return Buffer.from(await doc.save());
}

export async function generateContractPdf(
  quotationDocxBuffer: Buffer,
  data: ContractData,
): Promise<Buffer> {
  const [coverPdf, quotationPdf] = await Promise.all([
    htmlToPdf(buildCoverHtml(data)),
    extractDocxToPdf(quotationDocxBuffer),
  ]);

  const merged = await PDFDocument.create();
  for (const pdfBuffer of [coverPdf, quotationPdf]) {
    const doc = await PDFDocument.load(pdfBuffer);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }

  const mergedBuffer = Buffer.from(await merged.save());
  return stampFooter(mergedBuffer, data);
}
