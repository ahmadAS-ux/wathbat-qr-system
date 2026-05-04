import { PDFDocument } from "pdf-lib";
import { extractDocxToPdf } from "./docx-extractor.js";
import { htmlToPdf } from "./html-to-pdf.js";

interface ContractData {
  companyName: string;
  companyAddress: string;
  companyCr: string;
  companyVat: string;
  companyPhone: string;
  logoBase64?: string;
  logoMime?: string;
  projectName: string;
  customerName: string;
  generatedDate: string;
  coverIntroAr: string;
  coverIntroEn: string;
  termsAr: string;
  termsEn: string;
  signatureBlockAr: string;
  signatureBlockEn: string;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildCoverHtml(data: ContractData): Buffer {
  const logoHtml = data.logoBase64
    ? `<img src="data:${data.logoMime};base64,${data.logoBase64}" style="max-height:80px;max-width:200px;object-fit:contain;" />`
    : "";

  const html = `<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: Arial, Tahoma, sans-serif; margin: 40px; color: #1a1a1a; }
  .header { display: flex; align-items: center; gap: 20px; border-bottom: 2px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 24px; }
  .company-info { flex: 1; }
  .company-name { font-size: 18px; font-weight: bold; }
  .company-meta { font-size: 11px; color: #555; margin-top: 4px; }
  .contract-title { text-align: center; font-size: 22px; font-weight: bold; margin: 24px 0; border: 1px solid #ccc; padding: 12px; }
  .project-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin-bottom: 24px; border: 1px solid #eee; padding: 12px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 13px; font-weight: bold; border-bottom: 1px solid #ddd; margin-bottom: 8px; padding-bottom: 4px; }
  .arabic { direction: rtl; text-align: right; font-family: Arial, Tahoma, 'Traditional Arabic', sans-serif; line-height: 1.8; white-space: pre-wrap; font-size: 12px; }
  .english { direction: ltr; text-align: left; line-height: 1.6; white-space: pre-wrap; font-size: 12px; }
  .sig-block { margin-top: 40px; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <div class="company-info">
      <div class="company-name">${escHtml(data.companyName)}</div>
      <div class="company-meta">${escHtml(data.companyAddress)}</div>
      <div class="company-meta">CR: ${escHtml(data.companyCr)} | VAT: ${escHtml(data.companyVat)} | Tel: ${escHtml(data.companyPhone)}</div>
    </div>
  </div>

  <div class="contract-title">CONTRACT / عقد</div>

  <div class="project-info">
    <div><strong>Project:</strong> ${escHtml(data.projectName)}</div>
    <div style="text-align:right"><strong>المشروع:</strong> ${escHtml(data.projectName)}</div>
    <div><strong>Customer:</strong> ${escHtml(data.customerName)}</div>
    <div style="text-align:right"><strong>العميل:</strong> ${escHtml(data.customerName)}</div>
    <div><strong>Date:</strong> ${escHtml(data.generatedDate)}</div>
    <div style="text-align:right"><strong>التاريخ:</strong> ${escHtml(data.generatedDate)}</div>
  </div>

  ${data.coverIntroEn ? `<div class="section"><div class="section-title">Introduction</div><div class="english">${escHtml(data.coverIntroEn)}</div></div>` : ""}
  ${data.coverIntroAr ? `<div class="section"><div class="arabic">${escHtml(data.coverIntroAr)}</div></div>` : ""}

  ${data.termsEn ? `<div class="section"><div class="section-title">Terms and Conditions</div><div class="english">${escHtml(data.termsEn)}</div></div>` : ""}
  ${data.termsAr ? `<div class="section"><div class="arabic">${escHtml(data.termsAr)}</div></div>` : ""}

  ${data.signatureBlockEn ? `<div class="section sig-block"><div class="section-title">Signature</div><div class="english">${escHtml(data.signatureBlockEn)}</div></div>` : ""}
  ${data.signatureBlockAr ? `<div class="section sig-block"><div class="arabic">${escHtml(data.signatureBlockAr)}</div></div>` : ""}
</body>
</html>`;
  return Buffer.from(html, "utf-8");
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
  return Buffer.from(await merged.save());
}
