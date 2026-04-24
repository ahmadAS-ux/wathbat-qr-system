import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable, dropdownOptionsTable, systemSettings, paymentMilestonesTable, projectPhasesTable, vendorsTable, purchaseOrdersTable, poItemsTable, manufacturingOrdersTable } from "@workspace/db";
import { sql, eq, inArray } from "drizzle-orm";
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

    // v2.5.1: parsed quotation + section tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parsed_quotations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_file_id INTEGER NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
        project_name_in_file TEXT,
        quotation_number TEXT,
        quotation_date TEXT,
        currency TEXT NOT NULL DEFAULT 'SAR',
        positions JSONB NOT NULL DEFAULT '[]',
        subtotal_net TEXT,
        tax_rate TEXT,
        tax_amount TEXT,
        grand_total TEXT,
        raw_position_count INTEGER NOT NULL DEFAULT 0,
        deduped_position_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parsed_sections (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_file_id INTEGER NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
        project_name_in_file TEXT,
        system TEXT,
        drawing_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parsed_section_drawings (
        id SERIAL PRIMARY KEY,
        parsed_section_id INTEGER NOT NULL REFERENCES parsed_sections(id) ON DELETE CASCADE,
        order_index INTEGER NOT NULL,
        position_code TEXT,
        media_filename TEXT NOT NULL,
        mime_type TEXT NOT NULL DEFAULT 'image/png',
        image_data BYTEA NOT NULL,
        width_px INTEGER,
        height_px INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // v2.5.3: assembly list + cut optimisation parsed tables
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parsed_assembly_lists (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_file_id INTEGER NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
        project_name_in_file TEXT,
        position_count INTEGER NOT NULL DEFAULT 0,
        positions JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS parsed_cut_optimisations (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        source_file_id INTEGER NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
        project_name_in_file TEXT,
        profile_count INTEGER NOT NULL DEFAULT 0,
        profiles JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // v2.5.2: system settings (contract template, etc.)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // v2.6.0: payment milestones
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payment_milestones (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        label TEXT NOT NULL,
        percentage INTEGER,
        amount INTEGER,
        paid_amount INTEGER,
        due_date DATE,
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMPTZ,
        qoyod_doc_file_id INTEGER REFERENCES project_files(id),
        notes TEXT
      )
    `);

    // v3.0: project_phases table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS project_phases (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        phase_number INTEGER NOT NULL,
        label TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        delivered_at TIMESTAMP,
        installed_at TIMESTAMP,
        signed_off_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // v3.1: Phase 3 tables — vendors, purchase_orders, po_items, manufacturing_orders
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        category TEXT NOT NULL DEFAULT 'Other',
        contact_person TEXT,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS purchase_orders (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        vendor_id INTEGER NOT NULL REFERENCES vendors(id),
        status TEXT NOT NULL DEFAULT 'pending',
        total_amount INTEGER,
        amount_paid INTEGER,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL REFERENCES users(id)
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS po_items (
        id SERIAL PRIMARY KEY,
        po_id INTEGER NOT NULL REFERENCES purchase_orders(id),
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT NOT NULL DEFAULT 'pcs',
        unit_price INTEGER,
        received_quantity INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending'
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS manufacturing_orders (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id),
        status TEXT NOT NULL DEFAULT 'pending',
        delivery_deadline DATE,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER NOT NULL REFERENCES users(id),
        updated_at TIMESTAMP,
        updated_by INTEGER REFERENCES users(id)
      )
    `);

    // v3.0: idempotent column additions
    await db.execute(sql`ALTER TABLE project_files ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`);
    await db.execute(sql`UPDATE project_files SET is_active = true WHERE is_active IS NULL`);

    await db.execute(sql`ALTER TABLE payment_milestones ADD COLUMN IF NOT EXISTS linked_event TEXT`);
    await db.execute(sql`ALTER TABLE payment_milestones ADD COLUMN IF NOT EXISTS linked_phase_id INTEGER REFERENCES project_phases(id)`);
    // paid_amount already exists from v2.6.0 — guard with IF NOT EXISTS just in case
    await db.execute(sql`ALTER TABLE payment_milestones ADD COLUMN IF NOT EXISTS paid_amount INTEGER`);
    // status 'due' is a new valid value in v3.0 — no migration needed, existing 'pending' rows remain valid

    // v3.2: Phase 4 — customer confirmation columns on project_phases
    await db.execute(sql`ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN NOT NULL DEFAULT false`);
    await db.execute(sql`ALTER TABLE project_phases ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMP`);

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

runStartupMigrations().then(async () => {
  // v2.5.2: seed default contract template sections
  try {
    const templateKeys = [
      'contract_cover_intro_ar',
      'contract_cover_intro_en',
      'contract_terms_ar',
      'contract_terms_en',
      'contract_signature_block_ar',
      'contract_signature_block_en',
    ];
    const existing = await db.select().from(systemSettings)
      .where(inArray(systemSettings.key, templateKeys));
    const existingKeys = new Set(existing.map(r => r.key));

    const defaults: Record<string, string> = {
      contract_cover_intro_ar: `بسم الله الرحمن الرحيم

يتم الاتفاق بين شركة {{companyName}} والعميل الكريم {{customerName}} على تنفيذ أعمال مشروع {{projectName}} وفق المواصفات والشروط المذكورة في هذا العقد.

رقم عرض السعر: {{quotationNumber}}
تاريخ عرض السعر: {{quotationDate}}
تاريخ العقد: {{today}}`,

      contract_cover_intro_en: `In the name of Allah, the Most Gracious, the Most Merciful

This contract is made between {{companyName}} and the valued customer {{customerName}} for the execution of the {{projectName}} project according to the specifications and terms stated in this contract.

Quotation No.: {{quotationNumber}}
Quotation Date: {{quotationDate}}
Contract Date: {{today}}`,

      contract_terms_ar: `الشروط والأحكام:

1. تعتبر هذه الأسعار سارية لمدة 30 يوماً من تاريخ العقد.
2. يلتزم الطرف الثاني بدفع دفعة مقدمة بنسبة 30% عند توقيع العقد.
3. يتم التوريد والتركيب خلال المدة المتفق عليها بعد استلام الدفعة المقدمة.
4. جميع الأعمال مضمونة لمدة 12 شهراً من تاريخ التسليم النهائي.
5. أي تعديلات على المواصفات بعد توقيع العقد قد تؤدي إلى تغيير السعر والجدول الزمني.
6. تخضع هذه الاتفاقية لأحكام نظام العمل السعودي.`,

      contract_terms_en: `Terms and Conditions:

1. These prices are valid for 30 days from the contract date.
2. The second party shall pay a 30% advance payment upon signing this contract.
3. Supply and installation shall be completed within the agreed timeframe after the advance payment is received.
4. All works are warranted for 12 months from the final delivery date.
5. Any modifications to specifications after signing may result in price and timeline changes.
6. This agreement is subject to the regulations of Saudi Arabian labor law.`,

      contract_signature_block_ar: `الطرف الأول / {{companyName}}                الطرف الثاني / {{customerName}}

الاسم: _______________________                الاسم: _______________________

التوقيع: ______________________                التوقيع: ______________________

التاريخ: ______________________                التاريخ: ______________________`,

      contract_signature_block_en: `First Party / {{companyName}}                Second Party / {{customerName}}

Name: _______________________                Name: _______________________

Signature: ___________________                Signature: ___________________

Date: _______________________                Date: _______________________`,
    };

    for (const key of templateKeys) {
      if (!existingKeys.has(key)) {
        await db.insert(systemSettings).values({ key, value: defaults[key] });
      }
    }
    logger.info('[v2.5.2] Contract template seed check complete');
  } catch (err) {
    logger.warn({ err }, '[v2.5.2] Contract template seed failed');
  }

  // v2.5.0: log count of legacy fileTypes still in DB (informational)
  try {
    const legacyCounts = await db.execute(sql`
      SELECT file_type, COUNT(*) as c
      FROM project_files
      WHERE file_type IN ('technical_doc', 'qoyod_deposit', 'qoyod_payment', 'attachment')
      GROUP BY file_type
    `);
    if (legacyCounts.rows.length > 0) {
      logger.info({ legacy: Object.fromEntries(legacyCounts.rows.map((r: any) => [r.file_type, r.c])) }, "[v2.5.0] Legacy fileTypes hidden from UI");
    }
  } catch (err) {
    logger.warn({ err }, "[v2.5.0] Could not count legacy fileTypes");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });

  // v3.2: Warranty expiry check — runs every 6 hours
  // Projects where warrantyEndDate < today AND stageInternal < 14 → mark complete
  const runWarrantyExpiryCheck = async () => {
    try {
      const result = await db.execute(sql`
        UPDATE projects
        SET stage_internal = 14, stage_display = 'complete'
        WHERE warranty_end_date IS NOT NULL
          AND warranty_end_date < CURRENT_DATE
          AND stage_internal < 14
      `);
      if ((result as any).rowCount > 0) {
        logger.info({ count: (result as any).rowCount }, '[v3.2] Warranty expiry check: projects marked complete');
      }
    } catch (err) {
      logger.warn({ err }, '[v3.2] Warranty expiry check failed');
    }
  };
  runWarrantyExpiryCheck(); // run once on startup
  setInterval(runWarrantyExpiryCheck, 6 * 60 * 60 * 1000);
});
