import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { Applicant } from '../../types';
import { soundManager } from '../common/AudioFeedback';
import {
  X,
  Zap,
  Search,
  Receipt,
  Printer,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Building2,
  Banknote,
  Calendar,
  User,
  ArrowRight,
} from 'lucide-react';

interface QuickPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenReceipt: (receiptId: string) => void;
}

export const QuickPaymentModal: React.FC<QuickPaymentModalProps> = ({
  isOpen,
  onClose,
  onOpenReceipt,
}) => {
  const { getHeaders, activeStaff } = useStaff();
  const { showToast } = useNotification();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Applicant[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Applicant | null>(null);
  const [financials, setFinancials] = useState<any | null>(null);
  const [isLoadingFinancials, setIsLoadingFinancials] = useState(false);

  // Payment Form
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>(() => {
    return localStorage.getItem('elite_last_payment_method') || 'Cash';
  });
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [payerName, setPayerName] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Result Card State
  const [completedPayment, setCompletedPayment] = useState<{
    receiptId: string;
    receiptNo: string;
    paidAmount: number;
    prevBalance: number;
    newBalance: number;
  } | null>(null);

  // Anomaly warning modal trigger
  const [showAnomalyWarning, setShowAnomalyWarning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedStudent(null);
      setFinancials(null);
      setAmount('');
      setCompletedPayment(null);
      setShowAnomalyWarning(false);
    }
  }, [isOpen]);

  // Live Student Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/applicants?search=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.applicants || []);
        }
      } catch (e) {
        console.error(e);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Financials when student selected
  const handleSelectStudent = async (student: Applicant) => {
    setSelectedStudent(student);
    setPayerName(student.guardian_name || `${student.first_name} ${student.last_name}`);
    setIsLoadingFinancials(true);
    try {
      const res = await fetch(`/api/applicants/${student.id}`);
      if (res.ok) {
        const data = await res.json();
        setFinancials(data.financials);
        // Default amount to outstanding balance
        if (data.financials && data.financials.balanceDue > 0) {
          setAmount(String(data.financials.balanceDue));
        } else {
          setAmount('15000');
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFinancials(false);
    }
  };

  const executePaymentSubmit = async () => {
    if (!selectedStudent || !amount || Number(amount) <= 0 || !payerName.trim()) {
      showToast('Please provide a valid amount and payer name.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save last payment method in localStorage
      localStorage.setItem('elite_last_payment_method', paymentMethod);

      const res = await fetch('/api/income', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          date,
          amount: Number(amount),
          source: 'Tuition',
          payment_method: paymentMethod,
          payer_name: payerName,
          applicant_id: selectedStudent.id,
          reference_no: referenceNo,
          notes: notes || 'Walk-in payment recorded via Quick Terminal',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to record transaction');
      }

      // Play soft tactile success chime
      soundManager.playSuccessChime();

      const prevBal = financials?.balanceDue || 0;
      const newBal = Math.max(0, prevBal - Number(amount));

      setCompletedPayment({
        receiptId: data.id,
        receiptNo: data.receipt_no,
        paidAmount: Number(amount),
        prevBalance: prevBal,
        newBalance: newBal,
      });

      showToast(
        `Receipt ${data.receipt_no} generated! Updated Balance: LKR ${newBal.toLocaleString('en-US')}`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Error processing payment', 'error');
    } finally {
      setIsSubmitting(false);
      setShowAnomalyWarning(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    // Anomaly Warning: If amount > 250,000 or greater than 2x balance
    if (numAmount > 250000 || (financials && numAmount > financials.balanceDue * 2 && financials.balanceDue > 0)) {
      setShowAnomalyWarning(true);
      return;
    }
    executePaymentSubmit();
  };

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-primary">
                Task-Oriented Workflow
              </div>
              <h3 className="font-serif font-bold text-lg text-foreground">
                Walk-In Parent Payment Terminal
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* If payment just completed -> Show Impact Balance Card */}
        {completedPayment ? (
          <div className="space-y-5 animate-fade py-2 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto text-2xl">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h4 className="font-serif font-bold text-xl text-foreground">
                Payment Credited Successfully
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Official School Receipt <span className="font-mono font-bold text-foreground">{completedPayment.receiptNo}</span> has been logged.
              </p>
            </div>

            {/* Impact Balance Box */}
            <div className="p-4 rounded-xl bg-card border border-border max-w-md mx-auto text-left space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Amount Paid Now:</span>
                <span className="font-mono font-bold text-foreground">
                  LKR {completedPayment.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Previous Balance:</span>
                <span className="font-mono text-muted-foreground">
                  LKR {completedPayment.prevBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-primary block">
                    Updated Remaining Balance:
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {completedPayment.newBalance === 0 ? 'Fully Cleared! All dues paid.' : 'Pending future installments'}
                  </span>
                </div>
                <span className="font-mono font-bold text-lg text-primary">
                  LKR {completedPayment.newBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  onOpenReceipt(completedPayment.receiptId);
                  onClose();
                }}
                className="btn btn-primary text-xs !h-9 px-4 rounded-lg inline-flex items-center justify-center gap-2 whitespace-nowrap leading-none shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span className="leading-none">Print Official Receipt</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost text-xs !h-9 px-4 rounded-lg inline-flex items-center justify-center whitespace-nowrap leading-none cursor-pointer"
              >
                Close Terminal
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Step 1: Find Student */}
            {!selectedStudent ? (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-foreground">
                  1. Search Student (Type Student Name, App No, or Guardian Phone)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    className="input !pl-10 !h-10 text-sm"
                    placeholder="Search e.g. Liam, APP-2026-0104, 077..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Results list */}
                {searchResults.length > 0 ? (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 border border-border rounded-xl p-1 bg-card">
                    {searchResults.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectStudent(s)}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-primary/5 hover:border-primary border border-transparent cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center font-bold text-xs font-mono">
                            {s.first_name[0]}{s.last_name[0]}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-foreground flex items-center gap-2">
                              {s.first_name} {s.last_name}
                              <span className="font-mono text-[10px] text-muted-foreground">({s.application_no})</span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {s.grade_applying} • Parent: {s.guardian_name} ({s.guardian_phone})
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-transform group-hover:translate-x-0.5" />
                      </div>
                    ))}
                  </div>
                ) : searchQuery.trim() ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No matching students found.</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground/80 text-center py-2">
                    Enter student name or application number to pull live fee balances instantly.
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Selected Student Card & Live Balance */}
                <div className="p-3.5 rounded-xl bg-card border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs font-mono">
                      {selectedStudent.first_name[0]}{selectedStudent.last_name[0]}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {selectedStudent.first_name} {selectedStudent.last_name}
                        <span className="font-mono font-normal text-muted-foreground ml-2">
                          ({selectedStudent.application_no})
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {selectedStudent.grade_applying} • Guardian: {selectedStudent.guardian_name}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setFinancials(null);
                    }}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    Change Student
                  </button>
                </div>

                {/* Live Balance Summary Snapshot */}
                {isLoadingFinancials ? (
                  <div className="p-3 bg-muted/40 rounded-xl text-center text-xs text-muted-foreground">
                    Calculating live ledger balance...
                  </div>
                ) : financials ? (
                  <div className="grid grid-cols-3 gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                        Net Expected
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        LKR {financials.expectedNet?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-muted-foreground block">
                        Already Paid
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        LKR {financials.paidTotal?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono text-primary font-semibold block">
                        Balance Due
                      </span>
                      <span className="font-mono font-bold text-base text-primary">
                        LKR {financials.balanceDue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Payment Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Payment Amount (LKR) <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      className="input font-mono font-bold text-base"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    {financials && financials.balanceDue > 0 && (
                      <div className="flex gap-2 mt-1.5">
                        <button
                          type="button"
                          onClick={() => setAmount(String(financials.balanceDue))}
                          className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-mono"
                        >
                          Full (LKR {financials.balanceDue.toLocaleString('en-US')})
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmount(String(Math.round(financials.balanceDue / 2)))}
                          className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground font-mono"
                        >
                          50% (LKR {Math.round(financials.balanceDue / 2).toLocaleString('en-US')})
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Payment Method
                    </label>
                    <select
                      className="select font-medium"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                      <option value="Cash">Cash (Counter Tender)</option>
                      <option value="Bank Transfer">Bank Transfer / Online</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="Cheque">Cheque Deposit</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Payer / Depositor Name <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="input"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Payment Date
                    </label>
                    <input
                      type="date"
                      required
                      className="input"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Bank Ref / Cheque No. (Optional)
                    </label>
                    <input
                      type="text"
                      className="input font-mono"
                      placeholder="e.g. TXN-893021"
                      value={referenceNo}
                      onChange={(e) => setReferenceNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Notes / Remarks
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. Term 1 installment paid in cash"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-ghost text-xs py-2 px-3.5 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{isSubmitting ? 'Recording...' : 'Credit Payment & Issue Receipt'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Anomaly Confirmation Sub-Modal */}
        {showAnomalyWarning && (
          <div className="modal-backdrop" onClick={() => setShowAnomalyWarning(false)}>
            <div className="modal !max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <span>Unusually High Amount Warning</span>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed">
                You are about to record a payment of{' '}
                <strong className="font-mono text-foreground font-bold">
                  LKR {Number(amount).toLocaleString('en-US')}
                </strong>{' '}
                for {selectedStudent?.first_name} {selectedStudent?.last_name}.
              </p>
              <p className="text-[11px] text-muted-foreground">
                Please double-check the figures to prevent typographical errors.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAnomalyWarning(false)}
                  className="btn btn-ghost text-xs py-1.5 px-3 rounded-lg"
                >
                  Edit Amount
                </button>
                <button
                  type="button"
                  onClick={executePaymentSubmit}
                  className="btn btn-primary text-xs py-1.5 px-3.5 rounded-lg"
                >
                  Confirm & Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
