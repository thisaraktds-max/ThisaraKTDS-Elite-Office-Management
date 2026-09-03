import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StaffProvider } from './context/StaffContext';
import { NotificationProvider, useNotification } from './context/NotificationContext';
import { AppShell } from './components/layout/AppShell';

// Views
import { DashboardView } from './views/DashboardView';
import { AdmissionsView } from './views/AdmissionsView';
import { ApplicantDossierView } from './views/ApplicantDossierView';
import { AssessmentsView } from './views/AssessmentsView';
import { FamiliesView } from './views/FamiliesView';
import { FeesIncomeView } from './views/FeesIncomeView';
import { BalancesView } from './views/BalancesView';
import { RemindersView } from './views/RemindersView';
import { CashFlowView } from './views/CashFlowView';
import { CashDrawerView } from './views/CashDrawerView';
import { AuditLogView } from './views/AuditLogView';
import { SettingsView } from './views/SettingsView';
import { ExportBackupView } from './views/ExportBackupView';
import { AssetsView } from './views/AssetsView';

// Modals
import { GlobalSearchModal } from './components/modals/GlobalSearchModal';
import { StaffSwitchModal } from './components/modals/StaffSwitchModal';
import { NewApplicantModal } from './components/modals/NewApplicantModal';
import { BulkImportModal } from './components/modals/BulkImportModal';
import { RecordIncomeModal } from './components/modals/RecordIncomeModal';
import { RecordExpenseModal } from './components/modals/RecordExpenseModal';
import { StatementOfAccountModal } from './components/modals/StatementOfAccountModal';
import { CommunicationsModal } from './components/modals/CommunicationsModal';
import { PrintReceiptModal } from './components/modals/PrintReceiptModal';
import { OfferLetterModal } from './components/modals/OfferLetterModal';
import { GuidedEnrollmentModal } from './components/modals/GuidedEnrollmentModal';
import { QuickPaymentModal } from './components/modals/QuickPaymentModal';
import { HelpReferenceModal } from './components/modals/HelpReferenceModal';
import { StaffOnboardingTour } from './components/modals/StaffOnboardingTour';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Application runtime error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
          <div className="max-w-md w-full p-6 rounded-2xl bg-card border border-border shadow-lg text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-serif font-bold">Application Error Encountered</h2>
            <p className="text-xs text-muted-foreground">
              {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="btn btn-primary text-xs w-full cursor-pointer"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppContent: React.FC = () => {
  const { showToast } = useNotification();

  // Navigation state
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [admissionsFilter, setAdmissionsFilter] = useState<string>('all');

  // Modals state
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [showNewApplicant, setShowNewApplicant] = useState(false);
  const [showGuidedEnroll, setShowGuidedEnroll] = useState(false);
  const [showQuickPayment, setShowQuickPayment] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showStaffTour, setShowStaffTour] = useState(false);

  const [showRecordIncome, setShowRecordIncome] = useState(false);
  const [incomePrefill, setIncomePrefill] = useState<{ applicantId?: string; amount?: number }>({});
  const [showRecordExpense, setShowRecordExpense] = useState(false);
  const [statementApplicantId, setStatementApplicantId] = useState<string | null>(null);
  const [offerApplicantId, setOfferApplicantId] = useState<string | null>(null);
  const [receiptModalId, setReceiptModalId] = useState<string | null>(null);
  const [communicationsData, setCommunicationsData] = useState<any | null>(null);

  // Global Keyboard Shortcuts (Cmd+K for search, Alt+E for enroll, Alt+P for payment)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowGlobalSearch((prev) => !prev);
      } else if (e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setShowGuidedEnroll(true);
      } else if (e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setShowQuickPayment(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (view: string, idOrFilter?: string) => {
    let normalized = view;
    if (view === 'fees_income') normalized = 'fees';
    if (view === 'cash_flow') normalized = 'cashflow';
    if (view === 'cash_drawer') normalized = 'cashdrawer';
    if (view === 'backup') normalized = 'export';
    if (view === 'applicant-dossier') normalized = 'dossier';

    if (normalized === 'admissions') {
      if (idOrFilter) {
        setAdmissionsFilter(idOrFilter);
      }
    }

    setCurrentView(normalized);
    if (normalized === 'dossier' && idOrFilter) {
      setSelectedApplicantId(idOrFilter);
    } else if (normalized !== 'dossier') {
      setSelectedApplicantId(null);
    }
  };

  const handleOpenDossier = (applicantId: string) => {
    setSelectedApplicantId(applicantId);
    setCurrentView('dossier');
  };

  const handleOpenRecordIncomeWithPrefill = (applicantId?: string, amount?: number) => {
    setIncomePrefill({ applicantId, amount });
    setShowRecordIncome(true);
  };

  const handleOpenStatement = (applicantId: string) => {
    setStatementApplicantId(applicantId);
  };

  const handleOpenOfferLetter = (applicantId: string) => {
    setOfferApplicantId(applicantId);
  };

  const handleOpenReceipt = (receiptId: string) => {
    setReceiptModalId(receiptId);
  };

  const handleOpenCommunications = (data: any) => {
    setCommunicationsData(data);
  };

  return (
    <AppShell
      currentView={currentView}
      onNavigate={handleNavigate}
      onOpenNewApplicant={() => setShowNewApplicant(true)}
      onOpenNewIncome={() => handleOpenRecordIncomeWithPrefill()}
      onOpenNewExpense={() => setShowRecordExpense(true)}
      onOpenGlobalSearch={() => setShowGlobalSearch(true)}
      onOpenGuidedEnroll={() => setShowGuidedEnroll(true)}
      onOpenQuickPayment={() => setShowQuickPayment(true)}
      onOpenHelp={() => setShowHelpModal(true)}
    >
      {/* Dynamic View Rendering with Smooth Motion Transitions */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView === 'dossier' ? `dossier-${selectedApplicantId}` : currentView}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="w-full"
        >
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onOpenNewApplicant={() => setShowNewApplicant(true)}
              onOpenNewIncome={() => handleOpenRecordIncomeWithPrefill()}
              onOpenNewExpense={() => setShowRecordExpense(true)}
            />
          )}

          {currentView === 'admissions' && (
            <AdmissionsView
              key={admissionsFilter}
              onOpenDossier={handleOpenDossier}
              onOpenNewApplicant={() => setShowNewApplicant(true)}
              onOpenBulkImport={() => setShowBulkImport(true)}
              initialStatusFilter={admissionsFilter}
            />
          )}

          {currentView === 'dossier' && (
            selectedApplicantId ? (
              <ApplicantDossierView
                applicantId={selectedApplicantId}
                onBack={() => handleNavigate('admissions')}
                onOpenStatementOfAccount={handleOpenStatement}
                onOpenOfferLetter={handleOpenOfferLetter}
                onOpenCommunications={handleOpenCommunications}
                onOpenRecordIncome={(appId, amount) => handleOpenRecordIncomeWithPrefill(appId, amount)}
                onNavigateToStudent={handleOpenDossier}
              />
            ) : (
              <div className="panel p-12 text-center space-y-3">
                <h3 className="text-base font-serif font-bold text-foreground">No Student Dossier Selected</h3>
                <p className="text-xs text-muted-foreground">Please select an applicant from the Admissions Pipeline or search by student name.</p>
                <button
                  onClick={() => handleNavigate('admissions')}
                  className="btn btn-primary text-xs"
                >
                  Go to Admissions Pipeline
                </button>
              </div>
            )
          )}

          {currentView === 'assessments' && (
            <AssessmentsView onOpenDossier={handleOpenDossier} />
          )}

          {currentView === 'families' && (
            <FamiliesView onOpenDossier={handleOpenDossier} />
          )}

          {(currentView === 'fees' || currentView === 'fees_income') && (
            <FeesIncomeView
              onOpenNewIncome={() => handleOpenRecordIncomeWithPrefill()}
              onOpenReceiptModal={handleOpenReceipt}
              onOpenDossier={handleOpenDossier}
            />
          )}

          {currentView === 'balances' && (
            <BalancesView
              onOpenDossier={handleOpenDossier}
              onOpenStatementOfAccount={handleOpenStatement}
              onOpenCommunications={handleOpenCommunications}
              onOpenRecordIncome={(appId, amount) => handleOpenRecordIncomeWithPrefill(appId, amount)}
            />
          )}

          {currentView === 'reminders' && (
            <RemindersView
              onOpenDossier={handleOpenDossier}
              onOpenCommunications={handleOpenCommunications}
              onOpenRecordIncome={(appId, amount) => handleOpenRecordIncomeWithPrefill(appId, amount)}
            />
          )}

          {(currentView === 'cashflow' || currentView === 'cash_flow') && (
            <CashFlowView onOpenNewExpense={() => setShowRecordExpense(true)} />
          )}

          {(currentView === 'cashdrawer' || currentView === 'cash_drawer') && (
            <CashDrawerView />
          )}

          {currentView === 'assets' && (
            <AssetsView />
          )}

          {currentView === 'audit' && (
            <AuditLogView />
          )}

          {currentView === 'settings' && (
            <SettingsView onOpenBulkImport={() => setShowBulkImport(true)} />
          )}

          {(currentView === 'export' || currentView === 'backup') && (
            <ExportBackupView />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Global Modals */}
      {showGlobalSearch && (
        <GlobalSearchModal
          isOpen={showGlobalSearch}
          onClose={() => setShowGlobalSearch(false)}
          onNavigate={handleNavigate}
          onOpenNewApplicant={() => setShowNewApplicant(true)}
          onOpenNewIncome={() => handleOpenRecordIncomeWithPrefill()}
          onOpenNewExpense={() => setShowRecordExpense(true)}
        />
      )}

      <StaffSwitchModal />

      {showBulkImport && (
        <BulkImportModal
          isOpen={showBulkImport}
          onClose={() => setShowBulkImport(false)}
          onSuccess={() => {
            setShowBulkImport(false);
            handleNavigate('admissions');
          }}
        />
      )}

      {showGuidedEnroll && (
        <GuidedEnrollmentModal
          isOpen={showGuidedEnroll}
          onClose={() => setShowGuidedEnroll(false)}
          onSuccess={(applicantId) => {
            setShowGuidedEnroll(false);
            handleOpenDossier(applicantId);
          }}
        />
      )}

      {showQuickPayment && (
        <QuickPaymentModal
          isOpen={showQuickPayment}
          onClose={() => setShowQuickPayment(false)}
          onOpenReceipt={(receiptId) => handleOpenReceipt(receiptId)}
        />
      )}

      {showHelpModal && (
        <HelpReferenceModal
          isOpen={showHelpModal}
          onClose={() => setShowHelpModal(false)}
          onStartTour={() => {
            setShowHelpModal(false);
            setShowStaffTour(true);
          }}
          onNavigate={(view) => handleNavigate(view)}
          onOpenGuidedEnroll={() => {
            setShowHelpModal(false);
            setShowGuidedEnroll(true);
          }}
          onOpenQuickPayment={() => {
            setShowHelpModal(false);
            setShowQuickPayment(true);
          }}
        />
      )}

      {showStaffTour && (
        <StaffOnboardingTour
          isOpen={showStaffTour}
          onClose={() => setShowStaffTour(false)}
          onNavigate={(view) => handleNavigate(view)}
        />
      )}

      {showNewApplicant && (
        <NewApplicantModal
          isOpen={showNewApplicant}
          onClose={() => setShowNewApplicant(false)}
          onSuccess={(newId) => {
            setShowNewApplicant(false);
            handleOpenDossier(newId);
          }}
        />
      )}

      {showRecordIncome && (
        <RecordIncomeModal
          isOpen={showRecordIncome}
          onClose={() => {
            setShowRecordIncome(false);
            setIncomePrefill({});
          }}
          preselectedApplicantId={incomePrefill.applicantId}
          prefilledAmount={incomePrefill.amount}
          onSuccess={(receiptId) => {
            setShowRecordIncome(false);
            setIncomePrefill({});
            if (receiptId) handleOpenReceipt(receiptId);
          }}
        />
      )}

      {showRecordExpense && (
        <RecordExpenseModal
          isOpen={showRecordExpense}
          onClose={() => setShowRecordExpense(false)}
          onSuccess={() => {
            setShowRecordExpense(false);
            showToast('Operating expense logged successfully', 'success');
          }}
        />
      )}

      {statementApplicantId && (
        <StatementOfAccountModal
          isOpen={!!statementApplicantId}
          applicantId={statementApplicantId}
          onClose={() => setStatementApplicantId(null)}
        />
      )}

      {offerApplicantId && (
        <OfferLetterModal
          isOpen={!!offerApplicantId}
          applicantId={offerApplicantId}
          onClose={() => setOfferApplicantId(null)}
        />
      )}

      {receiptModalId && (
        <PrintReceiptModal
          isOpen={!!receiptModalId}
          receiptId={receiptModalId}
          onClose={() => setReceiptModalId(null)}
        />
      )}

      {communicationsData && (
        <CommunicationsModal
          isOpen={!!communicationsData}
          onClose={() => setCommunicationsData(null)}
          recipient={communicationsData}
        />
      )}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <StaffProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </StaffProvider>
    </ErrorBoundary>
  );
}
