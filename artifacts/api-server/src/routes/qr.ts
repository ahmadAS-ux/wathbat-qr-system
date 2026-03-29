import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import QRCode from "qrcode";
import { randomUUID } from "node:crypto";
import { recordProcessed } from "../lib/stats.js";

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
  rId: string;
  mediaName: string;
  buffer: Buffer;
  dataUrl: string;
}

// In-memory store
const processedFiles = new Map<
  string,
  { buffer: Buffer; filename: string; expiresAt: number }
>();

setInterval(
  () => {
    const now = Date.now();
    for (const [id, entry] of processedFiles.entries()) {
      if (entry.expiresAt < now) processedFiles.delete(id);
    }
  },
  10 * 60 * 1000,
);

// ─── Constants ────────────────────────────────────────────────────────────────
// 500000 EMU ≈ 13.9 mm. Cell width: 500000/635 ≈ 787 Twips + 2×28 margins = 843 → 900
const QR_COL_TARGET = 900;     // Twips (cell width for QR column)
const QR_IMAGE_EMU  = 500000;  // 500000 × 500000 EMU ≈ 13.9 mm × 13.9 mm

/**
 * Compute layout for adding the QR column.
 *
 * @param docXml  Full document XML (for page size / margins).
 * @param tblXml  The XML of the specific data table (for column widths).
 *
 * Strategy:
 *  1. Read the printable width from <w:pgSz> and <w:pgMar> in docXml.
 *  2. Read existing gridCol widths from the data table's <w:tblGrid> in tblXml.
 *  3. Scale every existing column proportionally so the table + QR column
 *     exactly fits the printable width.
 */
function calcLayout(_docXml: string, tblXml: string): {
  qrColWidth: number;
  qrEMU: number;
  scaledGridCols: number[];
  newTableW: number;
  origTableW: number;
} {
  // 1. Read existing gridCol widths from the data table
  const tblGridM = /<w:tblGrid\b[^>]*>([\s\S]*?)<\/w:tblGrid>/.exec(tblXml);
  const existingCols: number[] = [];
  if (tblGridM) {
    for (const m of tblGridM[1].matchAll(/<w:gridCol\b[^>]*w:w="(\d+)"/g)) {
      existingCols.push(parseInt(m[1], 10));
    }
  }
  const origTableW = existingCols.reduce((s, c) => s + c, 0) || 9924;

  // 2. Keep the total table width IDENTICAL to the original — the document was
  //    already calibrated for the page.  Shrink the 14 existing columns
  //    proportionally to make room for the new QR column.
  //    newTableW = origTableW  (no change to total width)
  const availableForExisting = origTableW - QR_COL_TARGET;
  const scale = existingCols.length > 0 ? availableForExisting / origTableW : 1;

  const scaledGridCols = existingCols.map(c => Math.round(c * scale));
  const scaledSum = scaledGridCols.reduce((s, c) => s + c, 0);
  // Fix integer rounding drift on the largest column
  const maxIdx = scaledGridCols.indexOf(Math.max(...scaledGridCols));
  if (maxIdx >= 0) scaledGridCols[maxIdx] += availableForExisting - scaledSum;

  return {
    qrColWidth: QR_COL_TARGET,
    qrEMU: QR_IMAGE_EMU,
    scaledGridCols,
    newTableW: origTableW, // total stays the same as original
    origTableW,
  };
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

/** Cell to add to every header row (containing "Position / Number") */
function makeQRHeaderCell(qrColWidth: number): string {
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${qrColWidth}" w:type="dxa"/>` +
    `<w:tcBorders>` +
    `<w:top w:val="single" w:color="000000" w:sz="4"/>` +
    `<w:left w:val="single" w:color="000000" w:sz="4"/>` +
    `<w:bottom w:val="single" w:color="000000" w:sz="4"/>` +
    `<w:right w:val="single" w:color="000000" w:sz="4"/>` +
    `</w:tcBorders>` +
    `<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>` +
    `<w:tcMar><w:top w:w="56" w:type="dxa"/><w:left w:w="56" w:type="dxa"/><w:bottom w:w="56" w:type="dxa"/><w:right w:w="56" w:type="dxa"/></w:tcMar>` +
    `<w:vAlign w:val="center"/>` +
    `</w:tcPr>` +
    `<w:p>` +
    `<w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="200" w:lineRule="exact"/></w:pPr>` +
    `<w:r><w:rPr><w:b/><w:sz w:val="16"/><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/></w:rPr>` +
    `<w:t>QR</w:t></w:r>` +
    `</w:p>` +
    `</w:tc>`
  );
}

