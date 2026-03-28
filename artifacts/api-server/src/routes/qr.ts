import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import QRCode from "qrcode";
import { randomUUID } from "node:crypto";

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
  qrDataUrl: string;
}

// In-memory store for processed files
const processedFiles = new Map<
  string,
  { buffer: Buffer; filename: string; expiresAt: number }
>();

// Cleanup old files every 10 minutes
setInterval(
  () => {
    const now = Date.now();
    for (const [id, entry] of processedFiles.entries()) {
      if (entry.expiresAt < now) processedFiles.delete(id);
    }
  },
  10 * 60 * 1000,
);

/** Extract all non-empty text segments from docx XML with their byte offsets */
function extractTextSegments(docXml: string): Array<{ text: string; index: number }> {
  const textRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  const segments: Array<{ text: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = textRe.exec(docXml)) !== null) {
    if (m[1].trim()) segments.push({ text: m[1], index: m.index });
  }
  return segments;
}

/** Find the index of the closing </w:tc> after a given position in the XML */
function findCellEnd(docXml: string, afterIdx: number): number {
  return docXml.indexOf("</w:tc>", afterIdx);
}

/** Find the index just AFTER the closing </w:p> that contains a text at textIdx */
function findParagraphEnd(docXml: string, textIdx: number): number {
  const closeP = docXml.indexOf("</w:p>", textIdx);
  return closeP >= 0 ? closeP + "</w:p>".length : -1;
}

