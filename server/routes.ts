import { Router, Request, Response } from 'express';
import { getDb, saveDb, getRawDbBuffer, restoreDbFromBuffer, seedInitialData, seedSampleCashFlow } from './db.js';
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

export const apiRouter = Router();

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export function validatePositiveAmount(value: any, fieldName: string = "amount"): number {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
  return num;
}

const ERROR_LOG_PATH = path.join(process.cwd(), "data", "error.log");

export function logErrorToFile(routeOrAction: string, err: any): void {
  try {
    const dir = path.dirname(ERROR_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const timestamp = new Date().toISOString();
    const errorDetails = err?.stack || err?.message || String(err);
    const entry = `[${timestamp}] [${routeOrAction}] ${errorDetails}\n`;
    fs.appendFileSync(ERROR_LOG_PATH, entry, "utf8");
  } catch (logErr) {
    console.error("[logErrorToFile] Failed to append to error.log:", logErr);
  }
}


function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to convert sql.js exec results into array of objects
function queryAll(db: any, sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  if (params && params.length > 0) {
    stmt.bind(params);
  }
  const results: any[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(db: any, sql: string, params: any[] = []): any | null {
  const res = queryAll(db, sql, params);
  return res.length > 0 ? res[0] : null;
}

function runSql(db: any, sql: string, params: any[] = []): void {
  db.run(sql, params);
  saveDb();
}

function logAudit(db: any, staffName: string, actionType: string, recordType: string, recordId: string | null, details: string) {
  const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
  db.run(
    "INSERT INTO audit_logs (id, staff_name, action_type, record_type, record_id, details, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [id, staffName || 'System', actionType, recordType, recordId, details, ts]
  );
  saveDb();
}

// ----------------------------------------------------
// SHARED FINANCIAL & BALANCE CALCULATION UTILITIES
// ----------------------------------------------------
export function computeStudentAging(
  balanceDue: number,
  installments: Array<{ amount_due: number; amount_paid: number; due_date: string; status?: string }>,
  lastPayment: string | null,
  applicantDate?: string | null,
  today: Date = new Date()
) {
  let agingBucket: 'current' | '30_days' | '60_days' | '90_plus' = 'current';
  let isOverdue = false;
  let daysOverdue = 0;
  const todayStr = today.toISOString().substring(0, 10);

  if (balanceDue <= 0) {
    return { agingBucket: 'current' as const, isOverdue: false, daysOverdue: 0 };
  }

  if (installments && installments.length > 0) {
    // Active installment plan exists: base overdue on whether any installment is actually past its due_date and unpaid
    const overdueInsts = installments.filter(inst => {
      const isUnpaid = Number(inst.amount_paid || 0) < Number(inst.amount_due || 0);
      const isPastDue = (inst.due_date && inst.due_date < todayStr) || inst.status === 'Overdue';
      return isUnpaid && isPastDue;
    });

    if (overdueInsts.length > 0) {
      isOverdue = true;
      const pastDueTimes = overdueInsts
        .map(i => new Date(i.due_date).getTime())
        .filter(t => !isNaN(t));
      const oldestDueTime = pastDueTimes.length > 0 ? Math.min(...pastDueTimes) : today.getTime();
      daysOverdue = Math.max(0, Math.floor((today.getTime() - oldestDueTime) / (1000 * 60 * 60 * 24)));

      if (daysOverdue > 90) agingBucket = '90_plus';
      else if (daysOverdue > 60) agingBucket = '60_days';
      else if (daysOverdue > 30) agingBucket = '30_days';
      else agingBucket = 'current';
    } else {
      // Installments exist and none are past due yet!
      isOverdue = false;
      agingBucket = 'current';
      daysOverdue = 0;
    }
  } else {
    // No installment plan configured: fall back to days-since-last-payment heuristic
    if (lastPayment) {
      const daysSinceLast = Math.floor((today.getTime() - new Date(lastPayment).getTime()) / (1000 * 60 * 60 * 24));
      daysOverdue = daysSinceLast;
      if (daysSinceLast > 90) agingBucket = '90_plus';
      else if (daysSinceLast > 60) agingBucket = '60_days';
      else if (daysSinceLast > 30) agingBucket = '30_days';
      else agingBucket = 'current';
      isOverdue = daysSinceLast > 30;
    } else {
      // Student has no payment history AND no installment plan.
      // Use enrollment or application creation date
      if (applicantDate) {
        const daysSinceEnrollment = Math.max(0, Math.floor((today.getTime() - new Date(applicantDate).getTime()) / (1000 * 60 * 60 * 24)));
        if (daysSinceEnrollment > 30) {
          daysOverdue = daysSinceEnrollment;
          if (daysSinceEnrollment > 90) agingBucket = '90_plus';
          else if (daysSinceEnrollment > 60) agingBucket = '60_days';
          else agingBucket = '30_days';
          isOverdue = true;
        } else {
          // Freshly enrolled (<= 30 days) with no payment history: Current!
          agingBucket = 'current';
          isOverdue = false;
          daysOverdue = 0;
        }
      } else {
        agingBucket = 'current';
        isOverdue = false;
        daysOverdue = 0;
      }
    }
  }

  return { agingBucket, isOverdue, daysOverdue };
}

export function calculateStudentBalance(db: any, applicantId: string) {
  const applicant = queryOne(db, "SELECT * FROM applicants WHERE id = ?", [applicantId]);
  if (!applicant) return null;

  const feeItems = queryAll(db, "SELECT * FROM fee_structures WHERE grade = ? AND academic_year = ?", [applicant.grade_applying, applicant.academic_year]);
  const scholarships = queryAll(db, "SELECT * FROM scholarships WHERE applicant_id = ?", [applicantId]);
  const incomePayments = queryAll(db, "SELECT * FROM income WHERE applicant_id = ? ORDER BY date DESC, created_at DESC", [applicantId]);
  const installments = queryAll(db, "SELECT * FROM installment_plans WHERE applicant_id = ? ORDER BY due_date ASC, installment_number ASC", [applicantId]);

  let baseTuition = 0;
  let otherFees = 0;
  for (const f of feeItems) {
    if (f.fee_type === 'Tuition') {
      baseTuition += Number(f.amount || 0);
    } else {
      otherFees += Number(f.amount || 0);
    }
  }
  const totalGross = baseTuition + otherFees;

  let discountTotal = 0;
  for (const s of scholarships) {
    if (s.discount_type === 'percentage') {
      discountTotal += (baseTuition * Number(s.value || 0)) / 100;
    } else {
      discountTotal += Number(s.value || 0);
    }
  }
  const expectedNet = Math.max(0, totalGross - discountTotal);
  const paidTotal = incomePayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const balanceDue = Math.max(0, expectedNet - paidTotal);

  const lastPayment = incomePayments.length > 0 ? incomePayments[0].date : null;
  const today = new Date();
  const daysSinceLast = lastPayment ? Math.floor((today.getTime() - new Date(lastPayment).getTime()) / (1000 * 60 * 60 * 24)) : null;

  const { agingBucket, isOverdue, daysOverdue } = computeStudentAging(
    balanceDue,
    installments,
    lastPayment,
    applicant.status_updated_at || applicant.created_at,
    today
  );

  return {
    applicant,
    baseTuition,
    otherFees,
    totalGross,
    gross: totalGross,
    discountTotal,
    discount: discountTotal,
    expectedNet,
    expected: expectedNet,
    paidTotal,
    paid: paidTotal,
    balanceDue,
    balance: balanceDue,
    percentPaid: expectedNet > 0 ? Math.min(100, Math.round((paidTotal / expectedNet) * 100)) : 100,
    feeItems,
    scholarships,
    payments: incomePayments,
    lastPaymentDate: lastPayment,
    daysSinceLastPayment: daysSinceLast,
    days_overdue: daysOverdue,
    agingBucket,
    isOverdue
  };
}

export function calculateAllStudentBalances(db: any, statuses: string[] = ['enrolled', 'accepted', 'documents_submitted', 'applied']) {
  const placeholders = statuses.map(() => '?').join(',');
  const applicants = queryAll(db, `
    SELECT a.id, a.application_no, a.first_name, a.last_name, a.grade_applying, a.academic_year, a.status,
           a.guardian_name, a.guardian_phone, a.guardian_email, a.status_updated_at, a.created_at, f.household_name
    FROM applicants a
    LEFT JOIN families f ON a.family_id = f.id
    WHERE (a.is_archived IS NULL OR a.is_archived = 0)
      AND a.status IN (${placeholders})
    ORDER BY a.last_name ASC
  `, statuses);

  const allFees = queryAll(db, "SELECT grade, academic_year, fee_type, amount FROM fee_structures");
  const allScholarships = queryAll(db, "SELECT applicant_id, discount_type, value FROM scholarships");
  const allIncome = queryAll(db, "SELECT applicant_id, amount, date FROM income WHERE applicant_id IS NOT NULL ORDER BY date DESC, created_at DESC");
  const allInstallments = queryAll(db, "SELECT applicant_id, amount_due, amount_paid, due_date, status FROM installment_plans");

  const today = new Date();

  return applicants.map(app => {
    const studentFees = allFees.filter(f => f.grade === app.grade_applying && f.academic_year === app.academic_year);
    let tuitionBase = 0;
    let otherTotal = 0;
    for (const f of studentFees) {
      if (f.fee_type === 'Tuition') tuitionBase += Number(f.amount || 0);
      else otherTotal += Number(f.amount || 0);
    }
    const gross = tuitionBase + otherTotal;

    const studentSchols = allScholarships.filter(s => s.applicant_id === app.id);
    let disc = 0;
    for (const s of studentSchols) {
      if (s.discount_type === 'percentage') disc += (tuitionBase * Number(s.value || 0)) / 100;
      else disc += Number(s.value || 0);
    }
    const expected = Math.max(0, gross - disc);

    const payments = allIncome.filter(i => i.applicant_id === app.id);
    const paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const balance = Math.max(0, expected - paid);
    const percentPaid = expected > 0 ? Math.min(100, Math.round((paid / expected) * 100)) : 100;

    const lastPayment = payments.length > 0 ? payments[0].date : null;
    const daysSinceLast = lastPayment ? Math.floor((today.getTime() - new Date(lastPayment).getTime()) / (1000 * 60 * 60 * 24)) : null;

    const studentInstallments = allInstallments.filter(i => i.applicant_id === app.id);
    const { agingBucket, isOverdue, daysOverdue } = computeStudentAging(
      balance,
      studentInstallments,
      lastPayment,
      app.status_updated_at || app.created_at,
      today
    );

    return {
      ...app,
      student_name: `${app.first_name} ${app.last_name}`,
      gross,
      discount: disc,
      expected,
      paid,
      balance,
      balanceDue: balance,
      expectedNet: expected,
      paidTotal: paid,
      percentPaid,
      lastPaymentDate: lastPayment,
      daysSinceLastPayment: daysSinceLast,
      days_overdue: daysOverdue,
      agingBucket,
      isOverdue
    };
  });
}

export function syncApplicantInstallmentPlans(db: any, applicantId: string) {
  if (!applicantId) return;
  const plans = queryAll(db, "SELECT * FROM installment_plans WHERE applicant_id = ? ORDER BY installment_number ASC, due_date ASC", [applicantId]);
  if (plans.length === 0) return;

  const incomeRows = queryAll(db, "SELECT amount FROM income WHERE applicant_id = ?", [applicantId]);
  let remainingPayment = incomeRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const todayStr = new Date().toISOString().substring(0, 10);

  for (const p of plans) {
    const due = Number(p.amount_due || 0);
    const allocated = Math.min(remainingPayment, due);
    remainingPayment = Math.max(0, remainingPayment - allocated);

    let status = 'Pending';
    if (allocated >= due && due > 0) {
      status = 'Paid';
    } else if (p.due_date && p.due_date < todayStr) {
      status = 'Overdue';
    } else if (allocated > 0) {
      status = 'Partial';
    } else {
      status = 'Pending';
    }

    db.run(
      "UPDATE installment_plans SET amount_paid = ?, status = ? WHERE id = ?",
      [allocated, status, p.id]
    );
  }
}

function getNextSequenceNumber(db: any, sequenceKey: string, defaultStart: number = 1): number {
  const row = queryOne(db, "SELECT value FROM settings WHERE key = ?", [sequenceKey]);
  let nextVal = defaultStart;
  if (row && row.value) {
    const parsed = parseInt(row.value, 10);
    if (!isNaN(parsed)) {
      nextVal = parsed + 1;
    }
  }
  db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [sequenceKey, String(nextVal)]);
  return nextVal;
}

function generateUniqueReceiptNo(db: any): string {
  const year = new Date().getFullYear();
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  
  let seq = getNextSequenceNumber(db, `seq_receipt_${year}_${month}`, 1);
  let receiptNo = `REC-${year}-${month}${seq.toString().padStart(3, '0')}`;
  
  while (queryOne(db, "SELECT id FROM income WHERE receipt_no = ?", [receiptNo])) {
    seq = getNextSequenceNumber(db, `seq_receipt_${year}_${month}`, seq + 1);
    receiptNo = `REC-${year}-${month}${seq.toString().padStart(3, '0')}`;
  }
  return receiptNo;
}

function generateUniqueApplicationNo(db: any): string {
  const year = new Date().getFullYear();
  let seq = getNextSequenceNumber(db, `seq_applicant_${year}`, 101);
  let appNo = `APP-${year}-${seq.toString().padStart(4, '0')}`;

  while (queryOne(db, "SELECT id FROM applicants WHERE application_no = ?", [appNo])) {
    seq = getNextSequenceNumber(db, `seq_applicant_${year}`, seq + 1);
    appNo = `APP-${year}-${seq.toString().padStart(4, '0')}`;
  }
  return appNo;
}

// ----------------------------------------------------
// 1. SETTINGS
// ----------------------------------------------------
apiRouter.get('/settings', async (req, res) => {
  try {
    const db = await getDb();
    const rows = queryAll(db, "SELECT key, value FROM settings");
    const settingsObj: Record<string, string> = {};
    for (const r of rows) {
      settingsObj[r.key] = r.value;
    }
    res.json(settingsObj);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /settings] error:`, err);
    logErrorToFile('GET /settings', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/settings', async (req, res) => {
  try {
    const db = await getDb();
    const updates = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Admin';

    for (const [k, v] of Object.entries(updates)) {
      db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [k, String(v)]);
    }
    saveDb();
    logAudit(db, staffName, 'update', 'settings', null, 'Updated school operational settings');
    res.json({ success: true, message: 'Settings updated' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /settings] error:`, err);
    logErrorToFile('PUT /settings', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings', async (req, res) => {
  try {
    const db = await getDb();
    const updates = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Admin';

    for (const [k, v] of Object.entries(updates)) {
      db.run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [k, String(v)]);
    }
    saveDb();
    logAudit(db, staffName, 'update', 'settings', null, 'Updated school operational settings');
    res.json({ success: true, message: 'Settings updated' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /settings] error:`, err);
    logErrorToFile('POST /settings', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings/clear-demo-data', async (req, res) => {
  try {
    const db = await getDb();
    const staffName = req.headers['x-staff-name'] as string || 'Admin';

    // Clear transactional and admissions records
    db.run("DELETE FROM income");
    db.run("DELETE FROM expenses");
    db.run("DELETE FROM cash_reconciliations");
    db.run("DELETE FROM installment_plans");
    db.run("DELETE FROM scholarships");
    db.run("DELETE FROM documents");
    db.run("DELETE FROM assessments");
    db.run("DELETE FROM communications");
    db.run("DELETE FROM applicants");
    db.run("DELETE FROM families");
    db.run("DELETE FROM assets");
    db.run("DELETE FROM audit_logs");
    
    // Clear dynamic sequence counters
    db.run("DELETE FROM settings WHERE key LIKE 'seq_%'");

    saveDb();
    logAudit(db, staffName, 'clear_demo_data', 'system', null, 'Cleared all demo transactional and student data');
    res.json({ success: true, message: 'All demo data cleared successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /settings/clear-demo-data] error:`, err);
    logErrorToFile('POST /settings/clear-demo-data', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/settings/seed-sample-data', async (req, res) => {
  try {
    const db = await getDb();
    const staffName = req.headers['x-staff-name'] as string || 'Admin';

    // Clear existing records first to avoid duplicate primary keys
    db.run("DELETE FROM income");
    db.run("DELETE FROM expenses");
    db.run("DELETE FROM cash_reconciliations");
    db.run("DELETE FROM installment_plans");
    db.run("DELETE FROM scholarships");
    db.run("DELETE FROM documents");
    db.run("DELETE FROM assessments");
    db.run("DELETE FROM communications");
    db.run("DELETE FROM applicants");
    db.run("DELETE FROM families");
    db.run("DELETE FROM assets");
    db.run("DELETE FROM audit_logs");
    db.run("DELETE FROM fee_structures");
    db.run("DELETE FROM staff");
    db.run("DELETE FROM settings");

    seedInitialData(db);
    saveDb();

    logAudit(db, staffName, 'seed_sample_data', 'system', null, 'Restored full institutional demo dataset (applicants, families, fees, ledgers, assets)');
    res.json({ success: true, message: 'Comprehensive sample demo dataset populated successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /settings/seed-sample-data] error:`, err);
    logErrorToFile('POST /settings/seed-sample-data', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 2. STAFF & AUTH
// ----------------------------------------------------
apiRouter.get('/staff', async (req, res) => {
  try {
    const db = await getDb();
    const activeOnly = req.query.active_only === 'true';
    let sql = "SELECT id, name, role, email, phone, avatar_initials, photo_url, active, is_active, (pin IS NOT NULL AND pin != '') as has_pin, created_at FROM staff";
    if (activeOnly) {
      sql += " WHERE (is_active = 1 OR is_active IS NULL) AND (active = 1 OR active IS NULL)";
    }
    sql += " ORDER BY name ASC";
    const staff = queryAll(db, sql);
    res.json(staff);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /staff] error:`, err);
    logErrorToFile('GET /staff', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/staff', async (req, res) => {
  try {
    const db = await getDb();
    const { name, role, email, phone, pin, photo_url } = req.body;
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Staff name is required' });
    }
    const id = `stf_${Date.now()}`;
    const initials = name.trim().split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) || 'ST';
    const now = new Date().toISOString();

    let hashedPin: string | null = null;
    if (pin && typeof pin === 'string' && pin.trim()) {
      hashedPin = bcrypt.hashSync(pin.trim(), 10);
    }

    db.run(
      "INSERT INTO staff (id, name, role, email, phone, pin, avatar_initials, photo_url, active, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)",
      [id, name.trim(), role || 'Admissions Officer', email || '', phone || '', hashedPin, initials, photo_url || '', now]
    );
    saveDb();
    logAudit(db, loggedInStaff, 'create', 'staff', id, `Added staff profile: ${name.trim()} (${role || 'Admissions Officer'})`);
    res.json({
      id,
      name: name.trim(),
      role: role || 'Admissions Officer',
      email,
      phone,
      avatar_initials: initials,
      photo_url: photo_url || '',
      has_pin: !!hashedPin,
      active: 1,
      is_active: 1
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /staff] error:`, err);
    logErrorToFile('POST /staff', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/staff/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { name, role, email, phone, photo_url } = req.body;
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Staff name is required' });
    }
    if (!role || !role.trim()) {
      return res.status(400).json({ error: 'Staff role is required' });
    }

    const existing = queryOne(db, "SELECT * FROM staff WHERE id = ?", [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const initials = name.trim().split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().substring(0, 2) || existing.avatar_initials || 'ST';

    db.run(
      "UPDATE staff SET name = ?, role = ?, email = COALESCE(?, email), phone = COALESCE(?, phone), avatar_initials = ?, photo_url = COALESCE(?, photo_url) WHERE id = ?",
      [name.trim(), role.trim(), email !== undefined ? email : existing.email, phone !== undefined ? phone : existing.phone, initials, photo_url !== undefined ? photo_url : existing.photo_url, req.params.id]
    );
    saveDb();
    logAudit(db, loggedInStaff, 'update', 'staff', req.params.id, `Updated staff profile: ${name.trim()} (${role.trim()})`);
    res.json({ success: true, message: 'Staff profile updated successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /staff/:id] error:`, err);
    logErrorToFile('PUT /staff/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// Update staff photo
apiRouter.put('/staff/:id/photo', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    const { photo_url } = req.body;
    const existing = queryOne(db, "SELECT name FROM staff WHERE id = ?", [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    db.run("UPDATE staff SET photo_url = ? WHERE id = ?", [photo_url || '', req.params.id]);
    saveDb();
    logAudit(db, loggedInStaff, 'update_photo', 'staff', req.params.id, `Updated photo for staff member: ${existing.name}`);
    res.json({ success: true, photo_url: photo_url || '' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /staff/:id/photo] error:`, err);
    logErrorToFile('PUT /staff/:id/photo', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/staff/:id/deactivate', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    const staff = queryOne(db, "SELECT id, name FROM staff WHERE id = ?", [req.params.id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    db.run("UPDATE staff SET is_active = 0, active = 0 WHERE id = ?", [req.params.id]);
    saveDb();
    logAudit(db, loggedInStaff, 'deactivate', 'staff', req.params.id, `Deactivated staff member: ${staff.name}`);
    res.json({ success: true, message: `Staff member ${staff.name} deactivated successfully` });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PATCH /staff/:id/deactivate] error:`, err);
    logErrorToFile('PATCH /staff/:id/deactivate', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/staff/:id/reactivate', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    const staff = queryOne(db, "SELECT id, name FROM staff WHERE id = ?", [req.params.id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    db.run("UPDATE staff SET is_active = 1, active = 1 WHERE id = ?", [req.params.id]);
    saveDb();
    logAudit(db, loggedInStaff, 'reactivate', 'staff', req.params.id, `Reactivated staff member: ${staff.name}`);
    res.json({ success: true, message: `Staff member ${staff.name} reactivated successfully` });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PATCH /staff/:id/reactivate] error:`, err);
    logErrorToFile('PATCH /staff/:id/reactivate', err);
    res.status(500).json({ error: err.message });
  }
});

const handleStaffPinUpdate = async (req: any, res: any) => {
  try {
    const db = await getDb();
    const { current_pin } = req.body;
    const new_pin = req.body.new_pin !== undefined ? req.body.new_pin : req.body.pin;
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';

    const staff = queryOne(db, "SELECT pin, name FROM staff WHERE id = ?", [req.params.id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // If new_pin is empty or null, remove the PIN requirement
    if (new_pin === null || new_pin === undefined || (typeof new_pin === 'string' && new_pin.trim() === '')) {
      db.run("UPDATE staff SET pin = NULL WHERE id = ?", [req.params.id]);
      saveDb();
      logAudit(db, loggedInStaff, 'remove_pin', 'staff', req.params.id, `Removed security PIN for staff: ${staff.name}`);
      return res.json({ success: true, message: 'Security PIN removed successfully' });
    }

    if (typeof new_pin !== 'string' || new_pin.trim().length < 4) {
      return res.status(400).json({ error: 'PIN must be at least 4 digits' });
    }

    // Verify current PIN if provided and if staff has a pin set
    if (staff.pin && current_pin) {
      let valid = false;
      if (staff.pin.startsWith('$2')) {
        valid = bcrypt.compareSync(current_pin, staff.pin);
      } else {
        valid = staff.pin === current_pin;
      }
      if (!valid) {
        return res.status(400).json({ error: 'Current PIN is incorrect' });
      }
    }

    const hashed = bcrypt.hashSync(new_pin.trim(), 10);
    db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashed, req.params.id]);
    saveDb();
    logAudit(db, loggedInStaff, 'update_pin', 'staff', req.params.id, `Updated security PIN for staff: ${staff.name}`);
    res.json({ success: true, message: 'Security PIN updated successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /staff/:id/pin] error:`, err);
    logErrorToFile('PUT /staff/:id/pin', err);
    res.status(500).json({ error: err.message });
  }
};

apiRouter.put('/staff/:id/pin', handleStaffPinUpdate);
apiRouter.patch('/staff/:id/pin', handleStaffPinUpdate);

apiRouter.post('/staff/verify-pin', async (req, res) => {
  try {
    const db = await getDb();
    const { staff_id, pin } = req.body;
    const staff = queryOne(db, "SELECT pin, is_active, active FROM staff WHERE id = ?", [staff_id]);
    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }
    if ((staff.is_active !== undefined && staff.is_active === 0) || (staff.active !== undefined && staff.active === 0)) {
      return res.status(403).json({ valid: false, error: 'Staff profile is deactivated. Please contact an administrator.' });
    }
    if (!staff.pin || staff.pin.trim() === '') {
      return res.json({ valid: true });
    }
    
    let valid = false;
    if (pin && typeof pin === 'string') {
      if (staff.pin.startsWith('$2')) {
        valid = bcrypt.compareSync(pin, staff.pin);
      } else {
        // Plaintext fallback and auto-upgrade to bcrypt
        valid = staff.pin === pin;
        if (valid) {
          const hashed = bcrypt.hashSync(pin, 10);
          db.run("UPDATE staff SET pin = ? WHERE id = ?", [hashed, staff_id]);
          saveDb();
        }
      }
    }
    res.json({ valid });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /staff/verify-pin] error:`, err);
    logErrorToFile('POST /staff/verify-pin', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. APPLICANTS & ADMISSIONS PIPELINE
// ----------------------------------------------------
apiRouter.get('/applicants', async (req, res) => {
  try {
    const db = await getDb();
    const { status, grade, search, include_archived } = req.query;

    let sql = "SELECT a.*, f.household_name FROM applicants a LEFT JOIN families f ON a.family_id = f.id WHERE 1=1";
    const params: any[] = [];

    if (include_archived !== 'true') {
      sql += " AND (a.is_archived IS NULL OR a.is_archived = 0)";
    }
    if (status && status !== 'all') {
      sql += " AND a.status = ?";
      params.push(status);
    }
    if (grade && grade !== 'all') {
      sql += " AND a.grade_applying = ?";
      params.push(grade);
    }
    if (search) {
      sql += " AND (a.first_name LIKE ? OR a.last_name LIKE ? OR a.application_no LIKE ? OR a.guardian_name LIKE ? OR a.guardian_phone LIKE ? OR a.guardian_email LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    sql += " ORDER BY a.created_at DESC";
    const applicants = queryAll(db, sql, params);

    // Calculate stage counts for funnel tabs
    const counts = queryAll(db, `
      SELECT status, COUNT(*) as count 
      FROM applicants 
      WHERE (is_archived IS NULL OR is_archived = 0)
      GROUP BY status
    `);
    const countMap: Record<string, number> = {
      all: applicants.length,
      inquiry: 0,
      applied: 0,
      documents_submitted: 0,
      accepted: 0,
      enrolled: 0,
      declined: 0,
      withdrawn: 0
    };
    for (const c of counts) {
      countMap[c.status] = c.count;
    }
    const totalAll = queryOne(db, "SELECT COUNT(*) as c FROM applicants WHERE (is_archived IS NULL OR is_archived = 0)")?.c || 0;
    countMap.all = totalAll;

    res.json({ applicants, counts: countMap });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /applicants] error:`, err);
    logErrorToFile('GET /applicants', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/applicants', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Registrar';
    const body = req.body;
    const id = `app_${Date.now()}`;
    const appNo = generateUniqueApplicationNo(db);
    const now = new Date().toISOString();

    db.run(`INSERT INTO applicants (
      id, application_no, first_name, last_name, dob, gender, grade_applying, academic_year,
      status, status_updated_at, guardian_name, guardian_phone, guardian_email, guardian_relationship,
      address, family_id, notes, blood_group, allergies, dietary_needs, emergency_contact, emergency_phone,
      emergency_relationship, physician_name, physician_phone, care_notes, is_archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, [
      id,
      appNo,
      body.first_name,
      body.last_name,
      body.dob || '2015-01-01',
      body.gender || 'Not specified',
      body.grade_applying || 'Grade 1',
      body.academic_year || '2026-2027',
      body.status || 'inquiry',
      now,
      body.guardian_name || '',
      body.guardian_phone || '',
      body.guardian_email || '',
      body.guardian_relationship || 'Parent',
      body.address || '',
      body.family_id || '',
      body.notes || '',
      body.blood_group || '',
      body.allergies || '',
      body.dietary_needs || '',
      body.emergency_contact || body.guardian_name || '',
      body.emergency_phone || body.guardian_phone || '',
      body.emergency_relationship || body.guardian_relationship || 'Parent',
      body.physician_name || '',
      body.physician_phone || '',
      body.care_notes || '',
      now,
      now
    ]);

    // Seed default credentials checklist
    const defaultDocs = [
      'Official Birth Certificate',
      'Previous 2-Year Academic Transcripts',
      'Official Immunization Record',
      'Confidential Teacher Recommendation Form',
      'Passport Copy & 2 Color Photos'
    ];
    defaultDocs.forEach((docName, idx) => {
      db.run("INSERT INTO documents (id, applicant_id, document_name, is_mandatory, status, received_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [`doc_${id}_${idx}`, id, docName, 1, 'pending', null, 'Pending submission', now]
      );
    });

    saveDb();
    logAudit(db, loggedInStaff, 'create', 'applicant', id, `Registered applicant ${body.first_name} ${body.last_name} (${appNo}) for ${body.grade_applying}`);
    res.json({ id, application_no: appNo, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants] error:`, err);
    logErrorToFile('POST /applicants', err);
    res.status(500).json({ error: err.message });
  }
});

// Update applicant photo
apiRouter.put('/applicants/:id/photo', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    const { photo_url } = req.body;
    db.run("UPDATE applicants SET photo_url = ?, updated_at = ? WHERE id = ?", [photo_url || '', new Date().toISOString(), req.params.id]);
    saveDb();
    logAudit(db, loggedInStaff, 'update_photo', 'applicant', req.params.id, `Updated photo for applicant ID: ${req.params.id}`);
    res.json({ success: true, photo_url: photo_url || '' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /applicants/:id/photo] error:`, err);
    logErrorToFile('PUT /applicants/:id/photo', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk status update for applicants with audit logging
apiRouter.post('/applicants/bulk-status', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admissions Officer';
    const { ids, status } = req.body;

    if (!Array.isArray(ids) || ids.length === 0 || !status) {
      return res.status(400).json({ error: 'Missing applicant ids or target status.' });
    }

    const now = new Date().toISOString();
    let updatedCount = 0;

    for (const id of ids) {
      const app = queryOne(db, "SELECT first_name, last_name, status FROM applicants WHERE id = ?", [id]);
      if (app) {
        db.run("UPDATE applicants SET status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?", [status, now, now, id]);
        logAudit(db, loggedInStaff, 'status_change', 'applicant', id, `Bulk status advancement: changed ${app.first_name} ${app.last_name} from '${app.status}' to '${status}'`);
        updatedCount++;
      }
    }

    saveDb();
    res.json({ success: true, updatedCount, status });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants/bulk-status] error:`, err);
    logErrorToFile('POST /applicants/bulk-status', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk communication logging for selected applicants
apiRouter.post('/applicants/bulk-communications', async (req, res) => {
  try {
    const db = await getDb();
    const staffName = req.headers['x-staff-name'] as string || 'Admissions Officer';
    const { applicant_ids, contact_type, summary, date } = req.body;

    if (!Array.isArray(applicant_ids) || applicant_ids.length === 0 || !contact_type || !summary) {
      return res.status(400).json({ error: 'Missing applicants, channel or summary.' });
    }

    const now = new Date().toISOString();
    const commDate = date || now.substring(0, 10);
    let loggedCount = 0;

    for (const appId of applicant_ids) {
      const app = queryOne(db, "SELECT first_name, last_name, family_id FROM applicants WHERE id = ?", [appId]);
      if (app) {
        const commId = `comm_bulk_${Date.now()}_${loggedCount}`;
        db.run(
          "INSERT INTO communications (id, applicant_id, family_id, contact_type, summary, date, staff_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [commId, appId, app.family_id || null, contact_type, summary, commDate, staffName, now]
        );
        logAudit(db, staffName, 'create', 'communication', commId, `Bulk notice logged (${contact_type}) for ${app.first_name} ${app.last_name}`);
        loggedCount++;
      }
    }

    saveDb();
    res.json({ success: true, loggedCount });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants/bulk-communications] error:`, err);
    logErrorToFile('POST /applicants/bulk-communications', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk import students
apiRouter.post('/applicants/bulk-import', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Registrar';
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No student rows provided for import.' });
    }

    let importedCount = 0;
    let familiesCreatedLinked = 0;
    const skippedRows: Array<{ row: any; reason: string }> = [];
    const now = new Date().toISOString();
    const currentYear = new Date().getFullYear();

    // Cache existing applicants for duplicate detection (name + dob)
    const existingApplicants = queryAll(db, "SELECT LOWER(first_name || ' ' || last_name) as name, dob FROM applicants");
    const existingSet = new Set<string>();
    for (const a of existingApplicants) {
      existingSet.add(`${(a.name || '').trim().toLowerCase()}_${(a.dob || '').trim()}`);
    }

    // Cache families
    const familyMap = new Map<string, string>(); // household_name lowercase -> id
    const existingFamilies = queryAll(db, "SELECT id, household_name FROM families");
    for (const f of existingFamilies) {
      familyMap.set((f.household_name || '').trim().toLowerCase(), f.id);
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rawName = (r.full_name || '').trim();
      const dob = (r.date_of_birth || '').trim();
      const grade = (r.grade || 'Grade 1').trim();
      const guardianName = (r.guardian_name || '').trim();
      const guardianPhone = (r.guardian_phone || '').trim();
      const guardianEmail = (r.guardian_email || '').trim();
      const familyName = (r.family_name || '').trim();
      const rawStatus = (r.status || 'enrolled').trim().toLowerCase();
      const status = ['enrolled', 'accepted', 'applied', 'inquiry', 'documents_submitted'].includes(rawStatus)
        ? rawStatus
        : 'enrolled';

      if (!rawName) {
        skippedRows.push({ row: r, reason: 'Missing student full name' });
        continue;
      }

      // Duplicate detection
      const nameKey = `${rawName.toLowerCase()}_${dob}`;
      if (dob && existingSet.has(nameKey)) {
        skippedRows.push({ row: r, reason: `Duplicate student: ${rawName} (${dob}) already exists in registry` });
        continue;
      }

      // Parse first & last name
      const nameParts = rawName.split(/\s+/);
      const firstName = nameParts[0] || rawName;
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Student';

      // Family linking
      let familyId = '';
      if (familyName) {
        const fKey = `${familyName.toLowerCase()} household`;
        const directKey = familyName.toLowerCase();

        if (familyMap.has(fKey)) {
          familyId = familyMap.get(fKey)!;
          familiesCreatedLinked++;
        } else if (familyMap.has(directKey)) {
          familyId = familyMap.get(directKey)!;
          familiesCreatedLinked++;
        } else {
          // Create family
          const famId = `fam_${Date.now()}_${i}`;
          const famCount = (queryOne(db, "SELECT COUNT(*) as c FROM families")?.c || 0) + 1;
          const famCode = `FAM-${currentYear}-${famCount.toString().padStart(3, '0')}`;
          const householdName = familyName.toLowerCase().includes('household') ? familyName : `${familyName} Household`;
          db.run(
            "INSERT INTO families (id, family_code, household_name, primary_guardian_name, primary_phone, primary_email, secondary_guardian_name, secondary_phone, secondary_email, address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [famId, famCode, householdName, guardianName || `${lastName} Family`, guardianPhone || '', guardianEmail || '', '', '', '', r.address || '', 'Created via Bulk Student Migration', now]
          );
          familyMap.set(householdName.toLowerCase(), famId);
          familyMap.set(directKey, famId);
          familyId = famId;
          familiesCreatedLinked++;
        }
      }

      const appNo = generateUniqueApplicationNo(db);
      const appId = `app_imp_${Date.now()}_${i}`;

      db.run(`INSERT INTO applicants (
        id, application_no, first_name, last_name, dob, gender, grade_applying, academic_year,
        status, status_updated_at, guardian_name, guardian_phone, guardian_email, guardian_relationship,
        address, family_id, notes, blood_group, allergies, dietary_needs, emergency_contact, emergency_phone,
        emergency_relationship, physician_name, physician_phone, care_notes, photo_url, is_archived, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`, [
        appId,
        appNo,
        firstName,
        lastName,
        dob || '2015-01-01',
        r.gender || 'Not specified',
        grade,
        r.academic_year || '2026-2027',
        status,
        now,
        guardianName || 'Primary Guardian',
        guardianPhone || '',
        guardianEmail || '',
        r.guardian_relationship || 'Parent',
        r.address || '',
        familyId,
        r.notes || 'Migrated student record',
        r.blood_group || '',
        r.allergies || '',
        r.dietary_needs || '',
        guardianName || '',
        guardianPhone || '',
        'Parent',
        '',
        '',
        '',
        r.photo_url || '',
        now,
        now
      ]);

      // Seed documents
      const defaultDocs = [
        'Official Birth Certificate',
        'Previous 2-Year Academic Transcripts',
        'Official Immunization Record',
        'Confidential Teacher Recommendation Form',
        'Passport Copy & 2 Color Photos'
      ];
      defaultDocs.forEach((docName, dIdx) => {
        const isRecv = ['enrolled', 'accepted'].includes(status);
        db.run("INSERT INTO documents (id, applicant_id, document_name, is_mandatory, status, received_date, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [`doc_${appId}_${dIdx}`, appId, docName, 1, isRecv ? 'received' : 'pending', isRecv ? now.substring(0, 10) : null, 'Migrated document record', now]
        );
      });

      existingSet.add(nameKey);
      importedCount++;
    }

    saveDb();
    logAudit(db, loggedInStaff, 'bulk_import', 'applicants', null, `Bulk imported ${importedCount} student records with ${familiesCreatedLinked} family links`);

    res.json({
      success: true,
      importedCount,
      familiesCreatedLinked,
      skippedCount: skippedRows.length,
      skippedRows
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants/bulk-import] error:`, err);
    logErrorToFile('POST /applicants/bulk-import', err);
    res.status(500).json({ error: err.message });
  }
});

// Single applicant dossier with all 7 sub-tabs
apiRouter.get('/applicants/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;

    const applicant = queryOne(db, "SELECT a.*, f.household_name, f.family_code FROM applicants a LEFT JOIN families f ON a.family_id = f.id WHERE a.id = ?", [id]);
    if (!applicant) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // 1. Documents
    const documents = queryAll(db, "SELECT * FROM documents WHERE applicant_id = ? ORDER BY created_at ASC", [id]);

    // 2. Siblings in same family
    let siblings: any[] = [];
    if (applicant.family_id) {
      siblings = queryAll(db, "SELECT id, first_name, last_name, grade_applying, status, application_no FROM applicants WHERE family_id = ? AND id != ? AND (is_archived IS NULL OR is_archived = 0)", [applicant.family_id, id]);
    }

    // 3. Financials using unified calculateStudentBalance
    const balanceInfo = calculateStudentBalance(db, id);

    // 4. Installment plans
    const installmentPlans = queryAll(db, "SELECT * FROM installment_plans WHERE applicant_id = ? ORDER BY installment_number ASC, due_date ASC", [id]);

    // 5. Communications history
    const communications = queryAll(db, "SELECT * FROM communications WHERE applicant_id = ? ORDER BY date DESC, created_at DESC", [id]);

    // 6. Assessments
    const assessments = queryAll(db, "SELECT * FROM assessments WHERE applicant_id = ? ORDER BY scheduled_at DESC", [id]);

    res.json({
      applicant,
      documents,
      siblings,
      financials: {
        baseTuition: balanceInfo?.baseTuition || 0,
        otherFees: balanceInfo?.otherFees || 0,
        totalGross: balanceInfo?.totalGross || 0,
        discountTotal: balanceInfo?.discountTotal || 0,
        expectedNet: balanceInfo?.expectedNet || 0,
        paidTotal: balanceInfo?.paidTotal || 0,
        balanceDue: balanceInfo?.balanceDue || 0,
        percentPaid: balanceInfo?.percentPaid || 100,
        feeItems: balanceInfo?.feeItems || [],
        scholarships: balanceInfo?.scholarships || [],
        payments: balanceInfo?.payments || []
      },
      installmentPlans,
      communications,
      assessments
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /applicants/:id] error:`, err);
    logErrorToFile('GET /applicants/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/applicants/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Office Staff';
    const body = req.body;
    const now = new Date().toISOString();

    db.run(`UPDATE applicants SET
      first_name = ?, last_name = ?, dob = ?, gender = ?, grade_applying = ?, academic_year = ?,
      guardian_name = ?, guardian_phone = ?, guardian_email = ?, guardian_relationship = ?,
      address = ?, family_id = ?, notes = ?, blood_group = ?, allergies = ?, dietary_needs = ?,
      emergency_contact = ?, emergency_phone = ?, emergency_relationship = ?, physician_name = ?,
      physician_phone = ?, care_notes = ?, updated_at = ?
      WHERE id = ?`, [
      body.first_name,
      body.last_name,
      body.dob,
      body.gender,
      body.grade_applying,
      body.academic_year,
      body.guardian_name,
      body.guardian_phone,
      body.guardian_email,
      body.guardian_relationship,
      body.address,
      body.family_id || null,
      body.notes,
      body.blood_group,
      body.allergies,
      body.dietary_needs,
      body.emergency_contact,
      body.emergency_phone,
      body.emergency_relationship,
      body.physician_name,
      body.physician_phone,
      body.care_notes,
      now,
      id
    ]);

    saveDb();
    logAudit(db, loggedInStaff, 'update', 'applicant', id, `Updated dossier profile for ${body.first_name} ${body.last_name}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /applicants/:id] error:`, err);
    logErrorToFile('PUT /applicants/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/applicants/:id/status', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { status } = req.body;
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admissions Officer';
    const now = new Date().toISOString();

    const app = queryOne(db, "SELECT first_name, last_name, status FROM applicants WHERE id = ?", [id]);
    if (!app) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    db.run("UPDATE applicants SET status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?", [status, now, now, id]);
    saveDb();
    logAudit(db, loggedInStaff, 'status_change', 'applicant', id, `Changed admission status of ${app.first_name} ${app.last_name} from '${app.status}' to '${status}'`);
    res.json({ success: true, newStatus: status });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PATCH /applicants/:id/status] error:`, err);
    logErrorToFile('PATCH /applicants/:id/status', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/applicants/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Registrar';

    const app = queryOne(db, "SELECT first_name, last_name, application_no FROM applicants WHERE id = ?", [id]);
    if (!app) {
      return res.status(404).json({ error: 'Applicant not found' });
    }

    // Check if applicant has any financial income history
    const incomeCountRow = queryOne(db, "SELECT COUNT(*) as count FROM income WHERE applicant_id = ?", [id]);
    const incomeCount = incomeCountRow?.count || 0;

    if (incomeCount > 0) {
      // Soft-delete (archive) to preserve immutable financial audit records
      db.run("UPDATE applicants SET is_archived = 1, updated_at = ? WHERE id = ?", [new Date().toISOString(), id]);
      saveDb();
      logAudit(db, loggedInStaff, 'archive', 'applicant', id, `Archived applicant ${app.first_name} ${app.last_name} (${app.application_no}) to preserve ${incomeCount} financial income records`);
      return res.json({ success: true, archived: true, message: 'Applicant archived to preserve financial records' });
    }

    // Hard delete when zero income records exist
    db.run("DELETE FROM documents WHERE applicant_id = ?", [id]);
    db.run("DELETE FROM scholarships WHERE applicant_id = ?", [id]);
    db.run("DELETE FROM installment_plans WHERE applicant_id = ?", [id]);
    db.run("DELETE FROM assessments WHERE applicant_id = ?", [id]);
    db.run("DELETE FROM communications WHERE applicant_id = ?", [id]);
    db.run("DELETE FROM applicants WHERE id = ?", [id]);

    saveDb();
    logAudit(db, loggedInStaff, 'delete', 'applicant', id, `Deleted applicant ${app.first_name} ${app.last_name} (${app.application_no})`);
    res.json({ success: true, deleted: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /applicants/:id] error:`, err);
    logErrorToFile('DELETE /applicants/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// Documents management
apiRouter.post('/applicants/:id/documents', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { document_name, is_mandatory } = req.body;
    const docId = `doc_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(
      "INSERT INTO documents (id, applicant_id, document_name, is_mandatory, status, received_date, notes, created_at) VALUES (?, ?, ?, ?, 'pending', NULL, '', ?)",
      [docId, id, document_name, is_mandatory ? 1 : 0, now]
    );
    saveDb();
    res.json({ id: docId, document_name, status: 'pending' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants/:id/documents] error:`, err);
    logErrorToFile('POST /applicants/:id/documents', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/applicants/:id/documents/:docId', async (req, res) => {
  try {
    const db = await getDb();
    const { id, docId } = req.params;
    const { status, notes } = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Admissions Staff';
    const now = status === 'received' ? new Date().toISOString().substring(0, 10) : null;

    const existingDoc = queryOne(db, "SELECT document_name FROM documents WHERE id = ?", [docId]);
    db.run(
      "UPDATE documents SET status = ?, received_date = ?, notes = ? WHERE id = ?",
      [status, now, notes !== undefined ? notes : '', docId]
    );
    saveDb();
    logAudit(db, staffName, 'document_update', 'document', docId, `Updated ${existingDoc ? existingDoc.document_name : 'document'} status to '${status}' for student ${id}`);
    res.json({ success: true, status, received_date: now });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PATCH /applicants/:id/documents/:docId] error:`, err);
    logErrorToFile('PATCH /applicants/:id/documents/:docId', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/applicants/:id/documents/:docId', async (req, res) => {
  try {
    const db = await getDb();
    const { id, docId } = req.params;
    const staffName = req.headers['x-staff-name'] as string || 'Admissions Staff';

    const existingDoc = queryOne(db, "SELECT document_name FROM documents WHERE id = ?", [docId]);
    db.run("DELETE FROM documents WHERE id = ?", [docId]);
    saveDb();
    logAudit(db, staffName, 'delete', 'document', docId, `Removed document requirement '${existingDoc ? existingDoc.document_name : docId}' from student ${id}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /applicants/:id/documents/:docId] error:`, err);
    logErrorToFile('DELETE /applicants/:id/documents/:docId', err);
    res.status(500).json({ error: err.message });
  }
});

// Scholarships
apiRouter.post('/applicants/:id/scholarships', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { title, discount_type, value, justification } = req.body;
    const validatedValue = validatePositiveAmount(value, 'value');
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Bursar';
    const schId = `sch_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(
      "INSERT INTO scholarships (id, applicant_id, title, discount_type, value, justification, approved_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [schId, id, title, discount_type, validatedValue, justification || '', loggedInStaff, now]
    );
    saveDb();
    logAudit(db, loggedInStaff, 'create', 'scholarship', schId, `Approved ${discount_type === 'percentage' ? `${validatedValue}%` : `${validatedValue}`} fee abatement (${title}) for applicant ${id}`);
    res.json({ id: schId, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants/:id/scholarships] error:`, err);
    logErrorToFile('POST /applicants/:id/scholarships', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/applicants/:id/scholarships/:schId', async (req, res) => {
  try {
    const db = await getDb();
    const { id, schId } = req.params;
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Bursar';
    const existing = queryOne(db, "SELECT * FROM scholarships WHERE id = ?", [schId]);
    db.run("DELETE FROM scholarships WHERE id = ?", [schId]);
    saveDb();
    syncApplicantInstallmentPlans(db, id);
    logAudit(db, loggedInStaff, 'delete', 'scholarship', schId, `Removed fee concession "${existing?.title || schId}" (${existing?.discount_type === 'percentage' ? `${existing?.value}%` : `LKR ${existing?.value || 0}`})`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /applicants/:id/scholarships/:schId] error:`, err);
    logErrorToFile('DELETE /applicants/:id/scholarships/:schId', err);
    res.status(500).json({ error: err.message });
  }
});

// Installment plan generation
const handleGenerateInstallmentLogic = async (req: any, res: any) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { plan_type } = req.body; // 'annual', 'term', 'monthly'
    let total_amount = req.body.total_amount;

    if (total_amount !== undefined && total_amount !== null && total_amount !== '') {
      total_amount = validatePositiveAmount(total_amount, 'total_amount');
    } else {
      const balanceInfo = calculateStudentBalance(db, id);
      const computedAmount = balanceInfo && balanceInfo.balanceDue > 0
        ? balanceInfo.balanceDue
        : (balanceInfo?.expectedNet || 0);

      if (!computedAmount || computedAmount <= 0) {
        return res.status(400).json({
          error: `No fee structure was found for grade "${balanceInfo?.applicant?.grade_applying || 'unknown'}" and academic year "${balanceInfo?.applicant?.academic_year || 'unknown'}". An explicit total_amount must be provided.`
        });
      }
      total_amount = computedAmount;
    }

    const now = new Date().toISOString();

    // Clear old plan
    db.run("DELETE FROM installment_plans WHERE applicant_id = ?", [id]);

    const currentYear = new Date().getFullYear();
    if (plan_type === 'annual') {
      db.run(
        "INSERT INTO installment_plans (id, applicant_id, plan_type, installment_number, title, amount_due, due_date, amount_paid, status, created_at) VALUES (?, ?, 'annual', 1, 'Full Academic Year Payment', ?, ?, 0, 'Pending', ?)",
        [`inst_${id}_1`, id, total_amount, `${currentYear}-09-01`, now]
      );
    } else if (plan_type === 'term') {
      const termAmount = Number((total_amount / 3).toFixed(2));
      const termDiff = Number((total_amount - termAmount * 2).toFixed(2));
      const terms = [
        { num: 1, title: 'Term 1 (Autumn Intake)', date: `${currentYear}-09-01`, amt: termAmount },
        { num: 2, title: 'Term 2 (Spring Term)', date: `${currentYear}-12-15`, amt: termAmount },
        { num: 3, title: 'Term 3 (Summer Term)', date: `${currentYear + 1}-03-15`, amt: termDiff }
      ];
      for (const t of terms) {
        db.run(
          "INSERT INTO installment_plans (id, applicant_id, plan_type, installment_number, title, amount_due, due_date, amount_paid, status, created_at) VALUES (?, ?, 'term', ?, ?, ?, ?, 0, 'Pending', ?)",
          [`inst_${id}_${t.num}`, id, t.num, t.title, t.amt, t.date, now]
        );
      }
    } else if (plan_type === 'monthly') {
      const monthlyAmt = Number((total_amount / 10).toFixed(2));
      const monthTitles = ['September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
      for (let i = 0; i < 10; i++) {
        const d = new Date(currentYear, 8 + i, 1);
        const dateStr = d.toISOString().substring(0, 10);
        db.run(
          "INSERT INTO installment_plans (id, applicant_id, plan_type, installment_number, title, amount_due, due_date, amount_paid, status, created_at) VALUES (?, ?, 'monthly', ?, ?, ?, ?, 0, 'Pending', ?)",
          [`inst_${id}_${i + 1}`, id, i + 1, `${monthTitles[i]} Installment`, monthlyAmt, dateStr, now]
        );
      }
    }

    saveDb();
    res.json({ success: true, message: `Generated ${plan_type} installment plan`, total_amount });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants/:id/installment-plans] error:`, err);
    logErrorToFile('POST /applicants/:id/installment-plans', err);
    res.status(500).json({ error: err.message });
  }
};

apiRouter.post('/applicants/:id/installment-plans', handleGenerateInstallmentLogic);
apiRouter.post('/applicants/:id/installments/generate', handleGenerateInstallmentLogic);

// Communications Log
apiRouter.post('/applicants/:id/communications', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { contact_type, summary, date, family_id } = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Office Staff';
    const commId = `comm_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(
      "INSERT INTO communications (id, applicant_id, family_id, contact_type, summary, date, staff_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [commId, id, family_id || null, contact_type, summary, date || now.substring(0, 10), staffName, now]
    );
    saveDb();
    logAudit(db, staffName, 'create', 'communication', commId, `Logged ${contact_type} communication with guardian of applicant ${id}`);
    res.json({ id: commId, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /applicants/:id/communications] error:`, err);
    logErrorToFile('POST /applicants/:id/communications', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 4. ASSESSMENTS
// ----------------------------------------------------
apiRouter.get('/assessments', async (req, res) => {
  try {
    const db = await getDb();
    const { status, type } = req.query;
    let sql = "SELECT * FROM assessments WHERE 1=1";
    const params: any[] = [];

    if (status && status !== 'all') {
      sql += " AND status = ?";
      params.push(status);
    }
    if (type && type !== 'all') {
      sql += " AND assessment_type = ?";
      params.push(type);
    }
    sql += " ORDER BY scheduled_at DESC";

    const assessments = queryAll(db, sql, params);
    res.json(assessments);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /assessments] error:`, err);
    logErrorToFile('GET /assessments', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/assessments', async (req, res) => {
  try {
    const db = await getDb();
    const { applicant_id, applicant_name, grade, assessment_type, interviewer_name, scheduled_at, duration_minutes, notes, override_conflict, force } = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Admissions Officer';
    const duration = duration_minutes ? Number(duration_minutes) : 30;

    // Interview Conflict Detection (only against assessments with status 'Scheduled' and exact interviewer match)
    if (!override_conflict && !force && interviewer_name && scheduled_at) {
      const newStart = new Date(scheduled_at).getTime();
      const newEnd = newStart + duration * 60 * 1000;

      if (!isNaN(newStart) && !isNaN(newEnd)) {
        const existing = queryAll(
          db,
          "SELECT * FROM assessments WHERE interviewer_name = ? AND status = 'Scheduled'",
          [interviewer_name]
        );

        for (const item of existing) {
          const exStart = new Date(item.scheduled_at).getTime();
          const exDuration = item.duration_minutes ? Number(item.duration_minutes) : 30;
          const exEnd = exStart + exDuration * 60 * 1000;

          if (!isNaN(exStart) && !isNaN(exEnd)) {
            // Overlap check: startA < endB && endA > startB
            if (newStart < exEnd && newEnd > exStart) {
              return res.status(409).json({
                conflict: true,
                warning: true,
                message: `${interviewer_name} already has ${item.assessment_type} scheduled with ${item.applicant_name} during this time.`,
                conflictWith: {
                  id: item.id,
                  applicant_name: item.applicant_name,
                  assessment_type: item.assessment_type,
                  interviewer_name: item.interviewer_name,
                  scheduled_at: item.scheduled_at,
                  duration_minutes: exDuration
                }
              });
            }
          }
        }
      }
    }

    const id = `asm_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(
      "INSERT INTO assessments (id, applicant_id, applicant_name, grade, assessment_type, interviewer_name, scheduled_at, duration_minutes, score, max_score, recommendation, status, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 100, NULL, 'Scheduled', ?, ?)",
      [id, applicant_id, applicant_name, grade, assessment_type, interviewer_name, scheduled_at, duration, notes || '', now]
    );
    saveDb();
    logAudit(db, staffName, 'create', 'assessment', id, `Scheduled ${assessment_type} for ${applicant_name} with ${interviewer_name}`);
    res.json({ id, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /assessments] error:`, err);
    logErrorToFile('POST /assessments', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/assessments/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { score, recommendation, status, interviewer_name, scheduled_at, duration_minutes, notes, override_conflict, force } = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Admissions Officer';

    const existingRows = queryAll(db, "SELECT * FROM assessments WHERE id = ?", [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    const current = existingRows[0];

    const targetInterviewer = interviewer_name !== undefined ? interviewer_name : current.interviewer_name;
    const targetScheduledAt = scheduled_at !== undefined ? scheduled_at : current.scheduled_at;
    const targetDuration = duration_minutes !== undefined ? Number(duration_minutes) : (current.duration_minutes || 30);
    const targetStatus = status !== undefined ? status : current.status;

    // Conflict detection if status is 'Scheduled' and not overridden
    if (targetStatus === 'Scheduled' && !override_conflict && !force && targetInterviewer && targetScheduledAt) {
      const newStart = new Date(targetScheduledAt).getTime();
      const newEnd = newStart + targetDuration * 60 * 1000;

      if (!isNaN(newStart) && !isNaN(newEnd)) {
        const existing = queryAll(
          db,
          "SELECT * FROM assessments WHERE interviewer_name = ? AND status = 'Scheduled' AND id != ?",
          [targetInterviewer, id]
        );

        for (const item of existing) {
          const exStart = new Date(item.scheduled_at).getTime();
          const exDuration = item.duration_minutes ? Number(item.duration_minutes) : 30;
          const exEnd = exStart + exDuration * 60 * 1000;

          if (!isNaN(exStart) && !isNaN(exEnd)) {
            if (newStart < exEnd && newEnd > exStart) {
              return res.status(409).json({
                conflict: true,
                warning: true,
                message: `${targetInterviewer} already has ${item.assessment_type} scheduled with ${item.applicant_name} during this time.`,
                conflictWith: {
                  id: item.id,
                  applicant_name: item.applicant_name,
                  assessment_type: item.assessment_type,
                  interviewer_name: item.interviewer_name,
                  scheduled_at: item.scheduled_at,
                  duration_minutes: exDuration
                }
              });
            }
          }
        }
      }
    }

    const updatedScore = score !== undefined ? (score === null ? null : Number(score)) : current.score;
    const updatedRec = recommendation !== undefined ? recommendation : current.recommendation;
    const updatedNotes = notes !== undefined ? notes : current.notes;

    db.run(
      "UPDATE assessments SET score = ?, recommendation = ?, status = ?, interviewer_name = ?, scheduled_at = ?, duration_minutes = ?, notes = ? WHERE id = ?",
      [updatedScore, updatedRec, targetStatus, targetInterviewer, targetScheduledAt, targetDuration, updatedNotes, id]
    );
    saveDb();
    logAudit(db, staffName, 'update', 'assessment', id, `Scored/Updated assessment (${updatedRec || targetStatus})`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /assessments/:id] error:`, err);
    logErrorToFile('PUT /assessments/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.patch('/assessments/:id/score', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { score, recommendation, notes } = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Admissions Officer';

    db.run(
      "UPDATE assessments SET score = ?, recommendation = ?, status = 'Completed', notes = COALESCE(?, notes) WHERE id = ?",
      [Number(score), recommendation || null, notes || null, id]
    );
    saveDb();
    logAudit(db, staffName, 'update', 'assessment', id, `Recorded assessment evaluation score: ${score}/100 (${recommendation || 'Completed'})`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PATCH /assessments/:id/score] error:`, err);
    logErrorToFile('PATCH /assessments/:id/score', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/assessments/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const staffName = req.headers['x-staff-name'] as string || 'Admissions Officer';
    const existing = queryOne(db, "SELECT applicant_name, assessment_type FROM assessments WHERE id = ?", [id]);

    db.run("DELETE FROM assessments WHERE id = ?", [id]);
    saveDb();
    logAudit(db, staffName, 'delete', 'assessment', id, `Cancelled/deleted assessment for ${existing?.applicant_name || id} (${existing?.assessment_type || 'test'})`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /assessments/:id] error:`, err);
    logErrorToFile('DELETE /assessments/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. FAMILIES MODULE
// ----------------------------------------------------
apiRouter.get('/families', async (req, res) => {
  try {
    const db = await getDb();
    const families = queryAll(db, "SELECT * FROM families ORDER BY household_name ASC");

    // Augment with linked students count & names
    const result = families.map(f => {
      const students = queryAll(db, "SELECT id, first_name, last_name, grade_applying, status FROM applicants WHERE family_id = ?", [f.id]);
      const incomeHistory = queryAll(db, "SELECT id, receipt_no, date, amount, source FROM income WHERE family_id = ? ORDER BY date DESC", [f.id]);
      const totalPaid = incomeHistory.reduce((sum, inc) => sum + inc.amount, 0);
      return {
        ...f,
        students,
        student_count: students.length,
        total_paid: totalPaid
      };
    });

    res.json(result);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /families] error:`, err);
    logErrorToFile('GET /families', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/families', async (req, res) => {
  try {
    const db = await getDb();
    const body = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Registrar';
    const id = `fam_${Date.now()}`;
    const year = new Date().getFullYear();
    const countRow = queryOne(db, "SELECT COUNT(*) as total FROM families");
    const code = `FAM-${year}-${((countRow?.total || 0) + 1).toString().padStart(3, '0')}`;
    const now = new Date().toISOString();

    db.run(
      "INSERT INTO families (id, family_code, household_name, primary_guardian_name, primary_phone, primary_email, secondary_guardian_name, secondary_phone, secondary_email, address, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [id, code, body.household_name, body.primary_guardian_name, body.primary_phone, body.primary_email || '', body.secondary_guardian_name || '', body.secondary_phone || '', body.secondary_email || '', body.address || '', body.notes || '', now]
    );
    saveDb();
    logAudit(db, staffName, 'create', 'family', id, `Registered household: ${body.household_name} (${code})`);
    res.json({ id, family_code: code, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /families] error:`, err);
    logErrorToFile('POST /families', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/families/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const body = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Registrar';

    db.run(
      "UPDATE families SET household_name = ?, primary_guardian_name = ?, primary_phone = ?, primary_email = ?, secondary_guardian_name = ?, secondary_phone = ?, secondary_email = ?, address = ?, notes = ? WHERE id = ?",
      [body.household_name, body.primary_guardian_name, body.primary_phone, body.primary_email, body.secondary_guardian_name, body.secondary_phone, body.secondary_email, body.address, body.notes, id]
    );
    saveDb();
    logAudit(db, staffName, 'update', 'family', id, `Updated family record: ${body.household_name}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /families/:id] error:`, err);
    logErrorToFile('PUT /families/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/families/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const staffName = req.headers['x-staff-name'] as string || 'Registrar';

    const family = queryOne(db, "SELECT * FROM families WHERE id = ?", [id]);
    if (!family) {
      return res.status(404).json({ error: 'Family household not found' });
    }

    const linkedApplicants = queryAll(db, "SELECT id, first_name, last_name, status FROM applicants WHERE family_id = ? AND (is_archived IS NULL OR is_archived = 0)", [id]);
    if (linkedApplicants.length > 0) {
      logAudit(db, staffName, 'delete_blocked', 'family', id, `Attempted to delete household "${family.household_name}" but blocked: ${linkedApplicants.length} active students still linked`);
      return res.status(400).json({
        error: `Cannot delete household "${family.household_name}". There are ${linkedApplicants.length} active student(s) linked to this family (${linkedApplicants.map(a => `${a.first_name} ${a.last_name}`).join(', ')}). Please reassign or un-link them before deleting.`
      });
    }

    db.run("UPDATE applicants SET family_id = NULL WHERE family_id = ?", [id]);
    db.run("DELETE FROM families WHERE id = ?", [id]);
    saveDb();
    logAudit(db, staffName, 'delete', 'family', id, `Deleted household record: ${family.household_name} (${family.family_code || id})`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /families/:id] error:`, err);
    logErrorToFile('DELETE /families/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 6. FEE STRUCTURE MATRIX
// ----------------------------------------------------
apiRouter.get('/fees', async (req, res) => {
  try {
    const db = await getDb();
    const fees = queryAll(db, "SELECT * FROM fee_structures ORDER BY academic_year DESC, grade ASC, fee_type ASC");
    res.json(fees);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /fees] error:`, err);
    logErrorToFile('GET /fees', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/fees', async (req, res) => {
  try {
    const db = await getDb();
    const { academic_year, grade, fee_type, amount, is_compulsory, description } = req.body;
    const validatedAmount = validatePositiveAmount(amount, 'amount');
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';
    const id = `fee_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(
      "INSERT INTO fee_structures (id, academic_year, grade, fee_type, amount, is_compulsory, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, academic_year, grade, fee_type, validatedAmount, is_compulsory ? 1 : 0, description || '', now]
    );
    saveDb();
    logAudit(db, staffName, 'create', 'fee_structure', id, `Added ${fee_type} fee (${validatedAmount}) for ${grade} (${academic_year})`);
    res.json({ id, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /fees] error:`, err);
    logErrorToFile('POST /fees', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/fees/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const { academic_year, grade, fee_type, amount, is_compulsory, description } = req.body;
    const validatedAmount = validatePositiveAmount(amount, 'amount');
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';

    db.run(
      "UPDATE fee_structures SET academic_year = ?, grade = ?, fee_type = ?, amount = ?, is_compulsory = ?, description = ? WHERE id = ?",
      [academic_year, grade, fee_type, validatedAmount, is_compulsory ? 1 : 0, description || '', id]
    );
    saveDb();
    logAudit(db, staffName, 'update', 'fee_structure', id, `Updated fee item ${fee_type} for ${grade}`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /fees/:id] error:`, err);
    logErrorToFile('PUT /fees/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/fees/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';
    const existing = queryOne(db, "SELECT * FROM fee_structures WHERE id = ?", [id]);

    db.run("DELETE FROM fee_structures WHERE id = ?", [id]);
    saveDb();
    logAudit(db, staffName, 'delete', 'fee_structure', id, `Removed fee schedule rule: ${existing?.fee_type || 'Fee'} for ${existing?.grade || 'all grades'} (${existing?.academic_year || ''})`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /fees/:id] error:`, err);
    logErrorToFile('DELETE /fees/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 7. INCOME & RECEIPTS
// ----------------------------------------------------
apiRouter.get('/income', async (req, res) => {
  try {
    const db = await getDb();
    const { source, payment_method, search, startDate, endDate } = req.query;
    let sql = "SELECT i.*, a.first_name as student_first_name, a.last_name as student_last_name, a.application_no, a.grade_applying as student_grade FROM income i LEFT JOIN applicants a ON i.applicant_id = a.id WHERE 1=1";
    const params: any[] = [];

    if (source && source !== 'all') {
      sql += " AND i.source = ?";
      params.push(source);
    }
    if (payment_method && payment_method !== 'all') {
      sql += " AND i.payment_method = ?";
      params.push(payment_method);
    }
    if (startDate) {
      sql += " AND i.date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND i.date <= ?";
      params.push(endDate);
    }
    if (search) {
      sql += " AND (i.receipt_no LIKE ? OR i.payer_name LIKE ? OR i.reference_no LIKE ? OR a.first_name LIKE ? OR a.last_name LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }

    sql += " ORDER BY i.date DESC, i.created_at DESC";
    const income = queryAll(db, sql, params);
    res.json(income);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /income] error:`, err);
    logErrorToFile('GET /income', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/income', async (req, res) => {
  try {
    const db = await getDb();
    const body = req.body;
    const amount = validatePositiveAmount(body.amount, 'amount');
    const staffName = req.headers['x-staff-name'] as string || body.received_by_staff_name || 'Bursar';
    const id = `inc_${Date.now()}`;
    const receiptNo = generateUniqueReceiptNo(db);
    const now = new Date().toISOString();

    db.run(`INSERT INTO income (
      id, receipt_no, date, amount, source, payment_method, payer_name,
      applicant_id, family_id, received_by_staff_id, received_by_staff_name,
      reference_no, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id,
      receiptNo,
      body.date || now.substring(0, 10),
      amount,
      body.source || 'Tuition',
      body.payment_method || 'Bank Transfer',
      body.payer_name,
      body.applicant_id || null,
      body.family_id || null,
      body.received_by_staff_id || null,
      staffName,
      body.reference_no || '',
      body.notes || '',
      now
    ]);

    if (body.applicant_id) {
      syncApplicantInstallmentPlans(db, body.applicant_id);
    }

    saveDb();
    logAudit(db, staffName, 'payment_recorded', 'income', id, `Recorded ${body.payment_method} income of LKR ${amount.toFixed(2)} (${receiptNo}) from ${body.payer_name} for ${body.source}`);
    res.json({ id, receipt_no: receiptNo, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /income] error:`, err);
    logErrorToFile('POST /income', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/income/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const receipt = queryOne(db, `
      SELECT i.*, a.first_name, a.last_name, a.grade_applying, a.application_no, a.address, a.guardian_phone,
             f.household_name, f.family_code
      FROM income i
      LEFT JOIN applicants a ON i.applicant_id = a.id
      LEFT JOIN families f ON i.family_id = f.id
      WHERE i.id = ?
    `, [id]);

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json(receipt);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /income/:id] error:`, err);
    logErrorToFile('GET /income/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/income/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const body = req.body;
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';

    const existing = queryOne(db, "SELECT * FROM income WHERE id = ?", [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Income entry not found' });
    }

    const amount = validatePositiveAmount(body.amount !== undefined ? body.amount : existing.amount, 'amount');
    const payerName = body.payer_name !== undefined ? String(body.payer_name).trim() : existing.payer_name;
    const date = body.date || existing.date;
    const source = body.source || existing.source;
    const paymentMethod = body.payment_method || existing.payment_method;
    const referenceNo = body.reference_no !== undefined ? String(body.reference_no) : existing.reference_no;
    const notes = body.notes !== undefined ? String(body.notes) : existing.notes;

    if (!payerName) {
      return res.status(400).json({ error: 'Payer name cannot be empty' });
    }

    // Update editable fields without altering receipt_no or applicant_id/family_id linkage
    db.run(`UPDATE income SET
      amount = ?,
      payer_name = ?,
      date = ?,
      source = ?,
      payment_method = ?,
      reference_no = ?,
      notes = ?
    WHERE id = ?`, [
      amount,
      payerName,
      date,
      source,
      paymentMethod,
      referenceNo,
      notes,
      id
    ]);

    // Resync installment plans for the linked applicant if applicable
    if (existing.applicant_id) {
      syncApplicantInstallmentPlans(db, existing.applicant_id);
    }

    saveDb();
    logAudit(db, staffName, 'update', 'income', id, `Updated income entry ${existing.receipt_no} (LKR ${amount.toFixed(2)}) from ${payerName} for ${source}`);
    res.json({ success: true, message: 'Income entry updated successfully', id });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /income/:id] error:`, err);
    logErrorToFile('PUT /income/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/income/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';
    const rec = queryOne(db, "SELECT receipt_no, amount, payer_name, applicant_id FROM income WHERE id = ?", [id]);
    if (rec) {
      db.run("DELETE FROM income WHERE id = ?", [id]);
      if (rec.applicant_id) {
        syncApplicantInstallmentPlans(db, rec.applicant_id);
      }
      saveDb();
      logAudit(db, staffName, 'delete', 'income', id, `Reversed/deleted receipt ${rec.receipt_no} (LKR ${rec.amount}) from ${rec.payer_name}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /income/:id] error:`, err);
    logErrorToFile('DELETE /income/:id', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 8. OUTSTANDING BALANCES & AGING
// ----------------------------------------------------
apiRouter.get('/balances', async (req, res) => {
  try {
    const db = await getDb();
    const balances = calculateAllStudentBalances(db, ['enrolled', 'accepted', 'documents_submitted', 'applied']);
    res.json(balances);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /balances] error:`, err);
    logErrorToFile('GET /balances', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 9. REMINDERS & STALLED APPLICANTS
// ----------------------------------------------------
apiRouter.get('/reminders', async (req, res) => {
  try {
    const db = await getDb();
    const today = new Date();

    // 1. Overdue balances (> 30 days overdue with balance > 0)
    const allBalances = calculateAllStudentBalances(db, ['enrolled', 'accepted']) || [];
    const balancesRes = allBalances
      .filter(b => b && (b.balance || 0) > 0 && ((b.days_overdue || 0) >= 30 || b.isOverdue))
      .map(b => ({
        id: `rem_bal_${b.id}`,
        type: 'overdue_balance',
        applicant_id: b.id,
        student_name: `${b.first_name || ''} ${b.last_name || ''}`.trim() || 'Unnamed Student',
        grade: b.grade_applying || 'Unassigned Grade',
        guardian_name: b.guardian_name || '',
        guardian_phone: b.guardian_phone || '',
        guardian_email: b.guardian_email || '',
        amount_due: b.balance || 0,
        days_overdue: b.days_overdue || 0,
        title: `Outstanding Tuition (LKR ${(b.balance || 0).toLocaleString()})`,
        message: `Account is ${b.days_overdue || 0} days overdue. Last payment recorded ${b.lastPaymentDate || 'Never'}.`
      }));

    // 2. Stalled pipeline applicants
    const thresholdSetting = queryOne(db, "SELECT value FROM settings WHERE key = 'stalled_applicant_threshold_days'");
    const thresholdDays = thresholdSetting ? parseInt(thresholdSetting.value, 10) || 14 : 14;

    const stalledApplicants = queryAll(db, "SELECT * FROM applicants WHERE (is_archived IS NULL OR is_archived = 0) AND status IN ('inquiry', 'applied', 'documents_submitted')") || [];
    const stalledRes: any[] = [];
    for (const s of stalledApplicants) {
      if (!s) continue;
      const rawDate = s.status_updated_at || s.created_at;
      const updateDate = rawDate ? new Date(rawDate) : today;
      const validTime = isNaN(updateDate.getTime()) ? today.getTime() : updateDate.getTime();
      const stalledDays = Math.max(0, Math.floor((today.getTime() - validTime) / (1000 * 60 * 60 * 24)));
      if (stalledDays >= thresholdDays) {
        const safeStatus = String(s.status || 'inquiry');
        stalledRes.push({
          id: `rem_stall_${s.id}`,
          type: 'stalled_applicant',
          applicant_id: s.id,
          student_name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Applicant',
          grade: s.grade_applying || 'General',
          guardian_name: s.guardian_name || '',
          guardian_phone: s.guardian_phone || '',
          guardian_email: s.guardian_email || '',
          status: safeStatus,
          days_stalled: stalledDays,
          title: `Stalled in '${safeStatus.replace('_', ' ')}'`,
          message: `Application has been in ${safeStatus} stage for ${stalledDays} days without progression.`
        });
      }
    }

    // 3. Upcoming assessments scheduled
    const upcomingAssessments = queryAll(db, "SELECT * FROM assessments WHERE status = 'Scheduled' ORDER BY scheduled_at ASC") || [];
    const assessmentRes = upcomingAssessments
      .filter(asm => asm != null)
      .map(asm => ({
        id: `rem_asm_${asm.id}`,
        type: 'upcoming_assessment',
        applicant_id: asm.applicant_id,
        student_name: asm.applicant_name || 'Candidate',
        grade: asm.grade || '',
        scheduled_at: asm.scheduled_at,
        interviewer: asm.interviewer_name || 'Staff',
        assessment_type: asm.assessment_type || 'Assessment',
        title: `${asm.assessment_type || 'Assessment'} Scheduled`,
        message: `Assessment with ${asm.interviewer_name || 'Staff'} set for ${asm.scheduled_at || 'scheduled date'}.`
      }));

    const totalCount = balancesRes.length + stalledRes.length + assessmentRes.length;
    res.json({
      totalCount,
      overdueBalances: balancesRes,
      stalledApplicants: stalledRes,
      upcomingAssessments: assessmentRes
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /reminders] error:`, err);
    logErrorToFile('GET /reminders', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/reminders/count', async (req, res) => {
  try {
    const db = await getDb();
    const allBalances = calculateAllStudentBalances(db, ['enrolled', 'accepted']) || [];
    const balancesCount = allBalances.filter(b => b && (b.balance || 0) > 0 && ((b.days_overdue || 0) >= 30 || b.isOverdue)).length;

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const stalledRow = queryOne(
      db,
      `SELECT COUNT(*) as count FROM applicants WHERE status IN ('draft', 'submitted', 'under_review') AND updated_at < ?`,
      [sevenDaysAgo]
    );

    const assessmentRow = queryOne(
      db,
      `SELECT COUNT(*) as count FROM assessments WHERE status = 'Scheduled'`,
      []
    );

    const total = balancesCount + (stalledRow?.count || 0) + (assessmentRow?.count || 0);
    res.json({ count: total, totalCount: total });
  } catch (err: any) {
    console.error(`[GET /reminders/count] error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 10. CASH FLOW & EXPENSES
// ----------------------------------------------------
apiRouter.get('/expenses', async (req, res) => {
  try {
    const db = await getDb();
    const { category, payment_method, startDate, endDate, search } = req.query;
    let sql = "SELECT * FROM expenses WHERE 1=1";
    const params: any[] = [];

    if (category && category !== 'all') {
      sql += " AND category = ?";
      params.push(category);
    }
    if (payment_method && payment_method !== 'all') {
      sql += " AND payment_method = ?";
      params.push(payment_method);
    }
    if (startDate) {
      sql += " AND date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      sql += " AND date <= ?";
      params.push(endDate);
    }
    if (search) {
      sql += " AND (paid_to LIKE ? OR reference_no LIKE ? OR notes LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += " ORDER BY date DESC, created_at DESC";
    const expenses = queryAll(db, sql, params);
    res.json(expenses);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /expenses] error:`, err);
    logErrorToFile('GET /expenses', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/expenses', async (req, res) => {
  try {
    const db = await getDb();
    const body = req.body;
    const amount = validatePositiveAmount(body.amount, 'amount');
    const staffName = req.headers['x-staff-name'] as string || body.recorded_by_staff_name || 'Bursar';
    const id = `exp_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(`INSERT INTO expenses (
      id, date, amount, category, paid_to, payment_method, reference_no,
      recorded_by_staff_name, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
      id,
      body.date || now.substring(0, 10),
      amount,
      body.category || 'Supplies',
      body.paid_to,
      body.payment_method || 'Bank Transfer',
      body.reference_no || '',
      staffName,
      body.notes || '',
      now
    ]);

    saveDb();
    logAudit(db, staffName, 'create', 'expense', id, `Recorded expense of ${amount.toFixed(2)} to ${body.paid_to} (${body.category})`);
    res.json({ id, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /expenses] error:`, err);
    logErrorToFile('POST /expenses', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/expenses/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const body = req.body;
    const amount = validatePositiveAmount(body.amount, 'amount');
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';

    db.run(`UPDATE expenses SET
      date = ?, amount = ?, category = ?, paid_to = ?, payment_method = ?,
      reference_no = ?, notes = ?
      WHERE id = ?`, [
      body.date,
      amount,
      body.category,
      body.paid_to,
      body.payment_method,
      body.reference_no,
      body.notes,
      id
    ]);

    saveDb();
    logAudit(db, staffName, 'update', 'expense', id, `Updated expense entry ${id} (${amount.toFixed(2)})`);
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /expenses/:id] error:`, err);
    logErrorToFile('PUT /expenses/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/expenses/:id', async (req, res) => {
  try {
    const db = await getDb();
    const { id } = req.params;
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';
    const exp = queryOne(db, "SELECT paid_to, amount FROM expenses WHERE id = ?", [id]);
    db.run("DELETE FROM expenses WHERE id = ?", [id]);
    saveDb();
    if (exp) {
      logAudit(db, staffName, 'delete', 'expense', id, `Deleted expense of $${exp.amount} paid to ${exp.paid_to}`);
    }
    res.json({ success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /expenses/:id] error:`, err);
    logErrorToFile('DELETE /expenses/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get(['/cash-flow/summary', '/cashflow/weekly', '/cashflow/summary', '/cash-flow/weekly'], async (req, res) => {
  try {
    const db = await getDb();

    // 8-week trend
    const allIncome = queryAll(db, "SELECT date, amount, source FROM income ORDER BY date ASC");
    const allExpenses = queryAll(db, "SELECT date, amount, category FROM expenses ORDER BY date ASC");

    const totalIncome = allIncome.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = allExpenses.reduce((sum, e) => sum + e.amount, 0);
    const netCashPosition = totalIncome - totalExpense;

    // Expense by category
    const expenseByCat: Record<string, number> = {};
    for (const e of allExpenses) {
      expenseByCat[e.category] = (expenseByCat[e.category] || 0) + e.amount;
    }

    // Income by source
    const incomeBySource: Record<string, number> = {};
    for (const i of allIncome) {
      incomeBySource[i.source] = (incomeBySource[i.source] || 0) + i.amount;
    }

    // Generate weekly data for the past 8 weeks
    const weeks: any[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const dStart = new Date(now);
      dStart.setDate(now.getDate() - (i + 1) * 7);
      const dEnd = new Date(now);
      dEnd.setDate(now.getDate() - i * 7);

      const startStr = toYMD(dStart);
      const endStr = toYMD(dEnd);
      const label = `Wk ${8 - i} (${dStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;

      const incInWeek = allIncome
        .filter(x => x.date >= startStr && x.date <= endStr)
        .reduce((sum, x) => sum + x.amount, 0);

      const expInWeek = allExpenses
        .filter(x => x.date >= startStr && x.date <= endStr)
        .reduce((sum, x) => sum + x.amount, 0);

      weeks.push({
        week: label,
        label,
        startDate: startStr,
        endDate: endStr,
        income: incInWeek,
        expense: expInWeek,
        net: incInWeek - expInWeek
      });
    }

    res.json({
      totalIncome,
      totalExpense,
      netCashPosition,
      netSurplus: netCashPosition,
      expenseByCat,
      incomeBySource,
      weeklyTrend: weeks,
      weeklyData: weeks
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /cash-flow/summary] error:`, err);
    logErrorToFile('GET /cash-flow/summary', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post(['/cashflow/seed-sample', '/cash-flow/seed-sample'], async (req, res) => {
  try {
    const db = await getDb();
    seedSampleCashFlow(db, true);
    saveDb();
    res.json({ success: true, message: 'Sample cash flow records refreshed successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /cashflow/seed-sample] error:`, err);
    logErrorToFile('POST /cashflow/seed-sample', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 11. CASH DRAWER & RECONCILIATION
// ----------------------------------------------------
apiRouter.get(['/cash-drawer/reconciliations', '/cash-drawer/history'], async (req, res) => {
  try {
    const db = await getDb();
    const rows = queryAll(db, "SELECT * FROM cash_reconciliations ORDER BY date DESC");
    res.json(rows);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /cash-drawer/reconciliations] error:`, err);
    logErrorToFile('GET /cash-drawer/reconciliations', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get(['/cash-drawer/calc', '/cash-drawer/daily'], async (req, res) => {
  try {
    const db = await getDb();
    const date = (req.query.date as string) || new Date().toISOString().substring(0, 10);

    // Look for previous day closing cash as default opening cash
    const prevRec = queryOne(db, "SELECT physically_counted_cash FROM cash_reconciliations WHERE date < ? ORDER BY date DESC LIMIT 1", [date]);
    const defaultOpening = prevRec ? Number(prevRec.physically_counted_cash) : 500.00;

    // Cash income for this date
    const cashIncomeRows = queryAll(db, "SELECT * FROM income WHERE date = ? AND payment_method = 'Cash'", [date]);
    const totalCashIncome = cashIncomeRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // Cash expenses for this date
    const cashExpenseRows = queryAll(db, "SELECT * FROM expenses WHERE date = ? AND payment_method = 'Cash'", [date]);
    const totalCashExpense = cashExpenseRows.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const systemExpected = defaultOpening + totalCashIncome - totalCashExpense;

    // Existing reconciliation for today if any
    const existing = queryOne(db, "SELECT * FROM cash_reconciliations WHERE date = ?", [date]);

    res.json({
      date,
      defaultOpening,
      openingCash: defaultOpening,
      totalCashIncome,
      systemCashIncome: totalCashIncome,
      totalCashExpense,
      systemCashExpense: totalCashExpense,
      systemExpected,
      reconciliation: existing,
      existing,
      cashIncomeRows,
      cashExpenseRows
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /cash-drawer/calc] error:`, err);
    logErrorToFile('GET /cash-drawer/calc', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/cash-drawer/reconcile', async (req, res) => {
  try {
    const db = await getDb();
    const { date, opening_cash, system_expected_cash, physically_counted_cash, notes, is_locked, unlock, force_unlock } = req.body;
    const validatedOpening = validatePositiveAmount(opening_cash, 'opening_cash');
    const countedNum = Number(physically_counted_cash);
    if (isNaN(countedNum) || countedNum < 0) {
      throw new ValidationError('physically_counted_cash cannot be negative');
    }
    const staffName = req.headers['x-staff-name'] as string || 'Bursar';

    // Check if locked
    const existing = queryOne(db, "SELECT * FROM cash_reconciliations WHERE date = ?", [date]);
    if (existing && existing.is_locked === 1 && !unlock && !force_unlock && is_locked !== 0) {
      return res.status(400).json({ error: `Cash drawer for ${date} is locked and finalized. Unlock it first to make changes.` });
    }

    const discrepancy = countedNum - Number(system_expected_cash);
    const id = `rec_${date.replace(/-/g, '_')}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    db.run(`INSERT INTO cash_reconciliations (
      id, date, opening_cash, system_expected_cash, physically_counted_cash, discrepancy, is_locked, notes, reconciled_by_staff_name, reconciled_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      opening_cash = excluded.opening_cash,
      system_expected_cash = excluded.system_expected_cash,
      physically_counted_cash = excluded.physically_counted_cash,
      discrepancy = excluded.discrepancy,
      is_locked = excluded.is_locked,
      notes = excluded.notes,
      reconciled_by_staff_name = excluded.reconciled_by_staff_name,
      reconciled_at = excluded.reconciled_at
    `, [
      id,
      date,
      validatedOpening,
      Number(system_expected_cash),
      countedNum,
      discrepancy,
      is_locked ? 1 : 0,
      notes || '',
      staffName,
      now
    ]);

    saveDb();
    logAudit(db, staffName, 'reconciliation', 'cash_drawer', id, `Completed cash drawer reconciliation for ${date}: Counted LKR ${countedNum.toFixed(2)} (Discrepancy: LKR ${discrepancy.toFixed(2)})`);
    res.json({ id, discrepancy, success: true });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /cash-drawer/reconcile] error:`, err);
    logErrorToFile('POST /cash-drawer/reconcile', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 12. DASHBOARD METRICS
// ----------------------------------------------------
apiRouter.get(['/dashboard/metrics', '/dashboard/stats'], async (req, res) => {
  try {
    const db = await getDb();

    // Capacity & Enrollment
    const capacitySetting = queryOne(db, "SELECT value FROM settings WHERE key = 'total_student_capacity'");
    const targetCapacity = capacitySetting ? parseInt(capacitySetting.value, 10) : 450;
    const enrolledCount = queryOne(db, "SELECT COUNT(*) as count FROM applicants WHERE (is_archived IS NULL OR is_archived = 0) AND status = 'enrolled'")?.count || 0;
    const pendingCount = queryOne(db, "SELECT COUNT(*) as count FROM applicants WHERE (is_archived IS NULL OR is_archived = 0) AND status IN ('applied', 'documents_submitted', 'accepted')")?.count || 0;

    // Funnel counts
    const funnelStages = ['inquiry', 'applied', 'documents_submitted', 'accepted', 'enrolled', 'declined', 'withdrawn'];
    const funnelCounts: Record<string, number> = {};
    for (const st of funnelStages) {
      funnelCounts[st] = queryOne(db, "SELECT COUNT(*) as count FROM applicants WHERE (is_archived IS NULL OR is_archived = 0) AND status = ?", [st])?.count || 0;
    }
    const totalApplicants = Object.values(funnelCounts).reduce((a, b) => a + b, 0);
    const conversionRate = totalApplicants > 0 ? Math.round((enrolledCount / totalApplicants) * 100) : 0;

    // Grade breakdown (both Array and Object format)
    const gradeRows = queryAll(db, "SELECT grade_applying, COUNT(*) as count FROM applicants WHERE (is_archived IS NULL OR is_archived = 0) AND status = 'enrolled' GROUP BY grade_applying");
    const gradeBreakdownList = gradeRows.map(g => ({ grade: g.grade_applying, count: g.count }));
    const gradeBreakdownObj: Record<string, number> = {};
    for (const g of gradeRows) {
      gradeBreakdownObj[g.grade_applying] = g.count;
    }

    // Financial Snapshot
    const incomeTotalRow = queryOne(db, "SELECT SUM(amount) as sum FROM income");
    const incomeTotal = incomeTotalRow?.sum ? Number(incomeTotalRow.sum) : 0;
    
    const expenseTotalRow = queryOne(db, "SELECT SUM(amount) as sum FROM expenses");
    const expenseTotal = expenseTotalRow?.sum ? Number(expenseTotalRow.sum) : 0;
    const netIncome = incomeTotal - expenseTotal;

    // Recent Income
    const recentIncome = queryAll(db, `
      SELECT i.*, a.first_name as student_first_name, a.last_name as student_last_name, a.application_no 
      FROM income i 
      LEFT JOIN applicants a ON i.applicant_id = a.id 
      ORDER BY i.date DESC, i.created_at DESC 
      LIMIT 5
    `);

    // Recent Expenses
    const recentExpenses = queryAll(db, "SELECT * FROM expenses ORDER BY date DESC, created_at DESC LIMIT 5");

    const recentLedger = [
      ...recentIncome.map(i => ({ id: i.id, date: i.date, amount: i.amount, category: i.source, party: i.payer_name, payment_method: i.payment_method, type: 'income' })),
      ...recentExpenses.map(e => ({ id: e.id, date: e.date, amount: e.amount, category: e.category, party: e.paid_to, payment_method: e.payment_method, type: 'expense' }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 7);

    // Recent Audit Logs
    const recentAudits = queryAll(db, "SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 6");

    // Settings
    const settingsRows = queryAll(db, "SELECT key, value FROM settings");
    const settingsObj: Record<string, string> = {};
    for (const r of settingsRows) {
      settingsObj[r.key] = r.value;
    }

    const capacityPercent = Math.min(100, targetCapacity > 0 ? Math.round((enrolledCount / targetCapacity) * 100) : 0);

    // Outstanding balances from calculated student balances
    const allBalances = calculateAllStudentBalances(db, ['enrolled', 'accepted', 'documents_submitted', 'applied']);
    const outstandingTotal = allBalances.reduce((sum, b) => sum + (b.balance || 0), 0);

    // Weekly income & expenses
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek);
    const mondayStr = toYMD(monday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = toYMD(sunday);

    const incomeThisWeekRow = queryOne(db, "SELECT SUM(amount) as sum FROM income WHERE date >= ? AND date <= ?", [mondayStr, sundayStr]);
    const incomeThisWeek = incomeThisWeekRow?.sum ? Number(incomeThisWeekRow.sum) : 0;

    const expenseThisWeekRow = queryOne(db, "SELECT SUM(amount) as sum FROM expenses WHERE date >= ? AND date <= ?", [mondayStr, sundayStr]);
    const expensesThisWeek = expenseThisWeekRow?.sum ? Number(expenseThisWeekRow.sum) : 0;
    const netMovement = incomeThisWeek - expensesThisWeek;

    // Monthly Revenue vs. Expenses aggregation (rolling 12 months)
    const incomeByMonthRows = queryAll(db, "SELECT substr(date, 1, 7) as month, SUM(amount) as sum, COUNT(*) as count FROM income GROUP BY substr(date, 1, 7)");
    const expenseByMonthRows = queryAll(db, "SELECT substr(date, 1, 7) as month, SUM(amount) as sum, COUNT(*) as count FROM expenses GROUP BY substr(date, 1, 7)");

    const incomeMonthMap: Record<string, number> = {};
    for (const r of incomeByMonthRows) {
      if (r.month) incomeMonthMap[r.month] = Number(r.sum || 0);
    }
    const expenseMonthMap: Record<string, number> = {};
    for (const r of expenseByMonthRows) {
      if (r.month) expenseMonthMap[r.month] = Number(r.sum || 0);
    }

    const latestIncome = queryOne(db, "SELECT MAX(date) as max_date FROM income");
    const latestExpense = queryOne(db, "SELECT MAX(date) as max_date FROM expenses");
    const maxDateStr = [latestIncome?.max_date, latestExpense?.max_date, toYMD(new Date())]
      .filter(Boolean)
      .sort()
      .reverse()[0] || toYMD(new Date());

    const anchorDate = new Date(maxDateStr + 'T00:00:00');

    const monthlyFinancials: Array<{
      monthKey: string;
      month: string;
      shortMonth: string;
      fullMonth: string;
      year: number;
      revenue: number;
      expenses: number;
      net: number;
      savingsRate: number;
    }> = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${monthNum}`;
      const shortMonth = d.toLocaleDateString('en-US', { month: 'short' });
      const month = `${shortMonth} '${String(year).slice(-2)}`;
      const fullMonth = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const revenue = Math.round(incomeMonthMap[monthKey] || 0);
      const expenses = Math.round(expenseMonthMap[monthKey] || 0);
      const net = revenue - expenses;
      const savingsRate = revenue > 0 ? Math.round((net / revenue) * 100) : 0;

      monthlyFinancials.push({
        monthKey,
        month,
        shortMonth,
        fullMonth,
        year,
        revenue,
        expenses,
        net,
        savingsRate,
      });
    }

    res.json({
      targetCapacity,
      enrolledCount,
      capacityPercent,
      capacity: {
        totalCapacity: targetCapacity,
        enrolled: enrolledCount,
        pending: pendingCount,
        percentage: capacityPercent
      },
      funnelCounts,
      pipelineCounts: funnelCounts,
      totalApplicants,
      conversionRate,
      gradeBreakdown: gradeBreakdownList,
      gradeBreakdownObj,
      incomeTotal,
      expenseTotal,
      netIncome,
      incomeThisWeek,
      expensesThisWeek,
      netMovement,
      outstanding: outstandingTotal,
      outstandingTotal,
      monthlyFinancials,
      monthlyTrends: monthlyFinancials,
      financials: {
        totalIncome: incomeTotal,
        totalExpense: expenseTotal,
        netCashflow: netIncome,
        incomeThisWeek,
        expensesThisWeek,
        netMovement,
        outstanding: outstandingTotal,
        monthlyFinancials
      },
      recentIncome,
      recentExpenses,
      recentLedger,
      recentAudits,
      recentAudit: recentAudits,
      settings: settingsObj
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /dashboard/metrics] error:`, err);
    logErrorToFile('GET /dashboard/metrics', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 13. GLOBAL SEARCH
// ----------------------------------------------------
apiRouter.get('/search', async (req, res) => {
  try {
    const db = await getDb();
    const q = (req.query.q as string || '').trim();
    if (!q) {
      return res.json({ applicants: [], families: [], income: [], expenses: [] });
    }

    const term = `%${q}%`;

    const applicants = queryAll(db, `
      SELECT id, application_no, first_name, last_name, grade_applying, status, guardian_name, guardian_phone, guardian_email
      FROM applicants
      WHERE first_name LIKE ? OR last_name LIKE ? OR application_no LIKE ? OR guardian_name LIKE ? OR guardian_phone LIKE ? OR guardian_email LIKE ?
      LIMIT 8
    `, [term, term, term, term, term, term]);

    const families = queryAll(db, `
      SELECT id, family_code, household_name, primary_guardian_name, primary_phone, primary_email
      FROM families
      WHERE household_name LIKE ? OR family_code LIKE ? OR primary_guardian_name LIKE ? OR primary_phone LIKE ?
      LIMIT 8
    `, [term, term, term, term]);

    const income = queryAll(db, `
      SELECT id, receipt_no, date, amount, source, payment_method, payer_name
      FROM income
      WHERE receipt_no LIKE ? OR payer_name LIKE ? OR reference_no LIKE ? OR source LIKE ?
      LIMIT 8
    `, [term, term, term, term]);

    const expenses = queryAll(db, `
      SELECT id, date, amount, category, paid_to, payment_method, reference_no
      FROM expenses
      WHERE paid_to LIKE ? OR reference_no LIKE ? OR category LIKE ? OR notes LIKE ?
      LIMIT 8
    `, [term, term, term, term]);

    res.json({ applicants, families, income, expenses });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /search] error:`, err);
    logErrorToFile('GET /search', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 14. AUDIT LOGS
// ----------------------------------------------------
apiRouter.get('/audit-logs', async (req, res) => {
  try {
    const db = await getDb();
    const { staff, action, entity, target_id, limit } = req.query;
    let sql = "SELECT * FROM audit_logs WHERE 1=1";
    const params: any[] = [];

    if (staff && staff !== 'all') {
      sql += " AND staff_name = ?";
      params.push(staff);
    }
    if (action && action !== 'all') {
      sql += " AND action_type = ?";
      params.push(action);
    }
    if (entity && entity !== 'all') {
      sql += " AND entity_type = ?";
      params.push(entity);
    }
    if (target_id) {
      sql += " AND target_id = ?";
      params.push(target_id);
    }

    const maxRows = limit ? parseInt(limit as string, 10) || 200 : 200;
    sql += ` ORDER BY timestamp DESC LIMIT ${maxRows}`;
    const logs = queryAll(db, sql, params);
    res.json(logs);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /audit-logs] error:`, err);
    logErrorToFile('GET /audit-logs', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 15. EXPORT & BACKUP
// ----------------------------------------------------
apiRouter.get('/export/sqlite', async (req, res) => {
  try {
    const buffer = getRawDbBuffer();
    res.setHeader('Content-Type', 'application/x-sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="school-office-backup-${new Date().toISOString().substring(0, 10)}.db"`);
    res.send(buffer);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /export/sqlite] error:`, err);
    logErrorToFile('GET /export/sqlite', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/export/excel', async (req, res) => {
  try {
    const db = await getDb();

    const applicants = queryAll(db, "SELECT application_no, first_name, last_name, dob, gender, grade_applying, academic_year, status, guardian_name, guardian_phone, guardian_email, address FROM applicants");
    const income = queryAll(db, "SELECT receipt_no, date, amount, source, payment_method, payer_name, reference_no, received_by_staff_name, notes FROM income");
    const expenses = queryAll(db, "SELECT date, amount, category, paid_to, payment_method, reference_no, recorded_by_staff_name, notes FROM expenses");
    const fees = queryAll(db, "SELECT academic_year, grade, fee_type, amount, is_compulsory, description FROM fee_structures");

    const wb = XLSX.utils.book_new();

    const wsIncome = XLSX.utils.json_to_sheet(income);
    XLSX.utils.book_append_sheet(wb, wsIncome, "Income Ledger");

    const wsExpenses = XLSX.utils.json_to_sheet(expenses);
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses Ledger");

    const wsApplicants = XLSX.utils.json_to_sheet(applicants);
    XLSX.utils.book_append_sheet(wb, wsApplicants, "Applicants Directory");

    const wsFees = XLSX.utils.json_to_sheet(fees);
    XLSX.utils.book_append_sheet(wb, wsFees, "Fee Structure");

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Elite_School_Financial_Ledger_${new Date().toISOString().substring(0, 10)}.xlsx"`);
    res.send(buf);
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /export/excel] error:`, err);
    logErrorToFile('GET /export/excel', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/export/json', async (req, res) => {
  try {
    const db = await getDb();
    const tables = ['settings', 'staff', 'families', 'applicants', 'documents', 'assessments', 'fee_structures', 'scholarships', 'installment_plans', 'income', 'expenses', 'cash_reconciliations', 'communications', 'audit_logs'];
    const snapshot: Record<string, any[]> = {};
    for (const t of tables) {
      snapshot[t] = queryAll(db, `SELECT * FROM ${t}`);
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="elite-school-snapshot-${new Date().toISOString().substring(0, 10)}.json"`);
    res.json({
      export_version: '1.0',
      school: 'Elite International School',
      created_at: new Date().toISOString(),
      data: snapshot
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /export/json] error:`, err);
    logErrorToFile('GET /export/json', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/export/restore-json', async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) {
      return res.status(400).json({ error: 'Missing snapshot data' });
    }
    const db = await getDb();
    const tables = ['settings', 'staff', 'families', 'applicants', 'documents', 'assessments', 'fee_structures', 'scholarships', 'installment_plans', 'income', 'expenses', 'cash_reconciliations', 'communications', 'audit_logs', 'assets'];

    for (const t of tables) {
      if (data[t] && Array.isArray(data[t])) {
        db.run(`DELETE FROM ${t}`);
        for (const row of data[t]) {
          const keys = Object.keys(row);
          const placeholders = keys.map(() => '?').join(', ');
          const values = Object.values(row) as any[];
          db.run(`INSERT INTO ${t} (${keys.join(', ')}) VALUES (${placeholders})`, values);
        }
      }
    }

    saveDb();
    logAudit(db, req.headers['x-staff-name'] as string || 'Admin', 'restore', 'system', null, 'Restored database from JSON snapshot backup');
    res.json({ success: true, message: 'Database restored successfully from snapshot' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /export/restore-json] error:`, err);
    logErrorToFile('POST /export/restore-json', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/export/save-to-folder', async (req, res) => {
  try {
    const db = await getDb();
    const settingRow = queryOne(db, "SELECT value FROM settings WHERE key = 'backup_folder_path'");
    const targetFolder = settingRow?.value || path.join(process.cwd(), 'data', 'backups');

    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }

    const dateStr = new Date().toISOString().substring(0, 10);
    const dbBuffer = getRawDbBuffer();
    const destDbPath = path.join(targetFolder, `school-office-backup-${dateStr}.db`);
    fs.writeFileSync(destDbPath, dbBuffer);

    // Also write JSON snapshot
    const tables = ['settings', 'staff', 'families', 'applicants', 'documents', 'assessments', 'fee_structures', 'scholarships', 'installment_plans', 'income', 'expenses', 'cash_reconciliations', 'communications', 'audit_logs', 'assets'];
    const snapshot: Record<string, any[]> = {};
    for (const t of tables) {
      snapshot[t] = queryAll(db, `SELECT * FROM ${t}`);
    }
    const destJsonPath = path.join(targetFolder, `elite-school-snapshot-${dateStr}.json`);
    fs.writeFileSync(destJsonPath, JSON.stringify({
      export_version: '1.0',
      school: 'Elite International School',
      created_at: new Date().toISOString(),
      data: snapshot
    }, null, 2));

    logAudit(db, req.headers['x-staff-name'] as string || 'Admin', 'backup', 'system', null, `Saved local backup snapshot to folder: ${targetFolder}`);
    res.json({ success: true, folder: targetFolder, files: [destDbPath, destJsonPath] });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /export/save-to-folder] error:`, err);
    logErrorToFile('POST /export/save-to-folder', err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 12. ASSETS & INVENTORY REGISTER
// ----------------------------------------------------
apiRouter.get('/assets', async (req, res) => {
  try {
    const db = await getDb();
    const { category, condition, search } = req.query;

    let sql = "SELECT * FROM assets WHERE 1=1";
    const params: any[] = [];

    if (category && category !== 'all') {
      sql += " AND category = ?";
      params.push(category);
    }
    if (condition && condition !== 'all') {
      sql += " AND condition = ?";
      params.push(condition);
    }
    if (search) {
      sql += " AND (item_name LIKE ? OR current_location LIKE ? OR notes LIKE ? OR created_by LIKE ?)";
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    sql += " ORDER BY purchase_date DESC";
    const assets = queryAll(db, sql, params);

    const totalActiveValue = queryOne(db, "SELECT SUM(purchase_price) as sum FROM assets WHERE condition != 'Retired'")?.sum || 0;
    const totalAllValue = queryOne(db, "SELECT SUM(purchase_price) as sum FROM assets")?.sum || 0;
    const totalCount = queryOne(db, "SELECT COUNT(*) as c FROM assets")?.c || 0;
    const activeCount = queryOne(db, "SELECT COUNT(*) as c FROM assets WHERE condition != 'Retired'")?.c || 0;
    const retiredCount = queryOne(db, "SELECT COUNT(*) as c FROM assets WHERE condition = 'Retired'")?.c || 0;

    res.json({
      assets,
      summary: {
        totalActiveValue,
        totalAllValue,
        totalCount,
        activeCount,
        retiredCount
      }
    });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[GET /assets] error:`, err);
    logErrorToFile('GET /assets', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.post('/assets', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    const { item_name, category, purchase_date, purchase_price, current_location, condition, notes } = req.body;

    if (!item_name || !category || purchase_price === undefined || purchase_price === null || purchase_price === '') {
      return res.status(400).json({ error: 'Item name, category, and purchase price are required.' });
    }
    const validatedPrice = validatePositiveAmount(purchase_price, 'purchase_price');

    const id = `ast_${Date.now()}`;
    const now = new Date().toISOString();

    db.run(
      "INSERT INTO assets (id, item_name, category, purchase_date, purchase_price, current_location, condition, notes, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        item_name.trim(),
        category.trim(),
        purchase_date || now.substring(0, 10),
        validatedPrice,
        current_location ? current_location.trim() : 'General Campus',
        condition || 'Good',
        notes || '',
        loggedInStaff,
        now,
        now
      ]
    );

    saveDb();
    logAudit(db, loggedInStaff, 'create', 'asset', id, `Registered asset: ${item_name} (${category}, LKR ${validatedPrice})`);
    res.json({ id, success: true, message: 'Asset registered successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[POST /assets] error:`, err);
    logErrorToFile('POST /assets', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.put('/assets/:id', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    const { item_name, category, purchase_date, purchase_price, current_location, condition, notes } = req.body;
    let validatedPrice: number | null = null;
    if (purchase_price !== undefined && purchase_price !== null && purchase_price !== '') {
      validatedPrice = validatePositiveAmount(purchase_price, 'purchase_price');
    }
    const now = new Date().toISOString();

    db.run(
      "UPDATE assets SET item_name = COALESCE(?, item_name), category = COALESCE(?, category), purchase_date = COALESCE(?, purchase_date), purchase_price = COALESCE(?, purchase_price), current_location = COALESCE(?, current_location), condition = COALESCE(?, condition), notes = COALESCE(?, notes), updated_at = ? WHERE id = ?",
      [
        item_name ? item_name.trim() : null,
        category ? category.trim() : null,
        purchase_date || null,
        validatedPrice !== null ? validatedPrice : (purchase_price !== undefined ? parseFloat(purchase_price) : null),
        current_location ? current_location.trim() : null,
        condition || null,
        notes !== undefined ? notes : null,
        now,
        req.params.id
      ]
    );

    saveDb();
    logAudit(db, loggedInStaff, 'update', 'asset', req.params.id, `Updated asset ID ${req.params.id} (Condition: ${condition || 'unchanged'})`);
    res.json({ success: true, message: 'Asset record updated successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[PUT /assets/:id] error:`, err);
    logErrorToFile('PUT /assets/:id', err);
    res.status(500).json({ error: err.message });
  }
});

apiRouter.delete('/assets/:id', async (req, res) => {
  try {
    const db = await getDb();
    const loggedInStaff = req.headers['x-staff-name'] as string || 'Admin';
    const asset = queryOne(db, "SELECT item_name FROM assets WHERE id = ?", [req.params.id]);

    db.run("DELETE FROM assets WHERE id = ?", [req.params.id]);
    saveDb();

    logAudit(db, loggedInStaff, 'delete', 'asset', req.params.id, `Deleted asset item: ${asset?.item_name || req.params.id}`);
    res.json({ success: true, message: 'Asset deleted successfully' });
  } catch (err: any) {
    if (err instanceof ValidationError || err?.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    console.error(`[DELETE /assets/:id] error:`, err);
    logErrorToFile('DELETE /assets/:id', err);
    res.status(500).json({ error: err.message });
  }
});
