import React, { useState, useEffect } from 'react';
import { X, Printer, Receipt, CheckCircle } from 'lucide-react';
import { Income } from '../../types';

interface PrintReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptId: string;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptId,
}) => {
  const [receipt, setReceipt] = useState<Income | null>(null);
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && receiptId) {
      setIsLoading(true);
      Promise.all([
        fetch(`/api/income/${receiptId}`).then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
        .then(([receiptData, settingsData]) => {
          setReceipt(receiptData);
          setSettings(settingsData);
        })
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, receiptId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currency = settings.currency_symbol ? `${settings.currency_symbol} ` : 'LKR ';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-2xl !p-6" onClick={e => e.stopPropagation()}>
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border receipt-actions">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[hsl(162,30%,40%)]" />
            <span className="font-semibold text-sm">Official Bursar Payment Receipt</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn btn-primary flex items-center gap-2 text-xs">
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading || !receipt ? (
          <div className="p-8 text-center text-muted-foreground">Loading receipt details...</div>
        ) : (
          <div className="receipt-print bg-card border-2 border-primary/20 p-6 rounded-xl shadow-sm space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-lg border border-border/80 p-0.5 bg-muted/40 flex items-center justify-center flex-shrink-0">
                  <img
                    src="/school-logo.png"
                    alt="School Logo"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h2 className="font-serif font-bold text-lg text-primary">{settings.school_name || 'Elite International School'}</h2>
                  <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">Office of the Bursar • Matara</p>
                  <p className="text-[10px] text-muted-foreground">{settings.address || '1/143, Akuressa Road, Matara, Sri Lanka'} • {settings.email || 'office@eis.lk'} • {settings.phone || '+94 70 699 9333'}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="mono font-bold text-sm text-foreground">{receipt.receipt_no}</div>
                <div className="text-xs text-muted-foreground">Date: {receipt.date}</div>
              </div>
            </div>

            {/* Receipt Body */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="eyebrow mb-1">Received From (Payer)</div>
                <div className="font-bold text-foreground text-sm">{receipt.payer_name}</div>
                {receipt.student_first_name && (
                  <div className="text-muted-foreground mt-1">
                    Student: <span className="font-semibold text-foreground">{receipt.student_first_name} {receipt.student_last_name}</span> ({receipt.application_no})
                  </div>
                )}
              </div>

              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="eyebrow mb-1">Payment Method & Reference</div>
                <div className="font-bold text-foreground text-sm">{receipt.payment_method}</div>
                <div className="text-muted-foreground mt-1">
                  Ref: <span className="mono font-medium text-foreground">{receipt.reference_no || 'OFFICE-REC'}</span>
                </div>
              </div>
            </div>

            {/* Amount Banner */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="eyebrow block">Classification / Fee Category</span>
                <span className="font-bold text-foreground text-sm">{receipt.source}</span>
                {receipt.notes && <p className="text-xs text-muted-foreground mt-0.5">{receipt.notes}</p>}
              </div>
              <div className="text-right">
                <span className="eyebrow block">Amount Received</span>
                <span className="mono font-bold text-2xl text-[hsl(162,30%,35%)]">
                  {currency}{Number(receipt.amount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Signatures & Footer notice */}
            <div className="pt-4 border-t border-border flex items-end justify-between text-[11px] text-muted-foreground">
              <div>
                <div className="flex items-center gap-1.5 text-foreground font-medium mb-1">
                  <CheckCircle className="w-3.5 h-3.5 text-[hsl(162,30%,40%)]" />
                  Received & Processed By: <span className="font-bold">{receipt.received_by_staff_name || 'Accounts Staff'}</span>
                </div>
                <p className="italic max-w-sm">
                  {settings.receipt_footer_notice || 'Thank you for your prompt remittance. Fees once paid are non-refundable.'}
                </p>
              </div>

              <div className="text-right">
                <div className="w-32 border-b border-foreground/40 mb-1 ml-auto"></div>
                <span className="font-mono text-[10px]">Official Stamp / Signature</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
