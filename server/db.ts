import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'school-office.db');

let dbInstance: Database | null = null;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function getDb(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    try {
      const fileBuffer = fs.readFileSync(DB_PATH);
      dbInstance = new SQL.Database(fileBuffer);
      console.log(`[Database] Loaded existing SQLite database from ${DB_PATH}`);
    } catch (err) {
      console.error('[Database] Failed to read existing db file, creating new one:', err);
      dbInstance = new SQL.Database();
    }
  } else {
    console.log(`[Database] Initializing new SQLite database at ${DB_PATH}`);
    dbInstance = new SQL.Database();
  }

  initSchema(dbInstance);
  saveDb();
  return dbInstance;
}

/**
 * ARCHITECTURAL CONSTRAINT / NOTE:
 * saveDb() serializes and writes the ENTIRE in-memory sql.js SQLite database buffer
 * to the file system (DB_PATH) synchronously upon invocation.
 * While this provides complete transactional durability across server restarts without
 * native compiled C++ bindings, writes should be structured cleanly without unnecessary
 * redundant write loops during bulk operations.
 */
export function saveDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[Database] Error saving SQLite database file:', err);
  }
}

export function getRawDbBuffer(): Buffer {
  if (!dbInstance) throw new Error('Database not initialized');
  saveDb();
  return fs.readFileSync(DB_PATH);
}

export function restoreDbFromBuffer(buffer: Buffer): void {
  fs.writeFileSync(DB_PATH, buffer);
  dbInstance = null; // force reload
}

