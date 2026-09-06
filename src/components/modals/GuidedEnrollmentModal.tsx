import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll';
import { useStaff } from '../../context/StaffContext';
import { useNotification } from '../../context/NotificationContext';
import { Family } from '../../types';
import { soundManager } from '../common/AudioFeedback';
import {
  X,
  GraduationCap,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  User,
  Home,
  Receipt,
  FileCheck,
  Award,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

interface GuidedEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (applicantId: string) => void;
}

export const GuidedEnrollmentModal: React.FC<GuidedEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { getHeaders, activeStaff } = useStaff();
  const { showToast } = useNotification();

  const [step, setStep] = useState<number>(1);
  const [families, setFamilies] = useState<Family[]>([]);
  const [settings, setSettings] = useState<any>({});
  const currency = settings.currency_symbol || 'LKR';
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Student
    first_name: '',
    last_name: '',
    dob: '2019-06-15',
    gender: 'Male',
    grade_applying: 'Grade 1',
    academic_year: '2026-2027',
    blood_group: 'O+',
    allergies: '',
    // Step 2: Household & Guardian
    family_id: '',
    guardian_name: '',
    guardian_relationship: 'Father',
    guardian_phone: '',
    guardian_email: '',
    address: 'Matara, Southern Province',
    emergency_contact: '',
    emergency_phone: '',
    emergency_relationship: 'Mother',
    // Step 3: Financial & Abatement
    baseTuition: 45000,
    scholarshipTitle: '',
    scholarshipType: 'percentage' as 'percentage' | 'fixed',
    scholarshipValue: 0,
    scholarshipJustification: '',
    // Step 4: Documents
    docsChecked: {
      birth_cert: true,
      transcripts: false,
      immunization: true,
      recommendation: false,
      photos: true,
    },
    // Final
    enrollImmediately: true,
  });

  // Inline Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetch('/api/settings')
        .then((res) => res.json())
        .then((data) => setSettings(data || {}))
        .catch(() => {});

      fetch('/api/families')
        .then((res) => res.json())
        .then((data) => setFamilies(data || []))
        .catch((err) => console.error(err));

      // Restore saved enrollment draft if exists
      const saved = localStorage.getItem('elite_guided_enroll_draft');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFormData(parsed);
        } catch (e) {}
      }
    }
  }, [isOpen]);

  // Auto-save draft
  useEffect(() => {
    if (isOpen && (formData.first_name || formData.last_name || formData.guardian_name)) {
      localStorage.setItem('elite_guided_enroll_draft', JSON.stringify(formData));
    }
  }, [formData, isOpen]);

  // Dynamic Tuition Estimator based on Grade
  useEffect(() => {
    const grade = formData.grade_applying;
    let cost = 45000;
    if (grade === 'Kindergarten' || grade === 'Nursery') cost = 38000;
    else if (grade.includes('Grade 6') || grade.includes('Grade 7') || grade.includes('Grade 8')) cost = 52000;
    else if (grade.includes('Grade 9') || grade.includes('Grade 10')) cost = 60000;
    else if (grade.includes('Grade 11') || grade.includes('Grade 12')) cost = 75000;
    setFormData((prev) => ({ ...prev, baseTuition: cost }));
  }, [formData.grade_applying]);

  const handleFamilyChange = (famId: string) => {
    const fam = families.find((f) => f.id === famId);
    if (fam) {
      setFormData((prev) => ({
        ...prev,
        family_id: famId,
        guardian_name: prev.guardian_name || fam.primary_guardian_name,
        guardian_phone: prev.guardian_phone || fam.primary_phone,
        guardian_email: prev.guardian_email || fam.primary_email,
        address: prev.address || fam.address,
      }));
    } else {
      setFormData((prev) => ({ ...prev, family_id: '' }));
    }
  };

  const validateStep = (currentStep: number): boolean => {
    const errs: Record<string, string> = {};
    if (currentStep === 1) {
      if (!formData.first_name.trim()) errs.first_name = 'First name is required';
      if (!formData.last_name.trim()) errs.last_name = 'Last name is required';
      if (!formData.dob) errs.dob = 'Date of birth is required';
    } else if (currentStep === 2) {
      if (!formData.guardian_name.trim()) errs.guardian_name = 'Guardian name is required';
      if (!formData.guardian_phone.trim()) errs.guardian_phone = 'Guardian phone is required';
      else if (formData.guardian_phone.length < 8) errs.guardian_phone = 'Please enter a valid phone number';
      if (formData.guardian_email && !formData.guardian_email.includes('@')) {
        errs.guardian_email = 'Invalid email address format';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(5, prev + 1));
    }
  };

  const prevStep = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleCompleteEnrollment = async () => {
    if (!validateStep(1) || !validateStep(2)) {
      showToast('Please check required student and guardian information.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create applicant record
      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        dob: formData.dob,
        gender: formData.gender,
        grade_applying: formData.grade_applying,
        academic_year: formData.academic_year,
        status: formData.enrollImmediately ? 'enrolled' : 'accepted',
        guardian_name: formData.guardian_name,
        guardian_phone: formData.guardian_phone,
        guardian_email: formData.guardian_email,
        guardian_relationship: formData.guardian_relationship,
        address: formData.address,
        family_id: formData.family_id || null,
        blood_group: formData.blood_group,
        allergies: formData.allergies,
        emergency_contact: formData.emergency_contact || formData.guardian_name,
        emergency_phone: formData.emergency_phone || formData.guardian_phone,
        emergency_relationship: formData.emergency_relationship,
        notes: `Enrolled via Guided Onboarding Wizard by ${activeStaff?.name || 'Registrar'}.`,
      };

      const res = await fetch('/api/applicants', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create student record');
      }

      const applicantId = data.id;

      // 2. If scholarship or fee discount was added, record it
      if (formData.scholarshipValue > 0 && formData.scholarshipTitle) {
        await fetch(`/api/applicants/${applicantId}/scholarships`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify({
            title: formData.scholarshipTitle,
            discount_type: formData.scholarshipType,
            value: Number(formData.scholarshipValue),
            justification: formData.scholarshipJustification || 'Granted during initial enrollment',
            approved_by: activeStaff?.name || 'Admissions Board',
          }),
        });
      }

      // Play joyful celebration sound
      soundManager.playCelebrationChime();

      // Clear draft
      localStorage.removeItem('elite_guided_enroll_draft');

      showToast(
        `🎉 Successfully enrolled ${formData.first_name} ${formData.last_name} (${data.application_no})!`,
        'success'
      );

      onSuccess(applicantId);
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Error executing enrollment', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  useLockBodyScroll(isOpen);

  if (!isOpen) return null;

  const netTuition =
    formData.scholarshipValue > 0
      ? formData.scholarshipType === 'percentage'
        ? formData.baseTuition * (1 - formData.scholarshipValue / 100)
        : Math.max(0, formData.baseTuition - formData.scholarshipValue)
      : formData.baseTuition;

  const stepsList = [
    { num: 1, label: 'Student', icon: User },
    { num: 2, label: 'Family', icon: Home },
    { num: 3, label: 'Fees & Abatements', icon: Receipt },
    { num: 4, label: 'Documents', icon: FileCheck },
    { num: 5, label: 'Review & Enroll', icon: Award },
  ];

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal !max-w-3xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider font-semibold text-primary">
                Task-Oriented Workflow
              </div>
              <h3 className="font-serif font-bold text-lg text-foreground">
                Enroll a New Student
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="grid grid-cols-5 gap-1 mb-6 bg-muted/40 p-1 rounded-xl border border-border/60">
          {stepsList.map((s) => {
            const Icon = s.icon;
            const isDone = step > s.num;
            const isCurrent = step === s.num;
            return (
              <button
                key={s.num}
                onClick={() => setStep(s.num)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-card text-foreground shadow-2xs font-semibold'
                    : isDone
                    ? 'text-primary'
                    : 'text-muted-foreground/60'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>

        {/* STEP 1: Student Information */}
        {step === 1 && (
          <div className="space-y-4 animate-fade">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <User className="w-4 h-4 text-primary" />
              <span>Step 1: Student Demographics & Academic Placement</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  First Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  className={`input ${errors.first_name ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. Liam"
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
                {errors.first_name && (
                  <span className="text-[10px] text-destructive mt-1 block">{errors.first_name}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Last Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  className={`input ${errors.last_name ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. Jayawardena"
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
                {errors.last_name && (
                  <span className="text-[10px] text-destructive mt-1 block">{errors.last_name}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Date of Birth <span className="text-destructive">*</span>
                </label>
                <input
                  type="date"
                  className="input"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Gender</label>
                <select
                  className="select"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Grade Applying
                </label>
                <select
                  className="select"
                  value={formData.grade_applying}
                  onChange={(e) => setFormData({ ...formData, grade_applying: e.target.value })}
                >
                  <option value="Kindergarten">Kindergarten</option>
                  <option value="Grade 1">Grade 1 (Standard Primary)</option>
                  <option value="Grade 2">Grade 2</option>
                  <option value="Grade 3">Grade 3</option>
                  <option value="Grade 4">Grade 4</option>
                  <option value="Grade 5">Grade 5</option>
                  <option value="Grade 6">Grade 6</option>
                  <option value="Grade 7">Grade 7 (Middle School)</option>
                  <option value="Grade 8">Grade 8</option>
                  <option value="Grade 9">Grade 9</option>
                  <option value="Grade 10">Grade 10</option>
                  <option value="Grade 11">Grade 11</option>
                  <option value="Grade 12">Grade 12</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Academic Year
                </label>
                <input
                  type="text"
                  className="input"
                  value={formData.academic_year}
                  onChange={(e) => setFormData({ ...formData, academic_year: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-border/50">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Blood Group</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. O+, A+, B+"
                  value={formData.blood_group}
                  onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Medical / Allergies</label>
                <input
                  type="text"
                  className="input"
                  placeholder="None / Asthmatic / Peanut allergy"
                  value={formData.allergies}
                  onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Household & Guardian */}
        {step === 2 && (
          <div className="space-y-4 animate-fade">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Home className="w-4 h-4 text-primary" />
                <span>Step 2: Household & Parent Contacts</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">Existing Family?</span>
                <select
                  className="select !h-7 !py-0 !text-xs !w-44"
                  value={formData.family_id}
                  onChange={(e) => handleFamilyChange(e.target.value)}
                >
                  <option value="">-- New Household --</option>
                  {families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.household_name} ({f.family_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Primary Guardian Name <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  className={`input ${errors.guardian_name ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. Dr. Sunil Jayawardena"
                  value={formData.guardian_name}
                  onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                />
                {errors.guardian_name && (
                  <span className="text-[10px] text-destructive mt-1 block">{errors.guardian_name}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Relationship</label>
                <select
                  className="select"
                  value={formData.guardian_relationship}
                  onChange={(e) => setFormData({ ...formData, guardian_relationship: e.target.value })}
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Legal Guardian</option>
                  <option value="Grandparent">Grandparent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Phone Number <span className="text-destructive">*</span>
                </label>
                <input
                  type="tel"
                  className={`input ${errors.guardian_phone ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. 077 123 4567"
                  value={formData.guardian_phone}
                  onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                />
                {errors.guardian_phone && (
                  <span className="text-[10px] text-destructive mt-1 block">{errors.guardian_phone}</span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Email Address</label>
                <input
                  type="email"
                  className={`input ${errors.guardian_email ? 'border-destructive ring-1 ring-destructive' : ''}`}
                  placeholder="e.g. parent@example.com"
                  value={formData.guardian_email}
                  onChange={(e) => setFormData({ ...formData, guardian_email: e.target.value })}
                />
                {errors.guardian_email && (
                  <span className="text-[10px] text-destructive mt-1 block">{errors.guardian_email}</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Residential Address</label>
              <input
                type="text"
                className="input"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* STEP 3: Fees & Abatements */}
        {step === 3 && (
          <div className="space-y-4 animate-fade">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-primary" />
              <span>Step 3: Tuition Schedule & Sibling/Scholarship Abatements</span>
            </div>

            {/* Live Fee Calculator Card */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Standard Tuition for {formData.grade_applying}:</span>
                <span className="font-mono font-bold text-foreground">
                  {currency} {formData.baseTuition.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-border/50">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Grant Scholarship / Discount
                  </label>
                  <input
                    type="text"
                    className="input !text-xs"
                    placeholder="e.g. Sibling Discount (10%)"
                    value={formData.scholarshipTitle}
                    onChange={(e) => setFormData({ ...formData, scholarshipTitle: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Discount Type
                  </label>
                  <select
                    className="select !text-xs"
                    value={formData.scholarshipType}
                    onChange={(e) => setFormData({ ...formData, scholarshipType: e.target.value as any })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ({currency})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Discount Value
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input !text-xs"
                    placeholder={formData.scholarshipType === 'percentage' ? 'e.g. 10' : 'e.g. 5000'}
                    value={formData.scholarshipValue || ''}
                    onChange={(e) => setFormData({ ...formData, scholarshipValue: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between text-xs">
                <span className="font-semibold text-primary">Expected Annual Net Receivable:</span>
                <span className="font-mono font-bold text-base text-primary">
                  {currency} {netTuition.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Documents Checklist */}
        {step === 4 && (
          <div className="space-y-4 animate-fade">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-primary" />
              <span>Step 4: Admission Credentials & Physical Documents Checklist</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Check off any physical documents received at the registration counter today:
            </p>

            <div className="space-y-2">
              {[
                { id: 'birth_cert', label: 'Official Birth Certificate (Certified Copy)' },
                { id: 'photos', label: 'Student Passport Photographs (2 copies)' },
                { id: 'immunization', label: 'Official Immunization & Health Record' },
                { id: 'transcripts', label: 'Previous Academic Transcripts / Term Reports' },
                { id: 'recommendation', label: 'Confidential Teacher Recommendation Form' },
              ].map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:bg-muted/40 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={(formData.docsChecked as any)[doc.id]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        docsChecked: { ...formData.docsChecked, [doc.id]: e.target.checked },
                      })
                    }
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span className="text-xs font-medium text-foreground">{doc.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: Final Review & Enrollment Confirmation */}
        {step === 5 && (
          <div className="space-y-4 animate-fade">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Award className="w-4 h-4 text-primary" />
              <span>Step 5: Final Summary & Official Enrollment</span>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground block">Student</span>
                  <span className="font-semibold text-foreground">{formData.first_name} {formData.last_name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground block">Placement</span>
                  <span className="font-semibold text-foreground">{formData.grade_applying}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground block">Guardian</span>
                  <span className="font-semibold text-foreground">{formData.guardian_name}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-muted-foreground block">Phone</span>
                  <span className="font-mono text-foreground">{formData.guardian_phone}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 block">
                    Total Net Tuition Charge
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formData.scholarshipTitle ? `With ${formData.scholarshipTitle}` : 'Standard Grade Schedule'}
                  </span>
                </div>
                <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400">
                  {currency} {netTuition.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/30 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.enrollImmediately}
                onChange={(e) => setFormData({ ...formData, enrollImmediately: e.target.checked })}
                className="w-4 h-4 accent-primary rounded"
              />
              <div>
                <span className="text-xs font-semibold text-primary block">
                  Officially stamp as 'Enrolled' student immediately
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Generates student register number and adds to official school roll
                </span>
              </div>
            </label>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1 || isSubmitting}
            className="btn btn-ghost text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            {step < 5 ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn btn-primary text-xs py-2 px-4 rounded-lg flex items-center gap-1.5 shadow-xs"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteEnrollment}
                disabled={isSubmitting}
                className="btn btn-primary text-xs py-2 px-5 rounded-lg flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Enrolling...' : 'Complete & Enroll Student'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
