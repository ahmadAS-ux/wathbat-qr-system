import { spawn } from "child_process";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const LIBREOFFICE_BIN = process.env["LIBREOFFICE_BIN"] ?? "soffice";
const TIMEOUT_MS = 90_000;

export async function htmlToPdf(htmlBuffer: Buffer): Promise<Buffer> {
  const tmpDir = join(tmpdir(), `html-pdf-${randomUUID()}`);
  await mkdir(tmpDir, { recursive: true });
  const inputPath = join(tmpDir, "input.html");
  const outputPath = join(tmpDir, "input.pdf");
  try {
    await writeFile(inputPath, htmlBuffer);
    await runLibreOffice(inputPath, tmpDir);
    const pdfBuffer = await readFile(outputPath).catch(() => {
      throw new Error("LibreOffice completed but output PDF was not created");
    });
    if (pdfBuffer.length === 0) throw new Error("LibreOffice produced an empty PDF");
    return pdfBuffer;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

function runLibreOffice(inputPath: string, outDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      `-env:UserInstallation=file://${outDir}/profile`,
      "--headless",
      "--nologo",
      "--nodefault",
      "--nofirststartwizard",
      "--nolockcheck",
      "--convert-to",
      "pdf:writer_pdf_Export",
      "--outdir",
      outDir,
      inputPath,
    ];
    const proc = spawn(LIBREOFFICE_BIN, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      const out = Buffer.concat(stdout).toString("utf8").trim();
      const err = Buffer.concat(stderr).toString("utf8").trim();
      reject(
        new Error(
          `LibreOffice HTML→PDF timed out after ${TIMEOUT_MS}ms. stdout: ${out.slice(0, 500)} stderr: ${err.slice(0, 2000)}`,
        ),
      );
    }, TIMEOUT_MS);
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Failed to spawn LibreOffice (${LIBREOFFICE_BIN}): ${err.message}`,
        ),
      );
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const out = Buffer.concat(stdout).toString("utf8").trim();
        const err = Buffer.concat(stderr).toString("utf8").trim();
        reject(
          new Error(
            `LibreOffice HTML→PDF exited ${code}. stdout: ${out.slice(0, 500)} stderr: ${err.slice(0, 2000)}`,
          ),
        );
      }
    });
  });
}
