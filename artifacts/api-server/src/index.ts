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
    // Step 1: Undo bad previous backfill — clear project_name values that are not
    // real project names (i.e. they don't exist in processed_docs)
    const undo = await db.execute(sql`
      UPDATE requests r
      SET project_name = NULL
      WHERE r.project_name IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM processed_docs p WHERE p.project_name = r.project_name
        )
    `);
    const undoCount = (undo as any).rowCount ?? 0;
    if (undoCount > 0) {
      logger.info({ count: undoCount }, "Migration: cleared wrongly-backfilled project_name values");
    }

    // Step 2: Correct backfill — move invoice_number → project_name only when
    // that value IS a real project in processed_docs (i.e. it was the QR ref param,
    // not an actual invoice number). Clear invoice_number for those rows.
    const fix = await db.execute(sql`
      UPDATE requests r
      SET project_name = r.invoice_number,
          invoice_number = NULL
      WHERE r.project_name IS NULL
        AND r.invoice_number IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM processed_docs p WHERE p.project_name = r.invoice_number
        )
    `);
    const fixCount = (fix as any).rowCount ?? 0;
    if (fixCount > 0) {
      logger.info({ count: fixCount }, "Migration: moved project names from invoice_number to project_name");
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
