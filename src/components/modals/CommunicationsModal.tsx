import React, { useState, useEffect } from 'react';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { X, Send, Copy, MessageSquare, Check, Phone, Mail } from 'lucide-react';

interface CommunicationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient?: {
    applicant_id?: string;
    family_id?: string;
    student_name: string;
    guardian_name: string;
    guardian_phone: string;
    guardian_email?: string;
    grade?: string;
    balance_due?: number;
    days_overdue?: number;
    contextType?: 'tuition_reminder' | 'document_request' | 'assessment_invite' | 'admission_offer' | 'general';
  };
}

export const CommunicationsModal: React.FC<CommunicationsModalProps> = ({
  isOpen,
  onClose,
  recipient,
}) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();
  const [templateType, setTemplateType] = useState<string>('tuition_reminder');
  const [channel, setChannel] = useState<'whatsapp' | 'sms' | 'email'>('whatsapp');
  const [customDraft, setCustomDraft] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const [settings, setSettings] = useState<any>({
    school_name: 'Elite International School',
    tagline: 'Scientia est Infinita',
    motto: 'To empower young minds with knowledge, skills, and values to create a future-ready generation.',
    address: '1/143, Akuressa Road, Matara, Sri Lanka',
    phone: '+94 70 699 9333',
    email: 'office@eis.lk',
    whatsapp_number: '+94706999333',
    currency_symbol: 'LKR',
  });

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setSettings((prev: any) => ({ ...prev, ...data }));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (recipient?.contextType) {
      setTemplateType(recipient.contextType);
    }
  }, [recipient]);

  useEffect(() => {
    if (!recipient) return;

    const studentName = recipient.student_name || 'Student';
    const guardianName = recipient.guardian_name || 'Parent/Guardian';
    const currency = settings.currency_symbol || 'LKR';
    const balance = recipient.balance_due ? `${currency} ${Number(recipient.balance_due).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `${currency} 0.00`;
    const days = recipient.days_overdue || 30;
    const grade = recipient.grade || 'the enrolled grade';
    const schoolName = settings.school_name || 'Elite International School';
    const schoolEmail = settings.email || 'office@eis.lk';
    const schoolPhone = settings.phone || '+94 70 699 9333';
    const schoolAddress = settings.address || '1/143, Akuressa Road, Matara, Sri Lanka';

    let draft = '';
    if (templateType === 'tuition_reminder') {
      draft = `Dear ${guardianName},\n\nThis is a friendly reminder from the Bursary & Accounts Office at ${schoolName}, Matara regarding ${studentName}'s academic account (${grade}).\n\nThere is currently an outstanding balance of ${balance} (now ${days} days past due). We kindly request that you settle this installment at your earliest convenience to ensure uninterrupted academic services.\n\nDirect Bank Remittance Details:\nBank: Commercial Bank of Ceylon | Matara Branch\nAccount Name: ${schoolName}\nAccount No: 1000 4892 0182\nPayment Reference: ${studentName} (${recipient.applicant_id || 'Student ID'})\n\nIf you have already made this payment or wish to discuss an installment schedule, please email ${schoolEmail} or call ${schoolPhone}.\n\nWarm regards,\nBursar & Finance Office\n${schoolName}\n${schoolAddress}\nTel: ${schoolPhone}`;
    } else if (templateType === 'document_request') {
      draft = `Dear ${guardianName},\n\nWarm greetings from the Admissions Office at ${schoolName}, Matara.\n\nIn order to finalize the admissions dossier for ${studentName} (${grade}, Academic Year 2026-2027), we kindly request that you submit the pending credentials (Official Birth Certificate / Previous Academic Records / Medical Form) to our office or email them to ${schoolEmail}.\n\nPlease feel free to contact us at ${schoolPhone} if you need any clarification.\n\nBest regards,\nOffice of Admissions\n${schoolName}\n${schoolAddress}`;
    } else if (templateType === 'assessment_invite') {
      draft = `Dear ${guardianName},\n\nWe are pleased to invite ${studentName} for the Admissions Assessment & Placement Session at ${schoolName}, Matara for ${grade}.\n\nSession Venue: Main Administration Building, ${schoolAddress}\nPlease bring a copy of previous academic report cards and writing materials.\n\nKindly contact us at ${schoolPhone} or reply to this message to confirm your family's attendance.\n\nWarm regards,\nAdmissions Committee\n${schoolName}`;
    } else if (templateType === 'admission_offer') {
      draft = `Dear ${guardianName},\n\nOn behalf of the Faculty Council and Board of Governors of ${schoolName}, Matara, we are delighted to offer ${studentName} admission for the 2026-2027 Academic Year (${grade})!\n\nYour official Letter of Provisional Admission and fee schedule are available. Please complete enrollment confirmation within 14 business days.\n\nCongratulations and a warm welcome to the Elite family!\n\nOffice of the Registrar\n${schoolName}\n${schoolAddress}\nEmail: ${schoolEmail} | Tel: ${schoolPhone}`;
    } else {
      draft = `Dear ${guardianName},\n\nGreetings from ${schoolName}, Matara regarding ${studentName}.\n\n[Please insert your custom notice or announcement here]\n\nBest regards,\nOffice of Administration\n${schoolName}\n${schoolAddress}\nTel: ${schoolPhone} | Email: ${schoolEmail}`;
    }

    setCustomDraft(draft);
  }, [recipient, templateType, settings]);

  if (!isOpen || !recipient) return null;

  const getSubjectLine = () => {
    const studentName = recipient.student_name || 'Student';
    const schoolName = settings.school_name || 'Elite International School';
    if (templateType === 'admission_offer') return `[${schoolName}] Official Offer of Admission (2026-2027) - ${studentName}`;
    if (templateType === 'tuition_reminder') return `[${schoolName}] Tuition & Account Statement Notice - ${studentName}`;
    if (templateType === 'document_request') return `[${schoolName}] Pending Admissions Credentials - ${studentName}`;
    if (templateType === 'assessment_invite') return `[${schoolName}] Admissions Assessment Invitation - ${studentName}`;
    return `[${schoolName}] Official Notice - ${studentName}`;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(customDraft);
      setCopied(true);
      showToast('Message copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
      logCommunicationToDb('Clipboard Copy');
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleWhatsAppDeepLink = () => {
    let cleanPhone = recipient.guardian_phone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0') && cleanPhone.length === 10) {
      cleanPhone = '94' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('94') && cleanPhone.length === 9) {
      cleanPhone = '94' + cleanPhone;
    }
    const encodedText = encodeURIComponent(customDraft);
    const url = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(url, '_blank');
    logCommunicationToDb('WhatsApp Direct');
  };

  const logCommunicationToDb = async (method: string) => {
    if (!recipient.applicant_id && !recipient.family_id) return;
    try {
      setIsLogging(true);
      await fetch(`/api/applicants/${recipient.applicant_id || '0'}/communications`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          contact_type: channel === 'whatsapp' ? 'WhatsApp' : channel === 'email' ? 'Email' : 'Notice',
          summary: `Sent template '${templateType.replace('_', ' ')}' via ${method} to ${recipient.guardian_name} (${recipient.guardian_phone})`,
          date: new Date().toISOString().substring(0, 10),
          family_id: recipient.family_id || null,
        }),
      });
    } catch (err) {
      console.error('Failed to auto-log communication:', err);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 text-accent-foreground flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-accent" />
            </div>
            <div>
              <div className="eyebrow">Guardian Outreach & Communications</div>
              <h3 className="text-lg font-serif font-bold text-foreground">Draft Guardian Notice</h3>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5 rounded-lg text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Recipient meta badge */}
        <div className="flex flex-wrap items-center justify-between p-3 rounded-xl bg-muted/40 border border-border mb-4 text-xs">
          <div>
            <div className="font-semibold text-foreground">{recipient.guardian_name} ({recipient.student_name})</div>
            <div className="text-muted-foreground flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {recipient.guardian_phone}</span>
              {recipient.guardian_email && (
                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {recipient.guardian_email}</span>
              )}
            </div>
          </div>
          {recipient.balance_due && (
            <div className="text-right">
              <span className="eyebrow block">Balance Due</span>
              <span className="mono font-bold text-sm text-destructive">${Number(recipient.balance_due).toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Template Selector & Channel Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-xs font-semibold mb-1">Message Purpose / Template</label>
            <select
              className="select"
              value={templateType}
              onChange={e => setTemplateType(e.target.value)}
            >
              <option value="tuition_reminder">Tuition Overdue & Balance Notice</option>
              <option value="document_request">Required Document & Transcript Request</option>
              <option value="assessment_invite">Assessment & Interview Invitation</option>
              <option value="admission_offer">Official Offer of Admission Notification</option>
              <option value="general">General Office Notice / Announcement</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">Outreach Channel</label>
            <div className="flex rounded-lg border border-input p-0.5 bg-card">
              <button
                type="button"
                onClick={() => setChannel('whatsapp')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  channel === 'whatsapp' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  channel === 'sms' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                SMS
              </button>
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                  channel === 'email' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Email
              </button>
            </div>
          </div>
        </div>

        {/* Message Editor */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-semibold">Message Draft (Editable)</label>
            <span className="mono text-[11px] text-muted-foreground">{customDraft.length} characters</span>
          </div>
          <textarea
            className="textarea !h-48 font-sans text-xs leading-relaxed"
            value={customDraft}
            onChange={e => setCustomDraft(e.target.value)}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <button
            type="button"
            onClick={handleCopy}
            className="btn btn-soft flex items-center gap-2 text-xs"
          >
            {copied ? <Check className="w-4 h-4 text-[hsl(162,30%,40%)]" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied to Clipboard!' : 'Copy Text'}
          </button>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            {channel === 'whatsapp' ? (
              <button
                type="button"
                onClick={handleWhatsAppDeepLink}
                className="btn btn-accent flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Launch WhatsApp Web / App
              </button>
            ) : channel === 'email' && recipient.guardian_email ? (
              <a
                href={`mailto:${recipient.guardian_email}?cc=${encodeURIComponent(settings.email || 'office@eis.lk')}&subject=${encodeURIComponent(getSubjectLine())}&body=${encodeURIComponent(customDraft)}`}
                onClick={() => logCommunicationToDb('Email Client')}
                className="btn btn-primary flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Launch Email Client
              </a>
            ) : (
              <button
                type="button"
                onClick={handleCopy}
                className="btn btn-primary flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy & Finish
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
