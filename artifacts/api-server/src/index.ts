import app from "./app";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runStartupMigrations() {
  try {
    // Backfill: the old scan page sent the QR ref param as `invoiceNumber` instead
    // of `projectName`. The scan form has no manual invoice-number input, so any
    // request where project_name is NULL and invoice_number is set must be holding
    // a project reference in the wrong column. Move it unconditionally.
    const fix = await db.execute(sql`
      UPDATE requests
      SET project_name = invoice_number,
          invoice_number = NULL
      WHERE project_name IS NULL
        AND invoice_number IS NOT NULL
    `);
    const fixCount = (fix as any).rowCount ?? 0;
    if (fixCount > 0) {
      logger.info({ count: fixCount }, "Migration: moved project ref from invoice_number to project_name");
    }
  } catch (err) {
    logger.error({ err }, "Startup migration failed — server will still start");
  }
}

runStartupMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
