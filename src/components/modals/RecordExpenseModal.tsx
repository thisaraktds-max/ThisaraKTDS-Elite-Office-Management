import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { X, CreditCard, Receipt, Building2 } from 'lucide-react';

interface RecordExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RecordExpenseModal: React.FC<RecordExpenseModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().substring(0, 10),
    amount: '',
    category: 'Supplies',
    paid_to: '',
    payment_method: 'Bank Transfer',
    reference_no: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount === '' || !formData.paid_to.trim()) {
      showToast('Please provide an amount and payee name.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Expense of LKR ${Number(formData.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} recorded to ${formData.paid_to}`, 'success');
        onSuccess();
        onClose();
      } else {
        showToast(data.error || 'Failed to record expense', 'error');
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
      <div
        className="modal !max-w-xl text-left"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase font-semibold">
                BURSARY & DISBURSEMENTS
              </div>
              <h3 className="text-lg font-serif font-bold text-foreground">
                Record Office Expense
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Expense Date *
              </label>
              <input
                type="date"
                required
                className="input !h-10 bg-background"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Amount (LKR) *
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                className="input !h-10 font-mono font-bold text-base bg-background text-foreground"
                placeholder="0.00"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Budget Category *
              </label>
              <select
                className="select !h-10 bg-background"
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as any })}
              >
                <option value="Supplies">Stationery & Office Supplies</option>
                <option value="Utilities">Campus Utilities (Power/Water/Net)</option>
                <option value="Maintenance">Grounds & Facility Maintenance</option>
                <option value="Educational Materials">Textbooks & Academic Consumables</option>
                <option value="Payroll">Faculty & Staff Payroll</option>
                <option value="Other">Other Operational Expenses</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Payment Method *
              </label>
              <select
                className="select !h-10 bg-background"
                value={formData.payment_method}
                onChange={e => setFormData({ ...formData, payment_method: e.target.value as any })}
              >
                <option value="Bank Transfer">Bank Transfer (Direct Debit / ACH)</option>
                <option value="Cash">Cash (Office Float Outflow)</option>
                <option value="Card">Corporate Credit Card</option>
                <option value="Cheque">School Cheque</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Paid To / Vendor *
              </label>
              <input
                type="text"
                required
                className="input !h-10 bg-background"
                placeholder="e.g. Apex Facilities / OfficeMax"
                value={formData.paid_to}
                onChange={e => setFormData({ ...formData, paid_to: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Invoice / Ref #
              </label>
              <input
                type="text"
                className="input !h-10 bg-background"
                placeholder="e.g. INV-9902"
                value={formData.reference_no}
                onChange={e => setFormData({ ...formData, reference_no: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Expense Justification / Description
            </label>
            <textarea
              className="textarea !h-20 bg-background text-xs leading-relaxed"
              placeholder="e.g. Approved by Head of Operations for annual laboratory calibration..."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary text-xs px-5 py-2 flex items-center gap-1.5 shadow-xs"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording...' : 'Save Expense Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