async function parseAndInjectQR(
  docxBuffer: Buffer,
): Promise<{ positions: PositionItem[]; projectName: string; date: string; outputBuffer: Buffer }> {
  const zip = new AdmZip(docxBuffer);
  const docXml = zip.readAsText("word/document.xml");

  const segments = extractTextSegments(docXml);

  // Find project name and date
  let projectName = "";
  let date = "";
  for (let i = 0; i < segments.length; i++) {
    const t = segments[i].text;
    if (t.startsWith("Date:")) date = t.replace("Date:", "").trim();
    if (t === "Project name:" && segments[i + 2]) projectName = segments[i + 2].text;
  }

  // Find position rows (pattern: "01 / 1", "02 / 3", etc.)
  const POSITION_RE = /^\d{2}\s*\/\s*\d+$/;
  const positionSegments: Array<{
    position: string;
    quantity: string;
    width: string;
    height: string;
    textIndex: number;
  }> = [];

  for (let i = 0; i < segments.length; i++) {
    if (POSITION_RE.test(segments[i].text)) {
      positionSegments.push({
        position: segments[i].text,
        quantity: segments[i + 1]?.text || "",
        width: segments[i + 2]?.text || "",
        height: segments[i + 3]?.text || "",
        textIndex: segments[i].index,
      });
    }
  }

  // Generate QR codes for each position
  type QREntry = {
    position: string;
    buffer: Buffer;
    dataUrl: string;
    mediaName: string;
    rId: string;
    textIndex: number;
  };

  const qrEntries: QREntry[] = [];
  for (let i = 0; i < positionSegments.length; i++) {
    const seg = positionSegments[i];
    const qrText = [
      `Pos: ${seg.position}`,
      seg.quantity ? `Qty: ${seg.quantity}` : "",
      seg.width ? `W: ${seg.width}mm` : "",
      seg.height ? `H: ${seg.height}mm` : "",
      projectName ? `Proj: ${projectName}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const qrBuffer = await QRCode.toBuffer(qrText, {
      type: "png",
      width: 200,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const dataUrl = await QRCode.toDataURL(qrText, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: "M",
    });

    const safeName = seg.position.replace(/\s*\/\s*/g, "_").replace(/\s/g, "");
    qrEntries.push({
      position: seg.position,
      buffer: qrBuffer,
      dataUrl,
      mediaName: `qr_${safeName}_${i}.png`,
      rId: `rIdQR${i + 100}`,
      textIndex: seg.textIndex,
    });
  }

  // Build PositionItems with data URLs for the frontend
  const positionItems: PositionItem[] = positionSegments.map((seg, i) => ({
    position: seg.position,
    quantity: seg.quantity,
    width: seg.width,
    height: seg.height,
    qrDataUrl: qrEntries[i]?.dataUrl || "",
  }));

  // Inject QR images into the docx XML
  // Strategy: for each position, find the paragraph containing it, then find the
  // end of the parent <w:tc> and insert an image paragraph right before </w:tc>
  const EMU = 800000; // 800000 EMU ≈ 2.2cm — square QR code (width = height)

  // We'll build injection points: { insertAfterIdx, xml }
  // Process in reverse order so insertions don't shift earlier indices
  const injections: Array<{ insertAfterIdx: number; xml: string }> = [];

  for (const qr of qrEntries) {
    const paraEnd = findParagraphEnd(docXml, qr.textIndex);
    if (paraEnd < 0) continue;

    const cellEnd = findCellEnd(docXml, qr.textIndex);
    if (cellEnd < 0) continue;

    const insertIdx = cellEnd; // insert before </w:tc>

    const imgId = qrEntries.indexOf(qr) + 100;
    const imageXml =
      `<w:p>` +
      `<w:pPr><w:spacing w:before="0" w:after="0"/><w:jc w:val="center"/></w:pPr>` +
      `<w:r><w:rPr/>` +
      `<w:drawing>` +
      `<wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" distT="0" distB="0" distL="0" distR="0">` +
      `<wp:extent cx="${EMU}" cy="${EMU}"/>` +
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="${imgId}" name="QR-${imgId}"/>` +
      `<wp:cNvGraphicFramePr>` +
      `<a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>` +
      `</wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:nvPicPr>` +
      `<pic:cNvPr id="${imgId}" name="QR-${imgId}"/>` +
      `<pic:cNvPicPr/>` +
      `</pic:nvPicPr>` +
      `<pic:blipFill>` +
      `<a:blip r:embed="${qr.rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
      `<a:stretch><a:fillRect/></a:stretch>` +
      `</pic:blipFill>` +
      `<pic:spPr>` +
      `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${EMU}" cy="${EMU}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
      `</pic:spPr>` +
      `</pic:pic>` +
      `</a:graphicData>` +
      `</a:graphic>` +
      `</wp:inline>` +
      `</w:drawing>` +
      `</w:r>` +
      `</w:p>`;

    injections.push({ insertAfterIdx: insertIdx, xml: imageXml });
  }

  // Apply injections in reverse order
  injections.sort((a, b) => b.insertAfterIdx - a.insertAfterIdx);
  let modifiedDocXml = docXml;
  for (const inj of injections) {
    modifiedDocXml =
      modifiedDocXml.slice(0, inj.insertAfterIdx) +
      inj.xml +
      modifiedDocXml.slice(inj.insertAfterIdx);
  }

  // Update the zip
  zip.updateFile("word/document.xml", Buffer.from(modifiedDocXml, "utf8"));

  // Add QR images to the zip
  for (const qr of qrEntries) {
    zip.addFile(`word/media/${qr.mediaName}`, qr.buffer);
  }

  // Update content types
  let contentTypesXml = zip.readAsText("[Content_Types].xml");
  if (!contentTypesXml.includes('Extension="png"')) {
    contentTypesXml = contentTypesXml.replace(
      "</Types>",
      `<Default Extension="png" ContentType="image/png"/></Types>`,
    );
    zip.updateFile("[Content_Types].xml", Buffer.from(contentTypesXml, "utf8"));
  }

  // Update document relationships
  let relsXml = zip.readAsText("word/_rels/document.xml.rels");
  const relEntries = qrEntries
    .map(
      (qr) =>
        `<Relationship Id="${qr.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${qr.mediaName}"/>`,
    )
    .join("\n");
  relsXml = relsXml.replace("</Relationships>", `${relEntries}\n</Relationships>`);
  zip.updateFile("word/_rels/document.xml.rels", Buffer.from(relsXml, "utf8"));

  return {
    positions: positionItems,
    projectName,
    date,
    outputBuffer: zip.toBuffer(),
  };
}

// POST /api/qr/process
router.post(
  "/qr/process",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "BadRequest", message: "No file uploaded" });
        return;
      }

      const { positions, projectName, date, outputBuffer } = await parseAndInjectQR(
        req.file.buffer,
      );

      if (positions.length === 0) {
        res.status(400).json({
          error: "ParseError",
          message:
            "No position/number rows found in the document. Please upload an Orgadata Glass/Panel Order (.docx) file.",
        });
        return;
      }

      const fileId = randomUUID();
      const originalName = req.file.originalname.replace(/\.docx$/i, "");
      processedFiles.set(fileId, {
        buffer: outputBuffer,
        filename: `${originalName}_with_QR.docx`,
        expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour TTL
      });

      res.json({
        fileId,
        positions,
        projectName,
        date,
        totalPositions: positions.length,
      });
    } catch (err) {
      req.log.error({ err }, "Error processing document");
      res.status(500).json({
        error: "InternalError",
        message: "Failed to process document",
      });
    }
  },
);

// GET /api/qr/download/:fileId
router.get("/qr/download/:fileId", (req: Request, res: Response): void => {
  const { fileId } = req.params;
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
