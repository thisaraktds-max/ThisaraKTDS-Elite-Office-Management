import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { X, Printer, Receipt, CheckCircle, Smartphone } from 'lucide-react';
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
  const [previewThermal, setPreviewThermal] = useState(false);

  useEffect(() => {
    if (isOpen && receiptId) {
      setIsLoading(true);
      Promise.all([
        fetch(`/api/income/${receiptId}`).then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
        .then(([receiptData, settingsData]) => {
          setReceipt(receiptData);
          setSettings(settingsData || {});
        })
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, receiptId]);

  useLockBodyScroll(isOpen && !!receiptId);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const currency = settings.currency_symbol ? `${settings.currency_symbol} ` : 'LKR ';

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      {/* Scoped CSS for 80mm Thermal Receipt Printing */}
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          .receipt-print-thermal,
          .receipt-print-thermal * {
            visibility: visible !important;
          }
          .receipt-print-thermal {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 72mm !important;
            padding: 2mm !important;
            font-size: 10px !important;
            line-height: 1.35 !important;
            color: #000 !important;
            background: #fff !important;
            box-sizing: border-box !important;
            border: none !important;
            box-shadow: none !important;
          }
          .receipt-print-screen {
            display: none !important;
          }
          .receipt-actions {
            display: none !important;
          }
        }
      `}</style>

      <div className="modal !max-w-2xl !p-6" onClick={e => e.stopPropagation()}>
        {/* Actions bar */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-border receipt-actions">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Receipt className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-serif font-bold text-sm text-foreground truncate">Payment Receipt</h3>
                <span className="text-[10px] font-mono bg-muted/80 text-muted-foreground px-2 py-0.5 rounded-full border border-border/80 whitespace-nowrap shrink-0">
                  80mm Thermal
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPreviewThermal(!previewThermal)}
              className="btn btn-soft !h-8 !px-3 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium whitespace-nowrap leading-none transition-all shadow-2xs"
              title="Toggle between standard view and 80mm thermal receipt preview"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span>{previewThermal ? 'Standard View' : 'Thermal Preview'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary !h-8 !px-3.5 inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-semibold whitespace-nowrap leading-none transition-all shadow-xs"
              title="Print receipt"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost !h-8 !w-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Close"
              aria-label="Close"
            >
              <X className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>

        {isLoading || !receipt ? (
          <div className="p-8 text-center text-muted-foreground">Loading receipt details...</div>
        ) : (
          <>
            {/* 1. ON-SCREEN VISUALLY RICH VIEW (Standard App Design System) */}
            <div className={`receipt-print-screen ${previewThermal ? 'hidden' : 'block'} bg-card border-2 border-primary/20 p-6 rounded-xl shadow-sm space-y-4`}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  {settings.school_logo_url ? (
                    <div className="w-11 h-11 rounded-lg border border-border/80 p-0.5 bg-muted/40 flex items-center justify-center flex-shrink-0">
                      <img
                        src={settings.school_logo_url}
                        alt={settings.school_name || 'School Logo'}
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ) : null}
                  <div>
                    <h2 className="font-serif font-bold text-lg text-primary">{settings.school_name || 'Elite International School'}</h2>
                    <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">Office of the Bursar</p>
                    <p className="text-[10px] text-muted-foreground">{settings.address || '[School Address Not Set]'} • {settings.email || '[Email Not Set]'} • {settings.phone || '[Phone Not Set]'}</p>
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

              <div className="text-[10px] text-muted-foreground text-center pt-2 font-mono">
                ⚡ Output automatically formats for 80mm thermal paper (72mm printable) upon printing.
              </div>
            </div>

            {/* 2. ON-SCREEN THERMAL PREVIEW (Visible when toggled on screen for staff verification) */}
            {previewThermal && (
              <div className="p-4 bg-muted/30 rounded-xl border border-border flex flex-col items-center">
                <div className="text-xs text-muted-foreground mb-3 font-mono">
                  80mm POS Thermal Paper Preview (Monochrome / Single-Column / 72mm Width)
                </div>
                <div className="w-[72mm] bg-white text-black p-[3mm] rounded shadow-md border border-neutral-300 font-sans text-[10px] leading-snug">
                  {/* Thermal Header with Logo / Fallback */}
                  <div className="text-center mb-2">
                    {settings.school_logo_url ? (
                      <div className="flex justify-center mb-1.5">
                        <img
                          src={settings.school_logo_url}
                          alt={settings.school_name || 'School Logo'}
                          className="w-[32mm] max-h-[18mm] object-contain mx-auto"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ) : null}
                    <div className="font-bold text-[11px] uppercase tracking-wide">
                      {settings.school_name || 'Elite International School'}
                    </div>
                    <div className="font-mono text-[9px] uppercase tracking-wider mt-0.5">
                      Office of the Bursar
                    </div>
                    <div className="text-[8px] leading-tight text-neutral-700 mt-1">
                      {settings.address || '[School Address Not Set]'}
                    </div>
                    <div className="text-[8px] leading-tight text-neutral-700">
                      {settings.email || '[Email Not Set]'} • Tel: {settings.phone || '[Phone Not Set]'}
                    </div>
                  </div>

                  <div className="border-t border-black border-dashed my-2" />

                  <div className="flex justify-between text-[9px] font-mono font-bold">
                    <span>RECEIPT NO:</span>
                    <span>{receipt.receipt_no}</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>DATE:</span>
                    <span>{receipt.date}</span>
                  </div>

                  <div className="border-t border-black border-dashed my-2" />

                  <div className="space-y-1.5 text-[9px]">
                    <div>
                      <span className="font-bold">RECEIVED FROM:</span>
                      <div className="font-medium">{receipt.payer_name}</div>
                    </div>

                    {receipt.student_first_name && (
                      <div>
                        <span className="font-bold">STUDENT:</span>
                        <div>{receipt.student_first_name} {receipt.student_last_name} ({receipt.application_no})</div>
                      </div>
                    )}

                    <div>
                      <span className="font-bold">PAYMENT METHOD:</span>
                      <div>{receipt.payment_method}</div>
                    </div>

                    <div>
                      <span className="font-bold">REFERENCE NO:</span>
                      <div className="font-mono">{receipt.reference_no || 'OFFICE-REC'}</div>
                    </div>

                    <div>
                      <span className="font-bold">FEE CATEGORY:</span>
                      <div>{receipt.source}</div>
                    </div>

                    {receipt.notes && (
                      <div>
                        <span className="font-bold">NOTES:</span>
                        <div>{receipt.notes}</div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-black border-dashed my-2" />

                  <div className="py-1.5 text-center border-y border-black border-double my-2">
                    <div className="text-[9px] font-bold uppercase tracking-wider">AMOUNT RECEIVED</div>
                    <div className="text-sm font-bold font-mono tracking-tight mt-0.5">
                      {currency}{Number(receipt.amount).toFixed(2)}
                    </div>
                  </div>

                  <div className="mt-2 text-[9px]">
                    <div className="font-bold">RECEIVED & PROCESSED BY:</div>
                    <div>{receipt.received_by_staff_name || 'Accounts Staff'}</div>
                  </div>

                  {/* Cashier Signature & Official Stamp Line */}
                  <div className="mt-4 pt-3 border-t border-neutral-300 flex flex-col items-center text-center">
                    <div className="w-[45mm] border-b border-black mb-1"></div>
                    <span className="text-[8px] uppercase tracking-wider font-mono">Cashier Signature</span>
                  </div>

                  {/* 30mm x 25mm Official Seal Stamp Placeholder Box */}
                  <div className="mt-3 flex justify-center">
                    <div className="w-[30mm] h-[25mm] border border-dashed border-neutral-400 flex items-center justify-center text-[8px] font-mono uppercase text-neutral-400 text-center px-1">
                      Official Seal
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-black border-dashed text-[8px] italic leading-tight text-center">
                    {settings.receipt_footer_notice || 'Thank you for your prompt remittance. Fees once paid are non-refundable.'}
                  </div>
                </div>
              </div>
            )}

            {/* 3. DEDICATED THERMAL PRINT CONTAINER (Rendered purely when window.print() executes) */}
            <div className="receipt-print-thermal hidden print:block">
              {/* Header with Logo / Fallback */}
              <div style={{ textAlign: 'center', marginBottom: '4px' }}>
                {settings.school_logo_url ? (
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
                    <img
                      src={settings.school_logo_url}
                      alt={settings.school_name || 'School Logo'}
                      style={{ width: '32mm', maxHeight: '18mm', objectFit: 'contain', margin: '0 auto' }}
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : null}
                <div style={{ fontWeight: 'bold', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {settings.school_name || 'Elite International School'}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', textTransform: 'uppercase', marginTop: '2px' }}>
                  Office of the Bursar
                </div>
                <div style={{ fontSize: '8px', lineHeight: '1.2', marginTop: '3px' }}>
                  {settings.address || '[School Address Not Set]'}
                </div>
                <div style={{ fontSize: '8px', lineHeight: '1.2' }}>
                  {settings.email || '[Email Not Set]'} • Tel: {settings.phone || '[Phone Not Set]'}
                </div>
              </div>

              <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* Receipt metadata */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                <span>RECEIPT NO:</span>
                <span>{receipt.receipt_no}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                <span>DATE:</span>
                <span>{receipt.date}</span>
              </div>

              <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* Stacked Single-Column Details */}
              <div style={{ fontSize: '9px', lineHeight: '1.35' }}>
                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontWeight: 'bold' }}>RECEIVED FROM:</div>
                  <div>{receipt.payer_name}</div>
                </div>

                {receipt.student_first_name && (
                  <div style={{ marginBottom: '4px' }}>
                    <div style={{ fontWeight: 'bold' }}>STUDENT:</div>
                    <div>{receipt.student_first_name} {receipt.student_last_name} ({receipt.application_no})</div>
                  </div>
                )}

                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontWeight: 'bold' }}>PAYMENT METHOD:</div>
                  <div>{receipt.payment_method}</div>
                </div>

                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontWeight: 'bold' }}>REFERENCE NO:</div>
                  <div style={{ fontFamily: 'monospace' }}>{receipt.reference_no || 'OFFICE-REC'}</div>
                </div>

                <div style={{ marginBottom: '4px' }}>
                  <div style={{ fontWeight: 'bold' }}>FEE CATEGORY:</div>
                  <div>{receipt.source}</div>
                </div>

                {receipt.notes && (
                  <div style={{ marginBottom: '4px' }}>
                    <div style={{ fontWeight: 'bold' }}>NOTES:</div>
                    <div>{receipt.notes}</div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

              {/* Amount - Large/Bold, Monochrome, No colored background */}
              <div style={{ textAlign: 'center', padding: '6px 0', borderTop: '1px solid #000', borderBottom: '1px solid #000', margin: '6px 0' }}>
                <div style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  AMOUNT RECEIVED
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', marginTop: '2px' }}>
                  {currency}{Number(receipt.amount).toFixed(2)}
                </div>
              </div>

              {/* Processed by staff name line */}
              <div style={{ fontSize: '9px', marginTop: '6px' }}>
                <div style={{ fontWeight: 'bold' }}>RECEIVED & PROCESSED BY:</div>
                <div>{receipt.received_by_staff_name || 'Accounts Staff'}</div>
              </div>

              {/* Cashier Signature Line */}
              <div style={{ marginTop: '14px', paddingTop: '8px', textAlign: 'center' }}>
                <div style={{ width: '45mm', borderBottom: '1px solid #000', margin: '0 auto 4px auto' }} />
                <span style={{ fontSize: '8px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Cashier Signature
                </span>
              </div>

              {/* 30mm x 25mm Official Seal Stamp Placeholder Box */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                <div
                  style={{
                    width: '30mm',
                    height: '25mm',
                    border: '1px dashed #999',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '8px',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    color: '#999',
                    boxSizing: 'border-box',
                  }}
                >
                  Official Seal
                </div>
              </div>

              {/* Receipt footer notice */}
              <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '6px', fontSize: '8px', fontStyle: 'italic', textAlign: 'center', lineHeight: '1.2' }}>
                {settings.receipt_footer_notice || 'Thank you for your prompt remittance. Fees once paid are non-refundable.'}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
