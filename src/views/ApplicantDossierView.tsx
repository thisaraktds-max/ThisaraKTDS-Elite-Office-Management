import React, { useState, useEffect, useRef } from 'react';
import { useStaff } from '../context/StaffContext';
import { useNotification } from '../context/NotificationContext';
import { Applicant, AdmissionStatus, DocumentItem, Scholarship, InstallmentPlan, Income, Communication, Family } from '../types';
import {
  ArrowLeft,
  User,
  FileCheck,
  Users,
  Receipt,
  CalendarDays,
  HeartPulse,
  MessageSquare,
  Award,
  FileText,
  Send,
  Plus,
  Trash2,
  Edit,
  Save,
  CheckCircle,
  Clock,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  Check,
  Camera,
  UploadCloud,
  ChevronDown,
  Sparkles,
  History,
  Shield,
  Printer,
} from 'lucide-react';
import { ConfirmDialogModal } from '../components/modals/ConfirmDialogModal';

interface ApplicantDossierViewProps {
  applicantId: string;
  onBack: () => void;
  onOpenStatementOfAccount: (id: string) => void;
  onOpenOfferLetter: (id: string) => void;
  onOpenCommunications: (recipient: any) => void;
  onOpenRecordIncome: (applicantId: string, prefilledAmount?: number) => void;
  onNavigateToStudent: (id: string) => void;
  onOpenReceiptModal?: (receiptId: string) => void;
}

