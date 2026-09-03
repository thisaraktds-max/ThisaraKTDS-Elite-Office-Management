import React, { useState, useEffect } from 'react';
import { X, Printer, Award, Check } from 'lucide-react';
import { Applicant } from '../../types';

interface OfferLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicantId: string;
}

export const OfferLetterModal: React.FC<OfferLetterModalProps> = ({
  isOpen,
  onClose,
  applicantId,
}) => {
  const [applicant, setApplicant] = useState<Applicant | null>(null);
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
          setApplicant(dossierData.applicant);
          setSettings(settingsData);
        })
        .catch(err => console.error(err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, applicantId]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-3xl !p-6" onClick={e => e.stopPropagation()}>
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border receipt-actions">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-accent" />
            <span className="font-semibold text-sm">Official Letter of Admission</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="btn btn-primary flex items-center gap-2 text-xs">
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading || !applicant ? (
          <div className="p-8 text-center text-muted-foreground">Generating letter of admission...</div>
        ) : (
          <div className="receipt-print bg-card border border-border p-10 rounded-xl shadow-sm text-foreground space-y-6">
            {/* School Crest Header */}
            <div className="text-center border-b-2 border-primary/20 pb-6">
              <div className="w-16 h-16 rounded-2xl border border-border/80 p-1.5 bg-muted/40 flex items-center justify-center mx-auto mb-3 shadow-sm">
                <img
                  src="/school-logo.png"
                  alt="School Logo"
                  className="w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <h1 className="font-serif font-bold text-2xl tracking-wide text-primary uppercase">
                {settings.school_name || 'Elite International School'}
              </h1>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-mono mt-1">
                Office of Admissions & Academic Council • Matara
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {settings.address || '1/143, Akuressa Road, Matara, Sri Lanka'} • {settings.email || 'office@eis.lk'} • Tel: {settings.phone || '+94 70 699 9333'}
              </p>
              {settings.tagline && (
                <p className="text-[11px] font-serif italic text-primary/80 mt-1">
                  "{settings.tagline}"
                </p>
              )}
            </div>

            {/* Date & Ref */}
            <div className="flex justify-between text-xs text-muted-foreground font-mono">
              <div>Ref: <span className="font-bold text-foreground">ADM-OFFER-{applicant.application_no}</span></div>
              <div>Date: <span className="font-bold text-foreground">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            </div>

            {/* Guardian Addressee */}
            <div className="text-xs leading-relaxed">
              <div className="font-bold text-foreground">{applicant.guardian_name}</div>
              <div>Guardian of {applicant.first_name} {applicant.last_name}</div>
              <div>{applicant.address || 'Address On Record'}</div>
            </div>

            {/* Formal Offer Letter Title */}
            <div className="text-center pt-2">
              <h2 className="font-serif font-bold text-xl text-primary underline underline-offset-8">
                OFFICIAL OFFER OF PROVISIONAL ADMISSION
              </h2>
              <div className="eyebrow !text-accent mt-2">Academic Year {applicant.academic_year}</div>
            </div>

            {/* Letter Body */}
            <div className="text-xs leading-relaxed space-y-3">
              <p>
                Dear <span className="font-semibold">{applicant.guardian_name}</span>,
              </p>
              <p>
                On behalf of the Faculty Council and the Board of Governors at <span className="font-semibold">{settings.school_name || 'Elite International School'}</span>, it is my distinct privilege to inform you that <span className="font-bold text-foreground">{applicant.first_name} {applicant.last_name}</span> has been granted provisional admission to <span className="font-bold text-foreground">{applicant.grade_applying}</span> for the upcoming academic year <span className="font-bold text-foreground">{applicant.academic_year}</span>.
              </p>
              <p>
                Our Admissions Committee was impressed by {applicant.first_name}'s academic readiness and personal profile during the evaluation process. We are confident that {applicant.first_name} will thrive within our rigorous academic framework and vibrant community of scholars.
              </p>
              <p>
                To formally secure this enrollment placement, kindly review the attached schedule of tuition and return the signed Acceptance & Matriculation Slip below along with the initial registration deposit within <span className="font-semibold">fourteen (14) business days</span> of receipt.
              </p>
              <p>
                We look forward to welcoming your family into our campus community.
              </p>
            </div>

            {/* Signature Area */}
            <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
              <div>
                <div className="w-48 border-b border-foreground/40 mb-1"></div>
                <div className="font-bold text-foreground">Dr. Alistair Vance, Ph.D.</div>
                <div className="text-muted-foreground text-[11px]">Head of School & Provost</div>
              </div>
              <div className="text-right">
                <div className="w-48 border-b border-foreground/40 mb-1 ml-auto"></div>
                <div className="font-bold text-foreground">Margaret Sterling, M.Ed.</div>
                <div className="text-muted-foreground text-[11px]">Director of Admissions</div>
              </div>
            </div>

            {/* Acceptance Slip */}
            <div className="border-t-2 border-dashed border-border pt-6 mt-6">
              <div className="eyebrow mb-2">Detachable Enrollment Acceptance Slip (Return to Bursar Office)</div>
              <div className="p-4 bg-muted/30 border border-border rounded-xl text-xs space-y-3">
                <div className="flex justify-between">
                  <span>Student: <span className="font-bold">{applicant.first_name} {applicant.last_name}</span> ({applicant.application_no})</span>
                  <span>Admitted Grade: <span className="font-bold">{applicant.grade_applying}</span></span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <div className="w-full border-b border-foreground/40 mb-1"></div>
                    <span className="text-[10px] text-muted-foreground">Parent / Guardian Signature</span>
                  </div>
                  <div>
                    <div className="w-full border-b border-foreground/40 mb-1"></div>
                    <span className="text-[10px] text-muted-foreground">Date Signed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
