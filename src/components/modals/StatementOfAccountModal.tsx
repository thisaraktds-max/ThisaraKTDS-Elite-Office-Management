import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { X, Printer, Download, FileText } from 'lucide-react';
import { Applicant } from '../../types';

interface StatementOfAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicantId: string;
}

export const StatementOfAccountModal: React.FC<StatementOfAccountModalProps> = ({
  isOpen,
  onClose,
  applicantId,
}) => {
  const [dossier, setDossier] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && applicantId) {
      setIsLoading(true);
      Promise.all([
        fetch(`/api/applicants/${applicantId}`).then(r => r.json()),
        fetch('/api/settings').then(r => r.json()),
      ])
        .then(([dossierData, settingsData]) => {
          setDossier(dossierData);
          setSettings(settingsData);
        })
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, applicantId]);

  useLockBodyScroll(isOpen && !!applicantId);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const app = dossier?.applicant;
  const fin = dossier?.financials;
  const currency = settings.currency_symbol ? `${settings.currency_symbol} ` : 'LKR ';

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm 15mm;
        }
      `}</style>
      <div className="modal !max-w-4xl !p-6" onClick={e => e.stopPropagation()}>
        {/* Top actions bar */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-border receipt-actions">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm">Official Statement of Account</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="btn btn-primary !h-8 !px-3.5 inline-flex items-center justify-center gap-1.5 text-xs font-semibold whitespace-nowrap leading-none rounded-lg shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 shrink-0" />
              <span className="inline-block leading-none">Print / Save PDF</span>
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

        {isLoading || !app ? (
          <div className="p-12 text-center text-muted-foreground">Generating statement of account...</div>
        ) : (
          <div className="receipt-print font-sans text-foreground bg-card p-8 border border-border rounded-xl shadow-sm">
            {/* Header with crest */}
            <div className="flex items-start justify-between border-b-2 border-primary/20 pb-6 mb-6">
              <div className="flex items-center gap-4">
                {settings.school_logo_url ? (
                  <div className="w-14 h-14 rounded-xl border border-border/80 p-1 bg-muted/40 flex items-center justify-center flex-shrink-0 shadow-2xs">
                    <img
                      src={settings.school_logo_url}
                      alt={settings.school_name || 'School Logo'}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : null}
                <div>
                  <h1 className="text-2xl font-serif font-bold tracking-tight text-primary">
                    {settings.school_name || 'Elite International School'}
                  </h1>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono">
                    Office of the Bursar & Academic Accounts
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {settings.address || '[School Address Not Set]'} • {settings.email || '[Email Not Set]'} • Tel: {settings.phone || '[Phone Not Set]'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <div className="eyebrow !text-primary">Statement of Account</div>
                <div className="mono text-xs text-muted-foreground mt-1">
                  Statement Ref: <span className="font-bold text-foreground">SOA-{app.application_no}</span>
                </div>
                <div className="mono text-xs text-muted-foreground">
                  Date: <span className="font-medium text-foreground">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div className="mono text-xs text-muted-foreground">
                  Academic Term: <span className="font-medium text-foreground">{app.academic_year}</span>
                </div>
              </div>
            </div>

            {/* Student & Guardian Metadata */}
            <div className="grid grid-cols-2 gap-6 p-4 rounded-xl bg-muted/30 border border-border mb-6 text-xs">
              <div>
                <div className="eyebrow mb-1">Student Particulars</div>
                <div className="font-bold text-sm text-foreground mb-0.5">
                  {app.first_name} {app.last_name}
                </div>
                <div className="text-muted-foreground">Student ID: <span className="mono font-medium text-foreground">{app.application_no}</span></div>
                <div className="text-muted-foreground">Enrolled Grade: <span className="font-medium text-foreground">{app.grade_applying}</span></div>
                <div className="text-muted-foreground">Status: <span className="capitalize font-medium text-foreground">{app.status.replace('_', ' ')}</span></div>
              </div>

              <div>
                <div className="eyebrow mb-1">Billed To (Guardian / Household)</div>
                <div className="font-bold text-sm text-foreground mb-0.5">
                  {app.guardian_name} ({app.guardian_relationship})
                </div>
                <div className="text-muted-foreground">Phone: <span className="mono text-foreground">{app.guardian_phone}</span></div>
                <div className="text-muted-foreground">Email: <span className="text-foreground">{app.guardian_email || '—'}</span></div>
                <div className="text-muted-foreground">Address: <span className="text-foreground">{app.address || 'On File'}</span></div>
              </div>
            </div>

            {/* Fee Schedule Itemization */}
            <div className="mb-6">
              <div className="eyebrow mb-2">1. Fee Schedule & Assessment Charges</div>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border font-mono">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Fee Item / Description</th>
                      <th className="py-2.5 px-4 text-left">Classification</th>
                      <th className="py-2.5 px-4 text-right">Gross Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fin?.feeItems?.map((fee: any) => (
                      <tr key={fee.id}>
                        <td className="py-2.5 px-4 font-medium">{fee.fee_type} ({fee.academic_year})</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{fee.description || 'Standard Assessment Fee'}</td>
                        <td className="py-2.5 px-4 text-right mono font-medium">{currency}{Number(fee.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                    {(!fin?.feeItems || fin?.feeItems.length === 0) && (
                      <tr>
                        <td colSpan={3} className="py-4 text-center text-muted-foreground">No prescribed fee schedules found for this grade.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scholarships & Fee Abatements */}
            {fin?.scholarships && fin?.scholarships.length > 0 && (
              <div className="mb-6">
                <div className="eyebrow mb-2">2. Fee Abatements, Scholarships & Sibling Concessions</div>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border font-mono">
                      <tr>
                        <th className="py-2.5 px-4 text-left">Bursary Title</th>
                        <th className="py-2.5 px-4 text-left">Justification</th>
                        <th className="py-2.5 px-4 text-right">Adjustment Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {fin?.scholarships.map((sch: any) => (
                        <tr key={sch.id} className="text-[hsl(162,30%,35%)]">
                          <td className="py-2 px-4 font-medium">{sch.title}</td>
                          <td className="py-2 px-4">{sch.justification || 'Approved institutional concession'}</td>
                          <td className="py-2 px-4 text-right mono font-bold">
                            -{currency}{sch.discount_type === 'percentage'
                              ? ((fin.baseTuition * sch.value) / 100).toFixed(2)
                              : Number(sch.value).toFixed(2)}
                            {sch.discount_type === 'percentage' && ` (${sch.value}%)`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments & Receipts Ledger */}
            <div className="mb-6">
              <div className="eyebrow mb-2">3. Payments Received & Settlements to Date</div>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border font-mono">
                    <tr>
                      <th className="py-2.5 px-4 text-left">Receipt #</th>
                      <th className="py-2.5 px-4 text-left">Date</th>
                      <th className="py-2.5 px-4 text-left">Payment Mode & Ref</th>
                      <th className="py-2.5 px-4 text-left">Received By</th>
                      <th className="py-2.5 px-4 text-right">Amount Credited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {fin?.payments?.map((pay: any) => (
                      <tr key={pay.id}>
                        <td className="py-2.5 px-4 mono font-semibold text-primary">{pay.receipt_no}</td>
                        <td className="py-2.5 px-4">{pay.date}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{pay.payment_method} {pay.reference_no && `(${pay.reference_no})`}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{pay.received_by_staff_name}</td>
                        <td className="py-2.5 px-4 text-right mono font-bold text-[hsl(162,30%,35%)]">
                          {currency}{Number(pay.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {(!fin?.payments || fin?.payments.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-muted-foreground">No payments credited to this account to date.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Balance Card */}
            <div className="flex justify-end mb-8">
              <div className="w-80 p-4 rounded-xl bg-muted/40 border border-border space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Gross Prescribed Charges:</span>
                  <span className="mono font-semibold">{currency}{Number(fin?.totalGross || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[hsl(162,30%,35%)]">
                  <span>Less Total Abatements:</span>
                  <span className="mono font-semibold">-{currency}{Number(fin?.discountTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-foreground pt-1 border-t border-border">
                  <span>Net Expected Tuition:</span>
                  <span className="mono">{currency}{Number(fin?.expectedNet || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[hsl(162,30%,35%)]">
                  <span>Total Payments Credited:</span>
                  <span className="mono font-semibold">{currency}{Number(fin?.paidTotal || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold pt-2 border-t-2 border-primary text-primary">
                  <span>TOTAL BALANCE DUE:</span>
                  <span className="mono text-base">{currency}{Number(fin?.balanceDue || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer / Remittance */}
            <div className="border-t border-border pt-4 text-[11px] text-muted-foreground flex items-end justify-between">
              <div className="max-w-md space-y-1">
                <div className="font-semibold text-foreground">Remittance Instructions</div>
                <p>Bank: Metropolitan Commercial Bank • Account Name: Elite International School</p>
                <p>Account No: 094-118290-01 • Routing/Swift: ELITUS33</p>
                <p className="italic">Please reference student ID ({app.application_no}) with all electronic transfers.</p>
              </div>

              <div className="text-right">
                <div className="w-40 border-b border-foreground/40 mb-1"></div>
                <div className="font-mono text-[10px]">Authorized Signature / Bursar Seal</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
