import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { extractDocxToPdf } from "./docx-extractor.js";
import { renderContractDocx, ContractRenderData } from "./contract-renderer.js";

export type { ContractRenderData };

export interface StampData {
  companyName: string;
  companyPhone: string;
  companyCr?: string;
  companyVat?: string;
  logoBase64?: string;
  logoMime?: string;
}

function stripNonWinAnsi(s: string): string {
  // Keep: tabs, newlines, CR, and basic ASCII + Latin-1 supplement (U+00A0..U+00FF)
  return s.replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '').trim();
}

export async function stampFooter(
  pdfBuffer: Buffer,
  data: StampData,
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
  data: ContractRenderData,
  lang: 'ar' | 'en',
  stamp: StampData,
): Promise<Buffer> {
  const filledDocx = renderContractDocx(data, lang);
  const pdfBuffer = await extractDocxToPdf(filledDocx);
  return stampFooter(pdfBuffer, stamp);
}