const ALL_STATUSES: { value: AdmissionStatus; label: string }[] = [
  { value: 'inquiry', label: 'Inquiry' },
  { value: 'applied', label: 'Applied' },
  { value: 'documents_submitted', label: 'Docs Submitted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'declined', label: 'Declined' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export const ApplicantDossierView: React.FC<ApplicantDossierViewProps> = ({
  applicantId,
  onBack,
  onOpenStatementOfAccount,
  onOpenOfferLetter,
  onOpenCommunications,
  onOpenRecordIncome,
  onNavigateToStudent,
  onOpenReceiptModal,
}) => {
  const { getHeaders } = useStaff();
  const { showToast } = useNotification();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  const [activeTab, setActiveTab] = useState<'profile' | 'docs' | 'family' | 'financials' | 'installments' | 'medical' | 'comms' | 'timeline'>('profile');
  const [dossier, setDossier] = useState<any>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [settings, setSettings] = useState<any>({});
  const currency = settings.currency_symbol || 'LKR';
  const [timelineLogs, setTimelineLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocNotes, setEditingDocNotes] = useState('');
  const [isLinkingFamily, setIsLinkingFamily] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');

  // Edit forms state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<any>({});
  const [medicalForm, setMedicalForm] = useState<any>({});
  const [newDocName, setNewDocName] = useState('');
  const [newDocMandatory, setNewDocMandatory] = useState(true);
  const [showAddDoc, setShowAddDoc] = useState(false);

  // Scholarship form
  const [showAddScholarship, setShowAddScholarship] = useState(false);
  const [scholarshipToDelete, setScholarshipToDelete] = useState<any | null>(null);
  const [isDeletingScholarship, setIsDeletingScholarship] = useState(false);
  const [schForm, setSchForm] = useState({
    title: 'Sibling Fee Concession',
    discount_type: 'percentage',
    value: '10',
    justification: 'Second enrolled child in household',
  });

  // Comm log form
  const [showAddComm, setShowAddComm] = useState(false);
  const [commForm, setCommForm] = useState({
    contact_type: 'Call',
    summary: '',
    date: new Date().toISOString().substring(0, 10),
  });

  const fetchDossier = async () => {
    setIsLoading(true);
    try {
      const [dossierRes, familiesRes, settingsRes] = await Promise.all([
        fetch(`/api/applicants/${applicantId}`),
        fetch('/api/families'),
        fetch('/api/settings'),
      ]);

      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setSettings(sData);
      }

      if (dossierRes.ok) {
        const data = await dossierRes.json();
        setDossier(data);
        setProfileForm(data.applicant || {});
        setMedicalForm({
          blood_group: data.applicant?.blood_group || 'O+',
          allergies: data.applicant?.allergies || '',
          dietary_needs: data.applicant?.dietary_needs || '',
          emergency_contact: data.applicant?.emergency_contact || '',
          emergency_phone: data.applicant?.emergency_phone || '',
          emergency_relationship: data.applicant?.emergency_relationship || '',
          physician_name: data.applicant?.physician_name || '',
          physician_phone: data.applicant?.physician_phone || '',
          care_notes: data.applicant?.care_notes || '',
        });
      }
      if (familiesRes.ok) {
        const fData = await familiesRes.json();
        setFamilies(fData);
      }

      // Fetch student specific audit logs
      try {
        const auditRes = await fetch(`/api/audit-logs?target_id=${applicantId}`);
        if (auditRes.ok) {
          const aData = await auditRes.json();
          setTimelineLogs(aData);
        }
      } catch (e) {
        console.error('Failed to load audit logs:', e);
      }
    } catch (err) {
      console.error('Failed to load dossier:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (applicantId) {
      fetchDossier();
    }
  }, [applicantId]);

  if (isLoading || !dossier?.applicant) {
    return (
      <div className="py-20 text-center text-muted-foreground text-sm font-sans">
        Loading student dossier and academic records...
      </div>
    );
  }

  const app: Applicant = dossier.applicant;
  const docs: DocumentItem[] = dossier.documents || [];
  const family: Family | null = dossier.family || null;
  const siblings = dossier.siblings || [];
  const financials = dossier.financials || { totalGross: 0, discountTotal: 0, expectedNet: 0, paidTotal: 0, balanceDue: 0 };
  const installments: InstallmentPlan[] = dossier.installments || [];
  const comms: Communication[] = dossier.communications || [];

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (PNG, JPG, or WEBP)', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('Image must be under 5MB in size', 'error');
      return;
    }

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = reader.result as string;
        const res = await fetch(`/api/applicants/${app.id}/photo`, {
          method: 'PUT',
          headers: getHeaders(),
          body: JSON.stringify({ photo_url: base64 }),
        });
        if (res.ok) {
          showToast('Student profile photo updated successfully', 'success');
          fetchDossier();
        } else {
          showToast('Failed to upload student photo', 'error');
        }
      } catch (err) {
        showToast('Error uploading photo', 'error');
      } finally {
        setIsUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/applicants/${app.id}/photo`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ photo_url: '' }),
      });
      if (res.ok) {
        showToast('Student photo removed', 'success');
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to remove photo', 'error');
    }
  };

  // Update Status
  const handleStatusChange = async (newStatus: AdmissionStatus) => {
    try {
      const res = await fetch(`/api/applicants/${app.id}/status`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(`Status updated to ${newStatus.replace('_', ' ')}`, 'success');
        setShowStatusPicker(false);
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  // Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/applicants/${app.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        showToast('Applicant profile details updated successfully', 'success');
        setIsEditingProfile(false);
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to update profile', 'error');
    }
  };

  // Save Medical
  const handleSaveMedical = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/applicants/${app.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(medicalForm),
      });
      if (res.ok) {
        showToast('Medical & emergency records saved', 'success');
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to save medical records', 'error');
    }
  };

  // Toggle Document Status
  const handleToggleDoc = async (docId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'received' ? 'pending' : 'received';
    const receivedDate = nextStatus === 'received' ? new Date().toISOString().substring(0, 10) : null;
    try {
      const res = await fetch(`/api/applicants/${app.id}/documents/${docId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status: nextStatus, received_date: receivedDate }),
      });
      if (res.ok) {
        showToast(`Document marked as ${nextStatus}`, 'success');
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to update document status', 'error');
    }
  };

  // Save Document Verification Notes
  const handleSaveDocNotes = async (docId: string) => {
    try {
      const res = await fetch(`/api/applicants/${app.id}/documents/${docId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ notes: editingDocNotes }),
      });
      if (res.ok) {
        showToast('Document notes updated', 'success');
        setEditingDocId(null);
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to save document notes', 'error');
    }
  };

  // Delete Document Requirement
  const handleDeleteDoc = async (docId: string, docName: string) => {
    if (!confirm(`Are you sure you want to remove the '${docName}' requirement?`)) return;
    try {
      const res = await fetch(`/api/applicants/${app.id}/documents/${docId}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(`Removed requirement: ${docName}`, 'success');
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to remove document requirement', 'error');
    }
  };

  // Quick Link / Unlink Household
  const handleQuickLinkHousehold = async (familyId: string | null) => {
    try {
      const updatedProfile = { ...profileForm, family_id: familyId };
      const res = await fetch(`/api/applicants/${app.id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(updatedProfile),
      });
      if (res.ok) {
        showToast(familyId ? 'Student linked to Household successfully' : 'Student unlinked from Household', 'success');
        setIsLinkingFamily(false);
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to update household link', 'error');
    }
  };

  // Add Custom Document
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim()) return;
    try {
      const res = await fetch(`/api/applicants/${app.id}/documents`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          document_name: newDocName.trim(),
          is_mandatory: newDocMandatory ? 1 : 0,
        }),
      });
      if (res.ok) {
        showToast(`Added document requirement '${newDocName}'`, 'success');
        setNewDocName('');
        setShowAddDoc(false);
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to add document', 'error');
    }
  };

  // Add Scholarship
  const handleAddScholarship = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/applicants/${app.id}/scholarships`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          title: schForm.title,
          discount_type: schForm.discount_type,
          value: Number(schForm.value),
          justification: schForm.justification,
        }),
      });
      if (res.ok) {
        showToast('Scholarship / Abatement applied to account', 'success');
        setShowAddScholarship(false);
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to apply scholarship', 'error');
    }
  };

  // Remove Scholarship
  const handleConfirmDeleteScholarship = async () => {
    if (!scholarshipToDelete) return;
    setIsDeletingScholarship(true);
    try {
      const res = await fetch(`/api/applicants/${app.id}/scholarships/${scholarshipToDelete.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (res.ok) {
        showToast(`Removed fee concession: ${scholarshipToDelete.title}`, 'success');
        setScholarshipToDelete(null);
        fetchDossier();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to remove fee concession', 'error');
      }
    } catch (err) {
      showToast('Failed to remove fee concession', 'error');
    } finally {
      setIsDeletingScholarship(false);
    }
  };

  // Generate Installment Plan
  const handleGenerateInstallments = async (planType: 'annual' | 'term' | 'monthly') => {
    try {
      const res = await fetch(`/api/applicants/${app.id}/installments/generate`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ plan_type: planType }),
      });
      if (res.ok) {
        showToast(`Generated ${planType} installment schedule`, 'success');
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to generate installment plan', 'error');
    }
  };

  // Add Communication Log
  const handleAddCommunication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commForm.summary.trim()) return;
    try {
      const res = await fetch(`/api/applicants/${app.id}/communications`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ...commForm,
          family_id: app.family_id || null,
        }),
      });
      if (res.ok) {
        showToast('Communication entry logged', 'success');
        setCommForm({ contact_type: 'Call', summary: '', date: new Date().toISOString().substring(0, 10) });
        setShowAddComm(false);
        fetchDossier();
      }
    } catch (err) {
      showToast('Failed to log communication', 'error');
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Top Dossier Header Card */}
      <div className="panel p-5 sm:p-6 shadow-sm border border-border bg-card">
        {/* Top Header Bar: Back & Student Details + Quick Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border">
          
          {/* Left info & avatar */}
          <div className="flex items-center gap-3.5 sm:gap-4">
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              title="Back to Pipeline"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            {/* Profile Avatar with Photo Upload */}
            <div className="relative group flex-shrink-0">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold text-lg sm:text-xl border border-primary/20 flex-shrink-0 shadow-xs overflow-hidden cursor-pointer relative group-hover:border-primary transition-all"
                title="Click to change student photo"
              >
                {app.photo_url ? (
                  <img
                    src={app.photo_url}
                    alt={`${app.first_name} ${app.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{app.first_name[0]}{app.last_name[0]}</span>
                )}

                {/* Upload Overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Camera className="w-5 h-5" />
                </div>
              </div>

              {/* Upload Trigger Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-transform hover:scale-105"
                title="Upload Photo"
              >
                <Camera className="w-3 h-3" />
              </button>

              {app.photo_url && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="absolute -top-1 -right-1 p-1 rounded-full bg-destructive text-destructive-foreground shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:scale-105"
                  title="Remove Photo"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg sm:text-2xl font-bold text-foreground tracking-tight">
                  {app.first_name} {app.last_name}
                </h2>

                {/* Clean Status Badge with Stage Picker Popover */}
                <div className="relative inline-block">
                  <button
                    onClick={() => setShowStatusPicker(!showStatusPicker)}
                    className={`badge badge-${app.status} text-xs font-semibold px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity shadow-2xs whitespace-nowrap`}
                    title="Click to change admission status"
                  >
                    <span>{app.status.replace('_', ' ')}</span>
                    <ChevronDown className="w-3 h-3 opacity-70" />
                  </button>

                  {showStatusPicker && (
                    <div className="absolute left-0 top-full mt-1.5 z-30 w-48 rounded-xl bg-card border border-border shadow-xl p-1.5 space-y-0.5 animate-fade">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase px-2 py-1">
                        Change Stage
                      </div>
                      {ALL_STATUSES.map((st) => (
                        <button
                          key={st.value}
                          onClick={() => handleStatusChange(st.value)}
                          className={`w-full text-left px-2.5 py-1.5 text-xs rounded-lg font-medium flex items-center justify-between transition-colors ${
                            app.status === st.value
                              ? 'bg-primary text-primary-foreground font-semibold'
                              : 'text-foreground hover:bg-muted'
                          }`}
                        >
                          <span>{st.label}</span>
                          {app.status === st.value && <Check className="w-3.5 h-3.5" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1 font-medium">
                <span className="font-mono font-semibold text-primary">{app.application_no}</span>
                <span className="text-border">•</span>
                <span className="text-foreground font-semibold">{app.grade_applying}</span>
                <span className="text-border">•</span>
                <span className="font-mono">{app.academic_year}</span>
                <span className="text-border hidden sm:inline">•</span>
                <span className="hidden sm:inline">Guardian: <strong className="text-foreground font-semibold">{app.guardian_name}</strong> ({app.guardian_phone})</span>
              </div>
            </div>
          </div>

          {/* Right: Primary Action Buttons */}
          <div className="flex items-center gap-2 self-start md:self-center shrink-0">
            <button
              onClick={() => onOpenOfferLetter(app.id)}
              className="btn btn-soft text-xs font-semibold px-3 py-2 flex items-center gap-1.5"
            >
              <Award className="w-4 h-4 text-accent shrink-0" />
              <span>Offer Letter</span>
            </button>

            <button
              onClick={() => onOpenStatementOfAccount(app.id)}
              className="btn btn-soft text-xs font-semibold px-3 py-2 flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span>Statement</span>
            </button>

            <button
              onClick={() => onOpenCommunications({
                applicant_id: app.id,
                family_id: app.family_id || undefined,
                student_name: `${app.first_name} ${app.last_name}`,
                guardian_name: app.guardian_name,
                guardian_phone: app.guardian_phone,
                guardian_email: app.guardian_email,
                grade: app.grade_applying,
                balance_due: financials.balanceDue,
                contextType: app.status === 'accepted' ? 'admission_offer' : financials.balanceDue > 0 ? 'tuition_reminder' : 'general',
              })}
              className="btn btn-primary text-xs font-semibold px-3.5 py-2 flex items-center gap-1.5 shadow-xs"
            >
              <Send className="w-4 h-4 shrink-0" />
              <span>Guardian Notice</span>
            </button>
          </div>
        </div>

        {/* Navigation Subtabs */}
        <div className="flex items-center gap-1.5 pt-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            {
              id: 'docs',
              label: 'Documents',
              icon: FileCheck,
              count: `${docs.filter(d => d.status === 'received').length}/${docs.length}`,
            },
            {
              id: 'family',
              label: 'Household',
              icon: Users,
              count: siblings.length > 0 ? siblings.length : undefined,
            },
            {
              id: 'financials',
              label: 'Financials',
              icon: Receipt,
              hasIndicator: true,
              balanceDue: Number(financials.balanceDue || 0),
            },
            {
              id: 'installments',
              label: 'Schedule',
              icon: CalendarDays,
              count: installments.length > 0 ? installments.length : undefined,
            },
            { id: 'medical', label: 'Medical', icon: HeartPulse },
            {
              id: 'comms',
              label: 'Comms Log',
              icon: MessageSquare,
              count: comms.length > 0 ? comms.length : undefined,
            },
            {
              id: 'timeline',
              label: 'Audit Trail',
              icon: History,
              count: timelineLogs.length > 0 ? timelineLogs.length : undefined,
            },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-fit px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono font-medium shrink-0 leading-none ${
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.hasIndicator && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      tab.balanceDue > 0
                        ? 'bg-rose-500 ring-2 ring-rose-500/20'
                        : 'bg-emerald-500/80'
                    }`}
                    title={
                      tab.balanceDue > 0
                        ? `Balance Due: ${currency} ${tab.balanceDue.toLocaleString()}`
                        : 'Account Settled'
                    }
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Subtab 1: Profile & Academic Placement */}
      {activeTab === 'profile' && (
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Student Dossier</div>
              <h3 className="text-base font-bold text-foreground">Personal & Academic Details</h3>
            </div>
            {!isEditingProfile ? (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="btn btn-soft text-xs flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            ) : (
              <button
                onClick={() => setIsEditingProfile(false)}
                className="btn btn-ghost text-xs"
              >
                Cancel
              </button>
            )}
          </div>

          {!isEditingProfile ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">Student Information</div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Full Name:</span>
                  <strong className="text-foreground font-semibold">{app.first_name} {app.last_name}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Application No:</span>
                  <span className="font-mono font-semibold text-primary">{app.application_no}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Date of Birth:</span>
                  <span className="font-medium text-foreground">{app.dob}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Gender:</span>
                  <span className="font-medium text-foreground">{app.gender}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Grade Placement:</span>
                  <span className="font-bold text-primary">{app.grade_applying}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Academic Year:</span>
                  <span className="font-mono text-foreground">{app.academic_year}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">Guardian & Residence</div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Primary Guardian:</span>
                  <strong className="text-foreground font-semibold">{app.guardian_name}</strong>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Relationship:</span>
                  <span className="font-medium text-foreground">{app.guardian_relationship}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-mono text-foreground">{app.guardian_phone}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40 gap-3">
                  <span className="text-muted-foreground shrink-0">Email:</span>
                  <span className="text-foreground break-all text-right font-medium">{app.guardian_email || '—'}</span>
                </div>
                <div className="py-1">
                  <span className="text-muted-foreground block mb-0.5">Address:</span>
                  <span className="text-foreground leading-relaxed block">{app.address || '—'}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">Household & Intake Notes</div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Linked Household:</span>
                  <span className="font-semibold text-foreground">
                    {app.household_name ? `${app.household_name}` : 'Unlinked Student Record'}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/40">
                  <span className="text-muted-foreground">Registration Timestamp:</span>
                  <span className="font-mono text-xs text-muted-foreground">{new Date(app.created_at).toLocaleString()}</span>
                </div>
                <div className="pt-1">
                  <span className="text-muted-foreground block mb-1">Admissions Notes:</span>
                  <p className="p-2.5 rounded-lg bg-card border border-border text-xs leading-relaxed text-foreground">
                    {app.notes || 'No special intake notes on file.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={profileForm.first_name || ''}
                    onChange={e => setProfileForm({ ...profileForm, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={profileForm.last_name || ''}
                    onChange={e => setProfileForm({ ...profileForm, last_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Date of Birth</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={profileForm.dob || ''}
                    onChange={e => setProfileForm({ ...profileForm, dob: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Grade Applying</label>
                  <select
                    className="select"
                    value={profileForm.grade_applying}
                    onChange={e => setProfileForm({ ...profileForm, grade_applying: e.target.value })}
                  >
                    <option value="Kindergarten">Kindergarten</option>
                    <option value="Grade 1">Grade 1</option>
                    <option value="Grade 2">Grade 2</option>
                    <option value="Grade 3">Grade 3</option>
                    <option value="Grade 4">Grade 4</option>
                    <option value="Grade 5">Grade 5</option>
                    <option value="Grade 6">Grade 6</option>
                    <option value="Grade 7">Grade 7</option>
                    <option value="Grade 8">Grade 8</option>
                    <option value="Grade 9">Grade 9</option>
                    <option value="Grade 10">Grade 10</option>
                    <option value="Grade 11">Grade 11</option>
                    <option value="Grade 12">Grade 12</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Gender</label>
                  <select
                    className="select"
                    value={profileForm.gender}
                    onChange={e => setProfileForm({ ...profileForm, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Link Household / Family</label>
                  <select
                    className="select"
                    value={profileForm.family_id || ''}
                    onChange={e => setProfileForm({ ...profileForm, family_id: e.target.value || null })}
                  >
                    <option value="">-- Unlinked Household --</option>
                    {families.map(f => (
                      <option key={f.id} value={f.id}>{f.household_name} ({f.family_code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Guardian Name</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={profileForm.guardian_name || ''}
                    onChange={e => setProfileForm({ ...profileForm, guardian_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Guardian Phone</label>
                  <input
                    type="tel"
                    required
                    className="input"
                    value={profileForm.guardian_phone || ''}
                    onChange={e => setProfileForm({ ...profileForm, guardian_phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Guardian Email</label>
                  <input
                    type="email"
                    className="input"
                    value={profileForm.guardian_email || ''}
                    onChange={e => setProfileForm({ ...profileForm, guardian_email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Residential Address</label>
                <input
                  type="text"
                  className="input"
                  value={profileForm.address || ''}
                  onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Intake Notes</label>
                <textarea
                  className="textarea !h-20"
                  value={profileForm.notes || ''}
                  onChange={e => setProfileForm({ ...profileForm, notes: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditingProfile(false)} className="btn btn-ghost text-xs">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary text-xs flex items-center gap-1.5">
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Profile Updates</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Subtab 2: Documents & Credentials Checklist */}
      {activeTab === 'docs' && (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Verification Checklist</div>
              <h3 className="text-base font-bold text-foreground">Required Documents & Transcripts</h3>
            </div>
            <button
              onClick={() => setShowAddDoc(!showAddDoc)}
              className="btn btn-soft text-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Custom Requirement</span>
            </button>
          </div>

          {showAddDoc && (
            <form onSubmit={handleAddDocument} className="p-4 bg-muted/40 rounded-xl border border-border flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold mb-1">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Previous Grade School Transcripts"
                  className="input !h-8 !text-xs"
                  value={newDocName}
                  onChange={e => setNewDocName(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pb-1.5">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newDocMandatory}
                    onChange={e => setNewDocMandatory(e.target.checked)}
                  />
                  <span>Mandatory for Enrollment</span>
                </label>
              </div>
              <div className="flex items-center gap-2 pb-1">
                <button type="submit" className="btn btn-primary text-xs !py-1.5">Add</button>
                <button type="button" onClick={() => setShowAddDoc(false)} className="btn btn-ghost text-xs !py-1.5">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {docs.map(doc => {
              const isReceived = doc.status === 'received';
              const isEditingNotes = editingDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isReceived
                      ? 'bg-[hsl(162,30%,40%)]/5 border-[hsl(162,30%,40%)]/30'
                      : 'bg-card border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="flex items-center gap-3 cursor-pointer flex-1"
                      onClick={() => handleToggleDoc(doc.id, doc.status)}
                    >
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                        isReceived ? 'bg-[hsl(162,30%,40%)] text-white' : 'border border-input text-transparent hover:border-primary'
                      }`}>
                        <Check className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-xs text-foreground flex items-center gap-2">
                          {doc.document_name}
                          {doc.is_mandatory === 1 && (
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-semibold">
                              Required
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-0.5">
                          {isReceived ? (
                            <span className="text-[hsl(162,30%,35%)] font-medium">Received on {doc.received_date || 'Record'}</span>
                          ) : (
                            <span className="text-amber-600 font-medium">Pending submission</span>
                          )}
                          {doc.verified_by && (
                            <span className="text-[10px] text-muted-foreground">
                              • Verified by {doc.verified_by}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        className="btn btn-ghost text-xs !p-1.5 text-muted-foreground hover:text-foreground"
                        title={doc.notes ? 'Edit notes' : 'Add verification notes'}
                        onClick={() => {
                          if (isEditingNotes) {
                            setEditingDocId(null);
                          } else {
                            setEditingDocId(doc.id);
                            setEditingDocNotes(doc.notes || '');
                          }
                        }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        className={`btn text-xs !py-1 !px-2.5 ${isReceived ? 'btn-soft' : 'btn-primary'}`}
                        onClick={() => handleToggleDoc(doc.id, doc.status)}
                      >
                        {isReceived ? 'Mark Pending' : 'Mark Received'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost text-xs !p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete requirement"
                        onClick={() => handleDeleteDoc(doc.id, doc.document_name)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Notes display or inline editor */}
                  {isEditingNotes ? (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add verification notes, registration serial, or remarks..."
                        className="input !h-8 !text-xs flex-1"
                        value={editingDocNotes}
                        onChange={e => setEditingDocNotes(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-primary text-xs !py-1 !px-3"
                        onClick={() => handleSaveDocNotes(doc.id)}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost text-xs !py-1 !px-2"
                        onClick={() => setEditingDocId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : doc.notes ? (
                    <div className="mt-2 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-lg border border-border/50 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 shrink-0 text-primary mt-0.5" />
                      <span>{doc.notes}</span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtab 3: Household & Siblings */}
      {activeTab === 'family' && (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Household Linkage</div>
              <h3 className="text-base font-bold text-foreground">Family Record & Enrolled Siblings</h3>
            </div>
            <div className="flex items-center gap-2">
              {family ? (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('Unlink this student from the current household?')) {
                      handleQuickLinkHousehold(null);
                    }
                  }}
                  className="btn btn-ghost text-xs text-destructive hover:bg-destructive/10"
                >
                  Unlink Household
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLinkingFamily(true)}
                  className="btn btn-primary text-xs flex items-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Link Household / Sibling</span>
                </button>
              )}
            </div>
          </div>

          {isLinkingFamily && (
            <div className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
              <div className="text-xs font-semibold text-foreground">Select Household to Link</div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="select flex-1 min-w-[240px] text-xs"
                  value={selectedFamilyId}
                  onChange={e => setSelectedFamilyId(e.target.value)}
                >
                  <option value="">-- Choose Household --</option>
                  {families.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.household_name} ({f.family_code}) - {f.primary_guardian_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedFamilyId}
                  onClick={() => handleQuickLinkHousehold(selectedFamilyId)}
                  className="btn btn-primary text-xs !py-1.5"
                >
                  Confirm Link
                </button>
                <button
                  type="button"
                  onClick={() => { setIsLinkingFamily(false); setSelectedFamilyId(''); }}
                  className="btn btn-ghost text-xs !py-1.5"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {family ? (
            <div className="space-y-6">
              <div className="p-4 bg-muted/30 rounded-xl border border-border grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Household Title</div>
                  <div className="font-bold text-sm text-foreground">{family.household_name}</div>
                  <div className="font-mono text-muted-foreground mt-0.5">{family.family_code}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Primary Guardian</div>
                  <div className="font-semibold text-foreground">{family.primary_guardian_name}</div>
                  <div className="text-muted-foreground">{family.primary_phone} • {family.primary_email}</div>
                </div>
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Secondary Contact / Address</div>
                  <div className="text-foreground">{family.secondary_guardian_name || 'None listed'}</div>
                  <div className="text-muted-foreground leading-relaxed">{family.address || 'Address On Record'}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Household Siblings ({siblings.length})</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {siblings.map((sib: any) => {
                    const isCurrent = sib.id === app.id;
                    return (
                      <div
                        key={sib.id}
                        onClick={() => !isCurrent && onNavigateToStudent(sib.id)}
                        className={`p-3 rounded-xl border transition-all ${
                          isCurrent
                            ? 'bg-primary/5 border-primary/40'
                            : 'bg-card border-border hover:border-accent cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs text-foreground">{sib.first_name} {sib.last_name}</span>
                          <span className={`badge badge-${sib.status} !text-[10px]`}>{sib.status.replace('_', ' ')}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">{sib.grade_applying} • {sib.application_no}</div>
                        {isCurrent ? (
                          <div className="mt-2 text-[10px] font-mono text-primary font-semibold">● Current Dossier</div>
                        ) : (
                          <div className="mt-2 text-[10px] text-accent font-semibold flex items-center gap-1">
                            <span>Open Dossier</span> →
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground text-xs space-y-3">
              <p>This student is currently not linked to a unified Household account.</p>
              <button
                onClick={() => { setActiveTab('profile'); setIsEditingProfile(true); }}
                className="btn btn-soft text-xs"
              >
                Link to Household in Profile Tab
              </button>
            </div>
          )}
        </div>
      )}

      {/* Subtab 4: Financials & Billing */}
      {activeTab === 'financials' && (
        <div className="space-y-6">
          {/* Top Summary Balance Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider block mb-1">1. Gross Charges</span>
              <span className="font-mono font-bold text-base text-foreground block">{currency} {Number(financials.totalGross).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider block mb-1">2. Abatements</span>
              <span className="font-mono font-bold text-base text-primary block">-{currency} {Number(financials.discountTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider block mb-1">3. Net Expected</span>
              <span className="font-mono font-bold text-base text-foreground block">{currency} {Number(financials.expectedNet).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-wider block mb-1">4. Payments Credited</span>
              <span className="font-mono font-bold text-base text-primary block">{currency} {Number(financials.paidTotal).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-primary/40 bg-primary/5">
              <span className="text-[10px] font-mono font-semibold text-primary uppercase tracking-wider block mb-1">5. Outstanding Due</span>
              <span className={`font-mono font-bold text-base block ${financials.balanceDue > 0 ? 'text-destructive' : 'text-primary'}`}>
                {currency} {Number(financials.balanceDue).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenRecordIncome(app.id, financials.balanceDue > 0 ? financials.balanceDue : undefined)}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Record Fee Payment</span>
              </button>

              <button
                onClick={() => setShowAddScholarship(!showAddScholarship)}
                className="btn btn-soft text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>Apply Scholarship / Concession</span>
              </button>
            </div>

            <button
              onClick={() => onOpenStatementOfAccount(app.id)}
              className="btn btn-soft text-xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>Print Official Statement of Account</span>
            </button>
          </div>

          {/* Add Scholarship Form */}
          {showAddScholarship && (
            <form onSubmit={handleAddScholarship} className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
              <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Apply Institutional Fee Concession / Sibling Discount</div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Discount Title</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={schForm.title}
                    onChange={e => setSchForm({ ...schForm, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Discount Type</label>
                  <select
                    className="select"
                    value={schForm.discount_type}
                    onChange={e => setSchForm({ ...schForm, discount_type: e.target.value })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ({currency})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Value ({schForm.discount_type === 'percentage' ? '%' : currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    className="input font-mono"
                    value={schForm.value}
                    onChange={e => setSchForm({ ...schForm, value: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Justification</label>
                  <input
                    type="text"
                    required
                    className="input"
                    value={schForm.justification}
                    onChange={e => setSchForm({ ...schForm, justification: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddScholarship(false)} className="btn btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Save & Recalculate Balance</button>
              </div>
            </form>
          )}

          {/* Applied Scholarships & Fee Concessions Table */}
          <div className="panel p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fee Abatements & Concessions</div>
                <h4 className="text-sm font-bold text-foreground">Applied Scholarships & Institutional Discounts</h4>
              </div>
              <span className="badge badge-soft text-[10px] font-mono whitespace-nowrap">
                Total Abatements: -{currency} {Number(financials.discountTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="table-clean w-full">
                <thead>
                  <tr>
                    <th>Concession Title</th>
                    <th>Type</th>
                    <th>Discount Rate / Value</th>
                    <th>Justification / Reason</th>
                    <th>Approved By</th>
                    <th className="text-right w-24">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {financials.scholarships?.map((sch: any) => (
                    <tr key={sch.id}>
                      <td className="font-semibold text-xs text-foreground">{sch.title}</td>
                      <td className="text-xs">
                        <span className={`badge ${sch.discount_type === 'percentage' ? 'badge-primary' : 'badge-soft'} !text-[10px]`}>
                          {sch.discount_type === 'percentage' ? 'Percentage %' : 'Fixed Amount'}
                        </span>
                      </td>
                      <td className="mono font-bold text-xs text-primary">
                        {sch.discount_type === 'percentage'
                          ? `${sch.value}% off tuition`
                          : `${currency} ${Number(sch.value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="text-xs text-muted-foreground max-w-xs truncate">{sch.justification || 'Standard discount'}</td>
                      <td className="text-xs text-muted-foreground">{sch.approved_by || 'Admissions / Bursar'}</td>
                      <td className="text-right">
                        <button
                          type="button"
                          onClick={() => setScholarshipToDelete(sch)}
                          className="btn btn-ghost !h-7 !px-2 text-xs inline-flex items-center justify-center gap-1 text-destructive hover:bg-destructive/10 rounded-md leading-none"
                          title="Remove Scholarship / Concession"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!financials.scholarships || financials.scholarships.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                        No scholarships or fee concessions applied to this student account.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Itemized Payments History */}
          <div className="panel p-5">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Credited Payment Receipts</div>
            <div className="overflow-x-auto">
              <table className="table-clean w-full">
                <thead>
                  <tr>
                    <th>Receipt #</th>
                    <th>Date</th>
                    <th>Payment Method</th>
                    <th>Payer</th>
                    <th>Received By</th>
                    <th className="text-right">Amount</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {financials.payments?.map((p: any) => (
                    <tr key={p.id}>
                      <td className="font-mono font-semibold text-xs text-primary">{p.receipt_no}</td>
                      <td className="text-xs text-muted-foreground">{p.date}</td>
                      <td className="text-xs">{p.payment_method} {p.reference_no && `(${p.reference_no})`}</td>
                      <td className="text-xs font-medium text-foreground">{p.payer_name}</td>
                      <td className="text-xs text-muted-foreground">{p.received_by_staff_name}</td>
                      <td className="text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        +{currency} {Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right whitespace-nowrap">
                        {onOpenReceiptModal && (
                          <button
                            type="button"
                            onClick={() => onOpenReceiptModal(p.id)}
                            className="btn btn-soft !py-1 !px-2.5 text-[11px] inline-flex items-center gap-1.5 font-medium rounded-lg hover:text-primary transition-colors cursor-pointer"
                            title={`View or Print Receipt ${p.receipt_no}`}
                          >
                            <Printer className="w-3 h-3 text-muted-foreground" />
                            <span>Receipt</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {(!financials.payments || financials.payments.length === 0) && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                        No payments credited for this student yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Subtab 5: Installment Plans */}
      {activeTab === 'installments' && (
        <div className="panel p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Payment Structuring</div>
              <h3 className="text-base font-bold text-foreground">Tuition Installment Schedules</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Generate Plan:</span>
              <button
                onClick={() => handleGenerateInstallments('term')}
                className="btn btn-soft text-xs"
              >
                3-Term Schedule
              </button>
              <button
                onClick={() => handleGenerateInstallments('monthly')}
                className="btn btn-soft text-xs"
              >
                10-Month Schedule
              </button>
              <button
                onClick={() => handleGenerateInstallments('annual')}
                className="btn btn-soft text-xs"
              >
                Annual Lump Sum
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table-clean w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Installment Title</th>
                  <th>Due Date</th>
                  <th>Amount Due</th>
                  <th>Amount Paid</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {installments.map(inst => (
                  <tr key={inst.id}>
                    <td className="font-mono text-xs text-muted-foreground">{inst.installment_number}</td>
                    <td className="font-semibold text-xs text-foreground">{inst.title}</td>
                    <td className="font-mono text-xs">{inst.due_date}</td>
                    <td className="font-mono text-xs font-bold">{currency} {Number(inst.amount_due).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-semibold">{currency} {Number(inst.amount_paid).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    <td>
                      <span className={`badge ${
                        inst.status === 'Paid' ? 'badge-accepted' : inst.status === 'Overdue' ? 'badge-declined' : 'badge-applied'
                      }`}>
                        {inst.status}
                      </span>
                    </td>
                    <td className="text-right">
                      {inst.status !== 'Paid' && (
                        <button
                          onClick={() => onOpenRecordIncome(app.id, inst.amount_due - inst.amount_paid)}
                          className="btn btn-soft !py-1 !px-2 text-xs"
                        >
                          Record Settlement
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {installments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                      No active installment schedule configured. Click one of the generator buttons above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 6: Medical & Dietary */}
      {activeTab === 'medical' && (
        <div className="panel p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Health & Safety Protocols</div>
              <h3 className="text-base font-bold text-foreground">Medical Records & Dietary Requirements</h3>
            </div>
          </div>

          <form onSubmit={handleSaveMedical} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Blood Group</label>
                <select
                  className="select"
                  value={medicalForm.blood_group}
                  onChange={e => setMedicalForm({ ...medicalForm, blood_group: e.target.value })}
                >
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="Unknown">Unknown</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Known Allergies & Triggers</label>
                <input
                  type="text"
                  placeholder="e.g. Peanuts, Penicillin, Bee stings"
                  className="input"
                  value={medicalForm.allergies}
                  onChange={e => setMedicalForm({ ...medicalForm, allergies: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Dietary Requirements</label>
                <input
                  type="text"
                  placeholder="e.g. Halal, Strict Vegetarian, Lactose Intolerant"
                  className="input"
                  value={medicalForm.dietary_needs}
                  onChange={e => setMedicalForm({ ...medicalForm, dietary_needs: e.target.value })}
                />
              </div>
            </div>

            <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Emergency Protocol Contacts</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Victoria Vance"
                    className="input"
                    value={medicalForm.emergency_contact}
                    onChange={e => setMedicalForm({ ...medicalForm, emergency_contact: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. +1 (555) 019-9922"
                    className="input"
                    value={medicalForm.emergency_phone}
                    onChange={e => setMedicalForm({ ...medicalForm, emergency_phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Relationship</label>
                  <input
                    type="text"
                    placeholder="e.g. Maternal Aunt"
                    className="input"
                    value={medicalForm.emergency_relationship}
                    onChange={e => setMedicalForm({ ...medicalForm, emergency_relationship: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Primary Family Physician</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Robert Chen, MD"
                  className="input"
                  value={medicalForm.physician_name}
                  onChange={e => setMedicalForm({ ...medicalForm, physician_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Physician Phone</label>
                <input
                  type="tel"
                  placeholder="e.g. +1 (555) 441-2911"
                  className="input"
                  value={medicalForm.physician_phone}
                  onChange={e => setMedicalForm({ ...medicalForm, physician_phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Special Nursing / Care Notes</label>
              <textarea
                className="textarea !h-20"
                placeholder="Inhaler stored in infirmary, EpiPen protocols..."
                value={medicalForm.care_notes}
                onChange={e => setMedicalForm({ ...medicalForm, care_notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" className="btn btn-primary flex items-center gap-1.5 text-xs">
                <Save className="w-3.5 h-3.5" />
                <span>Save Medical Record</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subtab 7: Communications Log */}
      {activeTab === 'comms' && (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Guardian Engagement</div>
              <h3 className="text-base font-bold text-foreground">Communications Log & Outreach History</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenCommunications({
                  applicant_id: app.id,
                  family_id: app.family_id || undefined,
                  student_name: `${app.first_name} ${app.last_name}`,
                  guardian_name: app.guardian_name,
                  guardian_phone: app.guardian_phone,
                  guardian_email: app.guardian_email,
                  grade: app.grade_applying,
                  balance_due: financials.balanceDue,
                })}
                className="btn btn-primary text-xs flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Draft Guardian Notice</span>
              </button>
              <button
                onClick={() => setShowAddComm(!showAddComm)}
                className="btn btn-soft text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Log Activity</span>
              </button>
            </div>
          </div>

          {showAddComm && (
            <form onSubmit={handleAddCommunication} className="p-4 bg-muted/40 rounded-xl border border-border space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Contact Method</label>
                  <select
                    className="select"
                    value={commForm.contact_type}
                    onChange={e => setCommForm({ ...commForm, contact_type: e.target.value })}
                  >
                    <option value="Call">Phone Call</option>
                    <option value="Meeting">In-Person Meeting</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Notice">Official Notice</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Date</label>
                  <input
                    type="date"
                    required
                    className="input"
                    value={commForm.date}
                    onChange={e => setCommForm({ ...commForm, date: e.target.value })}
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold mb-1">Summary / Discussion Points</label>
                  <textarea
                    required
                    className="textarea !h-20"
                    placeholder="Discussed placement assessment results with parent..."
                    value={commForm.summary}
                    onChange={e => setCommForm({ ...commForm, summary: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddComm(false)} className="btn btn-ghost text-xs">Cancel</button>
                <button type="submit" className="btn btn-primary text-xs">Save Log Entry</button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {comms.map(comm => (
              <div key={comm.id} className="p-3.5 rounded-xl bg-card border border-border space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-muted font-mono font-bold text-[10px] text-primary">
                      {comm.contact_type}
                    </span>
                    <span>Logged by {comm.staff_name}</span>
                  </span>
                  <span className="font-mono text-muted-foreground">{comm.date}</span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed pt-1">{comm.summary}</p>
              </div>
            ))}
            {comms.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No communications logged for this applicant yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Subtab 8: Audit Trail & Activity Timeline */}
      {activeTab === 'timeline' && (
        <div className="panel p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <div className="text-[10px] font-semibold text-primary uppercase tracking-wider">Compliance & History</div>
              <h3 className="text-base font-bold text-foreground">Lifecycle Audit Log & Event Timeline</h3>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {timelineLogs.length} events recorded
            </span>
          </div>

          <div className="space-y-3">
            {timelineLogs.map((log: any) => (
              <div key={log.id} className="p-3.5 rounded-xl bg-card border border-border flex items-start gap-3 transition-colors hover:bg-muted/30">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-muted font-mono text-[10px] text-muted-foreground">
                        {log.entity}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Recent'}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/90 mt-1 leading-relaxed">{log.message}</p>
                  <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                    <span>Officer:</span>
                    <span className="font-semibold text-foreground/80">{log.staff_name}</span>
                  </div>
                </div>
              </div>
            ))}

            {timelineLogs.length === 0 && (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-1">
                <History className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-medium text-foreground">No audit entries found</p>
                <p>Status updates, document approvals, and notes will automatically populate this lifecycle log.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Scholarship / Concession Confirmation Modal */}
      <ConfirmDialogModal
        isOpen={!!scholarshipToDelete}
        onClose={() => setScholarshipToDelete(null)}
        onConfirm={handleConfirmDeleteScholarship}
        title="Remove Fee Concession / Scholarship"
        message={`Are you sure you want to remove the "${scholarshipToDelete?.title}" concession from ${app.first_name} ${app.last_name}'s account?`}
        confirmText="Remove Concession"
        variant="danger"
        isConfirming={isDeletingScholarship}
        warningDetails={[
          `Discount Value: ${scholarshipToDelete?.discount_type === 'percentage' ? `${scholarshipToDelete?.value}% off standard tuition` : `${currency} ${Number(scholarshipToDelete?.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} fixed`}`,
          'Removing this concession will immediately increase the net tuition expected and student outstanding balance due.',
          'Any active installment plans will need to be re-evaluated to adjust for the revised net tuition.',
          'This removal will be recorded permanently in the staff audit trail.',
        ]}
      />
    </div>
  );
};
