import { spawn } from "child_process";
import { writeFile, readFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

export async function htmlToPdf(htmlBuffer: Buffer): Promise<Buffer> {
  const tmpDir = join(tmpdir(), `html-pdf-${randomUUID()}`);
  await mkdir(tmpDir, { recursive: true });
  const inputPath = join(tmpDir, "input.html");
  const outputPath = join(tmpDir, "input.pdf");
  try {
    await writeFile(inputPath, htmlBuffer);
    await new Promise<void>((resolve, reject) => {
      const bin = process.env["LIBREOFFICE_BIN"] ?? "soffice";
      const child = spawn(bin, [
        "--headless", "--nologo", "--nodefault",
        "--nofirststartwizard", "--nolockcheck",
        "--convert-to", "pdf:writer_pdf_Export",
        "--outdir", tmpDir,
        inputPath,
      ]);
      const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error("LibreOffice timeout")); }, 30000);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve(); else reject(new Error(`LibreOffice exited ${code}`));
      });
    });
    const pdfBuffer = await readFile(outputPath);
    if (!pdfBuffer.length) throw new Error("LibreOffice produced empty PDF");
    return pdfBuffer;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
