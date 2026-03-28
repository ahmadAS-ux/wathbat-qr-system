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
// A4 portrait = 11906 Twips wide, existing table = 9924 Twips → 1982 Twips free
const QR_COL_WIDTH = 1982; // Twips
const QR_EMU = 857250; // ≈ 24 mm – inline image, fully inside cell
const QR_ROW_MIN_HEIGHT = 1450; // Twips – forces row to expand for the image

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
function makeQRHeaderCell(): string {
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${QR_COL_WIDTH}" w:type="dxa"/>` +
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
function makeQRImageCell(rId: string, docPrId: number): string {
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${QR_COL_WIDTH}" w:type="dxa"/>` +
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
    `<wp:extent cx="${QR_EMU}" cy="${QR_EMU}"/>` +
    `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${docPrId}" name="QRCode${docPrId}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
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
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${QR_EMU}" cy="${QR_EMU}"/></a:xfrm>` +
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
function makeEmptyCell(withBorders = false): string {
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
    `<w:tcPr><w:tcW w:w="${QR_COL_WIDTH}" w:type="dxa"/>${borders}</w:tcPr>` +
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

  // 1. Extend <w:tblGrid> with the new QR column
  const tblGridCloseTag = "</w:tblGrid>";
  const tblGridCloseIdx = docXml.indexOf(tblGridCloseTag);
  if (tblGridCloseIdx >= 0) {
    mods.push({
      start: tblGridCloseIdx,
      end: tblGridCloseIdx + tblGridCloseTag.length,
      replacement: `<w:gridCol w:w="${QR_COL_WIDTH}"/>${tblGridCloseTag}`,
    });
  }

  // 2. Update <w:tblW> to new total width (9924 + 1982 = 11906)
  const tblWRe = /<w:tblW[^/]*\/>/;
  const tblWMatch = tblWRe.exec(docXml);
  if (tblWMatch && tblWMatch.index !== undefined) {
    const updated = tblWMatch[0].replace(/w:w="\d+"/, `w:w="11906"`);
    mods.push({
      start: tblWMatch.index,
      end: tblWMatch.index + tblWMatch[0].length,
      replacement: updated,
    });
  }

  // 3. Find all <w:tr> rows and inject the right cell before </w:tr>
  const TR_CLOSE = "</w:tr>";
  const trRe = /<w:tr[ >][\s\S]*?<\/w:tr>/g;
  const rows: Array<{ start: number; end: number; content: string }> = [];
  let trM: RegExpExecArray | null;
  while ((trM = trRe.exec(docXml)) !== null) {
    rows.push({ start: trM.index, end: trM.index + trM[0].length, content: trM[0] });
  }

  let qrIdx = 0;
  for (const row of rows) {
    const texts = [...row.content.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);

    const insertAt = row.end - TR_CLOSE.length;
    let cellXml: string;

    const isHeaderRow = texts.some((t) => t.includes("Position") && t.includes("Number"));
    const isDataRow = texts.some((t) => POSITION_RE.test(t));

    if (isHeaderRow) {
      cellXml = makeQRHeaderCell();
    } else if (isDataRow && qrIdx < qrEntries.length) {
      cellXml = makeQRImageCell(qrEntries[qrIdx].rId, 2000 + qrIdx);
      qrIdx++;

      // Expand the row height so the QR image is fully visible inside the cell
      const trHeightRe = /<w:trHeight[^/]*\/>/;
      const trHm = trHeightRe.exec(row.content);
      if (trHm) {
        const absPos = row.start + trHm.index;
        const currentVal = parseInt(trHm[0].match(/w:val="(\d+)"/)?.[1] ?? "0", 10);
        if (currentVal < QR_ROW_MIN_HEIGHT) {
          mods.push({
            start: absPos,
            end: absPos + trHm[0].length,
            replacement: trHm[0].replace(/w:val="\d+"/, `w:val="${QR_ROW_MIN_HEIGHT}"`),
          });
        }
      }
    } else {
      cellXml = makeEmptyCell(true);
    }

    mods.push({
      start: insertAt,
      end: insertAt + TR_CLOSE.length,
      replacement: cellXml + TR_CLOSE,
    });
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
