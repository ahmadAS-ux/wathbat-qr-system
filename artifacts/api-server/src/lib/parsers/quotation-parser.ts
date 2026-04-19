import AdmZip from 'adm-zip';

export interface QuotationPosition {
  position: string;
  quantity: number;
  description: string;
  unitPrice: string;
  lineTotal: string;
}

export interface ParsedQuotation {
  projectName: string | null;
  quotationNumber: string | null;
  quotationDate: string | null;
  positions: QuotationPosition[];
  subtotalNet: string | null;
  taxRate: string | null;
  taxAmount: string | null;
  grandTotal: string | null;
  rawPositionCount: number;
  dedupedPositionCount: number;
}

export function parseQuotationDocx(buffer: Buffer): ParsedQuotation {
  const zip = new AdmZip(buffer);
  const docXmlEntry = zip.getEntry('word/document.xml');
  if (!docXmlEntry) throw new Error('Invalid DOCX: word/document.xml not found');
  const xml = docXmlEntry.getData().toString('utf8');

  const texts: string[] = [];
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m: RegExpExecArray | null;
  while ((m = textRegex.exec(xml)) !== null) texts.push(m[1]);
  const fullText = texts.join(' ');
  const normalized = fullText.replace(/\s+/g, ' ').trim();

  // --- Project name ---
  let projectName: string | null = null;
  const projMatch = normalized.match(/Project:\s*(.+?)\s+(?:\d+\s+[A-Z]{2,}|Position\s+Quantity)/);
  if (projMatch) projectName = projMatch[1].replace(/\s+/g, ' ').trim();

  // --- Quotation number (Orgadata splits digits with spaces: "616 2" → "6162") ---
  let quotationNumber: string | null = null;
  const qnMatch = normalized.match(/Quotation No\.:\s*([\d\s]+?)(?=\s+Project|\s+Date|\s+[A-Z])/);
  if (qnMatch) quotationNumber = qnMatch[1].replace(/\s+/g, '');

  // --- Date (Orgadata splits digits: "18 / 4 /2 6" → "18/04/2026") ---
  let quotationDate: string | null = null;
  const dateMatch = normalized.match(/Date:\s*([\d\s\/]+?)(?=\s+Quotation|\s+[A-Z])/);
  if (dateMatch) {
    const raw = dateMatch[1].replace(/\s+/g, '');
    const parts = raw.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      let year = parts[2];
      if (year.length === 2) year = `20${year}`;
      quotationDate = `${day}/${month}/${year}`;
    } else {
      quotationDate = raw;
    }
  }

  // --- Positions ---
  const posRegex = /([A-Z]+-\d+[A-Za-z]?)\s+(\d+)\s+Pcs\s+([\d,]+(?:\.\d+)?)\s+([\d,]+(?:\.\d+)?)/g;
  const rawPositions: QuotationPosition[] = [];
  const matchesArr: Array<{ match: RegExpExecArray; start: number; end: number }> = [];
  let pm: RegExpExecArray | null;
  while ((pm = posRegex.exec(normalized)) !== null) {
    matchesArr.push({ match: pm, start: pm.index, end: pm.index + pm[0].length });
  }

  for (let i = 0; i < matchesArr.length; i++) {
    const curr = matchesArr[i];
    const next = matchesArr[i + 1];
    const descStart = curr.end;
    const descEnd = next ? next.start : Math.min(normalized.length, curr.end + 600);
    let description = normalized.slice(descStart, descEnd).trim();
    const stopIdx = description.search(/\b(Grand Total|Gesamtsumme|Total Price|Value Added Tax)\b/i);
    if (stopIdx >= 0) description = description.slice(0, stopIdx).trim();
    if (description.length > 500) description = description.slice(0, 500) + '...';

    rawPositions.push({
      position: curr.match[1],
      quantity: parseInt(curr.match[2], 10),
      description,
      unitPrice: curr.match[3],
      lineTotal: curr.match[4],
    });
  }

  // --- Dedupe (Orgadata exports screen + print copies) ---
  const seen = new Set<string>();
  const positions: QuotationPosition[] = [];
  for (const p of rawPositions) {
    const fp = `${p.position}|${p.quantity}|${p.unitPrice}|${p.lineTotal}`;
    if (seen.has(fp)) continue;
    seen.add(fp);
    positions.push(p);
  }

  // --- Grand totals ---
  let subtotalNet: string | null = null;
  let taxRate: string | null = null;
  let taxAmount: string | null = null;
  let grandTotal: string | null = null;

  const gtMatch = normalized.match(/Grand Total(?:\s+Net)?\s*([\d,]+(?:\.\d+)?)\s*SAR/i);
  if (gtMatch) subtotalNet = gtMatch[1];

  const vatMatch = normalized.match(/Value Added Tax\s*([\d.]+)\s*%\s*([\d,]+(?:\.\d+)?)\s*SAR/i);
  if (vatMatch) { taxRate = vatMatch[1]; taxAmount = vatMatch[2]; }

  const tpMatch = normalized.match(/Total Price\s*([\d,]+(?:\.\d+)?)\s*SAR/i);
  if (tpMatch) grandTotal = tpMatch[1];

  return {
    projectName,
    quotationNumber,
    quotationDate,
    positions,
    subtotalNet,
    taxRate,
    taxAmount,
    grandTotal,
    rawPositionCount: rawPositions.length,
    dedupedPositionCount: positions.length,
  };
}
