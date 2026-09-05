import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { Applicant } from '../../types';
import { X, Receipt, CheckCircle } from 'lucide-react';

interface RecordIncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (receiptId?: string) => void;
  preselectedApplicantId?: string;
  prefilledAmount?: number;
}

export const RecordIncomeModal: React.FC<RecordIncomeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedApplicantId,
  prefilledAmount,
}) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().substring(0, 10),
    amount: prefilledAmount ? String(prefilledAmount) : '',
    source: 'Tuition',
    payment_method: 'Bank Transfer',
    payer_name: '',
    applicant_id: preselectedApplicantId || '',
    reference_no: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      fetch('/api/applicants')
        .then(res => res.json())
        .then(data => {
          setApplicants(data.applicants || []);
          if (preselectedApplicantId) {
            const app = (data.applicants || []).find((a: Applicant) => a.id === preselectedApplicantId);
            if (app) {
              setFormData(prev => ({
                ...prev,
                applicant_id: app.id,
                payer_name: prev.payer_name || app.guardian_name,
                amount: prefilledAmount ? String(prefilledAmount) : prev.amount,
              }));
            }
          }
        })
        .catch(err => console.error(err));
    }
  }, [isOpen, preselectedApplicantId, prefilledAmount]);

  const handleStudentSelect = (studentId: string) => {
    const student = applicants.find(a => a.id === studentId);
    if (student) {
      setFormData(prev => ({
        ...prev,
        applicant_id: studentId,
        payer_name: student.guardian_name || `${student.first_name} ${student.last_name}`,
      }));
    } else {
      setFormData(prev => ({ ...prev, applicant_id: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount === '' || !formData.payer_name.trim()) {
      showToast('Please provide an amount and payer name.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/income', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Payment of LKR ${Number(formData.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} recorded successfully (${data.receipt_no})`, 'success');
        onSuccess(data.id);
        onClose();
      } else {
        showToast(data.error || 'Failed to record payment', 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bursary & Financial Ledger</div>
              <h3 className="text-xl font-serif font-bold text-foreground">Record Income / Payment</h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Payment Date *</label>
              <input
                type="date"
                required
                className="input"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Amount Received (LKR) *</label>
              <input
                type="number"
                step="1"
                min="1"
                required
                className="input font-mono font-bold text-base"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Income Category / Source *</label>
              <select
                className="select"
                value={formData.source}
                onChange={e => setFormData({ ...formData, source: e.target.value })}
              >
                <option value="Tuition">Tuition Fee</option>
                <option value="Registration">Registration Fee</option>
                <option value="Exam Fee">Exam Fee</option>
                <option value="Uniform">Uniform & Sports Kit</option>
                <option value="Donation">Endowment / Donation</option>
                <option value="Grant">Grant / Sponsorship</option>
                <option value="Other">Other Miscellaneous</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Payment Method *</label>
              <select
                className="select"
                value={formData.payment_method}
                onChange={e => setFormData({ ...formData, payment_method: e.target.value as any })}
              >
                <option value="Bank Transfer">Bank Transfer (Wire / ACH)</option>
                <option value="Cash">Cash (Office Drawer)</option>
                <option value="Card">Credit / Debit Card</option>
                <option value="Cheque">Banker's Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Linked Student / Applicant</label>
            <select
              className="select"
              value={formData.applicant_id}
              onChange={e => handleStudentSelect(e.target.value)}
            >
              <option value="">-- Non-student / General Income --</option>
              {applicants.map(a => (
                <option key={a.id} value={a.id}>
                  {a.first_name} {a.last_name} ({a.application_no} • {a.grade_applying})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Payer Name / Remitter *</label>
              <input
                type="text"
                required
                className="input"
                placeholder="e.g. Julian Montgomery"
                value={formData.payer_name}
                onChange={e => setFormData({ ...formData, payer_name: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Reference / Transaction #</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. WIRE-8819 / AUTH-4901"
                value={formData.reference_no}
                onChange={e => setFormData({ ...formData, reference_no: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Internal Ledger Notes</label>
            <textarea
              className="textarea !h-16"
              placeholder="e.g. Term 1 installment payment, partial clearance..."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {isSubmitting ? 'Recording...' : 'Generate Receipt & Record Income'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
