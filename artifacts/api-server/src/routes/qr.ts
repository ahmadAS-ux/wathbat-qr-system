import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import QRCode from "qrcode";
import { eq } from "drizzle-orm";
import { recordProcessed } from "../lib/stats.js";
import { db, processedDocsTable } from "@workspace/db";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.originalname.toLowerCase().endsWith(".docx")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only .docx files are accepted"));
    }
  },
});

interface PositionItem {
  position: string;
  quantity?: string;
  width?: string;
  height?: string;
  area?: string;
  perimeter?: string;
  price?: string;
  total?: string;
  qrDataUrl: string;
}

interface QREntry {
  position: string;
  dataUrl: string;
}


// ─── XML helpers ──────────────────────────────────────────────────────────────

/** Extract all non-empty <w:t> segments with byte offsets */
function extractTextSegments(xml: string): Array<{ text: string; index: number }> {
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const out: Array<{ text: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    if (m[1].trim()) out.push({ text: m[1], index: m.index });
  }
  return out;
}

// ─── Main processor ───────────────────────────────────────────────────────────

async function parseAndInjectQR(docxBuffer: Buffer): Promise<{
  positions: PositionItem[];
  projectName: string;
  date: string;
  outputBuffer: Buffer;
  rawPositionCount: number;
}> {
  const zip = new AdmZip(docxBuffer);
  const rawDocXml = zip.readAsText("word/document.xml");

  const segments = extractTextSegments(rawDocXml);

  let projectName = "";
  let date = "";
  for (let i = 0; i < segments.length; i++) {
    const t = segments[i].text;
    if (t.startsWith("Date:")) date = t.replace("Date:", "").trim();
    if (t === "Project name:" && segments[i + 2]) projectName = segments[i + 2].text;
  }

  // ── Step 1: Discover all table ranges ───────────────────────────────────────
  const POSITION_RE = /^\d{1,2}\s*\/\s*\d+$/;

  const TABLE_OPEN  = "<w:tbl>";
  const TABLE_CLOSE = "</w:tbl>";

  // ── Table / row open helpers ─────────────────────────────────────────────────
  // Orgadata (and Word in general) uses both <w:tbl> (no attributes) and
  // <w:tbl w:rsidR="..."> (with attributes) for nested tables.  Every helper
  // below handles BOTH forms so depth tracking never misfires.

  /** Position of the next <w:tbl> or <w:tbl ...> open tag, -1 if none. */
  function nextTblOpen(xml: string, from: number): number {
    const a = xml.indexOf("<w:tbl>", from);
    const b = xml.indexOf("<w:tbl ", from);
    if (a === -1) return b;
    if (b === -1) return a;
    return Math.min(a, b);
  }

  /**
   * Given the start index of a <w:tbl…> or <w:tbl> tag, return the index
   * immediately after the closing ">" of that opening tag.
   * (Content scanning must start from here, not from start + fixed-length.)
   */
  function afterTblOpenTag(xml: string, tblStart: number): number {
    const gt = xml.indexOf(">", tblStart + 5); // skip past "<w:tbl" (6 chars)
    return gt === -1 ? tblStart + TABLE_OPEN.length : gt + 1;
  }

  /**
   * Find all TOP-LEVEL <w:tbl[> ] ranges in xml (depth-aware).
   * Handles both <w:tbl> and <w:tbl attr="…"> opening tags.
   */
  function findTableRanges(xml: string): Array<{ start: number; end: number }> {
    const ranges: Array<{ start: number; end: number }> = [];
    let pos = 0;
    while (pos < xml.length) {
      const openIdx = nextTblOpen(xml, pos);
      if (openIdx === -1) break;
      let depth = 1;
      let search = afterTblOpenTag(xml, openIdx);
      while (depth > 0 && search < xml.length) {
        const no = nextTblOpen(xml, search);
        const nc = xml.indexOf(TABLE_CLOSE, search);
        if (nc === -1) break;
        if (no !== -1 && no < nc) {
          depth++;
          search = afterTblOpenTag(xml, no);
        } else {
          depth--;
          search = nc + TABLE_CLOSE.length;
        }
      }
      if (depth === 0) ranges.push({ start: openIdx, end: search });
      pos = search;
    }
    return ranges;
  }

  const rawTableRanges = findTableRanges(rawDocXml);
  console.log(`[QR] findTableRanges found ${rawTableRanges.length} top-level tables; sizes: ${rawTableRanges.map(r => r.end - r.start).join(", ")}`);

  // ── Step 2: Deduplicate tables, then drop summary/subset tables ──────────────
  // Orgadata exports every table twice (screen + print). Additionally it emits
  // a summary table at the bottom that repeats only the last few position rows
  // before the grand-total line. We must exclude both duplicates AND subsets.
  //
  // Pass A — deduplicate by fingerprint (ordered position string).
  const seenFingerprints = new Set<string>();
  type CandidateTable = { tIdx: number; posSet: Set<string> };
  const candidates: CandidateTable[] = [];

  for (let t = 0; t < rawTableRanges.length; t++) {
    const tContent = rawDocXml.slice(rawTableRanges[t].start, rawTableRanges[t].end);
    const positions = [...tContent.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map(m => m[1].trim())
      .filter(txt => POSITION_RE.test(txt));
    if (positions.length === 0) continue;
    const fingerprint = positions.join(",");
    if (seenFingerprints.has(fingerprint)) continue;
    seenFingerprints.add(fingerprint);
    candidates.push({ tIdx: t, posSet: new Set(positions) });
  }

  if (candidates.length === 0) throw new Error("NO_POSITIONS");

  // Pass B — record the original START OFFSET of each candidate table so we
  // can re-locate them after splices shift all subsequent offsets.
  // We do NOT filter any candidates here — all unique position-bearing tables
  // should receive QR codes.
  type DataTable = { startOffset: number; posSet: Set<string> };
  const dataTables: DataTable[] = candidates.map(c => ({
    startOffset: rawTableRanges[c.tIdx].start,
    posSet: c.posSet,
  }));

  // Total raw position count across all tables (for UI reporting).
  const rawPositionCount = candidates.reduce((acc, c) => acc + c.posSet.size, 0);

  dataTables.forEach((dt, i) =>
    console.log(`[QR] dataTable[${i}] startOffset=${dt.startOffset} posCount=${dt.posSet.size}`)
  );
  console.log(`[QR] dataTables=${dataTables.length}, rawPositionCount=${rawPositionCount}`);

  // ── Step 3: Extract positionData from all kept data tables ───────────────────
  const positionData: Array<{
    position: string; quantity: string; width: string;
    height: string; area: string; perimeter: string;
    price: string; total: string;
  }> = [];

  for (const dt of dataTables) {
    // Re-locate this table in rawDocXml by its recorded start offset.
    // (rawDocXml is never modified so offsets stay stable here.)
    const { start: tStart } = (() => {
      // Find the table range that begins at exactly dt.startOffset
      const r = rawTableRanges.find(r => r.start === dt.startOffset);
      if (!r) throw new Error(`Table at offset ${dt.startOffset} not found in rawDocXml`);
      return r;
    })();
    const tEnd = rawTableRanges.find(r => r.start === dt.startOffset)!.end;
    const tContent = rawDocXml.slice(tStart, tEnd);
    const rowRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
    let rowMatch: RegExpExecArray | null;
    while ((rowMatch = rowRe.exec(tContent)) !== null) {
      const rowTexts = [...rowMatch[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map(m => m[1].trim()).filter(Boolean);
      const posIdx = rowTexts.findIndex(t => POSITION_RE.test(t));
      if (posIdx === -1) continue;
      positionData.push({
        position:  rowTexts[posIdx]     || "",
        quantity:  rowTexts[posIdx + 1] || "",
        width:     rowTexts[posIdx + 2] || "",
        height:    rowTexts[posIdx + 3] || "",
        area:      rowTexts[posIdx + 4] || "",
        perimeter: rowTexts[posIdx + 5] || "",
        price:     rowTexts[posIdx + 6] || "",
        total:     rowTexts[posIdx + 7] || "",
      });
    }
  }

  console.log(`[QR] Found ${positionData.length} positions across ${dataTables.length} data table(s)`);
  if (positionData.length === 0) throw new Error("NO_POSITIONS");

  // ── Step 4: Generate QR data URLs (embedded directly into HTML) ─────────────
  const domain = (process.env.REPLIT_DOMAINS || '').split(',')[0].trim();
  const qrBaseUrl = process.env.QR_SCAN_BASE_URL ||
    (domain ? `https://${domain}/scan` : '/scan');

  console.log(`[QR] Scan page URL base: ${qrBaseUrl}`);

  const qrEntries: QREntry[] = [];
  for (let i = 0; i < positionData.length; i++) {
    const p = positionData[i];
    const urlParams = new URLSearchParams({ pos: p.position });
    if (p.width) urlParams.set('w', p.width);
    if (p.height) urlParams.set('h', p.height);
    if (p.quantity) urlParams.set('qty', p.quantity);
    if (projectName) urlParams.set('ref', projectName);
    const qrText = `${qrBaseUrl}?${urlParams.toString()}`;

    const dataUrl = await QRCode.toDataURL(qrText, { width: 200, margin: 1, errorCorrectionLevel: "M" });
    qrEntries.push({ position: p.position, dataUrl });
  }

  // ── Step 5: Build self-contained HTML report ─────────────────────────────────
  function esc(s: string): string {
    return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function parseNum(s: string): number {
    if (!s) return 0;
    const n = parseFloat(s.replace(/,/g, ""));
    return isNaN(n) ? 0 : n;
  }

  function fmtNum(n: number, decimals = 3): string {
    return n.toFixed(decimals);
  }

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 landscape; margin: 15mm; }
    body {
      font-family: Arial, 'Helvetica Neue', sans-serif;
      font-size: 10pt;
      color: #1a1a1a;
      background: #fff;
      direction: ltr;
    }

    /* ── Document header ── */
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: stretch;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 3px solid #1B2A4A;
      gap: 16px;
    }
    .doc-header-brand {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .brand-name {
      font-size: 18pt;
      font-weight: 900;
      color: #1B2A4A;
      letter-spacing: 1px;
    }
    .brand-sub {
      font-size: 8.5pt;
      color: #C89B3C;
      font-weight: 600;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .doc-header-meta {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: bold;
      color: #1B2A4A;
      margin-bottom: 4px;
    }
    .doc-subtitle { font-size: 9pt; color: #555; }
    .doc-header-info {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-end;
      text-align: right;
      gap: 4px;
    }
    .info-row { font-size: 9pt; color: #333; line-height: 1.5; }
    .info-row strong { color: #1B2A4A; min-width: 80px; display: inline-block; }

    /* ── Section title ── */
    .section-title {
      font-size: 10.5pt;
      font-weight: bold;
      color: #1B2A4A;
      margin: 14px 0 5px 0;
      padding-left: 8px;
      border-left: 4px solid #C89B3C;
    }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      font-size: 9.5pt;
      table-layout: fixed;
    }
    colgroup col.col-pos      { width: 10%; }
    colgroup col.col-qty      { width: 7%; }
    colgroup col.col-w        { width: 9%; }
    colgroup col.col-h        { width: 9%; }
    colgroup col.col-area     { width: 10%; }
    colgroup col.col-perim    { width: 10%; }
    colgroup col.col-price    { width: 11%; }
    colgroup col.col-total    { width: 11%; }
    colgroup col.col-qr       { width: 13%; }

    thead { display: table-header-group; }
    tr    { page-break-inside: avoid; }

    th {
      background: #1B2A4A;
      color: #fff;
      padding: 7px 5px;
      text-align: center;
      font-size: 9pt;
      font-weight: 700;
      border: 1px solid #0d1e38;
      line-height: 1.4;
    }
    td {
      border: 1px solid #c8c8c8;
      padding: 5px 5px;
      text-align: center;
      vertical-align: middle;
      font-size: 9.5pt;
      line-height: 1.3;
    }
    td.td-pos {
      font-weight: bold;
      color: #1B2A4A;
      text-align: left;
      padding-left: 8px;
    }
    tr:nth-child(even) td { background: #f4f6fb; }
    tr:nth-child(odd)  td { background: #fff; }

    /* QR cell */
    td.qr-cell { padding: 3px; }
    td.qr-cell img { width: 60px; height: 60px; display: block; margin: 0 auto; }

    /* Summary row */
    tr.summary-row td {
      background: #e8ecf4 !important;
      font-weight: bold;
      color: #1B2A4A;
      border-top: 2px solid #1B2A4A;
      font-size: 9.5pt;
    }
    tr.summary-row td.summary-label {
      text-align: left;
      padding-left: 8px;
      font-size: 9pt;
      color: #1B2A4A;
    }
    tr.summary-row td.summary-grand {
      background: #1B2A4A !important;
      color: #C89B3C !important;
      font-size: 10pt;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .doc-header { page-break-after: avoid; }
    }
  `;

  // Build one combined table across all sections
  let allRows = "";
  let grandArea = 0, grandPerim = 0, grandPrice = 0;
  let qrOffset = 0;
  for (let s = 0; s < dataTables.length; s++) {
    const count = dataTables[s].posSet.size;
    const sPositions = positionData.slice(qrOffset, qrOffset + count);
    const sQRs       = qrEntries.slice(qrOffset, qrOffset + count);
    qrOffset += count;

    for (const p of sPositions) {
      grandArea  += parseNum(p.area);
      grandPerim += parseNum(p.perimeter);
      grandPrice += parseNum(p.total);
    }

    allRows += sPositions.map((p, i) => {
      const qr = sQRs[i];
      const qrImg = qr?.dataUrl
        ? `<img src="${qr.dataUrl}" alt="QR ${esc(p.position)}" />`
        : "";
      return `<tr>
        <td class="td-pos">${esc(p.position)}</td>
        <td>${esc(p.quantity)}</td>
        <td>${esc(p.width)}</td>
        <td>${esc(p.height)}</td>
        <td>${esc(p.area)}</td>
        <td>${esc(p.perimeter)}</td>
        <td>${esc(p.price)}</td>
        <td>${esc(p.total)}</td>
        <td class="qr-cell">${qrImg}</td>
      </tr>`;
    }).join("\n") + "\n";
  }

  const grandSummaryRow = `<tr class="summary-row">
      <td class="summary-label" colspan="4">الإجمالي الكلي / Grand Total</td>
      <td>${fmtNum(grandArea)} م²</td>
      <td>${fmtNum(grandPerim)} م</td>
      <td></td>
      <td class="summary-grand">${fmtNum(grandPrice, 2)} ر.س</td>
      <td></td>
    </tr>`;

  const sectionsHtml = `
  <table>
    <colgroup>
      <col class="col-pos"/>
      <col class="col-qty"/>
      <col class="col-w"/>
      <col class="col-h"/>
      <col class="col-area"/>
      <col class="col-perim"/>
      <col class="col-price"/>
      <col class="col-total"/>
      <col class="col-qr"/>
    </colgroup>
    <thead>
      <tr>
        <th>Position / No.<br/>الموضع / الرقم</th>
        <th>Qty<br/>الكمية</th>
        <th>Width mm<br/>العرض</th>
        <th>Height mm<br/>الارتفاع</th>
        <th>Area m²<br/>المساحة</th>
        <th>Perim. m<br/>المحيط</th>
        <th>Price SAR<br/>السعر</th>
        <th>Total SAR<br/>الإجمالي</th>
        <th>QR Code<br/>رمز QR</th>
      </tr>
    </thead>
    <tbody>
${allRows}${grandSummaryRow}
    </tbody>
  </table>`;

  const infoRows = [
    projectName ? `<div class="info-row"><strong>Project:</strong> ${esc(projectName)}</div>` : "",
    date        ? `<div class="info-row"><strong>Date:</strong> ${esc(date)}</div>` : "",
    `<div class="info-row"><strong>Items:</strong> ${positionData.length} positions</div>`,
  ].filter(Boolean).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(projectName || "Wathbat QR Report")}</title>
  <style>${css}</style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-header-brand">
      <div class="brand-name">Wathbat Aluminum &nbsp;|&nbsp; وثبة للألمنيوم</div>
      <div class="brand-sub">wathbat.sa &nbsp;·&nbsp; Orgadata LogiKal QR Report</div>
    </div>
    <div class="doc-header-meta">
      <div class="doc-title">Glass / Panel Order Report</div>
      <div class="doc-subtitle">تقرير طلب الزجاج والألواح — رموز QR مضمنة</div>
    </div>
    <div class="doc-header-info">
      ${infoRows}
    </div>
  </div>
  ${sectionsHtml}
</body>
</html>`;

  console.log(`[QR] HTML report built — ${positionData.length} positions, ${dataTables.length} section(s)`);

  return {
    positions: positionData.map((p, i) => ({ ...p, qrDataUrl: qrEntries[i]?.dataUrl || "" })),
    projectName,
    date,
    outputBuffer: Buffer.from(html, "utf-8"),
    rawPositionCount,
  };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

router.post(
  "/qr/process",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "BadRequest", message: "No file uploaded" });
        return;
      }

      let result: Awaited<ReturnType<typeof parseAndInjectQR>>;
      try {
        result = await parseAndInjectQR(req.file.buffer);
      } catch (err: any) {
        if (err?.message === "NO_POSITIONS") {
          res.status(400).json({
            error: "ParseError",
            message:
              "No position/number rows found. Please upload an Orgadata Glass/Panel Order (.docx) file.",
          });
          return;
        }
        throw err;
      }

      const originalName = req.file.originalname.replace(/\.docx$/i, "");
      const reportFilename = `${originalName}_QR_Report.html`;

      if (result.projectName) {
        const [existing] = await db
          .select({ id: processedDocsTable.id })
          .from(processedDocsTable)
          .where(eq(processedDocsTable.projectName, result.projectName))
          .limit(1);
        if (existing) {
          res.status(409).json({
            error: "DuplicateProject",
            message: `A project named "${result.projectName}" already exists.`,
            projectName: result.projectName,
          });
          return;
        }
      }

      const [saved] = await db
        .insert(processedDocsTable)
        .values({
          originalFilename: req.file.originalname,
          reportFilename,
          projectName: result.projectName || null,
          processingDate: result.date || null,
          positionCount: result.positions.length,
          originalFile: req.file.buffer,
          reportFile: result.outputBuffer,
        })
        .returning({ id: processedDocsTable.id });

      recordProcessed(result.positions.length);

      res.json({
        fileId: String(saved.id),
        positions: result.positions,
        projectName: result.projectName,
        date: result.date,
        totalPositions: result.positions.length,
        rawPositionCount: result.rawPositionCount,
      });
    } catch (err) {
      req.log.error({ err }, "Error processing document");
      res.status(500).json({ error: "InternalError", message: "Failed to process document" });
    }
  },
);

router.get("/qr/download/:fileId", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.fileId as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "BadRequest", message: "Invalid file ID" });
    return;
  }

  const [row] = await db
    .select()
    .from(processedDocsTable)
    .where(eq(processedDocsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "NotFound", message: "File not found" });
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(row.reportFilename)}"`);
  res.setHeader("Content-Length", row.reportFile.length.toString());
  res.send(row.reportFile);
});

router.get("/qr/download/:fileId/original", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.fileId as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "BadRequest", message: "Invalid file ID" });
    return;
  }

  const [row] = await db
    .select()
    .from(processedDocsTable)
    .where(eq(processedDocsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "NotFound", message: "File not found" });
    return;
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(row.originalFilename)}"`);
  res.setHeader("Content-Length", row.originalFile.length.toString());
  res.send(row.originalFile);
});

router.delete("/:id", async (req: Request, res: Response) => {
  const id = Number(req.params["id"]);
  if (!id || isNaN(id)) {
    res.status(400).json({ error: "InvalidId" });
    return;
  }

  const [existing] = await db
    .select({ id: processedDocsTable.id })
    .from(processedDocsTable)
    .where(eq(processedDocsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "NotFound" });
    return;
  }

  await db.delete(processedDocsTable).where(eq(processedDocsTable.id, id));
  res.status(204).end();
});

export default router;