function initSchema(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      pin TEXT,
      avatar_initials TEXT,
      photo_url TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS families (
      id TEXT PRIMARY KEY,
      family_code TEXT NOT NULL UNIQUE,
      household_name TEXT NOT NULL,
      primary_guardian_name TEXT NOT NULL,
      primary_phone TEXT NOT NULL,
      primary_email TEXT,
      secondary_guardian_name TEXT,
      secondary_phone TEXT,
      secondary_email TEXT,
      address TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applicants (
      id TEXT PRIMARY KEY,
      application_no TEXT NOT NULL UNIQUE,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      dob TEXT NOT NULL,
      gender TEXT NOT NULL,
      grade_applying TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      status TEXT NOT NULL,
      status_updated_at TEXT NOT NULL,
      guardian_name TEXT NOT NULL,
      guardian_phone TEXT NOT NULL,
      guardian_email TEXT,
      guardian_relationship TEXT NOT NULL,
      address TEXT,
      family_id TEXT,
      notes TEXT,
      blood_group TEXT,
      allergies TEXT,
      dietary_needs TEXT,
      emergency_contact TEXT,
      emergency_phone TEXT,
      emergency_relationship TEXT,
      physician_name TEXT,
      physician_phone TEXT,
      care_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL,
      document_name TEXT NOT NULL,
      is_mandatory INTEGER DEFAULT 1,
      status TEXT NOT NULL, -- 'pending' or 'received'
      received_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      assessment_type TEXT NOT NULL,
      interviewer_name TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 30,
      score INTEGER,
      max_score INTEGER DEFAULT 100,
      recommendation TEXT,
      status TEXT NOT NULL, -- 'Scheduled', 'Completed', 'Cancelled'
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS fee_structures (
      id TEXT PRIMARY KEY,
      academic_year TEXT NOT NULL,
      grade TEXT NOT NULL,
      fee_type TEXT NOT NULL,
      amount REAL NOT NULL,
      is_compulsory INTEGER DEFAULT 1,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scholarships (
      id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL,
      title TEXT NOT NULL,
      discount_type TEXT NOT NULL, -- 'percentage' or 'fixed'
      value REAL NOT NULL,
      justification TEXT,
      approved_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS installment_plans (
      id TEXT PRIMARY KEY,
      applicant_id TEXT NOT NULL,
      plan_type TEXT NOT NULL, -- 'annual', 'term', 'monthly'
      installment_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      amount_due REAL NOT NULL,
      due_date TEXT NOT NULL,
      amount_paid REAL DEFAULT 0,
      status TEXT NOT NULL, -- 'Pending', 'Partial', 'Paid', 'Overdue'
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS income (
      id TEXT PRIMARY KEY,
      receipt_no TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      source TEXT NOT NULL, -- 'Tuition', 'Registration', 'Exam Fee', 'Uniform', 'Donation', 'Grant', 'Other'
      payment_method TEXT NOT NULL, -- 'Cash', 'Bank Transfer', 'Cheque', 'Card'
      payer_name TEXT NOT NULL,
      applicant_id TEXT,
      family_id TEXT,
      received_by_staff_id TEXT,
      received_by_staff_name TEXT NOT NULL,
      reference_no TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT NOT NULL, -- 'Payroll', 'Utilities', 'Supplies', 'Maintenance', 'Educational Materials', 'Other'
      paid_to TEXT NOT NULL,
      payment_method TEXT NOT NULL, -- 'Cash', 'Bank Transfer', 'Cheque', 'Card'
      reference_no TEXT,
      recorded_by_staff_name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_reconciliations (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      opening_cash REAL NOT NULL,
      system_expected_cash REAL NOT NULL,
      physically_counted_cash REAL NOT NULL,
      discrepancy REAL NOT NULL,
      is_locked INTEGER DEFAULT 0,
      notes TEXT,
      reconciled_by_staff_name TEXT NOT NULL,
      reconciled_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS communications (
      id TEXT PRIMARY KEY,
      applicant_id TEXT,
      family_id TEXT,
      contact_type TEXT NOT NULL, -- 'Call', 'Meeting', 'Email', 'Notice', 'Complaint', 'WhatsApp'
      summary TEXT NOT NULL,
      date TEXT NOT NULL,
      staff_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      staff_name TEXT NOT NULL,
      action_type TEXT NOT NULL,
      record_type TEXT NOT NULL,
      record_id TEXT,
      details TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      item_name TEXT NOT NULL,
      category TEXT NOT NULL,
      purchase_date TEXT NOT NULL,
      purchase_price REAL NOT NULL,
      current_location TEXT NOT NULL,
      condition TEXT NOT NULL,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Migrate photo_url and is_archived columns on applicants table if not existing
  try {
    db.run("ALTER TABLE applicants ADD COLUMN photo_url TEXT");
  } catch (e) {
    // Column already exists or table fresh
  }
  try {
    db.run("ALTER TABLE applicants ADD COLUMN is_archived INTEGER DEFAULT 0");
  } catch (e) {
    // Column already exists or table fresh
  }
  try {
    db.run("ALTER TABLE assessments ADD COLUMN duration_minutes INTEGER DEFAULT 30");
  } catch (e) {
    // Column already exists or table fresh
  }
  try {
    db.run("UPDATE assessments SET duration_minutes = 30 WHERE duration_minutes IS NULL");
  } catch (e) {
    // Column already updated
  }
  try {
    db.run("ALTER TABLE staff ADD COLUMN is_active INTEGER DEFAULT 1");
  } catch (e) {
    // Column already exists or table fresh
  }
  try {
    db.run("UPDATE staff SET is_active = COALESCE(active, 1) WHERE is_active IS NULL");
  } catch (e) {
    // Already updated
  }

  try {
    db.run("ALTER TABLE staff ADD COLUMN photo_url TEXT DEFAULT ''");
  } catch (e) {
    // Column already exists or table fresh
  }

  // Ensure set staff PINs are hashed with bcrypt (never default un-set pins to 9999)
  try {
    const staffRows = db.exec("SELECT id, pin FROM staff");
    if (staffRows.length > 0 && staffRows[0].values) {
      for (const row of staffRows[0].values) {
        const id = row[0] as string;
        const pin = row[1] as string;
        if (pin && pin.trim() && !pin.startsWith('$2')) {
          const hashed = bcrypt.hashSync(pin.trim(), 10);
          db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashed, id]);
        }
      }
    }
  } catch (e) {
    // Ignore migration error
  }

  // Seed default settings if empty
  const countRes = db.exec("SELECT COUNT(*) as count FROM settings");
  const count = countRes[0]?.values[0]?.[0] as number;
  if (count === 0) {
    seedInitialData(db);
  } else {
    // Ensure default settings include auto-lock timeout, threshold, and school_logo_url
    try {
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('school_logo_url', '')");
      db.run("DELETE FROM settings WHERE key = 'crest_icon'");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('default_opening_float', '50000.00')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('session_timeout_minutes', '10')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('stalled_applicant_threshold_days', '14')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('motto', 'To empower young minds with knowledge, skills, and values to create a future-ready generation.')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('tagline', 'Scientia est Infinita')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('address', '1/143, Akuressa Road, Matara, Sri Lanka')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('phone', '+94 70 699 9333')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('email', 'office@eis.lk')");
      db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('whatsapp_number', '+94706999333')");
      // Update school identity if default was placeholder
      db.run("UPDATE settings SET value = 'Scientia est Infinita' WHERE key = 'tagline' AND (value = 'School · Matara' OR value = '')");
      db.run("UPDATE settings SET value = '1/143, Akuressa Road, Matara, Sri Lanka' WHERE key = 'address' AND (value LIKE '%Crestview%' OR value = '')");
      db.run("UPDATE settings SET value = 'office@eis.lk' WHERE key = 'email' AND (value LIKE '%eliteschool%' OR value = '')");
      db.run("UPDATE settings SET value = '+94 70 699 9333' WHERE key = 'phone' AND (value LIKE '%555%' OR value = '')");
      db.run("UPDATE settings SET value = '+94706999333' WHERE key = 'whatsapp_number' AND (value LIKE '%555%' OR value = '')");
      db.run("UPDATE settings SET value = 'Thank you for your payment. Please retain this receipt for your records. Elite International School, 1/143, Akuressa Road, Matara, Sri Lanka • +94 70 699 9333 • office@eis.lk' WHERE key = 'receipt_footer_notice' AND value LIKE '%retain this receipt%'");
    } catch (e) {
      // Ignore
    }
  }

  // Ensure cash flow sample records exist for the current week and rolling 8-week history
  try {
    seedSampleCashFlow(db);
  } catch (e) {
    console.error('[Database] Error checking/seeding cashflow records:', e);
  }
}

function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function seedSampleCashFlow(db: Database, forceRefresh: boolean = false): void {
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek);
  const mondayStr = toYMD(monday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const sundayStr = toYMD(sunday);

  const incCurrentWeek = db.exec(`SELECT COUNT(*) as count FROM income WHERE date >= '${mondayStr}' AND date <= '${sundayStr}'`);
  const incCount = (incCurrentWeek[0]?.values[0]?.[0] as number) || 0;

  if (!forceRefresh && incCount >= 3) {
    return; // Already populated for the current week
  }

  const nowIso = now.toISOString();

  const getRelativeDateStr = (daysAgo: number): string => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return toYMD(d);
  };

  // Safe dates guaranteed to fall within the current calendar week (Monday to Sunday)
  const todayStr = toYMD(now);
  const yesterdayStr = dayOfWeek >= 1 ? getRelativeDateStr(1) : todayStr;
  const twoDaysAgoStr = dayOfWeek >= 2 ? getRelativeDateStr(2) : (dayOfWeek >= 1 ? yesterdayStr : todayStr);
  const threeDaysAgoStr = dayOfWeek >= 3 ? getRelativeDateStr(3) : twoDaysAgoStr;

  // Clean old sample records if forceRefresh is requested
  if (forceRefresh) {
    try {
      db.run("DELETE FROM income WHERE id LIKE 'inc_%'");
      db.run("DELETE FROM expenses WHERE id LIKE 'exp_%'");
    } catch (e) {
      // Ignore
    }
  }

  // --- CURRENT WEEK INCOME RECORDS (Total LKR 172,000) ---
  const currentWeekIncome = [
    ['inc_cw_1', 'REC-2026-0901', todayStr, 45000.00, 'Tuition', 'Bank Transfer', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_2', 'Marcus Sterling', 'BFT-MONT-8821', 'Autumn Term 1 core academic tuition fee installment', nowIso],
    ['inc_cw_2', 'REC-2026-0902', todayStr, 15000.00, 'Registration', 'Card', 'Layla Al-Mansoor', 'app_3', 'fam_2', 'stf_1', 'Malki Perera', 'POS-CARD-5402', 'Grade 10 matriculation deposit & registration fee', nowIso],
    ['inc_cw_3', 'REC-2026-0903', yesterdayStr, 35000.00, 'Tuition', 'Cash', 'Stefan Kowalski', 'app_4', 'fam_3', 'stf_1', 'Malki Perera', 'CASH-REC-202', 'Grade 7 middle school academic tuition payment', nowIso],
    ['inc_cw_4', 'REC-2026-0904', yesterdayStr, 8500.00, 'Uniform', 'Cash', 'Victoria Montgomery', 'app_2', 'fam_1', 'stf_1', 'Malki Perera', 'CASH-REC-203', 'Blazer kit, sportswear & house crest uniform set', nowIso],
    ['inc_cw_5', 'REC-2026-0905', twoDaysAgoStr, 50000.00, 'Tuition', 'Bank Transfer', 'Harrison Thornton', 'app_5', 'fam_4', 'stf_2', 'Marcus Sterling', 'NTB-WIRE-9011', 'Grade 3 primary tuition clearance', nowIso],
    ['inc_cw_6', 'REC-2026-0906', twoDaysAgoStr, 12000.00, 'Laboratory Fee', 'Bank Transfer', 'Tariq Al-Mansoor', 'app_3', 'fam_2', 'stf_3', 'Sophia Chen', 'BFT-ALM-6623', 'Senior STEM chemistry & physics laboratory consumable fee', nowIso],
    ['inc_cw_7', 'REC-2026-0907', threeDaysAgoStr, 6500.00, 'Exam Fee', 'Card', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_1', 'Malki Perera', 'POS-CARD-9912', 'Cambridge IGCSE termly assessment & examination licensing', nowIso],
  ];

  for (const inc of currentWeekIncome) {
    db.run(
      "INSERT OR REPLACE INTO income (id, receipt_no, date, amount, source, payment_method, payer_name, applicant_id, family_id, received_by_staff_id, received_by_staff_name, reference_no, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      inc
    );
  }

  // --- CURRENT WEEK EXPENSES RECORDS (Total LKR 53,200) ---
  const currentWeekExpenses = [
    ['exp_cw_1', todayStr, 14500.00, 'Supplies', 'Matara Stationers & Direct', 'Cash', 'VCH-SUP-2026-41', 'Malki Perera', 'Examination papers, registers, toner cartridges & student folders', nowIso],
    ['exp_cw_2', yesterdayStr, 22000.00, 'Utilities', 'Ceylon Electricity Board & SLT Fiber', 'Bank Transfer', 'ELEC-SLT-SEP', 'Marcus Sterling', 'Campus high-speed fiber internet & main administrative electric utility', nowIso],
    ['exp_cw_3', twoDaysAgoStr, 9500.00, 'Maintenance', 'Southern Facilities & Aircon Services', 'Cash', 'CASH-MAINT-12', 'Dr. Arthur Pendelton', 'Science lab AC unit servicing and air filter replacements', nowIso],
    ['exp_cw_4', threeDaysAgoStr, 7200.00, 'Educational Materials', 'Sarasavi Bookshop Ltd', 'Card', 'POS-BOOK-551', 'Eleanor Vance', 'Cambridge secondary reference textbooks for school library', nowIso],
  ];

  for (const exp of currentWeekExpenses) {
    db.run(
      "INSERT OR REPLACE INTO expenses (id, date, amount, category, paid_to, payment_method, reference_no, recorded_by_staff_name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      exp
    );
  }

  // --- HISTORICAL WEEKS RECORDS (For 8-Week Rolling Cash Flow Projection) ---
  const historicalIncome = [
    // Week 1 ago (7-10 days ago)
    ['inc_h_1', 'REC-2026-0810', getRelativeDateStr(8), 65000.00, 'Tuition', 'Bank Transfer', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_2', 'Marcus Sterling', 'BFT-MONT-7701', 'Autumn Term 1 Tuition installment settlement', nowIso],
    ['inc_h_2', 'REC-2026-0811', getRelativeDateStr(10), 20000.00, 'Registration', 'Cash', 'Tariq Al-Mansoor', 'app_3', 'fam_2', 'stf_1', 'Malki Perera', 'CASH-REC-118', 'Enrolment and placement confirmation fee', nowIso],

    // Week 2 ago (14-17 days ago)
    ['inc_h_3', 'REC-2026-0812', getRelativeDateStr(15), 90000.00, 'Tuition', 'Bank Transfer', 'Stefan Kowalski', 'app_4', 'fam_3', 'stf_2', 'Marcus Sterling', 'BFT-KOW-3019', 'Full semester academic tuition payment', nowIso],
    ['inc_h_4', 'REC-2026-0813', getRelativeDateStr(17), 15000.00, 'Uniform', 'Card', 'Victoria Montgomery', 'app_2', 'fam_1', 'stf_1', 'Malki Perera', 'POS-CARD-4410', 'Full school uniform & sportswear set', nowIso],

    // Week 3 ago (21-24 days ago)
    ['inc_h_5', 'REC-2026-0814', getRelativeDateStr(22), 45000.00, 'Tuition', 'Cash', 'Harrison Thornton', 'app_5', 'fam_4', 'stf_1', 'Malki Perera', 'CASH-REC-109', 'Grade 3 academic tuition installment', nowIso],
    ['inc_h_6', 'REC-2026-0815', getRelativeDateStr(24), 18000.00, 'Exam Fee', 'Bank Transfer', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_2', 'Marcus Sterling', 'BFT-MONT-6520', 'Annual Cambridge external exam registration', nowIso],

    // Week 4 ago (28-31 days ago)
    ['inc_h_7', 'REC-2026-0816', getRelativeDateStr(29), 120000.00, 'Tuition', 'Bank Transfer', 'Tariq Al-Mansoor', 'app_3', 'fam_2', 'stf_2', 'Marcus Sterling', 'BFT-ALM-5501', 'Annual high school senior tuition settlement', nowIso],
    ['inc_h_8', 'REC-2026-0817', getRelativeDateStr(31), 25000.00, 'Registration', 'Card', 'Stefan Kowalski', 'app_4', 'fam_3', 'stf_3', 'Sophia Chen', 'POS-CARD-3211', 'International transfer student registration', nowIso],

    // Week 5 ago (35-38 days ago)
    ['inc_h_9', 'REC-2026-0818', getRelativeDateStr(36), 75000.00, 'Tuition', 'Bank Transfer', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_2', 'Marcus Sterling', 'BFT-MONT-4901', 'Tuition installment fee payment', nowIso],
    ['inc_h_10', 'REC-2026-0819', getRelativeDateStr(38), 12000.00, 'Extracurricular / Sports', 'Cash', 'Harrison Thornton', 'app_5', 'fam_4', 'stf_1', 'Malki Perera', 'CASH-REC-095', 'Swimming club & cricket academy annual subscription', nowIso],

    // Week 6 ago (42-45 days ago)
    ['inc_h_11', 'REC-2026-0820', getRelativeDateStr(43), 80000.00, 'Tuition', 'Cash', 'Stefan Kowalski', 'app_4', 'fam_3', 'stf_1', 'Malki Perera', 'CASH-REC-082', 'Mid-year academic tuition fee installment', nowIso],
    ['inc_h_12', 'REC-2026-0821', getRelativeDateStr(45), 15000.00, 'Registration', 'Bank Transfer', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_2', 'Marcus Sterling', 'BFT-MONT-3810', 'Application dossier fee', nowIso],

    // Week 7 ago (49-52 days ago)
    ['inc_h_13', 'REC-2026-0822', getRelativeDateStr(50), 55000.00, 'Tuition', 'Bank Transfer', 'Tariq Al-Mansoor', 'app_3', 'fam_2', 'stf_2', 'Marcus Sterling', 'BFT-ALM-2201', 'Tuition fee installment', nowIso],
    ['inc_h_14', 'REC-2026-0823', getRelativeDateStr(52), 10000.00, 'Registration', 'Card', 'Harrison Thornton', 'app_5', 'fam_4', 'stf_3', 'Sophia Chen', 'POS-CARD-1980', 'Placement evaluation and assessment fee', nowIso],

    // Month 3 ago (~75-80 days ago - June)
    ['inc_h_15', 'REC-2026-0610', getRelativeDateStr(78), 185000.00, 'Tuition', 'Bank Transfer', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_2', 'Marcus Sterling', 'BFT-MONT-1102', 'Annual Term 3 tuition settlement', nowIso],
    ['inc_h_16', 'REC-2026-0618', getRelativeDateStr(85), 65000.00, 'Registration', 'Bank Transfer', 'Stefan Kowalski', 'app_4', 'fam_3', 'stf_2', 'Marcus Sterling', 'BFT-KOW-1190', 'Early registration deposit', nowIso],

    // Month 4 ago (~105-115 days ago - May)
    ['inc_h_17', 'REC-2026-0512', getRelativeDateStr(110), 160000.00, 'Tuition', 'Bank Transfer', 'Tariq Al-Mansoor', 'app_3', 'fam_2', 'stf_2', 'Marcus Sterling', 'BFT-ALM-0891', 'Term 2 tuition fee payment', nowIso],
    ['inc_h_18', 'REC-2026-0520', getRelativeDateStr(118), 35000.00, 'Exam Fee', 'Card', 'Harrison Thornton', 'app_5', 'fam_4', 'stf_1', 'Malki Perera', 'POS-CARD-1120', 'Standardized assessment fees', nowIso],

    // Month 5 ago (~135-145 days ago - April)
    ['inc_h_19', 'REC-2026-0414', getRelativeDateStr(140), 145000.00, 'Tuition', 'Bank Transfer', 'Julian Montgomery', 'app_1', 'fam_1', 'stf_2', 'Marcus Sterling', 'BFT-MONT-0544', 'Mid-year academic installment', nowIso],
    ['inc_h_20', 'REC-2026-0422', getRelativeDateStr(148), 28000.00, 'Extracurricular / Sports', 'Cash', 'Stefan Kowalski', 'app_4', 'fam_3', 'stf_1', 'Malki Perera', 'CASH-REC-041', 'Annual swimming and athletics kit subscription', nowIso],
  ];

  for (const inc of historicalIncome) {
    db.run(
      "INSERT OR REPLACE INTO income (id, receipt_no, date, amount, source, payment_method, payer_name, applicant_id, family_id, received_by_staff_id, received_by_staff_name, reference_no, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      inc
    );
  }

  const historicalExpenses = [
    // Week 1 ago
    ['exp_h_1', getRelativeDateStr(8), 28500.00, 'Supplies', 'Lanka Paper Mills & Stationery', 'Bank Transfer', 'VCH-SUP-2026-38', 'Malki Perera', 'Term examination papers, report card folios & envelopes', nowIso],
    ['exp_h_2', getRelativeDateStr(10), 16000.00, 'Utilities', 'Matara Water Supply Board', 'Cash', 'CASH-UTIL-09', 'Marcus Sterling', 'Campus municipal water and grounds sanitation monthly invoice', nowIso],

    // Week 2 ago
    ['exp_h_3', getRelativeDateStr(15), 34000.00, 'Maintenance', 'ElectroTech Power Systems', 'Bank Transfer', 'VCH-MAINT-2026-22', 'Marcus Sterling', 'Backup diesel generator quarterly servicing and fuel supply', nowIso],

    // Week 3 ago
    ['exp_h_4', getRelativeDateStr(22), 19500.00, 'Educational Materials', 'Oxford University Press Colombo', 'Card', 'POS-EDU-7741', 'Eleanor Vance', 'Secondary science teacher guides, laboratory logbooks & syllabi', nowIso],

    // Week 4 ago
    ['exp_h_5', getRelativeDateStr(29), 48000.00, 'Maintenance', 'Southern Fiber Networks Ltd', 'Bank Transfer', 'VCH-IT-2026-14', 'Marcus Sterling', 'Campus server rack cabling, router firewall license & backup drive', nowIso],
    ['exp_h_6', getRelativeDateStr(31), 25000.00, 'Supplies', 'Southern Office Supplies', 'Cash', 'CASH-SUPP-31', 'Malki Perera', 'Classroom whiteboard markers, paper reams & laminating rolls', nowIso],

    // Week 5 ago
    ['exp_h_7', getRelativeDateStr(36), 26000.00, 'Educational Materials', 'Cambridge University Press', 'Card', 'POS-CAMB-902', 'Sophia Chen', 'Primary mathematics workbooks and graded readers set', nowIso],

    // Week 6 ago
    ['exp_h_8', getRelativeDateStr(43), 31500.00, 'Utilities', 'Ceylon Electricity Board', 'Bank Transfer', 'ELEC-AUG-BILL', 'Marcus Sterling', 'Campus primary academic building electricity billing', nowIso],

    // Week 7 ago
    ['exp_h_9', getRelativeDateStr(50), 21000.00, 'Supplies', 'Matara Cleaners & Facilities', 'Cash', 'CASH-CLN-14', 'Malki Perera', 'Sanitization dispensers, handwash supplies & facility cleaning materials', nowIso],

    // Month 3 ago (June)
    ['exp_h_10', getRelativeDateStr(78), 58000.00, 'Maintenance', 'Apex Air Conditioning & Refrigeration', 'Bank Transfer', 'VCH-HVAC-2026-08', 'Marcus Sterling', 'Campus-wide HVAC servicing and filter replacements', nowIso],
    ['exp_h_11', getRelativeDateStr(85), 32000.00, 'Educational Materials', 'Colombo Book Agency', 'Bank Transfer', 'VCH-EDU-2026-44', 'Eleanor Vance', 'Cambridge primary reading sets and library reference books', nowIso],

    // Month 4 ago (May)
    ['exp_h_12', getRelativeDateStr(110), 45000.00, 'Utilities', 'Ceylon Electricity Board', 'Bank Transfer', 'ELEC-MAY-BILL', 'Marcus Sterling', 'May monthly administrative and classroom electric power invoice', nowIso],
    ['exp_h_13', getRelativeDateStr(118), 24500.00, 'Supplies', 'Southern Office Supplies', 'Cash', 'CASH-SUPP-19', 'Malki Perera', 'Admissions application folios, toner cartridges & badge stationery', nowIso],

    // Month 5 ago (April)
    ['exp_h_14', getRelativeDateStr(140), 38000.00, 'Maintenance', 'GreenScape Grounds & Gardeners', 'Bank Transfer', 'VCH-GRND-2026-02', 'Marcus Sterling', 'Campus sports grounds maintenance and landscaping', nowIso],
    ['exp_h_15', getRelativeDateStr(148), 18500.00, 'Educational Materials', 'Matara Science Consumables', 'Cash', 'CASH-SCI-08', 'Sophia Chen', 'Introductory laboratory test kits and experiment charts', nowIso],
  ];

  for (const exp of historicalExpenses) {
    db.run(
      "INSERT OR REPLACE INTO expenses (id, date, amount, category, paid_to, payment_method, reference_no, recorded_by_staff_name, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      exp
    );
  }

  console.log('[Database] Seeded rich sample cash flow records successfully');
}

export function seedInitialData(db: Database): void {
  const now = new Date().toISOString();
  const defaultHashedPin = bcrypt.hashSync('9999', 10);

  // Settings
  const settings = [
    ['school_name', 'Elite International School'],
    ['tagline', 'Scientia est Infinita'],
    ['motto', 'To empower young minds with knowledge, skills, and values to create a future-ready generation.'],
    ['address', '1/143, Akuressa Road, Matara, Sri Lanka'],
    ['phone', '+94 70 699 9333'],
    ['email', 'office@eis.lk'],
    ['whatsapp_number', '+94706999333'],
    ['currency_symbol', 'LKR'],
    ['academic_year', '2026-2027'],
    ['total_student_capacity', '450'],
    ['sibling_discount_2nd', '10'],
    ['sibling_discount_3rd', '15'],
    ['default_opening_float', '50000.00'],
    ['session_timeout_minutes', '10'],
    ['stalled_applicant_threshold_days', '14'],
    ['receipt_footer_notice', 'Thank you for your payment. Please retain this receipt for your records. Elite International School, 1/143, Akuressa Road, Matara, Sri Lanka • +94 70 699 9333 • office@eis.lk'],
    ['backup_folder_path', ''],
    ['school_logo_url', '']
  ];

  for (const [k, v] of settings) {
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [k, v]);
  }

  // Staff
  const staffMembers = [
    ['stf_1', 'Malki Perera', 'Office Staff', 'malki.perera@eliteschool.lk', '+94 77 123 4567', defaultHashedPin, 'MP', 1, now],
    ['stf_2', 'Marcus Sterling', 'Bursar & Finance Lead', 'm.sterling@eliteschool.lk', '+94 77 234 5678', defaultHashedPin, 'MS', 1, now],
    ['stf_3', 'Sophia Chen', 'Admissions Officer', 's.chen@eliteschool.lk', '+94 77 345 6789', defaultHashedPin, 'SC', 1, now],
    ['stf_4', 'Dr. Arthur Pendelton', 'Head of Office & Operations', 'a.pendelton@eliteschool.lk', '+94 77 456 7890', defaultHashedPin, 'AP', 1, now],
    ['stf_5', 'Eleanor Vance', 'Registrar', 'e.vance@eliteschool.lk', '+94 77 567 8901', defaultHashedPin, 'EV', 1, now],
  ];

  for (const s of staffMembers) {
    db.run("INSERT INTO staff (id, name, role, email, phone, pin, avatar_initials, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", s);
  }

  // Fee Structures
  const grades = ['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'];
  let feeId = 1;
  for (const g of grades) {
    const isHighSchool = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'].includes(g);
    const isMiddle = ['Grade 6', 'Grade 7', 'Grade 8'].includes(g);
    const tuition = isHighSchool ? 14500 : isMiddle ? 12000 : 9500;
    
    db.run("INSERT INTO fee_structures (id, academic_year, grade, fee_type, amount, is_compulsory, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
      [`fee_${feeId++}`, '2026-2027', g, 'Tuition', tuition, 1, `Annual Core Academic Tuition for ${g}`, now]);
    db.run("INSERT INTO fee_structures (id, academic_year, grade, fee_type, amount, is_compulsory, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
      [`fee_${feeId++}`, '2026-2027', g, 'Registration Fee', 450, 1, 'One-time admission & matriculation fee', now]);
    db.run("INSERT INTO fee_structures (id, academic_year, grade, fee_type, amount, is_compulsory, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
      [`fee_${feeId++}`, '2026-2027', g, 'Uniform', 320, 1, 'Standard academic & sports kit package', now]);
    db.run("INSERT INTO fee_structures (id, academic_year, grade, fee_type, amount, is_compulsory, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
      [`fee_${feeId++}`, '2026-2027', g, 'Exam Fee', 280, 1, 'Termly standardized examination & licensing fee', now]);
    if (isHighSchool) {
      db.run("INSERT INTO fee_structures (id, academic_year, grade, fee_type, amount, is_compulsory, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", 
        [`fee_${feeId++}`, '2026-2027', g, 'Laboratory Fee', 500, 1, 'Advanced Sciences & STEM Lab equipment consumable fee', now]);
    }
  }

  // Families
  const families = [
    ['fam_1', 'FAM-2026-001', 'Montgomery Household', 'Julian Montgomery', '+1 (555) 912-3401', 'j.montgomery@apexholdings.com', 'Victoria Montgomery', '+1 (555) 912-3402', 'v.montgomery@gmail.com', '42 Kensington Crescent, Suite 4', 'Alumni family (Class of 2004). Interested in STEM track.', now],
    ['fam_2', 'FAM-2026-002', 'Al-Mansoor Household', 'Tariq Al-Mansoor', '+1 (555) 834-1190', 'tariq@almansoor.ae', 'Layla Al-Mansoor', '+1 (555) 834-1191', 'layla@almansoor.ae', '18 Westbourne Terrace', 'Relocating from Dubai. Requires ESL diagnostics.', now],
    ['fam_3', 'FAM-2026-003', 'Kowalski Household', 'Stefan Kowalski', '+1 (555) 745-8822', 'stefan.k@bioresearch.org', 'Helena Kowalski', '+1 (555) 745-8823', 'h.kowalski@gmail.com', '9 Primrose Hill Road', 'Applied for sibling discount.', now],
    ['fam_4', 'FAM-2026-004', 'Thornton Household', 'Harrison Thornton', '+1 (555) 654-3210', 'harrison@thorntonlaw.com', 'Claire Thornton', '+1 (555) 654-3211', 'claire.thornton@gmail.com', '88 St. George Avenue', 'Board of Governors contact.', now],
  ];

  for (const f of families) {
    db.run("INSERT INTO families (id, family_code, household_name, primary_guardian_name, primary_phone, primary_email, secondary_guardian_name, secondary_phone, secondary_email, address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", f);
  }

  // Applicants across various pipeline stages
  const applicants = [
    [
      'app_1', 'APP-2026-0101', 'Alexander', 'Montgomery', '2012-04-14', 'Male', 'Grade 9', '2026-2027',
      'enrolled', now, 'Julian Montgomery', '+1 (555) 912-3401', 'j.montgomery@apexholdings.com', 'Father',
      '42 Kensington Crescent', 'fam_1', 'Strong candidate with background in competitive robotics.',
      'O+', 'Peanuts (Mild)', 'Nut-free table preferred', 'Victoria Montgomery', '+1 (555) 912-3402', 'Mother',
      'Dr. Robert Hastings', '+1 (555) 432-1098', 'Carries EpiPen as precaution.', now, now
    ],
    [
      'app_2', 'APP-2026-0102', 'Beatrice', 'Montgomery', '2015-09-22', 'Female', 'Grade 6', '2026-2027',
      'accepted', now, 'Julian Montgomery', '+1 (555) 912-3401', 'j.montgomery@apexholdings.com', 'Father',
      '42 Kensington Crescent', 'fam_1', 'Sibling of Alexander. Passionate about equestrian and cello.',
      'A+', 'None', 'None', 'Julian Montgomery', '+1 (555) 912-3401', 'Father',
      'Dr. Robert Hastings', '+1 (555) 432-1098', 'No chronic conditions.', now, now
    ],
    [
      'app_3', 'APP-2026-0103', 'Zayd', 'Al-Mansoor', '2011-11-05', 'Male', 'Grade 10', '2026-2027',
      'documents_submitted', now, 'Tariq Al-Mansoor', '+1 (555) 834-1190', 'tariq@almansoor.ae', 'Father',
      '18 Westbourne Terrace', 'fam_2', 'High proficiency in mathematics. Awaiting official school transcripts from previous school in Dubai.',
      'B+', 'Dust mites', 'Halal strictly', 'Layla Al-Mansoor', '+1 (555) 834-1191', 'Mother',
      'Dr. Samira Qureshi', '+1 (555) 678-2234', 'Asthma inhaler for sports.', now, now
    ],
    [
      'app_4', 'APP-2026-0104', 'Karolina', 'Kowalski', '2014-02-18', 'Female', 'Grade 7', '2026-2027',
      'applied', now, 'Stefan Kowalski', '+1 (555) 745-8822', 'stefan.k@bioresearch.org', 'Father',
      '9 Primrose Hill Road', 'fam_3', 'Application received. Entrance exam scheduled next Tuesday.',
      'AB+', 'Penicillin', 'Vegetarian', 'Helena Kowalski', '+1 (555) 745-8823', 'Mother',
      'Dr. Thomas Reid', '+1 (555) 890-1234', 'Mild seasonal allergies.', now, now
    ],
    [
      'app_5', 'APP-2026-0105', 'Oliver', 'Thornton', '2018-07-30', 'Male', 'Grade 3', '2026-2027',
      'inquiry', now, 'Harrison Thornton', '+1 (555) 654-3210', 'harrison@thorntonlaw.com', 'Father',
      '88 St. George Avenue', 'fam_4', 'Initial telephone inquiry regarding primary bilingual curriculum and bus service.',
      'O-', 'None', 'None', 'Claire Thornton', '+1 (555) 654-3211', 'Mother',
      'Dr. Emily Clark', '+1 (555) 543-9876', 'Routine pediatric clearances completed.', now, now
    ],
    [
      'app_6', 'APP-2026-0106', 'Lucas', 'Vanderbilt', '2010-03-12', 'Male', 'Grade 11', '2026-2027',
      'enrolled', now, 'Richard Vanderbilt', '+1 (555) 321-7654', 'r.vanderbilt@capital.com', 'Father',
      '5 Belgrave Mews', '', 'Transferring from Oxford Academy. Advanced Placement aspirant.',
      'A-', 'Shellfish', 'No seafood', 'Eleanor Vanderbilt', '+1 (555) 321-7655', 'Mother',
      'Dr. Robert Hastings', '+1 (555) 432-1098', 'All immunizations up to date.', now, now
    ],
    [
      'app_7', 'APP-2026-0107', 'Mila', 'Sorensen', '2016-12-01', 'Female', 'Grade 5', '2026-2027',
      'declined', now, 'Lars Sorensen', '+1 (555) 234-9988', 'lars@nordicgroup.dk', 'Father',
      '14 Regent Court', '', 'Family chose international post in Geneva. Graceful decline.',
      'O+', 'None', 'None', 'Astrid Sorensen', '+1 (555) 234-9989', 'Mother',
      'Dr. Thomas Reid', '+1 (555) 890-1234', 'None', now, now
    ]
  ];

  for (const a of applicants) {
    db.run(`INSERT INTO applicants (
      id, application_no, first_name, last_name, dob, gender, grade_applying, academic_year,
      status, status_updated_at, guardian_name, guardian_phone, guardian_email, guardian_relationship,
      address, family_id, notes, blood_group, allergies, dietary_needs, emergency_contact, emergency_phone,
      emergency_relationship, physician_name, physician_phone, care_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, a);
  }

  // Documents for applicants
  const defaultDocs = [
    'Official Birth Certificate',
    'Previous 2-Year Academic Transcripts',
    'Official Immunization Record',
    'Confidential Teacher Recommendation Form',
    'Passport Copy & 2 Color Photos'
  ];

  for (const a of applicants) {
    const appId = a[0] as string;
    const isEnrolledOrAccepted = ['enrolled', 'accepted', 'documents_submitted'].includes(a[8] as string);
    defaultDocs.forEach((doc, idx) => {
      const isRecv = isEnrolledOrAccepted && idx < 4;
      db.run("INSERT INTO documents (id, applicant_id, document_name, is_mandatory, status, received_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [`doc_${appId}_${idx}`, appId, doc, 1, isRecv ? 'received' : 'pending', isRecv ? '2026-08-15' : null, isRecv ? 'Verified by Registrar' : 'Pending submission', now]
      );
    });
  }

  // Assessments
  db.run(`INSERT INTO assessments (id, applicant_id, applicant_name, grade, assessment_type, interviewer_name, scheduled_at, duration_minutes, score, max_score, recommendation, status, notes, created_at) VALUES 
    ('asm_1', 'app_1', 'Alexander Montgomery', 'Grade 9', 'Entrance Exam', 'Sophia Chen', '2026-08-10T10:00:00.000Z', 45, 94, 100, 'Recommend Full Admission', 'Completed', 'Outstanding analytical and writing aptitude.', '${now}'),
    ('asm_2', 'app_2', 'Beatrice Montgomery', 'Grade 6', 'Parent Interview', 'Dr. Arthur Pendelton', '2026-08-12T14:30:00.000Z', 30, 90, 100, 'Recommend Full Admission', 'Completed', 'Strong familial alignment with school ethos and arts program.', '${now}'),
    ('asm_3', 'app_3', 'Zayd Al-Mansoor', 'Grade 10', 'Diagnostic Assessment', 'Sophia Chen', '2026-09-02T09:30:00.000Z', 60, NULL, 100, NULL, 'Scheduled', 'Diagnostic for ESL and Advanced Mathematics placement.', '${now}'),
    ('asm_4', 'app_4', 'Karolina Kowalski', 'Grade 7', 'Entrance Exam', 'Sophia Chen', '2026-09-05T11:00:00.000Z', 45, NULL, 100, NULL, 'Scheduled', 'Standard Middle School Entrance Assessment in Main Hall.', '${now}')
  `);

  // Scholarships
  db.run(`INSERT INTO scholarships (id, applicant_id, title, discount_type, value, justification, approved_by, created_at) VALUES
    ('sch_1', 'app_2', 'Sibling Concession', 'percentage', 10, 'Standard 10% second sibling fee concession.', 'Marcus Sterling', '${now}'),
    ('sch_2', 'app_1', 'STEM Merit Bursary', 'fixed', 1500, 'Academic competition scholarship award.', 'Dr. Arthur Pendelton', '${now}')
  `);

  // Installment Plans for Enrolled students (Outstanding totaling LKR 270,000)
  db.run(`INSERT INTO installment_plans (id, applicant_id, plan_type, installment_number, title, amount_due, due_date, amount_paid, status, created_at) VALUES
    ('inst_1_1', 'app_1', 'term', 1, 'Term 1 (Autumn Intake)', 45000.00, '2026-08-01', 45000.00, 'Paid', '${now}'),
    ('inst_1_2', 'app_1', 'term', 2, 'Term 2 (Spring Term)', 90000.00, '2026-12-01', 0, 'Pending', '${now}'),
    ('inst_1_3', 'app_1', 'term', 3, 'Term 3 (Summer Term)', 90000.00, '2027-03-15', 0, 'Pending', '${now}')
  `);

  db.run(`INSERT INTO installment_plans (id, applicant_id, plan_type, installment_number, title, amount_due, due_date, amount_paid, status, created_at) VALUES
    ('inst_6_1', 'app_6', 'term', 1, 'Term 1 (Autumn Intake)', 90000.00, '2026-08-01', 0, 'Pending', '${now}')
  `);

  // Seed sample cash flow (income and expenses for current week & 8-week history)
  seedSampleCashFlow(db, true);

  // Cash Reconciliations
  db.run(`INSERT INTO cash_reconciliations (id, date, opening_cash, system_expected_cash, physically_counted_cash, discrepancy, is_locked, notes, reconciled_by_staff_name, reconciled_at) VALUES
    ('rec_2026_08_28', '2026-08-28', 500.00, 830.00, 830.00, 0.00, 1, 'Cash drawer balanced perfectly. Bank drop made for $330.', 'Marcus Sterling', '2026-08-28 17:05'),
    ('rec_2026_08_29', '2026-08-29', 500.00, 500.00, 500.00, 0.00, 1, 'No cash transactions on Saturday morning. Float locked.', 'Eleanor Vance', '2026-08-29 13:00')
  `);

  // Communications
  db.run(`INSERT INTO communications (id, applicant_id, family_id, contact_type, summary, date, staff_name, created_at) VALUES
    ('comm_1', 'app_1', 'fam_1', 'Meeting', 'Welcome meeting with parents regarding House assignment and STEM scholarship.', '2026-08-11', 'Dr. Arthur Pendelton', '${now}'),
    ('comm_2', 'app_3', 'fam_2', 'Call', 'Requested certified English translation of previous school transcripts.', '2026-08-24', 'Sophia Chen', '${now}'),
    ('comm_3', 'app_4', 'fam_3', 'Email', 'Sent entrance exam preparation guide and confirmation of date.', '2026-08-26', 'Eleanor Vance', '${now}'),
    ('comm_4', 'app_6', '', 'Notice', 'Sent friendly reminder for outstanding balance on Autumn Term 1 tuition ($3,090.00).', '2026-08-29', 'Marcus Sterling', '${now}')
  `);

  // Audit Logs
  db.run(`INSERT INTO audit_logs (id, staff_name, action_type, record_type, record_id, details, timestamp) VALUES
    ('aud_1', 'Eleanor Vance', 'create', 'applicant', 'app_1', 'Enrolled applicant Alexander Montgomery for Grade 9 (APP-2026-0101)', '2026-08-05 09:30'),
    ('aud_2', 'Marcus Sterling', 'payment_recorded', 'income', 'inc_1', 'Recorded bank transfer payment of $4,756.66 (REC-2026-0801) from Julian Montgomery', '2026-08-05 10:15'),
    ('aud_3', 'Sophia Chen', 'create', 'assessment', 'asm_1', 'Completed entrance examination scoring (94/100) for Alexander Montgomery', '2026-08-10 12:45'),
    ('aud_4', 'Marcus Sterling', 'reconciliation', 'cash_drawer', 'rec_2026_08_28', 'Performed and locked daily cash drawer reconciliation for 2026-08-28', '2026-08-28 17:05')
  `);

  // Assets / Inventory initial items
  const initialAssets = [
    ['ast_1', 'Dell OptiPlex 7090 Front-Desk Terminal', 'Electronics', '2025-01-15', 185000.00, 'Reception / Front Desk', 'Good', 'Primary administrative counter terminal with barcode scanner', 'Dr. Arthur Pendelton', now, now],
    ['ast_2', 'Canon imageRUNNER 2625i Multi-Function Copier', 'Electronics', '2024-11-20', 420000.00, 'Staff Workroom', 'Good', 'Heavy-duty exam and report card printing machine under service contract', 'Marcus Sterling', now, now],
    ['ast_3', 'Teak Reception Counter & Visitor Seating Set', 'Furniture', '2024-08-10', 210000.00, 'Main Lobby', 'Good', 'Solid Ceylon teak reception desk with 4 upholstered guest armchairs', 'Dr. Arthur Pendelton', now, now],
    ['ast_4', 'Interactive Smart Projector (Epson EB-685Wi)', 'Electronics', '2025-03-02', 315000.00, 'Senior Science Lab', 'New', 'Ultra-short-throw interactive projector for STEM curriculum', 'Sophia Chen', now, now],
    ['ast_5', 'Classroom Dual-Desks & Ergonomic Chairs (Set of 25)', 'Furniture', '2024-09-01', 375000.00, 'Grade 9 Classrooms', 'Good', 'Standard wooden dual desks with powder-coated steel frames', 'Eleanor Vance', now, now],
    ['ast_6', 'Honda 5.5kVA Silent Backup Generator', 'Maintenance Equipment', '2024-06-18', 290000.00, 'Generator Utility Shed', 'Fair', 'Serviced quarterly; ensures uninterrupted power during examinations', 'Marcus Sterling', now, now],
    ['ast_7', 'Cambridge IGCSE & A-Level Reference Library (120 Vol)', 'Textbooks', '2025-01-10', 160000.00, 'School Library', 'Good', 'Complete reference textbook catalog for Grades 9-12 curriculum', 'Eleanor Vance', now, now],
  ];

  for (const a of initialAssets) {
    db.run("INSERT INTO assets (id, item_name, category, purchase_date, purchase_price, current_location, condition, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", a);
  }

  console.log('[Database] Seeded initial data successfully');
}
