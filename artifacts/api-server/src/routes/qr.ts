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
}> {
  const zip = new AdmZip(docxBuffer);
  const docXml = zip.readAsText("word/document.xml");

  const segments = extractTextSegments(docXml);

  // Find project metadata
  let projectName = "";
  let date = "";
  for (let i = 0; i < segments.length; i++) {
    const t = segments[i].text;
    if (t.startsWith("Date:")) date = t.replace("Date:", "").trim();
    if (t === "Project name:" && segments[i + 2]) projectName = segments[i + 2].text;
  }

  // Find position rows — column order: pos, qty, width, height, area, perimeter, price, total
  const POSITION_RE = /^\d{2}\s*\/\s*\d+$/;
  const positionData: Array<{
    position: string;
    quantity: string;
    width: string;
    height: string;
    area: string;
    perimeter: string;
    price: string;
    total: string;
  }> = [];

  for (let i = 0; i < segments.length; i++) {
    if (POSITION_RE.test(segments[i].text)) {
      positionData.push({
        position: segments[i].text,
        quantity: segments[i + 1]?.text || "",
        width: segments[i + 2]?.text || "",
        height: segments[i + 3]?.text || "",
        area: segments[i + 4]?.text || "",
        perimeter: segments[i + 5]?.text || "",
        price: segments[i + 6]?.text || "",
        total: segments[i + 7]?.text || "",
      });
    }
  }

  if (positionData.length === 0) {
    throw new Error("NO_POSITIONS");
  }

  // Generate QR codes
  const qrEntries: QREntry[] = [];
  for (let i = 0; i < positionData.length; i++) {
    const p = positionData[i];
    const qrText = [
      p.position,
      p.quantity ? `Qty:${p.quantity}` : "",
      p.width && p.height ? `${p.width}x${p.height}mm` : "",
      projectName || "",
    ]
      .filter(Boolean)
      .join(" | ");

    const buf = await QRCode.toBuffer(qrText, {
      type: "png",
      width: 300,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const dataUrl = await QRCode.toDataURL(qrText, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const safeName = p.position.replace(/\s*\/\s*/g, "_").replace(/\s/g, "");
    qrEntries.push({
      position: p.position,
      rId: `rIdQR${2000 + i}`,
      mediaName: `qr_pos_${safeName}_${i}.png`,
      buffer: buf,
      dataUrl,
    });
  }

  // ── Build all XML modifications as {start, end, replacement} in original docXml ──
  interface Mod {
    start: number;
    end: number;
    replacement: string;
  }
  const mods: Mod[] = [];

  // 0. Ensure required drawing/image namespaces are declared on the root <w:document> element.
  //    Plain LogiKal exports contain no images so these prefixes are absent; without them
  //    Word's XML parser rejects the file the moment it encounters wp:inline / a:graphic etc.
  const REQUIRED_NS: Record<string, string> = {
    wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
    a: "http://schemas.openxmlformats.org/drawingml/2006/main",
    pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
    r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  };
  const docElemRe = /<w:document\b[^>]*>/;
  const docElemMatch = docElemRe.exec(docXml);
  if (docElemMatch) {
    let docElem = docElemMatch[0];
    let nsAdditions = "";
    for (const [prefix, uri] of Object.entries(REQUIRED_NS)) {
      if (!docElem.includes(`xmlns:${prefix}=`)) {
        nsAdditions += ` xmlns:${prefix}="${uri}"`;
      }
    }
    if (nsAdditions) {
      // Insert before the closing '>' of the opening tag
      const closeGt = docElem.lastIndexOf(">");
      const newDocElem = docElem.slice(0, closeGt) + nsAdditions + docElem.slice(closeGt);
      mods.push({
        start: docElemMatch.index,
        end: docElemMatch.index + docElemMatch[0].length,
        replacement: newDocElem,
      });
    }
  }

  // 0b. Remove every <w:noWrap/> so numbers can wrap inside narrower cells
  for (const nwM of docXml.matchAll(/<w:noWrap\/>/g)) {
    mods.push({ start: nwM.index!, end: nwM.index! + nwM[0].length, replacement: "" });
  }

  // ── STEP 1: Collect ALL rows (depth-aware — handles nested tables) ───────
  // A simple non-greedy regex stops at the first </w:tr>, which is WRONG when
  // a row contains a nested table.  This depth-aware scanner matches each outer
  // <w:tr> to its true closing </w:tr>, skipping over any inner <w:tr> pairs.
  const TR_CLOSE = "</w:tr>";
  const rows: Array<{ start: number; end: number; content: string }> = [];
  {
    let i = 0;
    while (i < docXml.length) {
      const trOpen = docXml.indexOf("<w:tr", i);
      if (trOpen < 0) break;
      const afterTag = docXml[trOpen + 5];
      if (afterTag !== ">" && afterTag !== " ") { i = trOpen + 6; continue; }

      // Walk forward tracking nesting depth to find the matching </w:tr>
      let depth = 1;
      let pos   = trOpen + 5;
      while (depth > 0 && pos < docXml.length) {
        const nextOpen  = docXml.indexOf("<w:tr", pos);
        const nextClose = docXml.indexOf("</w:tr>", pos);
        if (nextClose < 0) break; // malformed XML — give up
        if (nextOpen >= 0 && nextOpen < nextClose) {
          // Another opening tag appears first — increase depth if it's a real <w:tr>
          const c = docXml[nextOpen + 5];
          if (c === ">" || c === " ") depth++;
          pos = nextOpen + 6;
        } else {
          depth--;
          pos = nextClose + 7; // step past </w:tr>
        }
      }

      if (depth === 0) {
        const end = pos; // character after the matching </w:tr>
        rows.push({ start: trOpen, end, content: docXml.slice(trOpen, end) });
        i = end; // continue from after this row — inner rows are NOT re-scanned
      } else {
        i = trOpen + 6;
      }
    }
  }

  // ── STEP 2: Find the data table (the one with Position/Number rows) ────────
  // We locate the specific <w:tbl> so we only modify its tblGrid/tblW/tcW,
  // not the header tables above it.
  const dataRows  = rows.filter(r =>
    [...r.content.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].some(m => POSITION_RE.test(m[1].trim()))
  );
  const hdrRows   = rows.filter(r =>
    r.content.includes("Position") && r.content.includes("Number")
  );
  const refRows   = [...hdrRows, ...dataRows].sort((a, b) => a.start - b.start);

  let dataTblStart = 0;
  let dataTblEnd   = docXml.length;

  if (refRows.length > 0) {
    const firstRefPos = refRows[0].start;
    const lastRefPos  = refRows[refRows.length - 1].end;

    // Last <w:tbl opening that appears before the first reference row
    const tblOpenRe = /<w:tbl[ >]/g;
    let tblOM: RegExpExecArray | null;
    let lastTblOpen = 0;
    while ((tblOM = tblOpenRe.exec(docXml)) !== null) {
      if (tblOM.index < firstRefPos) lastTblOpen = tblOM.index;
      else break;
    }
    dataTblStart = lastTblOpen;

    // First </w:tbl> that ends after the last reference row
    const closeIdx = docXml.indexOf("</w:tbl>", lastRefPos);
    dataTblEnd = closeIdx >= 0 ? closeIdx : docXml.length; // points to < of </w:tbl>
  }

  const dataTblXml = docXml.slice(dataTblStart, dataTblEnd);

  // ── STEP 3: Calculate layout using the CORRECT (data) table's grid ────────
  const { qrColWidth, qrEMU, scaledGridCols, newTableW, origTableW } =
    calcLayout(docXml, dataTblXml);

  // ── STEP 4: Rewrite <w:tblGrid> in the data table only ───────────────────
  const tblGridRe = /<w:tblGrid\b[^>]*>[\s\S]*?<\/w:tblGrid>/;
  const tblGridM  = tblGridRe.exec(dataTblXml);
  if (tblGridM) {
    const absStart  = dataTblStart + tblGridM.index;
    const newGrid   = scaledGridCols.map(w => `<w:gridCol w:w="${w}"/>`).join("") +
                      `<w:gridCol w:w="${qrColWidth}"/>`;
    mods.push({
      start: absStart,
      end:   absStart + tblGridM[0].length,
      replacement: `<w:tblGrid>${newGrid}</w:tblGrid>`,
    });
  }

  // ── STEP 5: Update <w:tblW> in the data table only ───────────────────────
  // Match both self-closing <w:tblW .../> and non-self-closing <w:tblW ...>
  const tblWRe = /<w:tblW\b[^>]*\/?>/;
  const tblWM  = tblWRe.exec(dataTblXml);
  if (tblWM) {
    const absStart = dataTblStart + tblWM.index;
    let updated = tblWM[0];
    // Update or insert w:w attribute
    updated = updated.includes('w:w="')
      ? updated.replace(/w:w="\d+"/, `w:w="${newTableW}"`)
      : updated.replace('<w:tblW', `<w:tblW w:w="${newTableW}"`);
    // Update or insert w:type attribute
    updated = updated.includes('w:type="')
      ? updated.replace(/w:type="[^"]*"/, `w:type="dxa"`)
      : updated.replace('<w:tblW', `<w:tblW w:type="dxa"`);
    mods.push({ start: absStart, end: absStart + tblWM[0].length, replacement: updated });
  }

  // ── STEP 6: Rescale every <w:tcW> that is inside the data table only ──────
  // Skip cells using pct/auto/nil types — only dxa values are in absolute Twips.
  const colScale = origTableW > 0 ? (newTableW - qrColWidth) / origTableW : 1;
  const tcWRe    = /<w:tcW\b[^>]*\/>/g;
  let   tcWM: RegExpExecArray | null;
  while ((tcWM = tcWRe.exec(dataTblXml)) !== null) {
    const origType = tcWM[0].match(/w:type="([^"]*)"/)?.[1] ?? "dxa";
    if (origType === "pct" || origType === "auto" || origType === "nil") continue;
    const origW = parseInt(tcWM[0].match(/w:w="(\d+)"/)?.[1] ?? "0", 10);
    if (origW === 0) continue;
    const newW  = Math.round(origW * colScale);
    const updated = tcWM[0]
      .replace(/w:w="\d+"/, `w:w="${newW}"`)
      .replace(/w:type="[^"]*"/, `w:type="dxa"`);
    if (updated !== tcWM[0]) {
      const absStart = dataTblStart + tcWM.index;
      mods.push({ start: absStart, end: absStart + tcWM[0].length, replacement: updated });
    }
  }

  // ── STEP 7: Inject QR cells into each row ────────────────────────────────
  // dataTblEnd now points to the '<' of </w:tbl>, so r.start < dataTblEnd
  // captures every row whose opening tag is inside the table (including the last rows).
  const dataTblXmlFull = docXml.slice(dataTblStart, dataTblEnd);
  void dataTblXmlFull; // available for future debugging
  const dataTblRows = rows.filter(
    (r) => r.start >= dataTblStart && r.start < dataTblEnd,
  );

  let qrIdx = 0;
  for (const row of dataTblRows) {
    const texts = [...row.content.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);

    const insertAt = row.end - TR_CLOSE.length;
    let cellXml: string;

    const isHeaderRow = texts.some((t) => t.includes("Position") && t.includes("Number"));
    const isDataRow   = texts.some((t) => POSITION_RE.test(t));

    // ── cantSplit: apply to EVERY row in the data table unconditionally ──────
    const trPrOpenM = /<w:trPr\b[^>]*>/.exec(row.content);
    if (trPrOpenM) {
      const trPrCloseIdx = row.content.indexOf("</w:trPr>", trPrOpenM.index);
      const trPrInner    = row.content.slice(trPrOpenM.index, trPrCloseIdx);
      if (!trPrInner.includes("<w:cantSplit")) {
        const insPos = row.start + trPrOpenM.index + trPrOpenM[0].length;
        mods.push({ start: insPos, end: insPos, replacement: "<w:cantSplit/>" });
      }
    } else {
      // No <w:trPr> at all — insert one after the opening <w:tr...> tag
      const trOpenEnd = row.content.indexOf(">") + 1;
      const insPos    = row.start + trOpenEnd;
      mods.push({ start: insPos, end: insPos, replacement: "<w:trPr><w:cantSplit/></w:trPr>" });
    }

    if (isHeaderRow) {
      cellXml = makeQRHeaderCell(qrColWidth);
    } else if (isDataRow) {
      if (qrIdx >= qrEntries.length) {
        // Safety: more isDataRow matches than QR entries — give an empty cell
        cellXml = makeEmptyCell(qrColWidth, true);
      } else {
        cellXml = makeQRImageCell(qrEntries[qrIdx].rId, 2000 + qrIdx, qrColWidth, qrEMU);
        qrIdx++;

        // ── Fix B: vertically center-align all existing cells in this row ───
        // Walk every </w:tcPr> and inject <w:vAlign center> if not already there.
        const tcPrCloseRe = /<\/w:tcPr>/g;
        let   tcPrCloseM: RegExpExecArray | null;
        while ((tcPrCloseM = tcPrCloseRe.exec(row.content)) !== null) {
          const tcPrOpenIdx = row.content.lastIndexOf("<w:tcPr", tcPrCloseM.index);
          const tcPrBlock   = row.content.slice(tcPrOpenIdx, tcPrCloseM.index);
          if (!tcPrBlock.includes("<w:vAlign")) {
            const insPos = row.start + tcPrCloseM.index; // insert before </w:tcPr>
            mods.push({ start: insPos, end: insPos, replacement: '<w:vAlign w:val="center"/>' });
          }
        }
        // Self-closing <w:tcPr/> → replace with full element + vAlign
        for (const scM of row.content.matchAll(/<w:tcPr\/>/g)) {
          const absPos = row.start + scM.index;
          mods.push({
            start: absPos, end: absPos + scM[0].length,
            replacement: '<w:tcPr><w:vAlign w:val="center"/></w:tcPr>',
          });
        }
        // Cells with NO <w:tcPr> at all — inject one after <w:tc>
        for (const tcM of row.content.matchAll(/<w:tc>/g)) {
          const after = row.content.slice(tcM.index + 6).trimStart();
          if (!after.startsWith("<w:tcPr")) {
            const insPos = row.start + tcM.index + 6;
            mods.push({
              start: insPos, end: insPos,
              replacement: '<w:tcPr><w:vAlign w:val="center"/></w:tcPr>',
            });
          }
        }

        // ── Fix C: set row height to auto so rows shrink to fit ─────────────
        const trHeightRe = /<w:trHeight\b[^>]*\/>/;
        const trHm = trHeightRe.exec(row.content);
        if (trHm) {
          const absPos = row.start + trHm.index;
          mods.push({
            start: absPos,
            end:   absPos + trHm[0].length,
            replacement: '<w:trHeight w:val="0" w:hRule="auto"/>',
          });
        }
      }
    } else {
      cellXml = makeEmptyCell(qrColWidth, true);
    }

    mods.push({
      start: insertAt,
      end:   insertAt + TR_CLOSE.length,
      replacement: cellXml + TR_CLOSE,
    });
  }

  // Diagnostic: confirm all rows were processed
  console.log(
    `[QR] totalRows=${rows.length}  dataTblRows=${dataTblRows.length}  dataRowsMatched=${dataTblRows.filter(r => [...r.content.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].some(m => POSITION_RE.test(m[1].trim()))).length}  qrEntries=${qrEntries.length}  qrInjected=${qrIdx}`,
  );

  // ── POST-PASS: guarantee <w:cantSplit/> on every <w:tr> in the document ───
  // This runs on the original docXml (before mods) which is fine — the mod
  // applier works by absolute index so writing two insertions at the same spot
  // just produces <w:cantSplit/><w:cantSplit/>, which Word silently ignores.
  const postTrRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  let   postTrM: RegExpExecArray | null;
  while ((postTrM = postTrRe.exec(docXml)) !== null) {
    const trContent = postTrM[0];
    const trStart   = postTrM.index;
    const trPrM     = /<w:trPr\b[^>]*>/.exec(trContent);
    if (trPrM) {
      const closeIdx = trContent.indexOf("</w:trPr>", trPrM.index);
      const inner    = trContent.slice(trPrM.index, closeIdx);
      if (!inner.includes("<w:cantSplit")) {
        const insPos = trStart + trPrM.index + trPrM[0].length;
        mods.push({ start: insPos, end: insPos, replacement: "<w:cantSplit/>" });
      }
    } else {
      const trOpenEnd = trContent.indexOf(">") + 1;
      const insPos    = trStart + trOpenEnd;
      mods.push({ start: insPos, end: insPos, replacement: "<w:trPr><w:cantSplit/></w:trPr>" });
    }
  }

  // 4. Apply all modifications in reverse order (high index → low index)
  mods.sort((a, b) => b.start - a.start);
  let modXml = docXml;
  for (const mod of mods) {
    modXml = modXml.slice(0, mod.start) + mod.replacement + modXml.slice(mod.end);
  }

  // 5. Update zip entries
  zip.updateFile("word/document.xml", Buffer.from(modXml, "utf8"));

  for (const qr of qrEntries) {
    zip.addFile(`word/media/${qr.mediaName}`, qr.buffer);
  }

  // 6. Content types — add PNG if missing
  let ctXml = zip.readAsText("[Content_Types].xml");
  if (!ctXml.includes('Extension="png"')) {
    ctXml = ctXml.replace(
      "</Types>",
      `<Default Extension="png" ContentType="image/png"/></Types>`,
    );
    zip.updateFile("[Content_Types].xml", Buffer.from(ctXml, "utf8"));
  }

  // 7. Relationships
  let relsXml = zip.readAsText("word/_rels/document.xml.rels");
  const newRels = qrEntries
    .map(
      (qr) =>
        `<Relationship Id="${qr.rId}" ` +
        `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
        `Target="media/${qr.mediaName}"/>`,
    )
    .join("\n");
  relsXml = relsXml.replace("</Relationships>", `${newRels}\n</Relationships>`);
  zip.updateFile("word/_rels/document.xml.rels", Buffer.from(relsXml, "utf8"));

  // 8. Build result
  const positionItems: PositionItem[] = positionData.map((p, i) => ({
    ...p,
    qrDataUrl: qrEntries[i]?.dataUrl || "",
  }));

  return {
    positions: positionItems,
    projectName,
    date,
    outputBuffer: zip.toBuffer(),
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