/** Cell containing a QR code image for a data row */
function makeQRImageCell(rId: string, docPrId: number, qrColWidth: number, qrEMU: number): string {
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${qrColWidth}" w:type="dxa"/>` +
    `<w:tcBorders>` +
    `<w:top w:val="nil" w:color="000000" w:sz="0"/>` +
    `<w:left w:val="single" w:color="000000" w:sz="4"/>` +
    `<w:bottom w:val="nil" w:color="000000" w:sz="0"/>` +
    `<w:right w:val="single" w:color="000000" w:sz="4"/>` +
    `</w:tcBorders>` +
    `<w:tcMar><w:top w:w="28" w:type="dxa"/><w:left w:w="28" w:type="dxa"/><w:bottom w:w="28" w:type="dxa"/><w:right w:w="28" w:type="dxa"/></w:tcMar>` +
    `<w:vAlign w:val="center"/>` +
    `</w:tcPr>` +
    `<w:p>` +
    `<w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>` +
    `<w:r><w:rPr/>` +
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${qrEMU}" cy="${qrEMU}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="QR${docPrId}"/>` +
    `<wp:cNvGraphicFramePr/>` +
    `<a:graphic>` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic>` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="${docPrId}" name="QRCode${docPrId}"/>` +
    `<pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="${rId}"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr bwMode="auto">` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${qrEMU}" cy="${qrEMU}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `<a:noFill/>` +
    `</pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData>` +
    `</a:graphic>` +
    `</wp:inline>` +
    `</w:drawing>` +
    `</w:r>` +
    `</w:p>` +
    `</w:tc>`
  );
}

/** Empty filler cell for non-data rows */
function makeEmptyCell(qrColWidth: number, withBorders = false): string {
  const borders = withBorders
    ? `<w:tcBorders>` +
      `<w:top w:val="nil" w:color="000000" w:sz="0"/>` +
      `<w:left w:val="nil" w:color="000000" w:sz="0"/>` +
      `<w:bottom w:val="nil" w:color="000000" w:sz="0"/>` +
      `<w:right w:val="nil" w:color="000000" w:sz="0"/>` +
      `</w:tcBorders>`
    : "";
  return (
    `<w:tc>` +
    `<w:tcPr><w:tcW w:w="${qrColWidth}" w:type="dxa"/>${borders}</w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>` +
    `</w:tc>`
  );
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
  let docXml = zip.readAsText("word/document.xml");

  const segments = extractTextSegments(docXml);

  let projectName = "";
  let date = "";
  for (let i = 0; i < segments.length; i++) {
    const t = segments[i].text;
    if (t.startsWith("Date:")) date = t.replace("Date:", "").trim();
    if (t === "Project name:" && segments[i + 2]) projectName = segments[i + 2].text;
  }

  // ── Step 1: Discover all table ranges in raw XML (before namespace injection) ──
  const POSITION_RE = /^\d{1,2}\s*\/\s*\d+$/;
  const rawDocXml   = zip.readAsText("word/document.xml");

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

  /**
   * Like tblXml.replace(/<w:tr …>…<\/w:tr>/g, cb) but depth-aware:
   * — nested tables inside cells are passed through unchanged (handles both
   *   <w:tbl> and <w:tbl attr="…"> forms)
   * — the callback only receives complete top-level rows
   */
  function applyToTopLevelRows(
    tblXml: string,
    cb: (rowXml: string) => string
  ): string {
    const ROW_CLOSE = "</w:tr>";
    function nextRowOpen(xml: string, from: number): number {
      const a = xml.indexOf("<w:tr>", from);
      const b = xml.indexOf("<w:tr ", from);
      if (a === -1) return b;
      if (b === -1) return a;
      return Math.min(a, b);
    }

    let result = "";
    let pos = 0;
    while (pos < tblXml.length) {
      const rowIdx = nextRowOpen(tblXml, pos);
      const tblIdx = nextTblOpen(tblXml, pos);   // ← handles both forms
      if (rowIdx === -1) { result += tblXml.slice(pos); break; }

      if (tblIdx !== -1 && tblIdx < rowIdx) {
        // Nested table before next row — pass through unchanged (depth-aware)
        result += tblXml.slice(pos, tblIdx);
        let depth = 1;
        let s = afterTblOpenTag(tblXml, tblIdx); // ← skip full opening tag
        while (depth > 0 && s < tblXml.length) {
          const no = nextTblOpen(tblXml, s);
          const nc = tblXml.indexOf(TABLE_CLOSE, s);
          if (nc === -1) break;
          if (no !== -1 && no < nc) { depth++; s = afterTblOpenTag(tblXml, no); }
          else                       { depth--; s = nc + TABLE_CLOSE.length; }
        }
        result += tblXml.slice(tblIdx, s);
        pos = s;
      } else {
        // Top-level row — find its matching </w:tr> with nesting depth tracking
        result += tblXml.slice(pos, rowIdx);
        let rdepth = 1;
        let rs = rowIdx + 5; // skip past "<w:tr" (content / attribute scan)
        while (rdepth > 0 && rs < tblXml.length) {
          const ro = nextRowOpen(tblXml, rs);
          const rc = tblXml.indexOf(ROW_CLOSE, rs);
          if (rc === -1) break;
          if (ro !== -1 && ro < rc) { rdepth++; rs = ro + 5; }
          else                       { rdepth--; rs = rc + ROW_CLOSE.length; }
        }
        result += cb(tblXml.slice(rowIdx, rs));
        pos = rs;
      }
    }
    return result;
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

  // ── Step 4: Generate QR codes ────────────────────────────────────────────────
  const qrEntries: QREntry[] = [];
  for (let i = 0; i < positionData.length; i++) {
    const p = positionData[i];
    const qrText = [p.position, p.quantity ? `Qty:${p.quantity}` : "",
      p.width && p.height ? `${p.width}x${p.height}mm` : "", projectName || ""]
      .filter(Boolean).join(" | ");

    const buf = await QRCode.toBuffer(qrText, { type: "png", width: 300, margin: 1, errorCorrectionLevel: "M" });
    const dataUrl = await QRCode.toDataURL(qrText, { width: 150, margin: 1, errorCorrectionLevel: "M" });
    const safeName = p.position.replace(/\s*\/\s*/g, "_").replace(/\s/g, "");
    qrEntries.push({
      position: p.position,
      rId: `rIdQR${2000 + i}`,
      mediaName: `qr_pos_${safeName}_${i}.png`,
      buffer: buf,
      dataUrl,
    });
  }

  // ── Step 5: Patch docXml (namespace injection + noWrap removal) ──────────────
  const REQUIRED_NS: Record<string, string> = {
    wp:  "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    a:   "http://schemas.openxmlformats.org/drawingml/2006/main",
    pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
    r:   "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  };
  // Only inject namespaces ONCE — use indexOf(">") not lastIndexOf to avoid
  // accidentally walking into a self-closing tag's content if the tag spans far.
  const docElemMatch = /<w:document\b[^>]*>/.exec(docXml);
  if (docElemMatch) {
    const elem = docElemMatch[0];
    const allExist = Object.keys(REQUIRED_NS).every(prefix =>
      elem.includes(`xmlns:${prefix}=`)
    );
    if (!allExist) {
      let additions = "";
      for (const [prefix, uri] of Object.entries(REQUIRED_NS)) {
        if (!elem.includes(`xmlns:${prefix}=`)) {
          additions += ` xmlns:${prefix}="${uri}"`;
        }
      }
      const closePos = elem.indexOf(">");
      const newElem = elem.slice(0, closePos) + additions + elem.slice(closePos);
      docXml = docXml.slice(0, docElemMatch.index) + newElem +
               docXml.slice(docElemMatch.index + docElemMatch[0].length);
    }
  }
  docXml = docXml.replace(/<w:noWrap\/>/g, "");

  // ── Step 6: Process each data table in document order (forward).
  //
  //   Key insight: after we splice the first modified table back into docXml,
  //   ALL subsequent byte offsets shift.  We cannot use the original integer
  //   table indices from rawTableRanges to address tables in the mutated docXml.
  //
  //   Strategy: for each iteration we call findTableRanges() on the CURRENT
  //   (possibly already-mutated) docXml to get fresh ranges, then identify our
  //   target table by matching the FIRST FEW TEXT TOKENS from its position set —
  //   a fingerprint that is stable across the splice (we're only adding a new
  //   cell at the end of each row; the existing cell text is untouched).
  let qrIdx = 0;
  for (const dt of dataTables) {
    const currentRanges = findTableRanges(docXml);

    // Find the range whose content contains the first position from this table.
    const firstPos = [...dt.posSet][0];
    const matchingRange = currentRanges.find(r => {
      const snippet = docXml.slice(r.start, r.end);
      return snippet.includes(firstPos);
    });
    if (!matchingRange) {
      console.log(`[QR] WARNING: could not find table for positions starting with "${firstPos}" — skipping`);
      continue;
    }
    const { start: tblStart, end: tblEnd } = matchingRange;
    let tblXml = docXml.slice(tblStart, tblEnd);

    const { qrColWidth, qrEMU, scaledGridCols, newTableW, origTableW } =
      calcLayout(docXml, tblXml);

    // Rewrite tblGrid
    const newGrid = scaledGridCols.map(w => `<w:gridCol w:w="${w}"/>`).join("") +
                    `<w:gridCol w:w="${qrColWidth}"/>`;
    tblXml = tblXml.replace(
      /<w:tblGrid\b[^>]*>[\s\S]*?<\/w:tblGrid>/,
      `<w:tblGrid>${newGrid}</w:tblGrid>`
    );

    // Rewrite tblW
    tblXml = tblXml.replace(/<w:tblW\b[^>]*\/?>/, (m) => {
      let u = m.includes('w:w="') ? m.replace(/w:w="\d+"/, `w:w="${newTableW}"`) : m.replace('<w:tblW', `<w:tblW w:w="${newTableW}"`);
      u = u.includes('w:type="') ? u.replace(/w:type="[^"]*"/, `w:type="dxa"`) : u.replace('<w:tblW', `<w:tblW w:type="dxa"`);
      return u;
    });

    // Rescale tcW
    const colScale = origTableW > 0 ? (newTableW - qrColWidth) / origTableW : 1;
    tblXml = tblXml.replace(/<w:tcW\b[^>]*\/>/g, (m) => {
      const type = m.match(/w:type="([^"]*)"/)?.[1] ?? "dxa";
      if (type === "pct" || type === "auto" || type === "nil") return m;
      const w = parseInt(m.match(/w:w="(\d+)"/)?.[1] ?? "0", 10);
      if (w === 0) return m;
      return m.replace(/w:w="\d+"/, `w:w="${Math.round(w * colScale)}"`)
              .replace(/w:type="[^"]*"/, `w:type="dxa"`);
    });

    // Process all top-level rows only (applyToTopLevelRows skips nested table rows).
    // Pass the INNER content only (strip outer <w:tbl>...</w:tbl> wrapper) so the
    // function doesn't mistake the outer opening tag for a nested table.
    const tableQrStart = qrIdx;
    const tblInnerContent = applyToTopLevelRows(
      tblXml.slice(TABLE_OPEN.length, tblXml.length - TABLE_CLOSE.length),
      (rowXml) => {
      const texts = [...rowXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map(m => m[1].trim()).filter(Boolean);

      const isHeaderRow = texts.some(t => t.includes("Position") && t.includes("Number"));
      const isDataRow   = texts.some(t => POSITION_RE.test(t));

      let row = rowXml;

      // Add cantSplit
      if (row.includes("<w:trPr>")) {
        if (!row.includes("<w:cantSplit")) row = row.replace("<w:trPr>", "<w:trPr><w:cantSplit/>");
      } else if (/<w:trPr\b/.test(row)) {
        if (!row.includes("<w:cantSplit")) row = row.replace(/<w:trPr\b[^>]*>/, m => m + "<w:cantSplit/>");
      } else {
        // Capture the ENTIRE <w:tr ...> opening tag (may include attributes like w:rsidR)
        // then append <w:trPr> as the first child — NOT inside the opening tag attributes.
        row = row.replace(/^(<w:tr(?:\s[^>]*)?>)/, (_m, openTag) => openTag + "<w:trPr><w:cantSplit/></w:trPr>");
      }

      // Fix row height
      if (isDataRow) {
        row = row.replace(/<w:trHeight\b[^>]*\/>/, '<w:trHeight w:val="0" w:hRule="auto"/>');
      }

      // vAlign center for data rows
      if (isDataRow) {
        row = row.replace(/<\/w:tcPr>/g, (m, offset, str) => {
          const before = str.slice(0, offset);
          if (!before.slice(before.lastIndexOf("<w:tcPr")).includes("<w:vAlign")) {
            return '<w:vAlign w:val="center"/>' + m;
          }
          return m;
        });
        row = row.replace(/<w:tcPr\/>/g, '<w:tcPr><w:vAlign w:val="center"/></w:tcPr>');
      }

      // Inject QR cell
      let cellXml: string;
      if (isHeaderRow) {
        cellXml = makeQRHeaderCell(qrColWidth);
      } else if (isDataRow) {
        cellXml = qrIdx < qrEntries.length
          ? makeQRImageCell(qrEntries[qrIdx].rId, 2000 + qrIdx, qrColWidth, qrEMU)
          : makeEmptyCell(qrColWidth, true);
        qrIdx++;
      } else {
        cellXml = makeEmptyCell(qrColWidth, true);
      }

      return row.replace(/<\/w:tr>$/, cellXml + "</w:tr>");
      }
    );
    tblXml = TABLE_OPEN + tblInnerContent + TABLE_CLOSE;

    console.log(`[QR] table(firstPos="${firstPos}"): injected ${qrIdx - tableQrStart} rows`);

    // Splice the modified table back into docXml
    docXml = docXml.slice(0, tblStart) + tblXml + docXml.slice(tblEnd);
  }

  console.log(`[QR] total injected=${qrIdx} of ${qrEntries.length}`);
  console.log(`[QR] final docXml length=${docXml.length}`);

  // Dump context around Word's reported error column for debugging
  const ERR_COL = 362320;
  if (docXml.length > ERR_COL - 200) {
    const start = Math.max(0, ERR_COL - 200);
    const end = Math.min(docXml.length, ERR_COL + 200);
    console.log(`[QR] XML context @col${ERR_COL}: ${JSON.stringify(docXml.slice(start, end))}`);
  }

  // Sanity-check: duplicate xmlns declarations corrupt the XML and cause Word to refuse the file
  const xmlnsWpMatches = docXml.match(/xmlns:wp=/g);
  if (xmlnsWpMatches && xmlnsWpMatches.length > 1) {
    throw new Error(`DUPLICATE_NAMESPACE: xmlns:wp declared ${xmlnsWpMatches.length} times`);
  }

  zip.updateFile("word/document.xml", Buffer.from(docXml, "utf8"));

  for (const qr of qrEntries) {
    zip.addFile(`word/media/${qr.mediaName}`, qr.buffer);
  }

  let ctXml = zip.readAsText("[Content_Types].xml");
  if (!ctXml.includes('Extension="png"')) {
    ctXml = ctXml.replace("</Types>", `<Default Extension="png" ContentType="image/png"/></Types>`);
    zip.updateFile("[Content_Types].xml", Buffer.from(ctXml, "utf8"));
  }

  let relsXml = zip.readAsText("word/_rels/document.xml.rels");
  const newRels = qrEntries.map(qr =>
    `<Relationship Id="${qr.rId}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
    `Target="media/${qr.mediaName}"/>`
  ).join("\n");
  relsXml = relsXml.replace("</Relationships>", `${newRels}\n</Relationships>`);
  zip.updateFile("word/_rels/document.xml.rels", Buffer.from(relsXml, "utf8"));

  return {
    positions: positionData.map((p, i) => ({ ...p, qrDataUrl: qrEntries[i]?.dataUrl || "" })),
    projectName,
    date,
    outputBuffer: zip.toBuffer(),
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

      const fileId = randomUUID();
      const originalName = req.file.originalname.replace(/\.docx$/i, "");
      processedFiles.set(fileId, {
        buffer: result.outputBuffer,
        filename: `${originalName}_with_QR.docx`,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
      recordProcessed(result.positions.length);

      res.json({
        fileId,
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

router.get("/qr/download/:fileId", (req: Request, res: Response): void => {
  const fileId = req.params.fileId as string;
  const entry = processedFiles.get(fileId);

  if (!entry) {
    res.status(404).json({ error: "NotFound", message: "File not found or has expired" });
    return;
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(entry.filename)}"`,
  );
  res.setHeader("Content-Length", entry.buffer.length.toString());
  res.send(entry.buffer);
});

export default router;
