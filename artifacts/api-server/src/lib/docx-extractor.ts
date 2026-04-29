import { spawn } from "child_process";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const LIBREOFFICE_BIN = process.env.LIBREOFFICE_BIN || "soffice";
const TIMEOUT_MS = 30_000;

/**
 * Converts a .docx buffer to a PDF buffer using LibreOffice headless.
 *
 * Writes the buffer to a temp file, runs soffice --convert-to pdf,
 * reads back the output PDF, then cleans up.
 *
 * Throws with a descriptive message if conversion fails or times out.
 */
export async function extractDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const tmpDir = join(tmpdir(), `docx-extract-${randomUUID()}`);
  const inputPath = join(tmpDir, "input.docx");
  const outputPath = join(tmpDir, "input.pdf");

  await mkdir(tmpDir, { recursive: true });
  try {
    await writeFile(inputPath, docxBuffer);

    await runLibreOffice(inputPath, tmpDir);

    const pdfBuffer = await readFile(outputPath).catch(() => {
      throw new Error("LibreOffice completed but output PDF was not created");
    });

    if (pdfBuffer.length === 0) {
      throw new Error("LibreOffice produced an empty PDF");
    }

    return pdfBuffer;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function runLibreOffice(inputPath: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "--headless",
      "--nologo",
      "--nodefault",
      "--nofirststartwizard",
      "--nolockcheck",
      "--convert-to", "pdf:writer_pdf_Export",
      "--outdir", outDir,
      inputPath,
    ];

    const proc = spawn(LIBREOFFICE_BIN, args, { stdio: ["ignore", "pipe", "pipe"] });

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error(`LibreOffice conversion timed out after ${TIMEOUT_MS}ms`));
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const out = Buffer.concat(stdout).toString("utf8").trim();
        const err = Buffer.concat(stderr).toString("utf8").trim();
        reject(new Error(`LibreOffice exited with code ${code}. stdout: ${out} stderr: ${err}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn LibreOffice (${LIBREOFFICE_BIN}): ${err.message}`));
    });
  });
}
