import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth.js";

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
    // of `projectName`. Only move a value from invoice_number → project_name when
    // it actually matches a real project name in processed_docs. Values that don't
    // match (e.g. real invoice numbers like INV-2025-001) stay in invoice_number.
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

  // Create users table and seed default admin
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'User',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
    if (!existing) {
      await db.insert(usersTable).values({ username: "admin", passwordHash: hashPassword("admin123"), role: "Admin" });
      logger.info("Default admin account created: admin / admin123");
    }
  } catch (err) {
    logger.error({ err }, "Failed to initialise users table — server will still start");
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
