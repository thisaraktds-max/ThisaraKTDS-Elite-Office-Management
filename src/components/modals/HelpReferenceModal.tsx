import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import {
  X,
  HelpCircle,
  Search,
  BookOpen,
  GraduationCap,
  Scale,
  Receipt,
  ClipboardCheck,
  Home,
  Vault,
  TrendingUp,
  ShieldCheck,
  DownloadCloud,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Zap,
  Keyboard,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Info,
  Package,
  FileSpreadsheet,
  MessageSquare,
  Smartphone,
  Mail,
  RefreshCw,
  Terminal,
  Lock,
} from 'lucide-react';

interface HelpReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour: () => void;
  onNavigate?: (view: string) => void;
  onOpenGuidedEnroll?: () => void;
  onOpenQuickPayment?: () => void;
}

interface StepGuide {
  id: string;
  category: 'admissions' | 'bursary' | 'assessments' | 'operations' | 'administration';
  title: string;
  subtitle: string;
  targetView: string;
  targetActionLabel: string;
  steps: string[];
  tips?: string[];
  warning?: string;
}

export const HelpReferenceModal: React.FC<HelpReferenceModalProps> = ({
  isOpen,
  onClose,
  onStartTour,
  onNavigate,
  onOpenGuidedEnroll,
  onOpenQuickPayment,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>('bulk_import');

  const guides: StepGuide[] = [
    {
      id: 'bulk_import',
      category: 'admissions',
      title: 'Migrating 460+ Existing Students (Bulk CSV / Excel Tool)',
      subtitle: 'Fast-track onboarding of the entire active student body with preview & duplicate checks',
      targetView: 'admissions',
      targetActionLabel: 'Open Admissions View',
      steps: [
        'Navigate to Admissions Funnel or School Settings and click "Import CSV/Excel".',
        'Step 1 (Download Template): Click "Download Sample Template (.CSV)" to obtain the pre-formatted columns (full_name, date_of_birth, grade, guardian_name, guardian_phone, guardian_email, family_name, status).',
        'Step 2 (Prepare Data): Populate the spreadsheet with your 460+ student records. Ensure date formats are YYYY-MM-DD or DD/MM/YYYY. If siblings share the same household, enter the same family_name to auto-link them.',
        'Step 3 (Upload File): Drag and drop or browse to select your .csv or .xlsx workbook.',
        'Step 4 (Pre-Commit Validation Preview): The system parses all rows, validates phone numbers and birth dates, flags potential duplicates, and previews how records will be committed.',
        'Step 5 (Commit to Database): Click "Commit Student Records". All students will be registered in SQLite with Enrolled status, student dossiers, and fee ledgers initialized.',
      ],
      tips: [
        'The import tool automatically handles sibling grouping and creates shared Household records for you.',
      ],
    },
    {
      id: 'guided_enrollment',
      category: 'admissions',
      title: 'How to Enroll a New Student (5-Step Fast Track)',
      subtitle: 'Complete intake wizard from demographic intake to tuition receipt generation',
      targetView: 'admissions',
      targetActionLabel: 'Open Admissions Pipeline',
      steps: [
        'Click the blue "Enroll Student" button in the top navigation bar from any screen.',
        'Step 1 (Basic Details): Enter the applicant\'s full name, date of birth, gender, and select their target grade.',
        'Step 2 (Family & Household): Enter guardian details or search existing households to automatically link siblings.',
        'Step 3 (Fee Schedule): Select academic terms and verify calculated tuition with any applicable sibling discounts (e.g. 10%).',
        'Step 4 (Documentation): Check off verified birth certificates, transfer certificates, or previous school report cards.',
        'Step 5 (Confirmation): Review the student summary and click "Complete Enrollment". The student will immediately appear as Enrolled and their bursary ledger will be initialized.',
      ],
      tips: [
        'The form automatically saves working drafts locally—if interrupted, your entered data will be waiting when you return.',
        'Press Alt+E or click the topbar action to launch this flow instantly.',
      ],
    },
    {
      id: 'assets_tracking',
      category: 'operations',
      title: 'School Asset & Equipment Inventory Tracking',
      subtitle: 'Managing laptops, smartboards, laboratory equipment, and sports gear',
      targetView: 'assets',
      targetActionLabel: 'Open Assets & Inventory',
      steps: [
        'Navigate to Assets & Inventory from the Operations section in the left sidebar.',
        'Review the KPI banner showing Active Inventory Value, Total Registered Assets, Operational Condition %, and Retired / Decommissioned items.',
        'Click "Register New Asset" to add school equipment.',
        'Fill in Item Name, Category (IT / Electronics, Classroom Furniture, Lab Equipment, Musical Instruments, Sports Gear), Serial / Barcode Number, Purchase Date, Cost (LKR), Assigned Location, and Condition (New, Good, Fair, Damaged).',
        'To edit or reassign an item: Click the edit icon on the asset card, change the assigned department/room, or update the condition.',
        'To export equipment registers: Click "Export to Excel" to generate a complete inventory audit sheet.',
      ],
      tips: [
        'Decommissioned or retired items can be marked as Disposed or Written-off while preserving historical purchase cost records.',
      ],
    },
    {
      id: 'comms_whatsapp_email',
      category: 'admissions',
      title: 'Guardian Notices: WhatsApp & Email Client Integration SOP',
      subtitle: 'How automated communication links connect with your office WhatsApp Web and Outlook/Thunderbird',
      targetView: 'balances',
      targetActionLabel: 'Go to Outstanding Balances',
      steps: [
        'Navigate to Outstanding Balances or open any Student Dossier.',
        'Click "Send Notice" or the Paper Airplane icon beside a student.',
        'Select the Notice Template: Tuition Overdue Reminder, Admission Offer Letter, Assessment Result, or Custom Announcement.',
        'The message draft is automatically generated for the chosen template type with the student\'s name, guardian name, balance due, and school details formatted directly.',
        'To send via WhatsApp: Click "Launch WhatsApp Web/App". The system automatically encodes the message and opens https://wa.me/<guardian_phone>?text=<encoded_message>.',
        'To send via Email: Click "Launch Email Client". The system generates a mailto: URL containing the guardian email, subject line, and formatted body.',
        'The system automatically timestamps and logs the notice in the candidate\'s permanent Communication Record.',
      ],
      tips: [
        'Ensure the school\'s official contact phone numbers and email are configured under School Settings so message signatures populate accurately.',
      ],
    },
    {
      id: 'funnel_pipeline',
      category: 'admissions',
      title: 'Managing the Admissions Funnel & Stage Changes',
      subtitle: 'Moving applicants across Inquiry, Applied, Assessment, Documents, Accepted, and Enrolled',
      targetView: 'admissions',
      targetActionLabel: 'Go to Admissions Funnel',
      steps: [
        'Navigate to Admissions Funnel from the left sidebar.',
        'Use the top filter chips to switch between Kanban Board view and Dense Table view.',
        'In Kanban view: Simply click and drag any student card from one stage column to another (e.g. from Inquiry to Applied).',
        'In Table view: Click the stage dropdown directly on any candidate row, or use the multi-select checkboxes to batch-update several candidates at once.',
        'Click on any student name to open their complete Dossier containing personal notes, attachments, assessment marks, and tuition schedule.',
      ],
      tips: [
        'Use the filter options (e.g. "Overdue Balances" on financial views, or grade and search on admissions) to quickly narrow down large lists.',
      ],
    },
    {
      id: 'entrance_assessments',
      category: 'assessments',
      title: 'Scheduling & Grading Candidate Entrance Tests',
      subtitle: 'Recording written marks, oral interview evaluations, and staff recommendations',
      targetView: 'assessments',
      targetActionLabel: 'Go to Assessments',
      steps: [
        'Navigate to Admissions Assessments from the left sidebar.',
        'Click "Schedule Assessment" to book a candidate into an upcoming testing slot.',
        'Select the applicant from the dropdown, choose the date and time, and assign the evaluating teacher.',
        'Once the test is administered, click "Score Candidate" on the assessment card.',
        'Enter the overall score (evaluated against the assessment\'s maximum score, typically 100).',
        'Select a recommendation from the dropdown (Recommend Full Admission, Conditional on Academic Support, Needs Learning Support Review, Placement on Waitlist, or Under Review by Academic Council), and record evaluative commentary.',
        'Click "Save & Complete Assessment" to mark the assessment record as Completed. (Note: transitioning the applicant\'s overall admissions stage is handled separately in the Admissions Funnel or student dossier).',
      ],
      tips: [
        'Official assessment result sheets can be printed directly from the candidate\'s Dossier.',
      ],
    },
    {
      id: 'walkin_payments',
      category: 'bursary',
      title: 'Walk-In Parent Payment & Instant Receipting',
      subtitle: 'Rapid counter transaction workflow for parents paying tuition at the reception',
      targetView: 'fees',
      targetActionLabel: 'Open Fees & Income Ledger',
      steps: [
        'Click the "Walk-In Payment" button in the topbar (or press Alt+P).',
        'Search the student by name, application number, or parent mobile number.',
        'Select the student to view their net expected tuition, previous payments, and outstanding balance aging.',
        'Enter the amount being settled today and choose the payment method (Cash, Bank Transfer, Card, or Cheque).',
        'Select the payment category (e.g. Term 1 Tuition Fee, Registration Fee, Uniform/Books).',
        'Click "Process Payment & Print Receipt" to record the transaction, credit the student ledger, and print an official thermal or A4 receipt.',
      ],
      tips: [
        'The transaction is automatically recorded in today\'s Cash Drawer ledger with the active staff member\'s signature stamp.',
      ],
    },
    {
      id: 'aging_balances',
      category: 'bursary',
      title: 'Tracking Outstanding Balances & Sending Notices',
      subtitle: 'Monitoring 30/60/90+ day overdue accounts and generating Statements of Account',
      targetView: 'balances',
      targetActionLabel: 'Go to Outstanding Balances',
      steps: [
        'Navigate to Outstanding Balances from the left sidebar.',
        'Review the KPI banner showing total receivable amount and accounts over 30/60/90 days delinquent.',
        'Use preset filters like "All Accounts", "Overdue Balances", or "Critical 90+ Days" to identify students requiring immediate follow-up.',
        'To send a notice: Click the paper airplane icon next to a student to open the Communications Drafter with pre-filled guardian contact, balance amount, and days overdue.',
        'Choose SMS, WhatsApp, or Email template, preview the generated message, and click "Send / Record Notice".',
        'To print a formal ledger summary: Click the document icon to generate a printable "Statement of Account" complete with school seal and payment history.',
      ],
      tips: [
        'Use the bulk export button to download a spreadsheet of all overdue accounts for administrative review.',
      ],
    },
    {
      id: 'family_siblings',
      category: 'admissions',
      title: 'Managing Families & Automatic Sibling Discounts',
      subtitle: 'Linking multiple children under one guardian to apply school fee concessions',
      targetView: 'families',
      targetActionLabel: 'Go to Households & Families',
      steps: [
        'Navigate to Households & Families from the left sidebar.',
        'Click "Add Family Household" to register a new family unit with father, mother, or primary guardian details.',
        'To link siblings: Open an existing student\'s Dossier, navigate to the "Family & Siblings" tab, and choose their household.',
        'The system will automatically detect multiple enrolled children in the same family and apply the configured sibling concession (e.g. 10% discount on 2nd and 3rd child).',
        'In the Families view, staff can see total combined fees and consolidated outstanding balances across all children in that household.',
      ],
    },
    {
      id: 'cash_drawer',
      category: 'operations',
      title: 'Daily Cash Drawer Float & End-of-Day Balancing',
      subtitle: 'Reconciling morning cash float, daytime counter receipts, and physical currency notes',
      targetView: 'cashdrawer',
      targetActionLabel: 'Go to Daily Cash Drawer',
      steps: [
        'At morning opening: Navigate to Daily Cash Drawer and verify the starting cash float (e.g. LKR 10,000).',
        'During the day: All cash fees collected automatically increment the drawer balance; cash petty expenses decrement it.',
        'At closing: Open the "Cash Count & Shift Reconciliation" tab.',
        'Count physical notes in the cash box and enter quantities for each denomination (5000, 1000, 500, 100, 50, 20).',
        'The counter will calculate total physical cash and compute the exact variance against expected system totals.',
        'If balanced (Variance = LKR 0.00), click "Sign & Lock Daily Drawer" to archive the shift record and print the reconciliation report.',
      ],
      warning: 'Never close the cash drawer with an unexplained discrepancy. Note any discrepancies in the shift comments box before locking.',
    },
    {
      id: 'staff_switching',
      category: 'administration',
      title: 'Switching Active Staff on Shared Front-Desk Computer',
      subtitle: 'Bcrypt PIN authentication and digital audit trail attribution',
      targetView: 'settings',
      targetActionLabel: 'Go to Staff Settings',
      steps: [
        'Look at the bottom of the left sidebar to see the currently authenticated staff profile.',
        'Click on the staff card at the bottom of the sidebar to open the "Switch Active Staff Profile" dialog.',
        'Select your name from the staff list.',
        'Enter your 4-digit security PIN (if configured for your profile).',
        'Click "Unlock Profile". All subsequent receipts, admissions notes, and financial entries will now be signed with your credentials.',
        'When stepping away from the desk, click "Lock Terminal Session" to prevent unauthorized entries.',
        'To change your PIN: Click "Change PIN" inside the modal, enter your current PIN and choose a new 4-digit code.',
      ],
    },
    {
      id: 'remote_updater',
      category: 'administration',
      title: 'Automated Remote System Updates (update.sh & update.bat)',
      subtitle: 'One-click script for pulling software updates and compiling production builds',
      targetView: 'settings',
      targetActionLabel: 'View Server Setup',
      steps: [
        'When connecting via Remote Desktop to update the office terminal:',
        'On Windows: Open command prompt or File Explorer in the application folder and double-click `update.bat`.',
        'On Mac/Linux: Run `./update.sh` in the terminal.',
        'The update script automatically creates a dated pre-update safety backup in `/backups/`, pulls the latest Git release, installs any updated npm dependencies, builds production bundles, and verifies the SQLite database.',
        'Once complete, restart the application using `npm run dev` or launch the startup desktop shortcut.',
      ],
      tips: [
        'Your existing student database and transaction records are preserved during updates.',
      ],
    },
    {
      id: 'backup_sqlite',
      category: 'administration',
      title: 'Database Backup & Full SQLite Data Portability',
      subtitle: 'Exporting raw SQLite database files, Excel workbooks, and system snapshots',
      targetView: 'export',
      targetActionLabel: 'Go to Backup & Export',
      steps: [
        'Navigate to Backup & SQLite Export from the left sidebar.',
        'Click "Download SQLite Database (.db)" to obtain a complete, binary snapshot of all school records.',
        'Store the downloaded database file on a secure, encrypted external drive (BitLocker / FileVault).',
        'To export human-readable spreadsheets: Click "Export Full Student Ledger to Excel (.xlsx)" or "Export Financial Audit Trail (.csv)".',
        'To restore a backup: Stop the dev server, copy the backup `.db` file into `/data/school-office.db`, and restart the application.',
      ],
    },
  ];

  const filteredGuides = useMemo(() => {
    return guides.filter((g) => {
      const matchCat =
        selectedCategory === 'all' || g.category === selectedCategory;
      const matchSearch =
        searchQuery === '' ||
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.steps.some((s) => s.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchSearch;
    });
  }, [guides, selectedCategory, searchQuery]);

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal !max-w-3xl flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Staff Knowledge Base & SOP Manual
              </div>
              <h2 className="text-lg font-serif font-bold text-foreground">
                Help & Step-by-Step Operating Guides
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onStartTour();
              }}
              className="btn btn-soft text-xs flex items-center gap-1.5 cursor-pointer"
              title="Launch interactive screen walkthrough"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Interactive Tour</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="py-3 flex flex-col sm:flex-row gap-3 items-center justify-between border-b border-border flex-shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search guides (e.g. import, PIN, balance)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input !pl-10 !py-1.5 text-xs w-full"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: 'All Guides' },
              { id: 'admissions', label: 'Admissions' },
              { id: 'bursary', label: 'Finance' },
              { id: 'operations', label: 'Operations' },
              { id: 'administration', label: 'Admin & Security' },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion List of Step Guides */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
          {filteredGuides.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              No matching help guides found for "{searchQuery}".
            </div>
          ) : (
            filteredGuides.map((guide) => {
              const isExpanded = expandedGuideId === guide.id;
              return (
                <div
                  key={guide.id}
                  className={`border rounded-xl transition-all overflow-hidden ${
                    isExpanded
                      ? 'border-primary/40 bg-card shadow-xs'
                      : 'border-border bg-card/60 hover:border-border/80 hover:bg-card'
                  }`}
                >
                  {/* Accordion Header */}
                  <div
                    onClick={() => setExpandedGuideId(isExpanded ? null : guide.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold mt-0.5 ${
                          isExpanded
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {guide.category === 'admissions'
                          ? 'ADM'
                          : guide.category === 'bursary'
                          ? 'FIN'
                          : guide.category === 'operations'
                          ? 'OPS'
                          : 'SEC'}
                      </div>
                      <div>
                        <h4 className="font-semibold text-xs text-foreground flex items-center gap-2">
                          {guide.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {guide.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-primary" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Accordion Body */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-1 border-t border-border/60 bg-muted/10 space-y-3.5">
                      <div className="space-y-2 mt-2">
                        {guide.steps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>

                      {guide.tips && guide.tips.length > 0 && (
                        <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-xs space-y-1">
                          <div className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                            <Sparkles className="w-3 h-3 text-accent" />
                            <span>Pro-Tips</span>
                          </div>
                          {guide.tips.map((t, idx) => (
                            <p key={idx} className="text-muted-foreground text-[11px] leading-relaxed">
                              • {t}
                            </p>
                          ))}
                        </div>
                      )}

                      {guide.warning && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{guide.warning}</span>
                        </div>
                      )}

                      <div className="pt-2 flex items-center justify-between border-t border-border">
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Target Module: {guide.targetView}
                        </span>
                        {onNavigate && (
                          <button
                            onClick={() => {
                              onClose();
                              onNavigate(guide.targetView);
                            }}
                            className="btn btn-primary text-xs !py-1 !px-2.5 flex items-center gap-1 cursor-pointer"
                          >
                            <span>{guide.targetActionLabel}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Keyboard Shortcuts Reference */}
        <div className="pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border">⌘K</kbd>
              <span>Search</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border">Alt+E</kbd>
              <span>Enroll</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="mono text-[10px] px-1.5 py-0.5 rounded bg-muted border border-border">Alt+P</kbd>
              <span>Payment</span>
            </span>
          </div>

          <button onClick={onClose} className="btn btn-soft text-xs cursor-pointer">
            Close Guide
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
