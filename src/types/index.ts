export type AdmissionStatus =
  | 'inquiry'
  | 'applied'
  | 'documents_submitted'
  | 'accepted'
  | 'enrolled'
  | 'declined'
  | 'withdrawn';

export interface Staff {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatar_initials: string;
  photo_url?: string;
  has_pin: boolean;
  active: number;
  is_active?: number;
  created_at: string;
}

export interface Applicant {
  id: string;
  application_no: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  grade_applying: string;
  academic_year: string;
  status: AdmissionStatus;
  status_updated_at: string;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  guardian_relationship: string;
  address: string;
  family_id: string | null;
  household_name?: string;
  notes: string;
  blood_group: string;
  allergies: string;
  dietary_needs: string;
  emergency_contact: string;
  emergency_phone: string;
  emergency_relationship: string;
  physician_name: string;
  physician_phone: string;
  care_notes: string;
  photo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: string;
  item_name: string;
  category: 'Furniture' | 'Electronics' | 'Maintenance Equipment' | 'Textbooks' | 'Sports Equipment' | 'Lab Equipment' | 'Vehicles' | 'Other';
  purchase_date: string;
  purchase_price: number;
  current_location: string;
  condition: 'New' | 'Good' | 'Fair' | 'Poor' | 'Retired';
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface DocumentItem {
  id: string;
  applicant_id: string;
  document_name: string;
  is_mandatory: number;
  status: 'pending' | 'received';
  received_date: string | null;
  verified_by?: string | null;
  notes: string;
  created_at: string;
}

export interface Assessment {
  id: string;
  applicant_id: string;
  applicant_name: string;
  grade: string;
  assessment_type: 'Entrance Exam' | 'Parent Interview' | 'Faculty Placement' | 'Diagnostic Assessment';
  interviewer_name: string;
  scheduled_at: string;
  duration_minutes?: number;
  score: number | null;
  max_score: number;
  recommendation:
    | 'Recommend Full Admission'
    | 'Conditional'
    | 'Needs Learning Support Review'
    | 'Placement on Waitlist'
    | 'Under Review by Academic Council'
    | null;
  status: 'Scheduled' | 'Completed' | 'Cancelled';
  notes: string;
  created_at: string;
}

export interface Family {
  id: string;
  family_code: string;
  household_name: string;
  primary_guardian_name: string;
  primary_phone: string;
  primary_email: string;
  secondary_guardian_name: string;
  secondary_phone: string;
  secondary_email: string;
  address: string;
  notes: string;
  created_at: string;
  students?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    grade_applying: string;
    status: AdmissionStatus;
  }>;
  student_count?: number;
  total_paid?: number;
}

export interface FeeStructure {
  id: string;
  academic_year: string;
  grade: string;
  fee_type: string;
  amount: number;
  is_compulsory: number;
  description: string;
  created_at: string;
}

export interface Scholarship {
  id: string;
  applicant_id: string;
  title: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  justification: string;
  approved_by: string;
  created_at: string;
}

export interface InstallmentPlan {
  id: string;
  applicant_id: string;
  plan_type: 'annual' | 'term' | 'monthly';
  installment_number: number;
  title: string;
  amount_due: number;
  due_date: string;
  amount_paid: number;
  status: 'Pending' | 'Partial' | 'Paid' | 'Overdue';
  created_at: string;
}

export interface Income {
  id: string;
  receipt_no: string;
  date: string;
  amount: number;
  source: string;
  payment_method: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Card';
  payer_name: string;
  applicant_id: string | null;
  family_id: string | null;
  received_by_staff_id: string | null;
  received_by_staff_name: string;
  reference_no: string;
  notes: string;
  created_at: string;
  student_first_name?: string;
  student_last_name?: string;
  student_grade?: string;
  application_no?: string;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: 'Payroll' | 'Utilities' | 'Supplies' | 'Maintenance' | 'Educational Materials' | 'Other';
  paid_to: string;
  payment_method: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Card';
  reference_no: string;
  recorded_by_staff_name: string;
  notes: string;
  created_at: string;
}

export interface CashReconciliation {
  id: string;
  date: string;
  opening_cash: number;
  system_expected_cash: number;
  physically_counted_cash: number;
  discrepancy: number;
  is_locked: number;
  notes: string;
  reconciled_by_staff_name: string;
  reconciled_at: string;
}

export interface Communication {
  id: string;
  applicant_id: string | null;
  family_id: string | null;
  contact_type: 'Call' | 'Meeting' | 'Email' | 'Notice' | 'Complaint' | 'WhatsApp';
  summary: string;
  date: string;
  staff_name: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  staff_name: string;
  action_type: string;
  record_type: string;
  record_id: string | null;
  details: string;
  timestamp: string;
}

export interface StudentBalance {
  id: string;
  application_no: string;
  first_name: string;
  last_name: string;
  grade_applying: string;
  academic_year: string;
  status: AdmissionStatus;
  guardian_name: string;
  guardian_phone: string;
  guardian_email: string;
  household_name?: string;
  gross: number;
  discount: number;
  expected: number;
  paid: number;
  balance: number;
  percentPaid: number;
  lastPaymentDate: string | null;
  daysSinceLastPayment: number | null;
  agingBucket: 'current' | '30_days' | '60_days' | '90_plus';
  isOverdue: boolean;
}

export interface MonthlyFinancial {
  monthKey: string;
  month: string;
  shortMonth: string;
  fullMonth: string;
  year: number;
  revenue: number;
  expenses: number;
  net: number;
  savingsRate: number;
}

export interface SchoolSettings {
  school_name: string;
  tagline: string;
  motto?: string;
  address?: string;
  phone?: string;
  email?: string;
  whatsapp_number?: string;
  currency_symbol: string;
  academic_year: string;
  total_student_capacity: string;
  sibling_discount_2nd: string;
  sibling_discount_3rd: string;
  default_opening_float?: string;
  receipt_footer_notice: string;
  backup_folder_path: string;
  school_logo_url: string;
  [key: string]: string | undefined;
}
