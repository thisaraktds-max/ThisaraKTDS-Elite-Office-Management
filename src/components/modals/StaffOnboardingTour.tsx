import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  LayoutDashboard,
  GraduationCap,
  ClipboardCheck,
  Receipt,
  Scale,
  Vault,
  ShieldCheck,
  Minimize2,
  Maximize2,
  Package,
  FileSpreadsheet,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

interface StaffOnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
}

interface TourStep {
  id: string;
  view: string;
  tabLabel: string;
  title: string;
  description: string;
  keyFeatures: string[];
}

export const StaffOnboardingTour: React.FC<StaffOnboardingTourProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [step, setStep] = useState(0);
  const [isMinimized, setIsMinimized] = useState(false);

  const tourSteps: TourStep[] = [
    {
      id: 'dashboard',
      view: 'dashboard',
      tabLabel: 'Executive Dashboard',
      title: '1. Executive Dashboard & Daily Overview',
      description:
        'Your daily high-level command center. Check weekly money collected vs. operational expenses, monitor total outstanding student fees, and review the admissions pulse at a glance.',
      keyFeatures: [
        'Real-time weekly income vs. expense cash balance',
        'Active admissions stage breakdown',
        'Quick links to review new applications and office reminders',
      ],
    },
    {
      id: 'admissions',
      view: 'admissions',
      tabLabel: 'Admissions Funnel',
      title: '2. Admissions Funnel & Student Dossiers',
      description:
        'Track every prospective candidate from initial inquiry through enrollment. Use Kanban drag-and-drop or table view with sticky headers, bulk status updates, and auto-saving drafts.',
      keyFeatures: [
        'Switch between visual Kanban pipeline and searchable table view',
        'Click any candidate to open their complete Student Dossier',
        'Bulk-select candidates to change stage or export to CSV',
      ],
    },
    {
      id: 'assessments',
      view: 'assessments',
      tabLabel: 'Admissions Assessments',
      title: '3. Entrance Testing & Teacher Interviews',
      description:
        'Manage entrance exam schedules and interview scorecards. Log written test marks, oral English evaluation, and staff recommendations to determine admission acceptance.',
      keyFeatures: [
        'Filter assessments by status (Scheduled, Completed, Recommended)',
        'Directly input subject marks (English, Math, General Knowledge)',
        'Pass or admit candidates directly into official enrollment',
      ],
    },
    {
      id: 'balances',
      view: 'balances',
      tabLabel: 'Outstanding Balances',
      title: '4. Tuition Ledger & 30/60/90 Day Aging',
      description:
        'Real-time bursary tracking of all pending student fees. Categorized into current, 30-day, 60-day, and critical 90+ day delinquency buckets with one-click payment collection.',
      keyFeatures: [
        'One-click "Pay" button to immediately settle outstanding dues',
        'Send pre-formatted SMS / WhatsApp tuition payment notices',
        'Generate printable official Statements of Account (PDF format)',
      ],
    },
    {
      id: 'cashdrawer',
      view: 'cashdrawer',
      tabLabel: 'Daily Cash Drawer',
      title: '5. Front-Desk Cash Drawer & Shift Balancing',
      description:
        'End-of-day cash reconciliation for the front desk. Count physical cash denominations (5000, 1000, 500, etc.) against system receipts to verify zero variance before locking up.',
      keyFeatures: [
        'Track morning opening float and daytime cash receipts',
        'Interactive denomination counter for physical currency verification',
        'Audit log with staff signature stamps for cash handovers',
      ],
    },
    {
      id: 'assets',
      view: 'assets',
      tabLabel: 'Assets & Inventory',
      title: '6. School Asset & Fixed Equipment Register',
      description:
        'Maintain complete custody records of IT laptops, projectors, science lab apparatus, classroom desks, and sports gear with location tags and condition audits.',
      keyFeatures: [
        'Track serial numbers, purchase cost, and warranty dates',
        'Monitor equipment condition (New, Good, Fair, Damaged)',
        'One-click export of complete school asset registers to Excel',
      ],
    },
    {
      id: 'settings',
      view: 'settings',
      tabLabel: 'Staff Profiles & Security',
      title: '7. Shared Terminal Staff & PIN Security',
      description:
        'Switch active staff members effortlessly during shift rotations. Every transaction, receipt, and admission note is digitally signed with bcrypt-hashed PIN codes.',
      keyFeatures: [
        'Fast 4-digit PIN authentication (Default is 9999)',
        '460+ Student bulk CSV/Excel migration tool',
        'Instant SQLite database backups and JSON audit export',
      ],
    },
  ];

  // When step changes, automatically navigate the app to that tab!
  useEffect(() => {
    if (isOpen && tourSteps[step]) {
      onNavigate(tourSteps[step].view);
    }
  }, [step, isOpen]);

  // Keyboard navigation for interactive tour
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (step < tourSteps.length - 1) setStep(prev => prev + 1);
      } else if (e.key === 'ArrowLeft') {
        if (step > 0) setStep(prev => prev - 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step, tourSteps.length]);

  if (!isOpen) return null;

  const current = tourSteps[step];

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('elite_staff_tour_completed', 'true');
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed bottom-5 right-5 z-50 max-w-md w-[calc(100vw-40px)] shadow-2xl"
    >
      <div className="bg-card/95 border-2 border-primary/40 rounded-2xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
        {/* Subtle top indicator line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((step + 1) / tourSteps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border mt-1">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-xs shadow-xs">
              {step + 1}
            </span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>Interactive Live Tour</span>
              </div>
              <div className="text-xs font-semibold text-foreground">
                Active Tab: <strong className="text-primary font-bold">{current.tabLabel}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized((prev) => !prev)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={isMinimized ? 'Expand Guide' : 'Minimize Guide'}
            >
              {isMinimized ? (
                <Maximize2 className="w-3.5 h-3.5" />
              ) : (
                <Minimize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close Tour (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body (Animated with AnimatePresence) */}
        {!isMinimized && (
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <h4 className="font-serif font-bold text-sm text-foreground">
                {current.title}
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {current.description}
              </p>

              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 border border-border/50">
                <div className="text-[10.5px] font-mono uppercase text-muted-foreground font-semibold">
                  Key Live Highlights
                </div>
                {current.keyFeatures.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              {/* Interactive Step Navigator */}
              <div className="pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {tourSteps.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setStep(i)}
                      title={`Jump to ${s.tabLabel}`}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        i === step ? 'w-6 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {step > 0 && (
                    <button
                      onClick={handlePrev}
                      className="btn btn-soft text-xs py-1 px-2.5 flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}
                  <button
                    onClick={handleNext}
                    className="btn btn-primary text-xs py-1 px-3 flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>{step === tourSteps.length - 1 ? 'Finish Tour' : 'Next Tab'}</span>
                    {step < tourSteps.length - 1 ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
};
