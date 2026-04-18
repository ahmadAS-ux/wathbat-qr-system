import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable, dropdownOptionsTable } from "@workspace/db";
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

  // Create all tables and seed default admin
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS processed_docs (
        id SERIAL PRIMARY KEY,
        original_filename TEXT NOT NULL,
        report_filename TEXT NOT NULL,
        project_name TEXT,
        processing_date TEXT,
        position_count INTEGER NOT NULL DEFAULT 0,
        original_file BYTEA NOT NULL,
        report_file BYTEA NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS requests (
        id SERIAL PRIMARY KEY,
        position_id TEXT NOT NULL,
        request_type TEXT NOT NULL,
        customer_phone TEXT,
        project_name TEXT,
        invoice_number TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'New',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
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

    // ERP tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        source TEXT NOT NULL,
        product_interest TEXT NOT NULL,
        building_type TEXT NOT NULL,
        location TEXT,
        assigned_to INTEGER REFERENCES users(id),
        budget_range TEXT,
        estimated_value INTEGER,
        first_followup_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        lost_reason TEXT,
        converted_project_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER REFERENCES users(id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS lead_logs (
        id SERIAL PRIMARY KEY,
        lead_id INTEGER NOT NULL REFERENCES leads(id),
        note TEXT NOT NULL,
        next_followup_date DATE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL REFERENCES users(id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT,
        location TEXT,
        building_type TEXT,
        product_interest TEXT,
        estimated_value INTEGER,
        stage_display TEXT NOT NULL DEFAULT 'new',
        stage_internal INTEGER NOT NULL DEFAULT 1,
        from_lead_id INTEGER REFERENCES leads(id),
        assigned_to INTEGER REFERENCES users(id),
        delivery_deadline DATE,
        warranty_months INTEGER,
        warranty_start_date DATE,
        warranty_end_date DATE,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL REFERENCES users(id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_files (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        file_type TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        file_data BYTEA NOT NULL,
        uploaded_at TIMESTAMP NOT NULL DEFAULT NOW(),
        uploaded_by INTEGER NOT NULL REFERENCES users(id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS dropdown_options (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        value TEXT NOT NULL,
        label_ar TEXT NOT NULL,
        label_en TEXT NOT NULL,
        sort_order INTEGER DEFAULT 0,
        active BOOLEAN DEFAULT TRUE
      )
    `);

    // Link legacy QR uploads to ERP projects (Issue #4 — nullable FK)
    await db.execute(sql`ALTER TABLE processed_docs ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id)`);

    // Ensure columns added after initial table creation exist (idempotent)
    await db.execute(sql`ALTER TABLE dropdown_options ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true`);
    await db.execute(sql`ALTER TABLE dropdown_options ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0`);
    // Backfill any rows that were inserted before the active column existed
    await db.execute(sql`UPDATE dropdown_options SET active = true WHERE active IS NULL`);

    // Rename legacy 'User' role to 'Employee'
    await db.execute(sql`UPDATE users SET role = 'Employee' WHERE role = 'User'`);

    // Correct any stale Arabic labels from earlier seed versions
    await db.execute(sql`UPDATE dropdown_options SET label_ar = 'حضوري'         WHERE category = 'lead_source'      AND value = 'walk_in'      AND label_ar = 'زيارة مباشرة'`);
    await db.execute(sql`UPDATE dropdown_options SET label_ar = 'تحويل'          WHERE category = 'lead_source'      AND value = 'referral'     AND label_ar = 'توصية'`);
    await db.execute(sql`UPDATE dropdown_options SET label_ar = 'تواصل اجتماعي' WHERE category = 'lead_source'      AND value = 'social'       AND label_ar = 'سوشال ميديا'`);
    await db.execute(sql`UPDATE dropdown_options SET label_ar = 'واجهات ستائرية' WHERE category = 'product_interest' AND value = 'curtain_wall' AND label_ar = 'واجهات زجاجية'`);
    await db.execute(sql`UPDATE dropdown_options SET label_ar = 'زجاج شاور'     WHERE category = 'product_interest' AND value = 'shower'       AND label_ar = 'زجاج حمامات'`);
    await db.execute(sql`UPDATE dropdown_options SET label_ar = 'عالي'          WHERE category = 'budget_range'     AND value = 'high'         AND label_ar = 'مرتفع'`);
    await db.execute(sql`UPDATE dropdown_options SET label_ar = 'ممتاز'         WHERE category = 'budget_range'     AND value = 'premium'      AND label_ar = 'بريميوم'`);

    // Seed dropdown options if empty
    const optResult = await db.execute(sql`SELECT COUNT(*) as count FROM dropdown_options`);
    const optRow = optResult.rows[0] as any;
    if (Number(optRow?.count ?? 0) === 0) {
      const seedRows = [
        // lead_source
        ["lead_source", "whatsapp", "واتساب",         "WhatsApp",     1],
        ["lead_source", "phone",    "هاتف",            "Phone",        2],
        ["lead_source", "walk_in",  "حضوري",           "Walk-in",      3],
        ["lead_source", "referral", "تحويل",           "Referral",     4],
        ["lead_source", "social",   "تواصل اجتماعي",  "Social media", 5],
        // product_interest
        ["product_interest", "windows",      "نوافذ",           "Windows",      1],
        ["product_interest", "doors",        "أبواب",           "Doors",        2],
        ["product_interest", "curtain_wall", "واجهات ستائرية", "Curtain wall", 3],
        ["product_interest", "facades",      "واجهات",          "Facades",      4],
        ["product_interest", "shower",       "زجاج شاور",      "Shower glass", 5],
        ["product_interest", "other",        "أخرى",            "Other",        6],
        // building_type
        ["building_type", "villa",      "فيلا",   "Villa",      1],
        ["building_type", "apartment",  "شقة",    "Apartment",  2],
        ["building_type", "commercial", "تجاري",  "Commercial", 3],
        ["building_type", "tower",      "برج",    "Tower",      4],
        // budget_range
        ["budget_range", "low",     "منخفض", "Low",     1],
        ["budget_range", "medium",  "متوسط", "Medium",  2],
        ["budget_range", "high",    "عالي",  "High",    3],
        ["budget_range", "premium", "ممتاز", "Premium", 4],
      ];
      for (const [category, value, labelAr, labelEn, sortOrder] of seedRows) {
        await db.insert(dropdownOptionsTable).values({
          category: category as string,
          value: value as string,
          labelAr: labelAr as string,
          labelEn: labelEn as string,
          sortOrder: sortOrder as number,
        });
      }
      logger.info("Seeded dropdown_options with default values");
    }
  } catch (err) {
    logger.error({ err }, "Failed to initialise tables — server will still start");
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
